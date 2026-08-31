"use server";

import { revalidatePath } from "next/cache";
import {
  checkAssignmentOverlap,
  createToolAssignment,
  createToolForCompany,
  getToolAssignmentsForTool,
  getToolById,
  getToolsWithDetails,
  insertToolSmsReminder,
  mapToolAssignmentRow,
  mapToolRow,
  returnToolAssignment,
  updateToolForCompany,
} from "@/lib/data/tools-data";
import { getEmployees } from "@/lib/data/tenant-data";
import { sendSms } from "@/lib/sms/send-sms";
import { hasAdminAccess, requireAdminContext, requireTenantContext } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { validateCheckoutStartDate } from "@/lib/tool-utils";
import {
  resolveToolCategory,
  toolAssignSchema,
  toolFormSchema,
  toolReturnSchema,
  toolSmsSchema,
} from "@/lib/validations/tools";
import type { Tool, ToolListItem, ToolWithDetails } from "@/types";

export type ToolActionResult =
  | { success: true; tool: Tool }
  | { success: false; error: string };

export type ToolDetailResult =
  | { success: true; tool: ToolWithDetails }
  | { success: false; error: string };

export type ToolListResult =
  | { success: true; tools: ToolListItem[] }
  | { success: false; error: string };

export type ToolAssignResult =
  | { success: true; tool: ToolWithDetails }
  | { success: false; error: string };

export type ToolSmsResult =
  | { success: true; tool: ToolWithDetails }
  | { success: false; error: string };

function safeError(message: string): { success: false; error: string } {
  return { success: false, error: message };
}

function parseToolForm(formData: FormData) {
  return toolFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    customCategory: formData.get("customCategory") || undefined,
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    serialNumber: formData.get("serialNumber") || undefined,
    internalNumber: formData.get("internalNumber") || undefined,
    description: formData.get("description") || undefined,
    condition: formData.get("condition") || undefined,
    baseStatus: formData.get("baseStatus") || undefined,
  });
}

function revalidateOutillage() {
  revalidatePath("/outillage");
  revalidatePath("/employees");
}

export async function createToolAction(formData: FormData): Promise<ToolActionResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseToolForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const category = resolveToolCategory(parsed.data);
  const { data, error } = await createToolForCompany(ctx.company.id, {
    name: parsed.data.name,
    category,
    brand: parsed.data.brand,
    model: parsed.data.model,
    serialNumber: parsed.data.serialNumber,
    internalNumber: parsed.data.internalNumber,
    description: parsed.data.description,
    condition: parsed.data.condition,
    baseStatus: parsed.data.baseStatus,
  });

  if (error || !data) {
    console.error("[createToolAction]", error?.message);
    return safeError("Impossible d'ajouter l'outil.");
  }

  revalidateOutillage();
  return { success: true, tool: mapToolRow(data as Record<string, unknown>) };
}

export async function updateToolAction(
  toolId: string,
  formData: FormData,
): Promise<ToolActionResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = parseToolForm(formData);
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const category = resolveToolCategory(parsed.data);
  const { data, error } = await updateToolForCompany(ctx.company.id, toolId, {
    name: parsed.data.name,
    category,
    brand: parsed.data.brand ?? "",
    model: parsed.data.model ?? "",
    serialNumber: parsed.data.serialNumber ?? "",
    internalNumber: parsed.data.internalNumber ?? "",
    description: parsed.data.description ?? "",
    condition: parsed.data.condition,
    baseStatus: parsed.data.baseStatus,
  });

  if (error || !data) {
    console.error("[updateToolAction]", error?.message);
    return safeError("Impossible de mettre à jour l'outil.");
  }

  revalidateOutillage();
  return { success: true, tool: mapToolRow(data as Record<string, unknown>) };
}

export async function assignToolAction(
  toolId: string,
  formData: FormData,
): Promise<ToolAssignResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = toolAssignSchema.safeParse({
    employeeId: formData.get("employeeId"),
    startDate: formData.get("startDate"),
    durationDays: formData.get("durationDays"),
    expectedReturnDate: formData.get("expectedReturnDate"),
    notes: formData.get("notes") || undefined,
    mode: formData.get("mode") || "assign",
      // Facultatif : présent seulement quand l'assignation part d'un call.
      scheduledJobId: formData.get("scheduledJobId") || undefined,
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const modeError = validateCheckoutStartDate(parsed.data.mode, parsed.data.startDate);
  if (modeError) return safeError(modeError);

  const employees = await getEmployees(ctx.company.id, false);
  const existingTool = await getToolById(ctx.company.id, toolId, false, employees);
  if (!existingTool) return safeError("Outil introuvable.");
  if (existingTool.baseStatus === "in_repair" || existingTool.baseStatus === "out_of_service") {
    return safeError(
      parsed.data.mode === "reserve"
        ? "Cet outil ne peut pas être réservé dans son état actuel."
        : "Cet outil ne peut pas être assigné dans son état actuel.",
    );
  }
  if (existingTool.currentAssignment) {
    return safeError(
      parsed.data.mode === "reserve"
        ? "Cet outil est déjà en utilisation."
        : "Cet outil est déjà assigné.",
    );
  }

  const { data: existingRows } = await getToolAssignmentsForTool(ctx.company.id, toolId);
  const assignments = (existingRows ?? []).map(mapToolAssignmentRow);
  const overlapError = checkAssignmentOverlap(
    assignments,
    parsed.data.startDate,
    parsed.data.expectedReturnDate,
  );
  if (overlapError) return safeError(overlapError);

  const { error } = await createToolAssignment(ctx.company.id, toolId, {
    employeeId: parsed.data.employeeId,
    startDate: parsed.data.startDate,
    expectedReturnDate: parsed.data.expectedReturnDate,
    notes: parsed.data.notes,
    createdByUserId: ctx.user.id,
      scheduledJobId: parsed.data.scheduledJobId ?? null,
  });

  if (error) {
    console.error("[assignToolAction]", error.message);
    return safeError("Impossible d'assigner l'outil.");
  }

  revalidateOutillage();
  const tool = await getToolById(ctx.company.id, toolId, false, employees);
  if (!tool) return safeError("Outil introuvable.");
  return { success: true, tool };
}

export async function returnToolAction(
  toolId: string,
  assignmentId: string,
  formData: FormData,
): Promise<ToolAssignResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = toolReturnSchema.safeParse({
    actualReturnDate: formData.get("actualReturnDate"),
    returnCondition: formData.get("returnCondition"),
    setInRepair: formData.get("setInRepair") === "true",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const { error: returnError } = await returnToolAssignment(ctx.company.id, assignmentId, {
    actualReturnDate: parsed.data.actualReturnDate,
    returnCondition: parsed.data.returnCondition,
    notes: parsed.data.notes,
  });

  if (returnError) {
    console.error("[returnToolAction]", returnError.message);
    return safeError("Impossible d'enregistrer le retour.");
  }

  if (parsed.data.setInRepair) {
    await updateToolForCompany(ctx.company.id, toolId, { baseStatus: "in_repair" });
  }

  revalidateOutillage();
  const employees = await getEmployees(ctx.company.id, false);
  const tool = await getToolById(ctx.company.id, toolId, false, employees);
  if (!tool) return safeError("Outil introuvable.");
  return { success: true, tool };
}

export async function sendToolSmsAction(
  toolId: string,
  formData: FormData,
): Promise<ToolSmsResult> {
  const ctx = await requireAdminContext();
  if (ctx.isDemo) return safeError("Utilisez le mode démo localement.");
  if (!isSupabaseConfigured()) return safeError("Supabase n'est pas configuré.");

  const parsed = toolSmsSchema.safeParse({
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return safeError(parsed.error.errors[0]?.message ?? "Données invalides");
  }

  const employees = await getEmployees(ctx.company.id, false);
  const tool = await getToolById(ctx.company.id, toolId, false, employees);
  if (!tool?.currentAssignment) {
    return safeError("Aucune assignation active pour cet outil.");
  }

  const phone = tool.currentAssignment.employeePhone;
  if (!phone?.trim()) {
    return safeError("Aucun numéro de téléphone pour cet employé.");
  }

  const smsResult = await sendSms({ to: phone, message: parsed.data.message });

  const { error } = await insertToolSmsReminder(ctx.company.id, {
    toolId,
    employeeId: tool.currentAssignment.employeeId,
    phone,
    message: parsed.data.message,
    sentByUserId: ctx.user.id,
    status: smsResult.sent ? "sent" : "failed",
    provider: smsResult.provider,
    providerId: smsResult.providerId,
  });

  if (error) {
    console.error("[sendToolSmsAction]", error.message);
    return safeError("Impossible d'enregistrer l'historique SMS.");
  }

  if (!smsResult.sent) {
    return safeError(smsResult.error ?? "Échec de l'envoi du SMS.");
  }

  revalidateOutillage();
  const updated = await getToolById(ctx.company.id, toolId, false, employees);
  if (!updated) return safeError("Outil introuvable.");
  return { success: true, tool: updated };
}

export async function refreshToolsAction(): Promise<ToolListResult> {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);
  const tools = await getToolsWithDetails(ctx.company.id, ctx.isDemo, employees);

  if (!hasAdminAccess(ctx.membershipRole)) {
    const selfEmployee = employees.find(
      (e) => e.email.trim().toLowerCase() === ctx.user.email.trim().toLowerCase(),
    );
    if (selfEmployee) {
      return {
        success: true,
        tools: tools.filter((t) => t.currentEmployeeId === selfEmployee.id),
      };
    }
    return { success: true, tools: [] };
  }

  return { success: true, tools };
}

export async function getToolDetailAction(toolId: string): Promise<ToolDetailResult> {
  const ctx = await requireTenantContext();
  const employees = await getEmployees(ctx.company.id, ctx.isDemo);
  const tool = await getToolById(ctx.company.id, toolId, ctx.isDemo, employees);

  if (!tool) return safeError("Outil introuvable.");

  if (!hasAdminAccess(ctx.membershipRole)) {
    const selfEmployee = employees.find(
      (e) => e.email.trim().toLowerCase() === ctx.user.email.trim().toLowerCase(),
    );
    const isOwn =
      tool.currentAssignment?.employeeId === selfEmployee?.id ||
      tool.futureReservations.some((r) => r.employeeId === selfEmployee?.id);
    if (!isOwn) return safeError("Accès refusé.");
  }

  return { success: true, tool };
}