"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  normalizeEmployeeEmail,
  resolveEmployeeAppAccessStatus,
  validateEmployeeAccessEmail,
  type ExistingProfileForAccess,
} from "@/lib/employee-access-utils";
import { mapEmployeeRow } from "@/lib/data/tenant-data";
import { hasAdminAccess, requireAdminContext } from "@/lib/session";
import { seatLimitMessage, seatUsage } from "@/lib/billing/seat-limit";
import {
  activationRefusedMessage,
  countPendingInvitations,
} from "@/lib/billing/pending-invitations";
import type { Employee, ProfileRole } from "@/types";

export type EmployeeAccessResult =
  | { success: true; employee: Employee }
  | { success: false; error: string };

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function mapExistingProfile(row: Record<string, unknown>): ExistingProfileForAccess {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    role: row.role as ProfileRole,
    employeeId: row.employee_id ? String(row.employee_id) : null,
  };
}

async function loadEmployeeForAccess(employeeId: string, companyId: string) {
  const admin = createAdminClient();
  const { data: employee, error } = await admin
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !employee) return null;
  return employee;
}

async function loadExistingProfileByEmail(email: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, company_id, role, employee_id")
    .eq("email", email)
    .maybeSingle();

  return data ? mapExistingProfile(data as Record<string, unknown>) : null;
}

async function ensureEmployeeProfileAndMembership(params: {
  userId: string;
  companyId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}) {
  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", params.userId)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await admin.from("profiles").insert({
      id: params.userId,
      company_id: params.companyId,
      first_name: params.firstName,
      last_name: params.lastName,
      email: params.email,
      phone: params.phone,
      role: "employee",
      status: "active",
      employee_id: params.employeeId,
    });

    if (profileError) {
      return { ok: false as const, error: "Impossible de créer le profil employé." };
    }
  } else {
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "employee",
        status: "active",
        employee_id: params.employeeId,
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
      })
      .eq("id", params.userId);

    if (profileError) {
      return { ok: false as const, error: "Impossible de mettre à jour le profil employé." };
    }
  }

  const { error: memberError } = await admin.from("company_members").upsert(
    { company_id: params.companyId, user_id: params.userId, role: "employee" },
    { onConflict: "company_id,user_id" }
  );

  if (memberError) {
    return { ok: false as const, error: "Impossible de lier l'employé à l'entreprise." };
  }

  await admin.auth.admin.updateUserById(params.userId, {
    user_metadata: {
      first_name: params.firstName,
      last_name: params.lastName,
      company_id: params.companyId,
      role: "employee",
      employee_id: params.employeeId,
    },
  });

  return { ok: true as const };
}

async function updateEmployeeAccessFields(
  employeeId: string,
  companyId: string,
  fields: Record<string, unknown>
) {
  const admin = createAdminClient();
  let { data, error } = await admin
    .from("employees")
    .update(fields)
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error?.message?.includes("app_access_invited_at")) {
    const fallbackFields = { ...fields };
    delete fallbackFields.app_access_invited_at;
    ({ data, error } = await admin
      .from("employees")
      .update(fallbackFields)
      .eq("id", employeeId)
      .eq("company_id", companyId)
      .select("*")
      .single());
  }

  return { data, error };
}

async function linkEmployeeInvitation(params: {
  employeeId: string;
  companyId: string;
  userId: string;
  adminUserId: string;
}) {
  if (params.userId === params.adminUserId) {
    return { ok: false as const, error: "Impossible de lier l'accès au compte administrateur." };
  }

  const invitedAt = new Date().toISOString();

  const { data: updated, error } = await updateEmployeeAccessFields(
    params.employeeId,
    params.companyId,
    {
      user_id: params.userId,
      app_access_enabled: false,
      app_access_invited_at: invitedAt,
    }
  );

  if (error || !updated) {
    return { ok: false as const, error: "Impossible d'enregistrer l'invitation employé." };
  }

  return { ok: true as const, employee: updated as Record<string, unknown> };
}

/**
 * Places occupées par l'entreprise : profils actifs et invitations encore
 * valides. Une invitation réserve une place, sinon un compte Solo pourrait en
 * envoyer cinquante et se retrouver à cinquante utilisateurs le jour où elles
 * sont acceptées.
 */
async function readSeatUsage(companyId: string) {
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("subscription_tier, name")
    .eq("id", companyId)
    .maybeSingle();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active");

  // Lecture incertaine : on ne bloque pas sur un décompte qu'on ne sait pas faire.
  if (error) return null;

  const { data: invitations } = await admin
    .from("employees")
    .select("app_access_invited_at, app_access_enabled")
    .eq("company_id", companyId)
    .not("app_access_invited_at", "is", null);

  const tier = company?.subscription_tier ? String(company.subscription_tier) : null;

  return {
    tier,
    companyName: company?.name ? String(company.name) : null,
    usage: seatUsage(
      {
        activeProfiles: profiles?.length ?? 0,
        pendingInvitations: countPendingInvitations(
          (invitations ?? []).map((r) => ({
            invitedAt: r.app_access_invited_at ? String(r.app_access_invited_at) : null,
            enabled: r.app_access_enabled === true,
          })),
        ),
      },
      tier,
    ),
  };
}

/**
 * Refuse une invitation quand la limite du palier est atteinte.
 *
 * Réinviter quelqu'un qui retient déjà une place ne consomme rien : seul
 * l'ajout d'une personne de plus est bloqué.
 */
async function refuseIfNoSeatLeft(
  companyId: string,
  employeeHoldsSeatAlready: boolean,
): Promise<string | null> {
  if (employeeHoldsSeatAlready) return null;

  const seats = await readSeatUsage(companyId);
  if (!seats) return null;

  return seats.usage.isFull ? seatLimitMessage(seats.usage, seats.tier) : null;
}

export async function sendEmployeeInvitationAction(
  employeeId: string
): Promise<EmployeeAccessResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const employee = await loadEmployeeForAccess(employeeId, ctx.company.id);
  if (!employee) return { success: false, error: "Employé introuvable." };

  const email = employee.email ? String(employee.email).trim() : "";
  const normalizedEmail = normalizeEmployeeEmail(email);
  const existingProfile = normalizedEmail
    ? await loadExistingProfileByEmail(normalizedEmail)
    : null;

  const validationError = validateEmployeeAccessEmail({
    employeeEmail: email,
    adminUserId: ctx.user.id,
    adminEmail: ctx.user.email,
    existingProfile,
    companyId: ctx.company.id,
    employeeId,
  });

  if (validationError) {
    return { success: false, error: validationError };
  }

  const adminUserId = ctx.user.id;
  const linkedUserId = employee.user_id ? String(employee.user_id) : null;

  if (linkedUserId === adminUserId) {
    return {
      success: false,
      error: "Cet employé est incorrectement lié à votre compte administrateur.",
    };
  }

  const currentStatus = resolveEmployeeAppAccessStatus(employee as Record<string, unknown>);
  if (currentStatus === "active") {
    return { success: false, error: "L'accès employé est déjà actif." };
  }

  if (currentStatus === "invited" || currentStatus === "pending") {
    // Un renvoi ne consomme pas de place : celle-ci est déjà retenue.
    return resendEmployeeInvitationAction(employeeId);
  }

  // À partir d'ici l'invitation est nouvelle, donc elle réserve une place.
  const seatRefusal = await refuseIfNoSeatLeft(ctx.company.id, false);
  if (seatRefusal) return { success: false, error: seatRefusal };

  const admin = createAdminClient();
  const appUrl = getAppUrl();
  const inviteMetadata = {
    first_name: employee.first_name,
    last_name: employee.last_name,
    company_id: ctx.company.id,
    role: "employee",
    employee_id: employeeId,
  };

  let userId = linkedUserId ?? existingProfile?.id ?? null;

  if (userId && userId === adminUserId) {
    return {
      success: false,
      error: "Ce courriel correspond à votre compte administrateur. Utilisez un courriel distinct pour l'employé.",
    };
  }

  if (!userId) {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: inviteMetadata,
        redirectTo: `${appUrl}/auth/callback?next=/terrain`,
      }
    );

    if (inviteError || !inviteData.user) {
      if (inviteError?.message?.toLowerCase().includes("already")) {
        return { success: false, error: "Un compte existe déjà avec ce courriel." };
      }
      return { success: false, error: "Impossible d'envoyer l'invitation employé." };
    }

    userId = inviteData.user.id;
  } else {
    const { error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: {
        data: inviteMetadata,
        redirectTo: `${appUrl}/auth/callback?next=/terrain`,
      },
    });

    if (linkError) {
      return { success: false, error: "Impossible d'envoyer l'invitation employé." };
    }
  }

  const profileResult = await ensureEmployeeProfileAndMembership({
    userId: userId!,
    companyId: ctx.company.id,
    employeeId,
    firstName: String(employee.first_name),
    lastName: String(employee.last_name),
    email: normalizedEmail,
    phone: employee.phone ? String(employee.phone) : null,
  });

  if (!profileResult.ok) {
    return { success: false, error: profileResult.error };
  }

  const linkResult = await linkEmployeeInvitation({
    employeeId,
    companyId: ctx.company.id,
    userId: userId!,
    adminUserId,
  });

  if (!linkResult.ok) {
    return { success: false, error: linkResult.error };
  }

  revalidatePath("/employees");
  revalidatePath("/terrain");

  return {
    success: true,
    employee: mapEmployeeRow(linkResult.employee),
  };
}

/** @deprecated Use sendEmployeeInvitationAction */
export async function grantEmployeeAccessAction(
  employeeId: string
): Promise<EmployeeAccessResult> {
  return sendEmployeeInvitationAction(employeeId);
}

export async function resendEmployeeInvitationAction(
  employeeId: string
): Promise<EmployeeAccessResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const employee = await loadEmployeeForAccess(employeeId, ctx.company.id);
  if (!employee) return { success: false, error: "Employé introuvable." };

  const email = employee.email ? String(employee.email).trim() : "";
  const normalizedEmail = normalizeEmployeeEmail(email);
  const existingProfile = normalizedEmail
    ? await loadExistingProfileByEmail(normalizedEmail)
    : null;

  const validationError = validateEmployeeAccessEmail({
    employeeEmail: email,
    adminUserId: ctx.user.id,
    adminEmail: ctx.user.email,
    existingProfile,
    companyId: ctx.company.id,
    employeeId,
  });

  if (validationError) {
    return { success: false, error: validationError };
  }

  const currentStatus = resolveEmployeeAppAccessStatus(employee as Record<string, unknown>);
  if (currentStatus === "active") {
    return { success: false, error: "L'accès employé est déjà actif." };
  }

  if (!employee.user_id) {
    return sendEmployeeInvitationAction(employeeId);
  }

  const userId = String(employee.user_id);
  if (userId === ctx.user.id) {
    return {
      success: false,
      error: "Cet employé est incorrectement lié à votre compte administrateur.",
    };
  }

  const admin = createAdminClient();
  const appUrl = getAppUrl();
  const inviteMetadata = {
    first_name: employee.first_name,
    last_name: employee.last_name,
    company_id: ctx.company.id,
    role: "employee",
    employee_id: employeeId,
  };

  const { error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: normalizedEmail,
    options: {
      data: inviteMetadata,
      redirectTo: `${appUrl}/auth/callback?next=/terrain`,
    },
  });

  if (linkError) {
    return { success: false, error: "Impossible de renvoyer l'invitation." };
  }

  const { data: updated, error: updateError } = await updateEmployeeAccessFields(
    employeeId,
    ctx.company.id,
    {
      app_access_invited_at: new Date().toISOString(),
      app_access_enabled: false,
    }
  );

  if (updateError || !updated) {
    return { success: false, error: "Impossible de mettre à jour l'invitation." };
  }

  revalidatePath("/employees");
  revalidatePath("/terrain");

  return { success: true, employee: mapEmployeeRow(updated as Record<string, unknown>) };
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

  if (userId === ctx.user.id) {
    return {
      success: false,
      error: "Impossible de désactiver l'accès — employé lié au compte administrateur.",
    };
  }

  if (userId) {
    await admin.from("profiles").update({ status: "inactive" }).eq("id", userId);
  }

  const { data: updated, error: updateError } = await updateEmployeeAccessFields(
    employeeId,
    ctx.company.id,
    {
      app_access_enabled: false,
      app_access_invited_at: null,
    }
  );

  if (updateError || !updated) {
    return { success: false, error: "Impossible de désactiver l'accès." };
  }

  revalidatePath("/employees");
  revalidatePath("/terrain");

  return { success: true, employee: mapEmployeeRow(updated as Record<string, unknown>) };
}

/** Called after invite confirmation — activates employee access once linked. */
export interface ActivationResult {
  activated: boolean;
  /** Message destiné à l'EMPLOYÉ, jamais à l'administrateur. */
  reason?: string;
}

export async function activateEmployeeAccessAfterConfirmation(
  userId: string,
): Promise<ActivationResult> {
  if (!isSupabaseConfigured()) return { activated: true };

  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const authUser = authData?.user;
  if (!authUser?.email_confirmed_at) return { activated: true };

  const { data: profile } = await admin
    .from("profiles")
    .select("employee_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.employee_id || profile.role !== "employee") return { activated: true };

  const { data: employee } = await admin
    .from("employees")
    .select("company_id")
    .eq("id", profile.employee_id)
    .maybeSingle();

  const companyId = employee?.company_id ? String(employee.company_id) : null;

  // La limite est revérifiée ICI, et pas seulement à l'invitation. Une
  // invitation cesse de retenir sa place au bout de quatorze jours ; si elle
  // est acceptée après coup alors que la place a été reprise, activer
  // dépasserait la limite en silence. On refuse plutôt, et on le dit.
  if (companyId) {
    const seats = await readSeatUsage(companyId);
    if (seats && seats.usage.isFull) {
      // L'invitation reste valide : rien n'est annulé, la place manque.
      return { activated: false, reason: activationRefusedMessage(seats.companyName) };
    }
  }

  await admin
    .from("employees")
    .update({ app_access_enabled: true })
    .eq("id", profile.employee_id)
    .eq("user_id", userId);

  await admin.from("profiles").update({ status: "active" }).eq("id", userId);
  return { activated: true };
}

export async function canManageEmployeeAccess(role: string): Promise<boolean> {
  return hasAdminAccess(role as Parameters<typeof hasAdminAccess>[0]);
}
