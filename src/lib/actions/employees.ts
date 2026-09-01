"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeForCompany,
  mapEmployeeRow,
  updateEmployeeForCompany,
} from "@/lib/data/tenant-data";
import { grantEmployeeAccessAction } from "@/lib/actions/employee-access";
import { refusAvecFicheCreee } from "@/lib/billing/seat-limit";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/session";
import { employeeFormSchema } from "@/lib/validations/employees";
import type { Employee } from "@/types";
import { getEmployees } from "@/lib/data/tenant-data";
import {
  normaliserCourriel,
  refusCourrielEnDouble,
  trouverPorteur,
} from "@/lib/employee-email-uniqueness";

export type EmployeeActionResult =
  | { success: true; employee: Employee }
  | { success: false; error: string };

function safeError(message: string): EmployeeActionResult {
  return { success: false, error: message };
}

function parseEmployeeForm(formData: FormData) {
  return employeeFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    trade: formData.get("trade"),
    roleId: formData.get("roleId") || undefined,
    email: formData.get("email") || undefined,
    mobilePhone: formData.get("mobilePhone") || undefined,
    truckNumber: formData.get("truckNumber") || undefined,
    status: formData.get("status") || undefined,
    profilePhoto: formData.get("profilePhoto") || undefined,
    notes: formData.get("notes") || undefined,
    department: formData.get("department") || undefined,
    hireDate: formData.get("hireDate") || undefined,
    hourlyRate: formData.get("hourlyRate") || undefined,
    grantAppAccess: formData.get("grantAppAccess") === "true",
  });
}

function toEmployeeInput(parsed: NonNullable<ReturnType<typeof parseEmployeeForm>["data"]>) {
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    trade: parsed.trade,
    roleId: parsed.roleId || null,
    // Enregistré en minuscules : une adresse est insensible à la casse, et
    // « PART-@X.TEST » affiché en majuscules sème le doute sans rien apporter.
    // L'unicité s'appuie déjà sur lower(email) — le stockage suit la règle.
    email: normaliserCourriel(parsed.email) || undefined,
    phone: parsed.mobilePhone || undefined,
    truckNumber: parsed.truckNumber || undefined,
    status: parsed.status ?? ("active" as const),
    profilePhoto: parsed.profilePhoto || undefined,
    notes: parsed.notes || undefined,
    department: parsed.department || undefined,
    hireDate: parsed.hireDate || undefined,
    hourlyRate: parsed.hourlyRate ? Number(parsed.hourlyRate) : undefined,
  };
}


/**
 * Refuse un courriel déjà porté par un autre employé de l'entreprise.
 *
 * La vérification lit la liste complète plutôt que d'interroger la base sur
 * l'adresse : c'est la même source que celle affichée, donc le message ne peut
 * pas contredire ce que l'utilisateur voit à l'écran.
 */
async function refuserSiCourrielPris(
  companyId: string,
  email: string | null | undefined,
  employeIdCourant?: string,
  transfertAutorise = false,
): Promise<string | null> {
  if (!normaliserCourriel(email)) return null;
  const employes = await getEmployees(companyId, false);

  // Transfert explicite : on retire l'adresse au porteur au lieu de refuser.
  // Sans ça il faut vider la première fiche, l'enregistrer, puis remplir la
  // seconde — trois gestes pour déplacer un courriel d'un gars à l'autre.
  if (transfertAutorise) {
    const porteur = trouverPorteur(email, employes, employeIdCourant);
    if (porteur) {
      const admin = createAdminClient();
      const { error } = await admin
        .from("employees")
        .update({ email: null, app_access_invited_at: null })
        .eq("id", porteur.id)
        .eq("company_id", companyId);
      if (error) return "Impossible de libérer le courriel de l'autre employé.";
    }
    return null;
  }

  return refusCourrielEnDouble(email, employes, employeIdCourant);
}

export async function createEmployeeAction(formData: FormData): Promise<EmployeeActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const doublon = await refuserSiCourrielPris(
    ctx.company.id,
    parsed.data.email,
    undefined,
    formData.get("transfertCourriel") === "true",
  );
  if (doublon) return safeError(doublon);

  const { data, error } = await createEmployeeForCompany(ctx.company.id, toEmployeeInput(parsed.data));

  if (error || !data) {
    console.error("[createEmployeeAction]", error?.message);
    return safeError("Impossible d'ajouter l'employé.");
  }

  const employee = mapEmployeeRow(data as Record<string, unknown>);

  if (parsed.data.grantAppAccess) {
    const accessResult = await grantEmployeeAccessAction(employee.id);
    if (!accessResult.success) {
      // La fiche existe déjà à ce stade : le dire, sinon l'employeur croit que
      // rien ne s'est passé et recommence.
      return safeError(
        refusAvecFicheCreee(
          accessResult.error ?? "L'invitation n'a pas pu être envoyée.",
          `${employee.firstName} ${employee.lastName}`.trim(),
        ),
      );
    }
    revalidatePath("/employees");
    revalidatePath("/dashboard");
    revalidatePath("/schedule");
    return { success: true, employee: accessResult.employee };
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");

  return { success: true, employee: mapEmployeeRow(data as Record<string, unknown>) };
}

export async function updateEmployeeAction(
  employeeId: string,
  formData: FormData
): Promise<EmployeeActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const doublon = await refuserSiCourrielPris(
    ctx.company.id,
    parsed.data.email,
    employeeId,
    formData.get("transfertCourriel") === "true",
  );
  if (doublon) return safeError(doublon);

  const { data, error } = await updateEmployeeForCompany(
    ctx.company.id,
    employeeId,
    toEmployeeInput(parsed.data)
  );

  if (error || !data) {
    console.error("[updateEmployeeAction]", error?.message);
    return safeError("Impossible de mettre à jour l'employé.");
  }

  let employee = mapEmployeeRow(data as Record<string, unknown>);

  if (
    parsed.data.grantAppAccess &&
    (employee.appAccessStatus === "none" || employee.appAccessStatus === "inactive")
  ) {
    const accessResult = await grantEmployeeAccessAction(employeeId);
    if (!accessResult.success) {
      return safeError(accessResult.error);
    }
    employee = accessResult.employee;
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");

  return { success: true, employee };
}

export async function deactivateEmployeeAction(employeeId: string): Promise<EmployeeActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const { data, error } = await updateEmployeeForCompany(ctx.company.id, employeeId, {
    status: "inactive",
  });

  if (error || !data) {
    console.error("[deactivateEmployeeAction]", error?.message);
    return safeError("Impossible de désactiver l'employé.");
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");

  return { success: true, employee: mapEmployeeRow(data as Record<string, unknown>) };
}
