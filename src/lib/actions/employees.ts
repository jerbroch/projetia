"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeForCompany,
  mapEmployeeRow,
  updateEmployeeForCompany,
} from "@/lib/data/tenant-data";
import { grantEmployeeAccessAction } from "@/lib/actions/employee-access";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/session";
import { employeeFormSchema } from "@/lib/validations/employees";
import type { Employee } from "@/types";

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
    email: parsed.email || undefined,
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

export async function createEmployeeAction(formData: FormData): Promise<EmployeeActionResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { data, error } = await createEmployeeForCompany(ctx.company.id, toEmployeeInput(parsed.data));

  if (error || !data) {
    console.error("[createEmployeeAction]", error?.message);
    return safeError("Impossible d'ajouter l'employé.");
  }

  const employee = mapEmployeeRow(data as Record<string, unknown>);

  if (parsed.data.grantAppAccess) {
    const accessResult = await grantEmployeeAccessAction(employee.id);
    if (!accessResult.success) {
      return safeError(accessResult.error);
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

  if (parsed.data.grantAppAccess && employee.appAccessStatus !== "active") {
    const accessResult = await grantEmployeeAccessAction(employeeId);
    if (!accessResult.success) {
      return safeError(accessResult.error);
    }
    employee = accessResult.employee;
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");

  return { success: true, employee: mapEmployeeRow(data as Record<string, unknown>) };
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
