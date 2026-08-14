import { test, expect, tenantAuth, assertPageLoadsWithout500 } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { landingLoginLink, landingRegisterLink } from "../helpers/locators";

const SIDEBAR_LINKS = [
  { href: "/dashboard", name: "Tableau de bord" },
  { href: "/customers", name: "Clients" },
  { href: "/quotes", name: "Soumissions" },
  { href: "/invoices", name: "Factures" },
  { href: "/schedule", name: "Calendrier" },
  { href: "/archives", name: "Archives" },
  { href: "/employees", name: "Employés" },
  { href: "/payments", name: "Paiements" },
  { href: "/settings", name: "Paramètres" },
];

test.describe("10. Navigation", () => {
  test.use({ storageState: tenantAuth, pageName: "Navigation" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await ensureDashboardAccess(page);
  });

  for (const link of SIDEBAR_LINKS) {
    test(`sidebar → ${link.name}`, async ({ page, audit }) => {
      await page.goto("/dashboard");
      await ensureDashboardAccess(page);

      const navLink = page.getByRole("navigation").getByRole("link", { name: link.name });
      await expect(navLink).toBeVisible({ timeout: 10000 });
      await navLink.click();

      await page.waitForURL(new RegExp(link.href.replace("/", "\\/")), {
        timeout: 30000,
        waitUntil: "domcontentloaded",
      });
      expect(page.url()).toContain(link.href);

      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible({ timeout: 10000 });
      await expect(title).toContainText(link.name);

      const responses: number[] = [];
      page.on("response", (r) => {
        if (r.url().includes("localhost:3000") && r.status() >= 500) {
          responses.push(r.status());
        }
      });

      if (responses.length > 0) {
        audit.addFinding({
          severity: "IMPORTANT",
          page: link.href,
          action: `Navigation sidebar → ${link.name}`,
          expected: "Pas de 500",
          actual: `HTTP ${responses.join(", ")}`,
          likelyFile: `src/app/(dashboard)${link.href}/page.tsx`,
        });
      }
    });
  }

  test("landing page links", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/");
    await expect(landingLoginLink(page)).toBeVisible();
    await expect(landingRegisterLink(page)).toBeVisible();
    await context.close();
  });

  test("routes invalides — pas de crash serveur", async ({ page, audit }) => {
    const resp = await page.goto("/route-inexistante-e2e");
    const status = resp?.status() ?? 0;
    if (status >= 500) {
      audit.addFinding({
        severity: "IMPORTANT",
        page: "/route-inexistante-e2e",
        action: "404 graceful",
        expected: "404 sans 500",
        actual: `HTTP ${status}`,
        likelyFile: "src/app/not-found.tsx",
      });
    }
    expect(status).toBeLessThan(500);
  });
});
