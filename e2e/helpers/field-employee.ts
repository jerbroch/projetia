import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FIELD_MARKER = "E2E Field Employee";

export interface FieldEmployeeTestContext {
  employeeId: string;
  userId: string;
  email: string;
  password: string;
  jobId: string;
  otherJobId: string;
}

export function createE2EAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured for E2E");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function setupFieldEmployeeTestData(
  admin: SupabaseClient,
  companyId: string
): Promise<FieldEmployeeTestContext> {
  const runId = Date.now();
  const email = `e2e+field${runId}@e2e.constructionios.test`;
  const password = process.env.E2E_DEFAULT_PASSWORD ?? "TestE2ePass123!";

  await admin
    .from("employees")
    .delete()
    .eq("company_id", companyId)
    .eq("first_name", FIELD_MARKER);

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      company_id: companyId,
      first_name: FIELD_MARKER,
      last_name: "Plombier",
      email,
      phone: "5145550199",
      trade: "Plombier",
      status: "active",
    })
    .select("id")
    .single();

  if (employeeError || !employee) {
    throw new Error(`Field employee seed failed: ${employeeError?.message}`);
  }

  const { data: signUp, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: FIELD_MARKER,
      last_name: "Plombier",
      company_id: companyId,
      role: "employee",
    },
  });

  if (signUpError || !signUp.user) {
    throw new Error(`Field auth user failed: ${signUpError?.message}`);
  }

  const userId = signUp.user.id;

  await admin.from("profiles").insert({
    id: userId,
    company_id: companyId,
    first_name: FIELD_MARKER,
    last_name: "Plombier",
    email,
    role: "employee",
    status: "active",
    employee_id: employee.id,
  });

  await admin.from("company_members").insert({
    company_id: companyId,
    user_id: userId,
    role: "employee",
  });

  await admin
    .from("employees")
    .update({ user_id: userId, app_access_enabled: true })
    .eq("id", employee.id);

  const start = new Date();
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);

  const { data: job, error: jobError } = await admin
    .from("scheduled_jobs")
    .insert({
      company_id: companyId,
      title: `${FIELD_MARKER} Call assigné`,
      description: "Test terrain",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      customer_name: "Client terrain",
      job_site_address: "100 Rue Field, Montréal",
      employee_ids: [employee.id],
      employee_names: [`${FIELD_MARKER} Plombier`],
      status: "scheduled",
      type: "job",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    throw new Error(`Field job seed failed: ${jobError?.message}`);
  }

  const otherStart = new Date(start);
  otherStart.setDate(otherStart.getDate() + 1);
  const otherEnd = new Date(otherStart);
  otherEnd.setHours(otherStart.getHours() + 2);

  const { data: otherJob, error: otherJobError } = await admin
    .from("scheduled_jobs")
    .insert({
      company_id: companyId,
      title: `${FIELD_MARKER} Call non assigné`,
      description: "Ne doit pas être visible",
      start_at: otherStart.toISOString(),
      end_at: otherEnd.toISOString(),
      customer_name: "Autre client",
      job_site_address: "200 Rue Autre",
      employee_ids: [],
      employee_names: [],
      status: "scheduled",
      type: "job",
    })
    .select("id")
    .single();

  if (otherJobError || !otherJob) {
    throw new Error(`Other field job seed failed: ${otherJobError?.message}`);
  }

  return {
    employeeId: employee.id as string,
    userId,
    email,
    password,
    jobId: job.id as string,
    otherJobId: otherJob.id as string,
  };
}

export async function cleanupFieldEmployeeTestData(
  admin: SupabaseClient,
  companyId: string,
  ctx: FieldEmployeeTestContext
) {
  await admin.from("field_hours").delete().eq("company_id", companyId).eq("scheduled_job_id", ctx.jobId);
  await admin.from("field_materials").delete().eq("company_id", companyId).eq("scheduled_job_id", ctx.jobId);
  await admin.from("scheduled_jobs").delete().eq("company_id", companyId).in("id", [ctx.jobId, ctx.otherJobId]);
  await admin.from("company_members").delete().eq("user_id", ctx.userId);
  await admin.from("profiles").delete().eq("id", ctx.userId);
  await admin
    .from("employees")
    .delete()
    .eq("company_id", companyId)
    .eq("first_name", FIELD_MARKER);
  await admin.auth.admin.deleteUser(ctx.userId);
}

export { FIELD_MARKER };
