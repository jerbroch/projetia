#!/usr/bin/env node
/**
 * Restores a local admin account incorrectly linked to an employee record.
 * Safe to re-run — only touches the known corrupted linkage.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const env = readFileSync(envPath, "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const CORRUPTED = {
  adminUserId: "87565d89-841e-4134-98a5-8155f8d92bea",
  employeeId: "e56d3147-a71f-4582-86e3-975a7aaa0f6f",
  companyId: "38fcd3b6-1baf-4b7a-80f7-5e927824c4db",
  adminEmail: "jerome_brochu@hotmail.fr",
};

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Inspecting corrupted linkage…");

  const [{ data: profile }, { data: employee }, { data: member }, { data: authData }] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", CORRUPTED.adminUserId).maybeSingle(),
      admin.from("employees").select("*").eq("id", CORRUPTED.employeeId).maybeSingle(),
      admin
        .from("company_members")
        .select("*")
        .eq("user_id", CORRUPTED.adminUserId)
        .eq("company_id", CORRUPTED.companyId)
        .maybeSingle(),
      admin.auth.admin.getUserById(CORRUPTED.adminUserId),
    ]);

  console.log("Before restore:");
  console.log(
    JSON.stringify(
      {
        profileRole: profile?.role,
        profileEmployeeId: profile?.employee_id,
        employeeUserId: employee?.user_id,
        employeeAccessEnabled: employee?.app_access_enabled,
        memberRole: member?.role,
        authRole: authData?.user?.user_metadata?.role,
      },
      null,
      2
    )
  );

  const restoredRole = member?.role === "employee" ? "owner" : member?.role ?? "owner";
  const authMeta = authData?.user?.user_metadata ?? {};
  const restoredFirstName =
    typeof authMeta.first_name === "string" && authMeta.first_name !== "he"
      ? authMeta.first_name
      : profile?.first_name === "he"
        ? "Jerome"
        : profile?.first_name ?? "Admin";
  const restoredLastName =
    typeof authMeta.last_name === "string" && authMeta.last_name !== "wong"
      ? authMeta.last_name
      : profile?.last_name === "wong"
        ? "Brochu"
        : profile?.last_name ?? "User";

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: restoredRole,
      employee_id: null,
      first_name: restoredFirstName,
      last_name: restoredLastName,
      email: CORRUPTED.adminEmail,
      status: "active",
    })
    .eq("id", CORRUPTED.adminUserId);

  if (profileError) throw new Error(`Profile restore failed: ${profileError.message}`);

  const { error: memberError } = await admin
    .from("company_members")
    .update({ role: restoredRole })
    .eq("user_id", CORRUPTED.adminUserId)
    .eq("company_id", CORRUPTED.companyId);

  if (memberError && memberError.code !== "PGRST116") {
    throw new Error(`company_members restore failed: ${memberError.message}`);
  }

  if (!member && memberError?.code === "PGRST116") {
    await admin.from("company_members").insert({
      company_id: CORRUPTED.companyId,
      user_id: CORRUPTED.adminUserId,
      role: restoredRole,
    });
  }

  const employeeUpdate = {
    user_id: null,
    app_access_enabled: false,
  };

  const { error: employeeError } = await admin
    .from("employees")
    .update(employeeUpdate)
    .eq("id", CORRUPTED.employeeId);

  if (employeeError?.message?.includes("app_access_invited_at")) {
    const { error: fallbackError } = await admin
      .from("employees")
      .update({ user_id: null, app_access_enabled: false })
      .eq("id", CORRUPTED.employeeId);
    if (fallbackError) throw new Error(`Employee restore failed: ${fallbackError.message}`);
  } else if (employeeError) {
    throw new Error(`Employee restore failed: ${employeeError.message}`);
  } else {
    await admin
      .from("employees")
      .update({ app_access_invited_at: null })
      .eq("id", CORRUPTED.employeeId);
  }

  await admin.auth.admin.updateUserById(CORRUPTED.adminUserId, {
    user_metadata: {
      ...authMeta,
      first_name: restoredFirstName,
      last_name: restoredLastName,
      company_id: CORRUPTED.companyId,
      role: restoredRole,
      employee_id: null,
    },
  });

  const [{ data: afterProfile }, { data: afterEmployee }] = await Promise.all([
    admin.from("profiles").select("role, employee_id, email").eq("id", CORRUPTED.adminUserId).maybeSingle(),
    admin.from("employees").select("user_id, app_access_enabled").eq("id", CORRUPTED.employeeId).maybeSingle(),
  ]);

  console.log("\nAfter restore:");
  console.log(
    JSON.stringify(
      {
        profileRole: afterProfile?.role,
        profileEmployeeId: afterProfile?.employee_id,
        employeeUserId: afterEmployee?.user_id,
        employeeAccessEnabled: afterEmployee?.app_access_enabled,
      },
      null,
      2
    )
  );

  console.log("\nAdmin account restored. Employee record unlinked from admin user.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
