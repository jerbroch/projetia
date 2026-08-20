import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { JobWorkflowStatus } from "@/lib/job-workflow";
import { filterJobsForEmployee } from "@/lib/field-permissions";
import { getScheduleEvents, getEmployees, mapScheduleRow } from "@/lib/data/tenant-data";
import { getToolsWithDetails } from "@/lib/data/tools-data";
import { isAssignmentOpen } from "@/lib/tool-utils";
import type {
  FieldCatalogItem,
  FieldHour,
  FieldMaterial,
  ScheduleEvent,
  ToolListItem,
} from "@/types";

export function mapFieldHourRow(row: Record<string, unknown>): FieldHour {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    scheduledJobId: String(row.scheduled_job_id),
    employeeId: String(row.employee_id),
    workDate: String(row.work_date).slice(0, 10),
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    hours: Number(row.hours),
    laborType: row.labor_type ? String(row.labor_type) : null,
    notes: row.notes ? String(row.notes) : null,
    timerStartedAt: row.timer_started_at ? String(row.timer_started_at) : null,
    timerStoppedAt: row.timer_stopped_at ? String(row.timer_stopped_at) : null,
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdAt: String(row.created_at),
  };
}

export function mapFieldMaterialRow(row: Record<string, unknown>): FieldMaterial {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    scheduledJobId: String(row.scheduled_job_id),
    employeeId: String(row.employee_id),
    catalogItemId: row.catalog_item_id ? String(row.catalog_item_id) : null,
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    quantity: Number(row.quantity),
    unit: String(row.unit ?? "unité"),
    notes: row.notes ? String(row.notes) : null,
    isCustom: Boolean(row.is_custom),
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdAt: String(row.created_at),
  };
}

export async function getFieldJobsForEmployee(
  companyId: string,
  employeeId: string,
  isDemo: boolean
): Promise<ScheduleEvent[]> {
  const jobs = await getScheduleEvents(companyId, isDemo);
  return filterJobsForEmployee(jobs, employeeId);
}

export async function getFieldJobById(
  companyId: string,
  jobId: string,
  employeeId: string,
  isDemo: boolean
): Promise<ScheduleEvent | null> {
  const jobs = await getFieldJobsForEmployeeScoped(companyId, employeeId, isDemo);
  return jobs.find((job) => job.id === jobId) ?? null;
}

export async function getFieldHoursForJob(
  companyId: string,
  jobId: string
): Promise<FieldHour[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("field_hours")
    .select("*")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId)
    .order("work_date", { ascending: false });

  if (error) {
    console.error("[getFieldHoursForJob]", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapFieldHourRow(row as Record<string, unknown>));
}

export async function getFieldMaterialsForJob(
  companyId: string,
  jobId: string
): Promise<FieldMaterial[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("field_materials")
    .select("*")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getFieldMaterialsForJob]", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapFieldMaterialRow(row as Record<string, unknown>));
}

export async function searchFieldCatalogItems(
  companyId: string,
  query: string,
  limit = 20
): Promise<FieldCatalogItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  let request = supabase
    .from("material_catalog_items")
    .select("id, name, unit, category_id")
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .limit(limit);

  const trimmed = query.trim();
  if (trimmed) {
    request = request.ilike("name", `%${trimmed}%`);
  }

  const { data, error } = await request.order("name");
  if (error) {
    console.error("[searchFieldCatalogItems]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    unit: String(row.unit ?? "unité"),
    category: row.category_id ? String(row.category_id) : null,
  }));
}

export async function getEmployeeToolsForField(
  companyId: string,
  employeeId: string,
  isDemo: boolean
): Promise<ToolListItem[]> {
  const employees = await getEmployees(companyId, isDemo);
  const tools = await getToolsWithDetails(companyId, isDemo, employees);
  return tools.filter((tool: ToolListItem) => tool.currentEmployeeId === employeeId);
}

export async function fetchAssignedJobsFromDb(companyId: string): Promise<ScheduleEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("start_at", { ascending: true });

  if (error) {
    console.error("[fetchAssignedJobsFromDb]", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapScheduleRow(row as Record<string, unknown>));
}

export async function getFieldJobsForEmployeeScoped(
  companyId: string,
  employeeId: string,
  isDemo: boolean
): Promise<ScheduleEvent[]> {
  if (isDemo) {
    return getFieldJobsForEmployee(companyId, employeeId, true);
  }
  const jobs = await fetchAssignedJobsFromDb(companyId);
  return filterJobsForEmployee(jobs, employeeId);
}

/** Server-only: narrow scheduled_jobs update for field workers (bypasses RLS). */
export async function updateScheduledJobFieldFieldsAdmin(
  companyId: string,
  jobId: string,
  updates: {
    status?: JobWorkflowStatus;
    workCompletedAt?: string | null;
    fieldReadyForReview?: boolean;
    fieldNotes?: string | null;
  }
) {
  if (!isSupabaseAdminConfigured()) {
    return { data: null, error: { message: "Supabase admin client is not configured." } };
  }

  const payload: Record<string, unknown> = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.workCompletedAt !== undefined) payload.work_completed_at = updates.workCompletedAt;
  if (updates.fieldReadyForReview !== undefined) {
    payload.field_ready_for_review = updates.fieldReadyForReview;
  }
  if (updates.fieldNotes !== undefined) payload.field_notes = updates.fieldNotes;

  const admin = createAdminClient();
  return admin
    .from("scheduled_jobs")
    .update(payload)
    .eq("id", jobId)
    .eq("company_id", companyId)
    .select("*")
    .single();
}

export async function countOpenToolsForEmployee(
  companyId: string,
  employeeId: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_assignments")
    .select("id, status, start_date, expected_return_date, actual_return_date, tool_id, employee_id, company_id, created_at, updated_at")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId);

  if (error) return 0;
  return (data ?? []).filter((row) =>
    isAssignmentOpen({
      status: row.status as "active" | "reserved" | "returned",
      actualReturnDate: row.actual_return_date ? String(row.actual_return_date).slice(0, 10) : undefined,
    })
  ).length;
}
