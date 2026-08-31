import {
  canQuickChangeToStatus,
  FIELD_QUICK_STATUSES,
  type JobWorkflowStatus,
} from "@/lib/job-workflow";
import type { FieldHour, FieldMaterial, ProfileRole, ScheduleEvent, TenantContext } from "@/types";

/** Roles that use the mobile field UI instead of the admin dashboard. */
export function isFieldWorkerRole(role: ProfileRole): boolean {
  return role === "employee";
}

export function canAccessFieldWorkerUI(ctx: Pick<TenantContext, "membershipRole">): boolean {
  return isFieldWorkerRole(ctx.membershipRole);
}

export function canAccessAdminDashboard(role: ProfileRole): boolean {
  return !isFieldWorkerRole(role);
}

export function isJobAssignedToEmployee(
  job: Pick<ScheduleEvent, "employeeIds">,
  employeeId: string | null | undefined
): boolean {
  if (!employeeId) return false;
  return job.employeeIds.includes(employeeId);
}

export function canViewJobAsEmployee(
  job: Pick<ScheduleEvent, "employeeIds">,
  employeeId: string | null | undefined
): boolean {
  return isJobAssignedToEmployee(job, employeeId);
}

const FIELD_EDITABLE_STATUSES: JobWorkflowStatus[] = [
  "scheduled",
  "en-route",
  "in-progress",
];

export function isFieldJobEditable(status: JobWorkflowStatus): boolean {
  return FIELD_EDITABLE_STATUSES.includes(status);
}

export function canUpdateFieldStatus(
  role: ProfileRole,
  job: Pick<ScheduleEvent, "employeeIds" | "status">,
  employeeId: string | null | undefined,
  toStatus: JobWorkflowStatus
): boolean {
  if (!FIELD_QUICK_STATUSES.includes(toStatus)) return false;
  if (!canQuickChangeToStatus(role, job.status, toStatus)) return false;

  if (isFieldWorkerRole(role)) {
    if (!canViewJobAsEmployee(job, employeeId)) return false;
    if (toStatus === "completed" && !isFieldJobEditable(job.status) && job.status !== "completed") {
      return false;
    }
    return true;
  }

  return canQuickChangeToStatus(role, job.status, toStatus);
}

export function canEnterFieldHours(
  role: ProfileRole,
  job: Pick<ScheduleEvent, "employeeIds" | "status">,
  employeeId: string | null | undefined
): boolean {
  if (isFieldWorkerRole(role)) {
    if (!canViewJobAsEmployee(job, employeeId)) return false;
    return isFieldJobEditable(job.status) || job.status === "completed";
  }
  return canQuickChangeToStatus(role, job.status, job.status) || role !== "accountant";
}

export function canEnterFieldMaterials(
  role: ProfileRole,
  job: Pick<ScheduleEvent, "employeeIds" | "status">,
  employeeId: string | null | undefined
): boolean {
  return canEnterFieldHours(role, job, employeeId);
}

export function canEditFieldNotes(
  role: ProfileRole,
  job: Pick<ScheduleEvent, "employeeIds" | "status">,
  employeeId: string | null | undefined
): boolean {
  if (isFieldWorkerRole(role)) {
    if (!canViewJobAsEmployee(job, employeeId)) return false;
    return isFieldJobEditable(job.status);
  }
  return role !== "accountant";
}

export function canCompleteFieldWork(
  role: ProfileRole,
  job: Pick<ScheduleEvent, "employeeIds" | "status">,
  employeeId: string | null | undefined
): boolean {
  return canUpdateFieldStatus(role, job, employeeId, "completed");
}

/** Strip sensitive / financial data from a job for field employee views. */
export function toFieldSafeScheduleEvent(event: ScheduleEvent): ScheduleEvent {
  return {
    ...event,
    internalNotes: undefined,
    billingAddress: undefined,
    quoteEstimationSnapshot: event.quoteEstimationSnapshot
      ? {
          quoteId: event.quoteEstimationSnapshot.quoteId,
          quoteNumber: event.quoteEstimationSnapshot.quoteNumber,
          estimatedHours: event.quoteEstimationSnapshot.estimatedHours,
          capturedAt: event.quoteEstimationSnapshot.capturedAt,
        }
      : undefined,
    approvedBy: undefined,
    approvedAt: undefined,
    approvedByName: undefined,
    sentAt: undefined,
    sentTo: undefined,
    sentBy: undefined,
    clientPoNumber: undefined,
  };
}

export interface FieldWorkCompletionSummary {
  hoursCount: number;
  materialsCount: number;
  toolsCount: number;
  hasFieldNotes: boolean;
  missingHours: boolean;
}

export function buildFieldCompletionSummary(
  hours: FieldHour[],
  materials: FieldMaterial[],
  toolsCount: number,
  fieldNotes?: string | null
): FieldWorkCompletionSummary {
  return {
    hoursCount: hours.length,
    materialsCount: materials.length,
    toolsCount,
    hasFieldNotes: Boolean(fieldNotes?.trim()),
    missingHours: hours.length === 0,
  };
}

export function filterJobsForEmployee(
  events: ScheduleEvent[],
  employeeId: string
): ScheduleEvent[] {
  return events.filter((event) => isJobAssignedToEmployee(event, employeeId));
}
