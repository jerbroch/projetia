"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  countOpenToolsForEmployee,
  getFieldJobById,
  mapFieldHourRow,
  mapFieldMaterialRow,
  searchFieldCatalogItems,
  updateScheduledJobFieldFieldsAdmin,
} from "@/lib/data/field-data";
import {
  getScheduledJobById,
  mapScheduleRow,
} from "@/lib/data/tenant-data";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  buildFieldCompletionSummary,
  canCompleteFieldWork,
  canEditFieldNotes,
  canEnterFieldHours,
  canEnterFieldMaterials,
  canUpdateFieldStatus,
  canViewJobAsEmployee,
} from "@/lib/field-permissions";
import type { JobWorkflowStatus } from "@/lib/job-workflow";
import { requireFieldContext, requireTenantContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FieldHour, FieldMaterial, ScheduleEvent } from "@/types";

export type FieldActionResult<T = void> =
  | { success: true; data?: T; event?: ScheduleEvent }
  | { success: false; error: string };

const fieldHourSchema = z.object({
  jobId: z.string().uuid(),
  workDate: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  hours: z.coerce.number().positive("Les heures doivent être supérieures à 0"),
  laborType: z.string().optional(),
  notes: z.string().optional(),
});

const fieldMaterialSchema = z.object({
  jobId: z.string().uuid(),
  catalogItemId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Le nom est requis"),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("La quantité doit être supérieure à 0"),
  unit: z.string().trim().min(1).default("unité"),
  notes: z.string().optional(),
  isCustom: z.coerce.boolean().optional(),
});

function revalidateFieldPaths(jobId?: string) {
  revalidatePath("/terrain");
  revalidatePath("/terrain/horaire");
  if (jobId) revalidatePath(`/terrain/calls/${jobId}`);
}

async function loadJobForActor(
  jobId: string,
  opts: { fieldOnly?: boolean } = {}
): Promise<
  | { success: true; ctx: Awaited<ReturnType<typeof requireTenantContext>>; job: ScheduleEvent }
  | { success: false; error: string }
> {
  const ctx = opts.fieldOnly ? await requireFieldContext() : await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Utilisez le mode démo localement." };

  const job = opts.fieldOnly
    ? await getFieldJobById(ctx.company.id, jobId, ctx.employeeId!, false)
    : await getScheduledJobById(ctx.company.id, jobId, false);

  if (!job) return { success: false, error: "Call introuvable ou accès refusé." };

  if (opts.fieldOnly && !canViewJobAsEmployee(job, ctx.employeeId)) {
    return { success: false, error: "Accès refusé à ce call." };
  }

  return { success: true, ctx, job };
}

export async function updateFieldJobStatusAction(
  jobId: string,
  newStatus: JobWorkflowStatus
): Promise<FieldActionResult> {
  const loaded = await loadJobForActor(jobId, { fieldOnly: true });
  if (!loaded.success) return loaded;

  const { ctx, job } = loaded;
  if (!canUpdateFieldStatus(ctx.membershipRole, job, ctx.employeeId, newStatus)) {
    return { success: false, error: "Changement de statut non autorisé." };
  }

  if (!isSupabaseAdminConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const now = new Date().toISOString();
  const fieldUpdates: Parameters<typeof updateScheduledJobFieldFieldsAdmin>[2] = {
    status: newStatus,
  };
  if (newStatus === "completed") {
    fieldUpdates.workCompletedAt = now;
    fieldUpdates.fieldReadyForReview = true;
  }

  const { data, error } = await updateScheduledJobFieldFieldsAdmin(
    ctx.company.id,
    jobId,
    fieldUpdates
  );
  if (error || !data) {
    console.error("[updateFieldJobStatusAction]", error?.message);
    return { success: false, error: "Impossible de mettre à jour le statut." };
  }

  revalidateFieldPaths(jobId);
  return { success: true, event: mapScheduleRow(data as Record<string, unknown>) };
}

export async function completeFieldWorkAction(jobId: string): Promise<
  FieldActionResult<ReturnType<typeof buildFieldCompletionSummary>>
> {
  const loaded = await loadJobForActor(jobId, { fieldOnly: true });
  if (!loaded.success) return loaded;

  const { ctx, job } = loaded;
  if (!canCompleteFieldWork(ctx.membershipRole, job, ctx.employeeId)) {
    return { success: false, error: "Impossible de terminer ce call." };
  }

  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  const supabase = await createClient();

  const [{ data: hoursRows }, { data: materialRows }, toolsCount] = await Promise.all([
    supabase.from("field_hours").select("*").eq("scheduled_job_id", jobId),
    supabase.from("field_materials").select("*").eq("scheduled_job_id", jobId),
    countOpenToolsForEmployee(ctx.company.id, ctx.employeeId!),
  ]);

  const summary = buildFieldCompletionSummary(
    (hoursRows ?? []).map((row) => mapFieldHourRow(row as Record<string, unknown>)),
    (materialRows ?? []).map((row) => mapFieldMaterialRow(row as Record<string, unknown>)),
    toolsCount,
    job.fieldNotes
  );

  const statusResult = await updateFieldJobStatusAction(jobId, "completed");
  if (!statusResult.success) return statusResult;

  revalidateFieldPaths(jobId);
  return { success: true, data: summary, event: statusResult.event };
}

export async function saveFieldHourAction(formData: FormData): Promise<FieldActionResult<FieldHour>> {
  const loaded = await loadJobForActor(String(formData.get("jobId")), { fieldOnly: true });
  if (!loaded.success) return loaded;

  const parsed = fieldHourSchema.safeParse({
    jobId: formData.get("jobId"),
    workDate: formData.get("workDate"),
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    hours: formData.get("hours"),
    laborType: formData.get("laborType") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { ctx, job } = loaded;
  if (!canEnterFieldHours(ctx.membershipRole, job, ctx.employeeId)) {
    return { success: false, error: "Saisie des heures non autorisée." };
  }

  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("field_hours")
    .insert({
      company_id: ctx.company.id,
      scheduled_job_id: parsed.data.jobId,
      employee_id: ctx.employeeId,
      work_date: parsed.data.workDate,
      start_time: parsed.data.startTime || null,
      end_time: parsed.data.endTime || null,
      hours: parsed.data.hours,
      labor_type: parsed.data.laborType || null,
      notes: parsed.data.notes || null,
      created_by_user_id: ctx.user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[saveFieldHourAction]", error?.message);
    return { success: false, error: "Impossible d'enregistrer les heures." };
  }

  revalidateFieldPaths(parsed.data.jobId);
  return { success: true, data: mapFieldHourRow(data as Record<string, unknown>) };
}

export async function saveFieldMaterialAction(
  formData: FormData
): Promise<FieldActionResult<FieldMaterial>> {
  const loaded = await loadJobForActor(String(formData.get("jobId")), { fieldOnly: true });
  if (!loaded.success) return loaded;

  const parsed = fieldMaterialSchema.safeParse({
    jobId: formData.get("jobId"),
    catalogItemId: formData.get("catalogItemId") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    quantity: formData.get("quantity"),
    unit: formData.get("unit") || "unité",
    notes: formData.get("notes") || undefined,
    isCustom: formData.get("isCustom") === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const { ctx, job } = loaded;
  if (!canEnterFieldMaterials(ctx.membershipRole, job, ctx.employeeId)) {
    return { success: false, error: "Saisie des matériaux non autorisée." };
  }

  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("field_materials")
    .insert({
      company_id: ctx.company.id,
      scheduled_job_id: parsed.data.jobId,
      employee_id: ctx.employeeId,
      catalog_item_id: parsed.data.catalogItemId || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      notes: parsed.data.notes || null,
      is_custom: parsed.data.isCustom ?? !parsed.data.catalogItemId,
      created_by_user_id: ctx.user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[saveFieldMaterialAction]", error?.message);
    return { success: false, error: "Impossible d'enregistrer le matériau." };
  }

  revalidateFieldPaths(parsed.data.jobId);
  return { success: true, data: mapFieldMaterialRow(data as Record<string, unknown>) };
}

export async function updateFieldNotesAction(
  jobId: string,
  fieldNotes: string
): Promise<FieldActionResult> {
  const loaded = await loadJobForActor(jobId, { fieldOnly: true });
  if (!loaded.success) return loaded;

  const { ctx, job } = loaded;
  if (!canEditFieldNotes(ctx.membershipRole, job, ctx.employeeId)) {
    return { success: false, error: "Modification des notes non autorisée." };
  }

  if (!isSupabaseAdminConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const { data, error } = await updateScheduledJobFieldFieldsAdmin(ctx.company.id, jobId, {
    fieldNotes,
  });
  if (error || !data) {
    return { success: false, error: "Impossible de mettre à jour les notes." };
  }

  revalidateFieldPaths(jobId);
  return { success: true, event: mapScheduleRow(data as Record<string, unknown>) };
}

export async function searchFieldCatalogAction(query: string) {
  const ctx = await requireFieldContext();
  return searchFieldCatalogItems(ctx.company.id, query);
}

export async function getFieldCompletionPreviewAction(jobId: string) {
  const loaded = await loadJobForActor(jobId, { fieldOnly: true });
  if (!loaded.success) return loaded;

  const { ctx, job } = loaded;
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };
  const supabase = await createClient();

  const [{ data: hoursRows }, { data: materialRows }, toolsCount] = await Promise.all([
    supabase.from("field_hours").select("*").eq("scheduled_job_id", jobId),
    supabase.from("field_materials").select("*").eq("scheduled_job_id", jobId),
    countOpenToolsForEmployee(ctx.company.id, ctx.employeeId!),
  ]);

  return {
    success: true as const,
    data: buildFieldCompletionSummary(
      (hoursRows ?? []).map((row) => mapFieldHourRow(row as Record<string, unknown>)),
      (materialRows ?? []).map((row) => mapFieldMaterialRow(row as Record<string, unknown>)),
      toolsCount,
      job.fieldNotes
    ),
  };
}
