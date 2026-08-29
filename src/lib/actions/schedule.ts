"use server";

import { revalidatePath } from "next/cache";
import {
  getCustomers,
  getEmployees,
  getQuoteById,
  getScheduledJobById,
  getScheduledJobByQuoteId,
  insertScheduledJobForCompany,
  mapScheduleRow,
  updateScheduledJobForCompany,
} from "@/lib/data/tenant-data";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { buildQuoteScheduleNotes, canScheduleQuote } from "@/lib/quote-utils";
import { buildQuoteEstimationSnapshot } from "@/lib/quote-cost-utils";
import {
  buildDateTime,
  buildScheduleEventFromQuote,
  mergeScheduleJobForUpdate,
  type QuoteScheduleFormValues,
} from "@/lib/schedule-utils";
import { getEmployeeFullName } from "@/lib/employee-utils";
import {
  canQuickChangeToStatus,
  type JobWorkflowStatus,
} from "@/lib/job-workflow";
import { canUpdateFieldStatus } from "@/lib/field-permissions";
import { requireTenantContext } from "@/lib/session";
import { scheduleFromQuoteSchema, scheduleJobSchema } from "@/lib/validations/schedule";
import type { ScheduleEvent } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { decalageDuCall } from "@/lib/job-shifts";
import { decalerPlagesDuCall } from "@/lib/data/job-shifts-data";

export type ScheduleQuoteResult =
  | { success: true; event: ScheduleEvent; scheduledJobId: string }
  | { success: false; error: string; existingJobId?: string };

export type ScheduleJobResult =
  | { success: true; event: ScheduleEvent }
  | { success: true; deleted: true; jobId: string }
  | { success: false; error: string };

function revalidateSchedulePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  revalidatePath("/archives");
}

function parseScheduleForm(formData: FormData) {
  return scheduleFromQuoteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    employeeId: formData.get("employeeId") || "",
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes") || "",
    clientPoNumber: formData.get("clientPoNumber") || "",
  });
}

function toFormValues(
  parsed: NonNullable<ReturnType<typeof parseScheduleForm>["data"]>
): QuoteScheduleFormValues {
  return {
    date: parsed.date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    employeeId: parsed.employeeId ?? "",
    status: parsed.status,
    internalNotes: parsed.internalNotes ?? "",
    clientPoNumber: parsed.clientPoNumber ?? "",
  };
}

function parseScheduleJobForm(formData: FormData) {
  const employeeIdsRaw = formData.get("employeeIds");
  let employeeIds: string[] = [];
  if (typeof employeeIdsRaw === "string" && employeeIdsRaw) {
    try {
      employeeIds = JSON.parse(employeeIdsRaw) as string[];
    } catch {
      employeeIds = [];
    }
  }

  return scheduleJobSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || "",
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    status: formData.get("status"),
    type: formData.get("type"),
    employeeIds,
    internalNotes: formData.get("internalNotes") || "",
    clientPoNumber: formData.get("clientPoNumber") || "",
    customerId: formData.get("customerId") || "",
    customerName: formData.get("customerName") || "",
    customerPhone: formData.get("customerPhone") || "",
    customerEmail: formData.get("customerEmail") || "",
    billingAddress: formData.get("billingAddress") || "",
    jobSiteAddress: formData.get("jobSiteAddress") || "",
  });
}

export async function scheduleQuoteAction(formData: FormData): Promise<ScheduleQuoteResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo localement." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const parsed = parseScheduleForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const quote = await getQuoteById(ctx.company.id, parsed.data.quoteId, false);
  if (!quote) {
    return { success: false, error: "Soumission introuvable." };
  }

  if (!canScheduleQuote(quote)) {
    return {
      success: false,
      error: "Cette soumission ne peut pas être planifiée (statut ou dépôt requis).",
    };
  }

  const existing = await getScheduledJobByQuoteId(ctx.company.id, quote.id, false);
  if (existing) {
    return {
      success: false,
      error: "Cette soumission est déjà planifiée.",
      existingJobId: existing.id,
    };
  }

  const [customers, employees] = await Promise.all([
    getCustomers(ctx.company.id, false),
    getEmployees(ctx.company.id, false),
  ]);

  const formValues = toFormValues(parsed.data);
  const notesPrefix = buildQuoteScheduleNotes(quote);
  const internalNotes = formValues.internalNotes
    ? `${notesPrefix}\n${formValues.internalNotes}`
    : notesPrefix;

  const event = buildScheduleEventFromQuote(
    quote,
    { ...formValues, internalNotes },
    customers,
    employees,
    ctx.company.id
  );

  if (parsed.data.clientPoNumber) {
    event.clientPoNumber = parsed.data.clientPoNumber;
  }

  if (quote.costEstimation) {
    event.quoteEstimationSnapshot = buildQuoteEstimationSnapshot(quote);
  }

  const { data, error } = await insertScheduledJobForCompany(ctx.company.id, event);
  if (error || !data) {
    console.error("[scheduleQuoteAction]", error?.message);
    if (error?.code === "23505") {
      return { success: false, error: "Cette soumission est déjà planifiée." };
    }
    return { success: false, error: "Impossible de planifier les travaux." };
  }

  const saved = mapScheduleRow(data as Record<string, unknown>);
  revalidateSchedulePaths();
  return { success: true, event: saved, scheduledJobId: saved.id };
}

export async function updateQuoteScheduleAction(formData: FormData): Promise<ScheduleQuoteResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo localement." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const parsed = parseScheduleForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const quote = await getQuoteById(ctx.company.id, parsed.data.quoteId, false);
  if (!quote) {
    return { success: false, error: "Soumission introuvable." };
  }

  const existing = await getScheduledJobByQuoteId(ctx.company.id, quote.id, false);
  if (!existing) {
    return { success: false, error: "Aucune planification trouvée pour cette soumission." };
  }

  const [customers, employees] = await Promise.all([
    getCustomers(ctx.company.id, false),
    getEmployees(ctx.company.id, false),
  ]);

  const formValues = toFormValues(parsed.data);
  const notesPrefix = buildQuoteScheduleNotes(quote);
  const internalNotes = formValues.internalNotes
    ? `${notesPrefix}\n${formValues.internalNotes}`
    : notesPrefix;

  const event = buildScheduleEventFromQuote(
    quote,
    { ...formValues, internalNotes },
    customers,
    employees,
    ctx.company.id,
    existing
  );

  event.clientPoNumber = parsed.data.clientPoNumber || existing.clientPoNumber;

  const { data, error } = await updateScheduledJobForCompany(
    ctx.company.id,
    existing.id,
    event
  );

  if (error || !data) {
    console.error("[updateQuoteScheduleAction]", error?.message);
    return { success: false, error: "Impossible de modifier la planification." };
  }

  const saved = mapScheduleRow(data as Record<string, unknown>);
  revalidateSchedulePaths();
  return { success: true, event: saved, scheduledJobId: saved.id };
}

export async function saveScheduleJobAction(formData: FormData): Promise<ScheduleJobResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo localement." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const parsed = parseScheduleJobForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const employees = await getEmployees(ctx.company.id, false);
  const selectedEmployees = employees.filter((employee) =>
    parsed.data.employeeIds.includes(employee.id)
  );

  const baseEvent: ScheduleEvent = {
    id: parsed.data.id ?? crypto.randomUUID(),
    companyId: ctx.company.id,
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    start: buildDateTime(parsed.data.date, parsed.data.startTime),
    end: buildDateTime(parsed.data.date, parsed.data.endTime),
    customerId: parsed.data.customerId || undefined,
    customerName: parsed.data.customerName || undefined,
    customerPhone: parsed.data.customerPhone || undefined,
    customerEmail: parsed.data.customerEmail || undefined,
    billingAddress: parsed.data.billingAddress || undefined,
    jobSiteAddress: parsed.data.jobSiteAddress || undefined,
    location: parsed.data.jobSiteAddress || "",
    employeeIds: parsed.data.employeeIds,
    employeeNames: selectedEmployees.map((employee) => getEmployeeFullName(employee)),
    internalNotes: parsed.data.internalNotes,
    status: parsed.data.status,
    type: parsed.data.type,
    clientPoNumber: parsed.data.clientPoNumber || undefined,
    jobOrigin: "direct",
    jobNumberType: "service_call",
  };

  if (parsed.data.id) {
    const existing = await getScheduledJobById(ctx.company.id, parsed.data.id, false);
    if (!existing) {
      return { success: false, error: "Travail introuvable." };
    }

    const event = mergeScheduleJobForUpdate(
      existing,
      {
        ...baseEvent,
        id: existing.id,
        jobNumber: existing.jobNumber,
        jobNumberType: existing.jobNumberType ?? "service_call",
        jobOrigin: existing.jobOrigin ?? "direct",
        quoteId: existing.quoteId,
      },
      "apply-all"
    );

    const { data, error } = await updateScheduledJobForCompany(ctx.company.id, existing.id, event);
    if (error || !data) {
      console.error("[saveScheduleJobAction:update]", error?.message);
      return { success: false, error: "Impossible de modifier le travail." };
    }

    const saved = mapScheduleRow(data as Record<string, unknown>);

    // Un call déplacé emmène les plages de ses employés, pour garder les
    // écarts relatifs. Les effacer forcerait à tout retracer pour un report
    // d'une heure.
    const decalage = decalageDuCall(existing.start, saved.start);
    if (decalage !== 0) {
      await decalerPlagesDuCall(ctx.company.id, saved.id, decalage);
    }
    revalidateSchedulePaths();
    return { success: true, event: saved };
  }

  const { data, error } = await insertScheduledJobForCompany(ctx.company.id, baseEvent);
  if (error || !data) {
    console.error("[saveScheduleJobAction:create]", error?.message);
    return { success: false, error: "Impossible de créer le travail." };
  }

  const saved = mapScheduleRow(data as Record<string, unknown>);
  revalidateSchedulePaths();
  return { success: true, event: saved };
}

export async function deleteScheduleJobAction(jobId: string): Promise<ScheduleJobResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo localement." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("id", jobId)
    .eq("company_id", ctx.company.id);

  if (error) {
    console.error("[deleteScheduleJobAction]", error.message);
    return { success: false, error: "Impossible de supprimer le travail." };
  }

  revalidateSchedulePaths();
  return { success: true, deleted: true, jobId };
}

export async function cancelScheduleJobAction(jobId: string): Promise<ScheduleJobResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo localement." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const existing = await getScheduledJobById(ctx.company.id, jobId, false);
  if (!existing) {
    return { success: false, error: "Travail introuvable." };
  }

  const { data, error } = await updateScheduledJobForCompany(ctx.company.id, jobId, {
    ...existing,
    status: "cancelled",
  });

  if (error || !data) {
    console.error("[cancelScheduleJobAction]", error?.message);
    return { success: false, error: "Impossible d'annuler le travail." };
  }

  const saved = mapScheduleRow(data as Record<string, unknown>);
  revalidateSchedulePaths();
  return { success: true, event: saved };
}

export async function updateScheduleJobStatusAction(
  jobId: string,
  newStatus: JobWorkflowStatus
): Promise<ScheduleJobResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Utilisez le mode démo côté client." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }

  const existing = await getScheduledJobById(ctx.company.id, jobId, false);
  if (!existing) {
    return { success: false, error: "Travail introuvable." };
  }

  if (!canQuickChangeToStatus(ctx.membershipRole, existing.status, newStatus)) {
    return { success: false, error: "Changement de statut non autorisé." };
  }

  if (
    !canUpdateFieldStatus(ctx.membershipRole, existing, ctx.employeeId, newStatus) &&
    ctx.membershipRole === "employee"
  ) {
    return { success: false, error: "Changement de statut non autorisé pour ce call." };
  }

  const now = new Date().toISOString();
  const timestampUpdates: Partial<ScheduleEvent> = {};

  if (newStatus === "completed") {
    timestampUpdates.workCompletedAt = now;
  } else if (newStatus === "pending-review") {
    timestampUpdates.submittedForReviewAt = now;
    timestampUpdates.workCompletedAt = existing.workCompletedAt ?? now;
  } else if (newStatus === "ready-to-invoice") {
    timestampUpdates.approvedBy = ctx.user.id;
    timestampUpdates.approvedAt = now;
  } else if (newStatus === "invoice-sent") {
    timestampUpdates.sentBy = ctx.user.id;
    timestampUpdates.sentAt = now;
  }

  const event = mergeScheduleJobForUpdate(existing, {
    ...existing,
    status: newStatus,
    ...timestampUpdates,
  });

  const { data, error } = await updateScheduledJobForCompany(ctx.company.id, jobId, event);
  if (error || !data) {
    console.error("[updateScheduleJobStatusAction]", error?.message);
    return { success: false, error: "Impossible de mettre à jour le statut." };
  }

  const saved = mapScheduleRow(data as Record<string, unknown>);
  revalidateSchedulePaths();
  return { success: true, event: saved };
}
