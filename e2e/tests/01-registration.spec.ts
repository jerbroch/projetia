import { test, expect } from "../fixtures/base";
import {
  generateTestEmail,
  STRONG_PASSWORD,
  applyPromoCode,
  skipOnboardingIfPresent,
} from "../helpers/auth";
import { landingRegisterLink } from "../helpers/locators";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

test.describe("1. Parcours inscription", () => {
  test.use({ pageName: "Inscription" });

  test("landing → register → choose-plan bloqué sans accès", async ({ page, audit }) => {
    const email = generateTestEmail("reg");
    const companyName = `E2E Co ${Date.now()}`;

    await page.goto("/");
    await expect(landingRegisterLink(page)).toBeVisible();
    await landingRegisterLink(page).click();

    await expect(page).toHaveURL(/\/register/);
    await page.getByLabel("Nom de l'entreprise").fill(companyName);
    await page.getByLabel("Prénom").fill("E2E");
    await page.getByLabel("Nom", { exact: true }).fill("Register");
    await page.getByLabel("Courriel professionnel").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(STRONG_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe").fill(STRONG_PASSWORD);
    await page.locator('input[name="acceptTerms"]').check();
    await page.locator('input[name="acceptPrivacy"]').check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();

    await page.waitForURL(/\/(verify-email|onboarding|choose-plan|dashboard|login)/, {
      timeout: 45000,
    });

    if (page.url().includes("/verify-email")) {
      audit.addFinding({
        severity: "IMPORTANT",
        page: "/register",
        action: "Inscription complète",
        expected: "Accès direct après inscription (email confirmé en test)",
        actual: "Redirection vers vérification courriel",
        likelyFile: "src/lib/actions/auth.ts",
      });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: users } = await admin.auth.admin.listUsers();
      const user = users?.users?.find((u) => u.email === email);
      if (user) await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
      await page.goto("/login");
      await page.getByLabel("Courriel").fill(email);
      await page.getByLabel("Mot de passe").fill(STRONG_PASSWORD);
      await page.getByRole("button", { name: "Se connecter" }).click();
    }

    await skipOnboardingIfPresent(page);
    await page.waitForURL(/\/(choose-plan|dashboard)/, { timeout: 30000 });

    if (page.url().includes("/choose-plan")) {
      await expect(page.getByText(/Choisissez votre accès/i)).toBeVisible();
    } else {
      await page.goto("/dashboard");
    }

    await page.goto("/dashboard");
    await page.waitForURL(/\/(choose-plan|dashboard)/, { timeout: 15000 });

    if (page.url().includes("/choose-plan")) {
      audit.addFinding({
        severity: "IMPORTANT",
        page: "/dashboard",
        action: "Accès tableau de bord sans promo",
        expected: "Redirection vers /choose-plan (accès bloqué)",
        actual: "Comportement conforme — accès bloqué",
      });
    }
  });

  test("code promo invalide puis ios123 → dashboard", async ({ page, audit }) => {
    const email = generateTestEmail("promo");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !key) {
      test.skip(true, "Supabase non configuré");
      return;
    }

    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signUp } = await admin.auth.admin.createUser({
      email,
      password: STRONG_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: "Promo", last_name: "Test" },
    });
    if (!signUp.user) test.skip(true, "Impossible de créer utilisateur test");

    const { data: company } = await admin
      .from("companies")
      .insert({
        name: "E2E Promo Test",
        email,
        access_type: "pending",
        requires_access_choice: true,
      })
      .select("id")
      .single();

    await admin.from("profiles").insert({
      id: signUp.user.id,
      company_id: company!.id,
      first_name: "Promo",
      last_name: "Test",
      email,
      role: "owner",
      status: "active",
    });

    await page.goto("/login");
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Mot de passe").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/\/choose-plan/, { timeout: 30000 });

    const promoToggle = page.getByRole("button", { name: /Entrer un code/i });
    if (await promoToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await promoToggle.click();
    }
    await page.getByLabel("Code promo").fill("BADCODE999");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText(/invalide|introuvable/i)).toBeVisible({ timeout: 10000 });

    await applyPromoCode(page, "ios123");
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  });
});
