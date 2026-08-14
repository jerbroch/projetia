import type { Page } from "@playwright/test";

export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function loginAsDemo(page: Page): Promise<void> {
  await page.goto("/login");
  const demoBtn = page.getByRole("button", { name: /démonstration|demo/i });
  if (await demoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await demoBtn.click();
    await page.waitForURL(/\/(dashboard|choose-plan|onboarding)/, { timeout: 30000 });
    return;
  }
  throw new Error("Demo login button not visible — set DEMO_LOGIN_ENABLED=true");
}

export async function applyPromoCode(page: Page, code: string): Promise<void> {
  await page.waitForURL(/\/choose-plan/, { timeout: 15000 }).catch(() => {});
  if (!page.url().includes("/choose-plan")) return;

  const promoToggle = page.getByRole("button", { name: /Entrer un code|code promo/i });
  if (await promoToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await promoToggle.click();
  }

  await page.getByLabel("Code promo").fill(code);
  await page.getByRole("button", { name: "Valider" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
}

export async function skipOnboardingIfPresent(page: Page): Promise<void> {
  if (page.url().includes("/onboarding")) {
    for (let i = 0; i < 5; i++) {
      const skip = page.getByRole("button", { name: /Passer|Skip/i });
      const finish = page.getByRole("button", { name: /Terminer|Commencer|Accéder/i });
      if (await finish.isVisible({ timeout: 2000 }).catch(() => false)) {
        await finish.click();
        break;
      }
      if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skip.click();
      } else {
        break;
      }
    }
    await page.waitForURL(/\/(dashboard|choose-plan)/, { timeout: 15000 }).catch(() => {});
  }
}

export async function ensureDashboardAccess(page: Page): Promise<void> {
  await skipOnboardingIfPresent(page);
  if (page.url().includes("/choose-plan")) {
    await applyPromoCode(page, "ios123");
  }
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
}

export function generateTestEmail(prefix = "e2e"): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}+${ts}${rand}@e2e.constructionios.test`;
}

export const STRONG_PASSWORD = "TestE2ePass123!";
