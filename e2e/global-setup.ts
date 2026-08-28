import type { FullConfig } from "@playwright/test";
import "./load-env";
import { createClient } from "@supabase/supabase-js";
import { resetAuditFile } from "./helpers/audit";
import { seedE2EBusinessData } from "./helpers/seed-data";
import { writeTestCredentials } from "./helpers/test-data";
import { cibleConfirmee } from "./target-guard";



cibleConfirmee();

const DEFAULT_PASSWORD = process.env.E2E_DEFAULT_PASSWORD ?? "TestE2ePass123!";

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin not configured");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function createTenantUser(admin: ReturnType<typeof createAdmin>, runId: string) {
  const email = process.env.E2E_TENANT_EMAIL ?? `e2e+tenant${runId}@e2e.constructionios.test`;
  const password =
    process.env.E2E_TENANT_PASSWORD ?? process.env.E2E_TEST_PASSWORD ?? DEFAULT_PASSWORD;

  const { data: existing } = await admin
    .from("profiles")
    .select("id, company_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await admin
      .from("companies")
      .update({
        access_type: "beta",
        is_beta: true,
        promo_code: "ios123",
        requires_access_choice: false,
      })
      .eq("id", existing.company_id);
    return { email, password, companyId: existing.company_id as string };
  }

  const { data: signUp, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "E2E", last_name: "Tenant", is_test_user: true },
  });

  if (signUpError || !signUp.user) {
    throw new Error(`Failed to create tenant user: ${signUpError?.message}`);
  }

  const userId = signUp.user.id;

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: `E2E Tenant ${runId}`,
      email,
      subscription_status: "active",
      access_type: "beta",
      is_beta: true,
      promo_code: "ios123",
      requires_access_choice: false,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create tenant company: ${companyError?.message}`);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    company_id: company.id,
    first_name: "E2E",
    last_name: "Tenant",
    email,
    role: "owner",
    status: "active",
  });

  if (profileError) {
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create tenant profile: ${profileError.message}`);
  }

  return { email, password, companyId: company.id as string };
}

async function ensureSuperAdminUser(admin: ReturnType<typeof createAdmin>, runId: string) {
  const email =
    process.env.E2E_SUPER_ADMIN_EMAIL ?? `e2e+superadmin${runId}@e2e.constructionios.test`;
  const password = process.env.E2E_TEST_PASSWORD ?? DEFAULT_PASSWORD;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId = existingProfile?.id as string | undefined;

  if (userId) {
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  }

  if (!userId) {
    const { data: signUp, error: signUpError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "E2E", last_name: "SuperAdmin", is_test_user: true },
    });

    if (signUpError || !signUp.user) {
      throw new Error(`Failed to create super admin user: ${signUpError?.message}`);
    }

    userId = signUp.user.id;

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: `E2E Super Admin ${runId}`,
        email,
        subscription_status: "active",
        access_type: "beta",
        is_beta: true,
        promo_code: "ios123",
        requires_access_choice: false,
      })
      .select("id")
      .single();

    if (companyError || !company) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create super admin company: ${companyError?.message}`);
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      company_id: company.id,
      first_name: "E2E",
      last_name: "SuperAdmin",
      email,
      role: "owner",
      status: "active",
    });

    if (profileError) {
      await admin.from("companies").delete().eq("id", company.id);
      await admin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create super admin profile: ${profileError.message}`);
    }
  }

  const { error: adminError } = await admin
    .from("platform_admins")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (adminError) {
    throw new Error(`Failed to register platform admin: ${adminError.message}`);
  }

  return { email, password };
}

async function globalSetup(_config: FullConfig) {
  resetAuditFile();
  const runId = String(Date.now());
  const admin = createAdmin();
  const tenant = await createTenantUser(admin, runId);
  const superAdmin = await ensureSuperAdminUser(admin, runId);
  const seed = await seedE2EBusinessData(admin, tenant.companyId);

  writeTestCredentials({
    runId,
    tenantEmail: tenant.email,
    tenantPassword: tenant.password,
    tenantCompanyId: tenant.companyId,
    superAdminEmail: superAdmin.email,
    superAdminPassword: superAdmin.password,
    seed,
  });

  console.log(`[E2E globalSetup] Tenant provisioned: ${tenant.email}`);
  console.log(`[E2E globalSetup] Super admin provisioned: ${superAdmin.email}`);
  console.log(`[E2E globalSetup] Seed job: ${seed.scheduledJobId}`);
}

export default globalSetup;
