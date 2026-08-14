"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/data/platform-data";
import { generateNextTestEmail } from "@/lib/platform/test-user-email";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";

export type TestUserActionResult =
  | { success: true; email: string; tempPassword: string; loginUrl: string }
  | { success: false; error: string };

export type DeleteTestUserResult = { success: true } | { success: false; error: string };

function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

function isSchemaMissing(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("schema cache");
}

async function collectExistingTestEmails(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const emails = new Set<string>();

  const { data: tracked } = await db.from("platform_test_users").select("email");
  for (const row of tracked ?? []) {
    if (row.email) emails.add(String(row.email).toLowerCase());
  }

  const { data: profiles } = await db.from("profiles").select("email").ilike("email", "%+test%@%");
  for (const row of profiles ?? []) {
    if (row.email) emails.add(String(row.email).toLowerCase());
  }

  return [...emails];
}

export async function createTestUserAction(): Promise<TestUserActionResult> {
  const adminUser = await requireSuperAdminUser();
  const db = createAdminClient();

  const nextEmail = generateNextTestEmail(
    adminUser.email,
    await collectExistingTestEmails(db),
    process.env.PLATFORM_TEST_EMAIL_BASE,
  );

  if (!nextEmail) {
    return {
      success: false,
      error:
        "Impossible de générer un courriel test. Vérifiez votre courriel super admin ou PLATFORM_TEST_EMAIL_BASE.",
    };
  }

  const tempPassword = generateTempPassword();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: signUpData, error: signUpError } = await db.auth.admin.createUser({
    email: nextEmail.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: "Test",
      last_name: "Utilisateur",
      is_test_user: true,
    },
  });

  if (signUpError || !signUpData.user) {
    if (signUpError?.message?.toLowerCase().includes("already")) {
      return { success: false, error: "Ce courriel test existe déjà." };
    }
    return { success: false, error: "Impossible de créer le compte test." };
  }

  const userId = signUpData.user.id;

  const { data: company, error: companyError } = await db
    .from("companies")
    .insert({
      name: "Compte test",
      email: nextEmail.email,
      subscription_status: "cancelled",
      access_type: "pending",
      requires_access_choice: true,
      trial_ends_at: null,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    await db.auth.admin.deleteUser(userId);
    if (isSchemaMissing(companyError?.message ?? "")) {
      return {
        success: false,
        error: "Migration 019 requise — appliquez platform_test_users avant de créer des comptes test.",
      };
    }
    return { success: false, error: "Impossible de créer l'entreprise test." };
  }

  const { error: profileError } = await db.from("profiles").insert({
    id: userId,
    company_id: company.id,
    first_name: "Test",
    last_name: "Utilisateur",
    email: nextEmail.email,
    role: "owner",
    status: "active",
  });

  if (profileError) {
    await db.from("companies").delete().eq("id", company.id);
    await db.auth.admin.deleteUser(userId);
    return { success: false, error: "Impossible de créer le profil test." };
  }

  const { error: memberError } = await db.from("company_members").insert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    await db.from("profiles").delete().eq("id", userId);
    await db.from("companies").delete().eq("id", company.id);
    await db.auth.admin.deleteUser(userId);
    return { success: false, error: "Impossible de finaliser le compte test." };
  }

  await db.auth.admin.updateUserById(userId, {
    user_metadata: {
      first_name: "Test",
      last_name: "Utilisateur",
      company_id: company.id,
      role: "owner",
      is_test_user: true,
    },
  });

  const { error: trackError } = await db.from("platform_test_users").insert({
    user_id: userId,
    email: nextEmail.email,
    company_id: company.id,
    created_by: adminUser.id,
  });

  if (trackError) {
    await db.from("company_members").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    await db.from("companies").delete().eq("id", company.id);
    await db.auth.admin.deleteUser(userId);
    if (isSchemaMissing(trackError.message)) {
      return {
        success: false,
        error: "Migration 019 requise — appliquez platform_test_users avant de créer des comptes test.",
      };
    }
    return { success: false, error: "Impossible d'enregistrer le compte test." };
  }

  await logAdminActivity(
    "test_user_created",
    `Compte test créé : ${nextEmail.email}`,
    company.id,
    { userId, email: nextEmail.email, method: nextEmail.method },
  );

  revalidatePath("/admin/test-users");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/activity");

  return {
    success: true,
    email: nextEmail.email,
    tempPassword,
    loginUrl: `${appUrl}/login`,
  };
}

export async function deleteTestUserAction(userId: string): Promise<DeleteTestUserResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();

  const { data: tracked, error: lookupError } = await db
    .from("platform_test_users")
    .select("user_id, email, company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    if (isSchemaMissing(lookupError.message)) {
      return { success: false, error: "Migration 019 requise." };
    }
    return { success: false, error: lookupError.message };
  }

  if (!tracked) {
    return { success: false, error: "Compte test introuvable ou non autorisé." };
  }

  const companyId = tracked.company_id ? String(tracked.company_id) : null;

  if (companyId) {
    const { count } = await db
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    if ((count ?? 0) <= 1) {
      await db.from("companies").delete().eq("id", companyId);
    } else {
      await db.from("company_members").delete().eq("user_id", userId);
      await db.from("profiles").delete().eq("id", userId);
    }
  }

  await db.from("platform_test_users").delete().eq("user_id", userId);

  const { error: deleteError } = await db.auth.admin.deleteUser(userId);
  if (deleteError) {
    return { success: false, error: "Impossible de supprimer le compte auth." };
  }

  await logAdminActivity(
    "test_user_deleted",
    `Compte test supprimé : ${tracked.email}`,
    companyId,
    { userId, email: tracked.email },
  );

  revalidatePath("/admin/test-users");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/activity");

  return { success: true };
}
