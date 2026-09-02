import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess, loginWithCredentials } from "../helpers/auth";
import {
  cleanupFieldEmployeeTestData,
  createE2EAdmin,
  setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

const PHOTO = path.resolve(__dirname, "../fixtures/chantier.jpg");

/**
 * Ce que ces épreuves cherchent à casser :
 *
 * 1. Un employé peut-il retirer une photo ? Il ne doit pas, même en
 *    contournant l'écran — c'est ce qui rend la photo valable comme preuve.
 * 2. Un employé voit-il les pièces d'un call qui n'est pas le sien ?
 * 3. L'entrepreneur, lui, retire-t-il vraiment ?
 */
test.describe("15. Pièces jointes", () => {
  let fieldCtx: FieldEmployeeTestContext;
  let companyId: string;

  test.beforeAll(async () => {
    const creds = readTestCredentials();
    companyId = creds.tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    fieldCtx = await setupFieldEmployeeTestData(createE2EAdmin(), companyId);
  });

  test.afterAll(async () => {
    if (!companyId || !fieldCtx) return;
    const admin = createE2EAdmin();
    const { data: restes } = await admin
      .from("job_attachments")
      .select("id, storage_path")
      .eq("company_id", companyId)
      .eq("scheduled_job_id", fieldCtx.jobId);
    if (restes?.length) {
      await admin.storage.from("pieces-jointes").remove(restes.map((r) => r.storage_path as string));
      await admin.from("job_attachments").delete().in("id", restes.map((r) => r.id as string));
    }
    await cleanupFieldEmployeeTestData(admin, companyId, fieldCtx);
  });

  test("l'employé ajoute une photo depuis son call", async ({ page }) => {
    await loginWithCredentials(page, fieldCtx.email, fieldCtx.password);
    await page.waitForURL(/\/terrain/, { timeout: 30000 });
    await page.goto(`/terrain/calls/${fieldCtx.jobId}`);

    await expect(page.getByRole("heading", { name: /Pièces jointes/ })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Aucune pièce jointe.", { exact: false })).toBeVisible();

    await page.getByLabel("Choisir des fichiers").setInputFiles(PHOTO);

    // Le nom peut devenir chantier.webp : la compression du navigateur change
    // l'extension quand elle réussit, et la garde quand elle échoue.
    await expect(page.getByRole("link", { name: /chantier\.(webp|jpg)/ })).toBeVisible({
      timeout: 30000,
    });

    // Le refus de suppression est DIT, pas seulement appliqué.
    await expect(page.getByRole("button", { name: /^Retirer / })).toHaveCount(0);
    await expect(page.getByText(/Seul votre employeur peut retirer/)).toBeVisible();

    const admin = createE2EAdmin();
    const { data: pieces } = await admin
      .from("job_attachments")
      .select("id, size_bytes, uploaded_by_employee_id, taken_at")
      .eq("scheduled_job_id", fieldCtx.jobId);

    expect(pieces).toHaveLength(1);
    expect(pieces![0].uploaded_by_employee_id).toBe(fieldCtx.employeeId);
    // 15 Mo est le plafond ; une photo de chantier compressée reste très en deçà.
    expect(Number(pieces![0].size_bytes)).toBeGreaterThan(0);
    expect(Number(pieces![0].size_bytes)).toBeLessThan(15 * 1024 * 1024);
  });

  test("l'employé ne peut pas supprimer, même en contournant l'écran", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    test.skip(!url || !anon, "Clés Supabase manquantes");

    const client = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: loginError } = await client.auth.signInWithPassword({
      email: fieldCtx.email,
      password: fieldCtx.password,
    });
    expect(loginError).toBeNull();

    // Il VOIT la pièce de son call.
    const { data: visibles } = await client
      .from("job_attachments")
      .select("id")
      .eq("scheduled_job_id", fieldCtx.jobId);
    expect(visibles).toHaveLength(1);

    // Mais il ne voit rien du call qui n'est pas le sien.
    const { data: autres } = await client
      .from("job_attachments")
      .select("id")
      .eq("scheduled_job_id", fieldCtx.otherJobId);
    expect(autres).toHaveLength(0);

    // La suppression ne lève pas d'erreur : la RLS ne touche aucune rangée.
    // C'est exactement pour ça que le refus doit aussi être dit à l'écran.
    await client.from("job_attachments").delete().eq("id", visibles![0].id as string);

    const admin = createE2EAdmin();
    const { data: apres } = await admin
      .from("job_attachments")
      .select("id")
      .eq("scheduled_job_id", fieldCtx.jobId);
    expect(apres).toHaveLength(1);

    await client.auth.signOut();
  });

  test.describe("au bureau", () => {
    test.use({ storageState: tenantAuth, pageName: "Pièces jointes" });

    test("l'entrepreneur voit la pièce et la retire", async ({ page }) => {
      await page.goto("/schedule");
      await ensureDashboardAccess(page);

      const bloc = page.locator(`[data-event-id="${fieldCtx.jobId}"]`);
      await expect(bloc).toBeVisible({ timeout: 15000 });
      await bloc.click();

      const lien = page.getByRole("link", { name: /chantier\.(webp|jpg)/ });
      await expect(lien).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: /^Retirer / }).click();
      await expect(lien).toHaveCount(0, { timeout: 15000 });

      const admin = createE2EAdmin();
      const { data: apres } = await admin
        .from("job_attachments")
        .select("id")
        .eq("scheduled_job_id", fieldCtx.jobId);
      expect(apres).toHaveLength(0);
    });
  });
});
