"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { EmployeeRole } from "@/types";

/**
 * Les rôles appartiennent à l'entrepreneur, pas à nous.
 *
 * Trois lignes génériques arrivent à l'inscription — « Employé senior »,
 * « Employé », « Apprenti » — sans taux. Un couvreur les renomme en
 * « Couvreur », « Aide-couvreur », un excavateur en « Opérateur »,
 * « Journalier ». Nous ne savons pas nommer leurs métiers, et nous ne savons
 * pas ce qu'ils paient.
 */

function mapRow(row: Record<string, unknown>): EmployeeRole {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name ?? ""),
    defaultHourlyRate:
      row.default_hourly_rate == null ? null : Number(row.default_hourly_rate),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  };
}

export async function listerRolesAction(): Promise<{ success: boolean; roles: EmployeeRole[] }> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return { success: true, roles: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("employee_roles")
    .select("*")
    .eq("company_id", ctx.company.id)
    .order("sort_order");

  return { success: true, roles: (data ?? []).map(mapRow) };
}

export async function enregistrerRoleAction(input: {
  id?: string;
  name: string;
  /** `null` = pas encore renseigné. Zéro reste saisissable pour un stagiaire. */
  defaultHourlyRate: number | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<{ success: boolean; error?: string; role?: EmployeeRole }> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Le nom du rôle est requis." };

  const supabase = await createClient();
  const payload = {
    company_id: ctx.company.id,
    name,
    default_hourly_rate: input.defaultHourlyRate,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };

  const requete = input.id
    ? supabase.from("employee_roles").update(payload).eq("id", input.id).eq("company_id", ctx.company.id)
    : supabase.from("employee_roles").insert(payload);

  const { data, error } = await requete.select("*").single();

  if (error || !data) {
    // L'index unique parle en anglais et cite des noms de contrainte. On
    // traduit la seule erreur que l'employeur peut provoquer.
    const doublon = error?.message?.includes("employee_roles_nom_unique");
    return {
      success: false,
      error: doublon
        ? `Un rôle « ${name} » existe déjà. Choisissez un autre nom.`
        : "Impossible d'enregistrer le rôle.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, role: mapRow(data as Record<string, unknown>) };
}

export async function supprimerRoleAction(
  roleId: string,
): Promise<{ success: boolean; error?: string; employesTouches?: number }> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const supabase = await createClient();

  // On compte AVANT de supprimer, pour pouvoir dire combien de fiches perdent
  // leur niveau. La contrainte est ON DELETE SET NULL : aucun employé n'est
  // effacé, mais l'employeur mérite de savoir ce qu'il vient de vider.
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.company.id)
    .eq("role_id", roleId);

  const { error } = await supabase
    .from("employee_roles")
    .delete()
    .eq("id", roleId)
    .eq("company_id", ctx.company.id);

  if (error) return { success: false, error: "Impossible de supprimer le rôle." };

  revalidatePath("/settings");
  revalidatePath("/employees");
  return { success: true, employesTouches: count ?? 0 };
}
