import type { Page } from "@playwright/test";
import { readTestCredentials } from "./test-data";

export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/**
 * CONNEXION DU LOCATAIRE, ATTENTE COMPRISE.
 *
 * `loginWithCredentials` remplit et clique, sans attendre : appeler `goto`
 * juste après tombe sur la page de connexion encore affichée. C'est ce que
 * faisaient les specs 23 et 24b, et le rapport d'intégration continue montrait
 * bien « Bienvenue sur ConstructionIOS » à la place de /quotes.
 *
 * Et pas de `storageState` pour ces specs-là : la suite complète dure près de
 * cinquante minutes, ils tournent à la fin, et l'état de session écrit par
 * `auth.setup` au début n'est plus valable à ce moment. On se connecte quand
 * on en a besoin.
 */
export async function connexionLocataire(page: Page): Promise<void> {
  const creds = readTestCredentials();
  await loginWithCredentials(page, creds.tenantEmail, creds.tenantPassword);
  await attendreDestination(page, /\/(dashboard|choose-plan|onboarding)/, 60000);
  await ensureDashboardAccess(page);
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

/**
 * ATTENDRE UNE DESTINATION, MÊME APRÈS UN RECHARGEMENT COMPLET.
 *
 * La connexion navigue par `window.location.assign` : c'est la seule
 * navigation qui atteigne `/terrain`, que le middleware traite à part et que
 * le routeur client abandonnait en silence. Mais un rechargement complet
 * détache la frame, et un `waitForURL` démarré pile à ce moment lève
 * `net::ERR_ABORTED; maybe frame was detached?` — l'attente est emportée par
 * la navigation qu'elle attendait.
 *
 * On réessaie donc une fois : au second tour, la navigation est déjà partie
 * et l'attente s'accroche à la bonne page. Ce n'est pas une tolérance à
 * l'échec — si la destination n'arrive pas, le second essai échoue aussi.
 */
export async function attendreDestination(
  page: Page,
  motif: RegExp,
  timeout = 30000,
): Promise<void> {
  try {
    await page.waitForURL(motif, { timeout });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    if (!message.includes("ERR_ABORTED") && !message.includes("frame was detached")) throw erreur;
    await page.waitForURL(motif, { timeout });
  }
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
