import type { ProfileRole, ScheduleEvent } from "@/types";

export type JobWorkflowStatus = ScheduleEvent["status"];

/** French labels for workflow statuses */
export const JOB_STATUS_LABELS: Record<JobWorkflowStatus, string> = {
  scheduled: "Planifié",
  "en-route": "En route",
  "in-progress": "En travail",
  completed: "Travaux terminés",
  "pending-review": "À vérifier",
  "ready-to-invoice": "Prêt à facturer",
  "invoice-sent": "Facture envoyée",
  paid: "Payé",
  cancelled: "Annulé",
};

/** Roles that can approve jobs for billing */
const APPROVE_ROLES: ProfileRole[] = ["owner", "admin", "dispatcher"];

/** Roles that can generate/send invoices to clients */
const INVOICE_SEND_ROLES: ProfileRole[] = ["owner", "admin", "dispatcher", "accountant"];

/** Statuses where field workers are considered on-site */
export const ACTIVE_FIELD_STATUSES: JobWorkflowStatus[] = ["scheduled", "en-route", "in-progress"];

/** Statuses eligible for plumber close-work submission */
export const SUBMIT_FOR_REVIEW_STATUSES: JobWorkflowStatus[] = [
  "scheduled",
  "en-route",
  "in-progress",
];

export function getJobStatusLabel(status: JobWorkflowStatus): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

export function canApproveBilling(role: ProfileRole): boolean {
  return APPROVE_ROLES.includes(role);
}

export function canSendInvoiceToClient(role: ProfileRole): boolean {
  return INVOICE_SEND_ROLES.includes(role);
}

/** Owner/admin may edit invoices linked to archived jobs */
export function canEditArchivedInvoice(role: ProfileRole): boolean {
  return role === "owner" || role === "admin";
}

/** Owner/admin may restore an archived job (and its invoice) to Factures */
export function canRestoreArchivedJob(role: ProfileRole): boolean {
  return role === "owner" || role === "admin";
}

/** Owner/admin may permanently delete an archived job */
export function canDeleteArchivedJob(role: ProfileRole): boolean {
  return role === "owner" || role === "admin";
}

export function resolveRestoredJobStatus(invoiceSentAt?: string | null): JobWorkflowStatus {
  return invoiceSentAt ? "invoice-sent" : "ready-to-invoice";
}

export function canSubmitJobForReview(role: ProfileRole): boolean {
  return role !== "accountant";
}

export function isPendingReviewJob(
  event: Pick<ScheduleEvent, "status" | "submittedForReviewAt" | "approvedAt">
): boolean {
  if (event.status === "pending-review") return true;
  return (
    event.status === "completed" &&
    Boolean(event.submittedForReviewAt) &&
    !event.approvedAt
  );
}

export function isReadyToInvoiceJob(event: Pick<ScheduleEvent, "status">): boolean {
  return event.status === "ready-to-invoice";
}

export function canSubmitJobStatus(status: JobWorkflowStatus): boolean {
  return SUBMIT_FOR_REVIEW_STATUSES.includes(status);
}

export function canApproveJobStatus(
  event: Pick<ScheduleEvent, "status" | "submittedForReviewAt" | "approvedAt">
): boolean {
  return isPendingReviewJob(event);
}

export function canGenerateInvoiceStatus(status: JobWorkflowStatus): boolean {
  return status === "ready-to-invoice";
}

export function canSendInvoiceEmailStatus(status: JobWorkflowStatus): boolean {
  return status === "ready-to-invoice" || status === "invoice-sent";
}

/** Jobs awaiting manager verification */
export function filterPendingReviewJobs(events: ScheduleEvent[]): ScheduleEvent[] {
  return events
    .filter(isPendingReviewJob)
    .sort((a, b) => {
      const aTime = a.submittedForReviewAt ?? a.start;
      const bTime = b.submittedForReviewAt ?? b.start;
      return bTime.localeCompare(aTime);
    });
}

export function countPendingReviewJobs(events: ScheduleEvent[]): number {
  return filterPendingReviewJobs(events).length;
}

/** Field quick-status targets from the schedule calendar */
export const FIELD_QUICK_STATUSES: JobWorkflowStatus[] = [
  "en-route",
  "in-progress",
  "completed",
];

/** Ordered field status buttons always shown in the schedule quick-actions dialog */
export const FIELD_QUICK_STATUS_BUTTON_ORDER: JobWorkflowStatus[] = [
  "en-route",
  "in-progress",
];

export function getFieldQuickStatusButtonOrder(role: ProfileRole): JobWorkflowStatus[] {
  return canUseFieldQuickStatus(role) ? [...FIELD_QUICK_STATUS_BUTTON_ORDER] : [];
}

/** Admin-only quick-status targets (office workflow) */
export const ADMIN_QUICK_STATUSES: JobWorkflowStatus[] = [
  "pending-review",
  "ready-to-invoice",
  "invoice-sent",
  "paid",
];

export function canUseFieldQuickStatus(role: ProfileRole): boolean {
  return role !== "accountant";
}

export function canUseAdminQuickStatus(role: ProfileRole): boolean {
  return canApproveBilling(role);
}

export function canQuickChangeToStatus(
  role: ProfileRole,
  fromStatus: JobWorkflowStatus,
  toStatus: JobWorkflowStatus
): boolean {
  if (fromStatus === "cancelled" || fromStatus === toStatus) return false;

  if (FIELD_QUICK_STATUSES.includes(toStatus)) {
    if (!canUseFieldQuickStatus(role)) return false;
    if (
      toStatus === "completed" &&
      ["pending-review", "ready-to-invoice", "invoice-sent", "paid"].includes(fromStatus)
    ) {
      return false;
    }
    return true;
  }

  if (ADMIN_QUICK_STATUSES.includes(toStatus)) {
    if (!canUseAdminQuickStatus(role)) return false;

    switch (toStatus) {
      case "pending-review":
        return fromStatus === "completed" || canSubmitJobStatus(fromStatus);
      case "ready-to-invoice":
        return fromStatus === "pending-review" || fromStatus === "completed";
      case "invoice-sent":
        return fromStatus === "ready-to-invoice" || fromStatus === "invoice-sent";
      case "paid":
        return fromStatus === "invoice-sent" || fromStatus === "paid";
      default:
        return false;
    }
  }

  return false;
}

export function getQuickStatusActions(
  role: ProfileRole,
  currentStatus: JobWorkflowStatus
): JobWorkflowStatus[] {
  const candidates: JobWorkflowStatus[] = [
    ...FIELD_QUICK_STATUSES,
    ...(canUseAdminQuickStatus(role) ? ADMIN_QUICK_STATUSES : []),
  ];

  return candidates.filter(
    (status) => status !== currentStatus && canQuickChangeToStatus(role, currentStatus, status)
  );
}

/** French button labels for quick status actions on the schedule */
export const QUICK_STATUS_BUTTON_LABELS: Partial<Record<JobWorkflowStatus, string>> = {
  "en-route": "Transport / En route",
  "in-progress": "En travail",
  completed: "Travaux terminés",
  "pending-review": "À vérifier",
  "ready-to-invoice": "Prêt à facturer",
  "invoice-sent": "Facture envoyée",
  paid: "Payé",
};
