import { test, expect, tenantAuth, assertNoHorizontalOverflow } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";

const MOBILE_ROUTES = [
  { path: "/dashboard", label: "Tableau de bord" },
  { path: "/customers", label: "Clients" },
  { path: "/schedule", label: "Calendrier" },
  { path: "/quotes", label: "Soumissions" },
  { path: "/invoices", label: "Factures" },
];

test.describe("9. Mobile viewport", () => {
  test.use({ storageState: tenantAuth, pageName: "Mobile" });

  test("login page mobile", async ({ browser, audit }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto("/login");
    await assertNoHorizontalOverflow(page);
    await expect(page.getByLabel("Courriel")).toBeVisible({ timeout: 15000 });
    const loginBtn = page.getByRole("button", { name: "Se connecter", exact: true });
    await expect(loginBtn).toBeVisible({ timeout: 15000 });
    const box = await loginBtn.boundingBox();
    if (!box || box.width < 44) {
      audit.addFinding({
        severity: "MINEUR",
        page: "/login",
        action: "Bouton connexion accessible mobile",
        expected: "Cible tactile ≥ 44px",
        actual: `Largeur: ${box?.width ?? 0}px`,
        likelyFile: "src/components/auth/login-form.tsx",
      });
    }
    await context.close();
  });

  for (const route of MOBILE_ROUTES) {
    test(`${route.label} — pas de débordement horizontal`, async ({ page, audit }) => {
      test.setTimeout(route.path === "/invoices" ? 180_000 : 90_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);
      await ensureDashboardAccess(page);
      if (!page.url().includes(route.path.split("/")[1] ?? route.path)) {
        await page.goto(route.path);
      }

      try {
        await assertNoHorizontalOverflow(page);
      } catch {
        audit.addFinding({
          severity: "MINEUR",
          page: route.path,
          action: "Overflow horizontal mobile",
          expected: "Pas de scroll horizontal",
          actual: "scrollWidth > clientWidth",
          likelyFile: "src/components/layout/dashboard-layout.tsx",
        });
      }

      const menuBtn = page.getByRole("button", { name: /menu/i });
      if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuBtn.click();
        await expect(page.getByRole("link", { name: route.label })).toBeVisible({ timeout: 5000 });
      }
    });
  }
});
