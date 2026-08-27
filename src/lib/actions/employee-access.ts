"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { mapEmployeeRow } from "@/lib/data/tenant-data";
import { hasAdminAccess, requireAdminContext } from "@/lib/session";
import { seatLimitMessage, seatUsage } from "@/lib/billing/seat-limit";
import type { Employee } from "@/types";

export type EmployeeAccessResult =
  | { success: true; employee: Employee; tempPassword?: string }
  | { success: false; error: string };

function generateTempPassword(): string {
  return randomBytes(10).toString("base64url").slice(0, 12);
}

/**
 * Refuse une nouvelle place quand la limite du palier est atteinte.
 *
 * Rendre son accès à quelqu'un qui l'occupe déjà ne consomme rien : on ne
 * bloque que l'ajout d'un connecté de plus. Réactiver un accès révoqué, en
 * revanche, reprend une place — le profil était repassé à `inactive`.
 *
 * Retourne le message de refus, ou `null` quand l'opération est permise.
 */
async function refuseIfNoSeatLeft(
  companyId: string,
  employeeUserId: unknown,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("subscription_tier")
    .eq("id", companyId)
    .maybeSingle();

  const { data: activeProfiles, error } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active");

  // Colonne ou table absente : on ne bloque pas sur une lecture incertaine.
  if (error) return null;

  const userId = employeeUserId ? String(employeeUserId) : null;
  const occupeDeja = userId
    ? (activeProfiles ?? []).some((p) => String(p.id) === userId)
    : false;
  if (occupeDeja) return null;

  const tier = company?.subscription_tier ? String(company.subscription_tier) : null;
  const usage = seatUsage({ activeProfiles: activeProfiles?.length ?? 0 }, tier);

  return usage.isFull ? seatLimitMessage(usage, tier) : null;
}

export async function grantEmployeeAccessAction(
  employeeId: string
): Promise<EmployeeAccessResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (employeeError || !employee) {
    return { success: false, error: "Employé introuvable." };
  }

  const email = employee.email ? String(employee.email).trim() : "";
  if (!email) {
    return { success: false, error: "Un courriel est requis pour donner accès à l'application." };
  }

  const seatRefusal = await refuseIfNoSeatLeft(ctx.company.id, employee.user_id);
  if (seatRefusal) return { success: false, error: seatRefusal };

  const tempPassword = generateTempPassword();
  let userId = employee.user_id ? String(employee.user_id) : null;

  if (!userId) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, company_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile && existingProfile.company_id !== ctx.company.id) {
      return { success: false, error: "Ce courriel est déjà utilisé par un autre compte." };
    }

    if (existingProfile) {
      userId = String(existingProfile.id);
    } else {
      const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: employee.first_name,
          last_name: employee.last_name,
          company_id: ctx.company.id,
          role: "employee",
        },
      });

      if (signUpError || !signUpData.user) {
        if (signUpError?.message?.toLowerCase().includes("already")) {
          return { success: false, error: "Un compte existe déjà avec ce courriel." };
        }
        return { success: false, error: "Impossible de créer le compte employé." };
      }

      userId = signUpData.user.id;

      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        company_id: ctx.company.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email,
        phone: employee.phone,
        role: "employee",
        status: "active",
        employee_id: employeeId,
      });

      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return { success: false, error: "Impossible de créer le profil employé." };
      }

      const { error: memberError } = await admin.from("company_members").insert({
        company_id: ctx.company.id,
        user_id: userId,
        role: "employee",
      });

      if (memberError) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return { success: false, error: "Impossible de lier l'employé à l'entreprise." };
      }
    }
  }

  await admin.auth.admin.updateUserById(userId!, {
    user_metadata: {
      first_name: employee.first_name,
      last_name: employee.last_name,
      company_id: ctx.company.id,
      role: "employee",
    },
  });

  await admin
    .from("profiles")
    .update({
      role: "employee",
      status: "active",
      employee_id: employeeId,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email,
    })
    .eq("id", userId!);

  await admin
    .from("company_members")
    .upsert(
      { company_id: ctx.company.id, user_id: userId!, role: "employee" },
      { onConflict: "company_id,user_id" }
    );

  const { data: updated, error: updateError } = await admin
    .from("employees")
    .update({ user_id: userId, app_access_enabled: true })
    .eq("id", employeeId)
    .eq("company_id", ctx.company.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return { success: false, error: "Impossible d'activer l'accès employé." };
  }

  revalidatePath("/employees");
  revalidatePath("/terrain");

  return {
    success: true,
    employee: mapEmployeeRow(updated as Record<string, unknown>),
    tempPassword: userId === employee.user_id ? undefined : tempPassword,
  };
}

export async function revokeEmployeeAccessAction(
  employeeId: string
): Promise<EmployeeAccessResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (employeeError || !employee) {
    return { success: false, error: "Employé introuvable." };
  }

  const userId = employee.user_id ? String(employee.user_id) : null;

  if (userId) {
    await admin.from("profiles").update({ status: "inactive" }).eq("id", userId);
  }

  const { data: updated, error: updateError } = await admin
    .from("employees")
    .update({ app_access_enabled: false })
    .eq("id", employeeId)
    .eq("company_id", ctx.company.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return { success: false, error: "Impossible de désactiver l'accès." };
  }

  revalidatePath("/employees");
  revalidatePath("/terrain");

  return { success: true, employee: mapEmployeeRow(updated as Record<string, unknown>) };
}

export async function canManageEmployeeAccess(role: string): Promise<boolean> {
  return hasAdminAccess(role as Parameters<typeof hasAdminAccess>[0]);
}
