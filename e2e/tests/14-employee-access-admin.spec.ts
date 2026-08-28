import { test, expect } from "../fixtures/base";
import { loginWithCredentials } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

test.describe("14. Accès employé — sécurité admin", () => {
  test("créer un employé avec accès ne modifie pas le compte admin", async ({ page }) => {
    const creds = readTestCredentials();
    test.skip(!creds.email || !creds.password || !creds.tenantCompanyId, "Identifiants E2E manquants");

    const adminClient = createE2EAdmin();
    const runId = Date.now();
    const employeeEmail = `e2e+emp-access${runId}@e2e.constructionios.test`;

    await loginWithCredentials(page, creds.email, creds.password);
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    const { data: adminProfileBefore } = await adminClient
      .from("profiles")
      .select("id, role, employee_id")
      .eq("email", creds.email)
      .maybeSingle();

    expect(adminProfileBefore?.role).not.toBe("employee");
    expect(adminProfileBefore?.employee_id).toBeNull();

    await page.goto("/employees");
    await page.getByRole("button", { name: /ajouter un employé/i }).click();
    await page.getByLabel("Prénom").fill("E2E");
    await page.getByLabel("Nom").fill(`Access${runId}`);
    await page.getByLabel("Métier").fill("Plombier");
    await page.getByLabel("Courriel").fill(employeeEmail);
    await page.getByLabel(/donner accès/i).check();
    await page.getByRole("button", { name: /ajouter l'employé/i }).click();

    await expect(page.getByText(/E2E Access/)).toBeVisible({ timeout: 15000 });

    const { data: adminProfileAfter } = await adminClient
      .from("profiles")
      .select("id, role, employee_id")
      .eq("email", creds.email)
      .maybeSingle();

    expect(adminProfileAfter?.role).toBe(adminProfileBefore?.role);
    expect(adminProfileAfter?.employee_id).toBeNull();

    const { data: employeeRow } = await adminClient
      .from("employees")
      .select("user_id, app_access_enabled, app_access_invited_at")
      .eq("email", employeeEmail)
      .maybeSingle();

    expect(employeeRow?.user_id).toBeTruthy();
    expect(employeeRow?.user_id).not.toBe(adminProfileBefore?.id);
    expect(employeeRow?.app_access_enabled).toBe(false);
    expect(employeeRow?.app_access_invited_at).toBeTruthy();

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await adminClient.from("employees").delete().eq("email", employeeEmail);
    if (employeeRow?.user_id) {
      await adminClient.from("company_members").delete().eq("user_id", employeeRow.user_id);
      await adminClient.from("profiles").delete().eq("id", employeeRow.user_id);
      await adminClient.auth.admin.deleteUser(employeeRow.user_id);
    }
  });
});
