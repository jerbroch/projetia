import { describe, expect, it } from "vitest";
import {
  canApproveBilling,
  canApproveJobStatus,
  canGenerateInvoiceStatus,
  canQuickChangeToStatus,
  canSendInvoiceToClient,
  canSubmitJobForReview,
  canSubmitJobStatus,
  canUseAdminQuickStatus,
  canUseFieldQuickStatus,
  countPendingReviewJobs,
  filterPendingReviewJobs,
  getFieldQuickStatusButtonOrder,
  getJobStatusLabel,
  getQuickStatusActions,
} from "@/lib/job-workflow";
import type { ScheduleEvent } from "@/types";

const baseJob: ScheduleEvent = {
  id: "job-1",
  companyId: "co-1",
  title: "Test",
  description: "",
  start: "2026-08-10T08:00:00",
  end: "2026-08-10T17:00:00",
  employeeIds: ["e1"],
  employeeNames: ["Plombier"],
  location: "123 Rue Test",
  status: "pending-review",
  type: "job",
  submittedForReviewAt: "2026-08-10T17:30:00",
};

describe("job-workflow roles", () => {
  it("allows owner/admin/dispatcher to approve", () => {
    expect(canApproveBilling("owner")).toBe(true);
    expect(canApproveBilling("admin")).toBe(true);
    expect(canApproveBilling("dispatcher")).toBe(true);
    expect(canApproveBilling("employee")).toBe(false);
    expect(canApproveBilling("estimator")).toBe(false);
  });

  it("allows invoice send for office roles but not field employee", () => {
    expect(canSendInvoiceToClient("owner")).toBe(true);
    expect(canSendInvoiceToClient("accountant")).toBe(true);
    expect(canSendInvoiceToClient("employee")).toBe(false);
  });

  it("allows field roles to submit for review", () => {
    expect(canSubmitJobForReview("employee")).toBe(true);
    expect(canSubmitJobForReview("accountant")).toBe(false);
  });
});

describe("job-workflow status transitions", () => {
  it("validates submit statuses", () => {
    expect(canSubmitJobStatus("in-progress")).toBe(true);
    expect(canSubmitJobStatus("pending-review")).toBe(false);
    expect(canSubmitJobStatus("ready-to-invoice")).toBe(false);
  });

  it("validates approve status", () => {
    expect(
      canApproveJobStatus({
        status: "pending-review",
        submittedForReviewAt: "2026-08-10T17:30:00",
      })
    ).toBe(true);
    expect(
      canApproveJobStatus({
        status: "completed",
        submittedForReviewAt: "2026-08-10T17:30:00",
      })
    ).toBe(true);
    expect(
      canApproveJobStatus({
        status: "completed",
        submittedForReviewAt: "2026-08-10T17:30:00",
        approvedAt: "2026-08-11T09:00:00",
      })
    ).toBe(false);
    expect(canApproveJobStatus({ status: "in-progress" })).toBe(false);
  });

  it("validates invoice generation status", () => {
    expect(canGenerateInvoiceStatus("ready-to-invoice")).toBe(true);
    expect(canGenerateInvoiceStatus("pending-review")).toBe(false);
  });
});

describe("pending review queue", () => {
  it("filters and counts pending review jobs", () => {
    const events: ScheduleEvent[] = [
      baseJob,
      { ...baseJob, id: "job-2", status: "scheduled" },
      {
        ...baseJob,
        id: "job-3",
        submittedForReviewAt: "2026-08-11T09:00:00",
      },
      {
        ...baseJob,
        id: "job-4",
        status: "completed",
        submittedForReviewAt: "2026-08-12T09:00:00",
      },
      {
        ...baseJob,
        id: "job-5",
        status: "completed",
        submittedForReviewAt: "2026-08-12T09:00:00",
        approvedAt: "2026-08-12T10:00:00",
      },
    ];
    const pending = filterPendingReviewJobs(events);
    expect(pending).toHaveLength(3);
    expect(countPendingReviewJobs(events)).toBe(3);
    expect(pending[0].id).toBe("job-4");
    expect(pending.map((job) => job.id)).not.toContain("job-5");
  });

  it("returns French status labels", () => {
    expect(getJobStatusLabel("pending-review")).toBe("À vérifier");
    expect(getJobStatusLabel("ready-to-invoice")).toBe("Prêt à facturer");
  });
});

describe("quick status actions", () => {
  it("allows field roles to use terrain quick statuses", () => {
    expect(canUseFieldQuickStatus("employee")).toBe(true);
    expect(canUseFieldQuickStatus("dispatcher")).toBe(true);
    expect(canUseFieldQuickStatus("accountant")).toBe(false);
  });

  it("allows office roles to use admin quick statuses", () => {
    expect(canUseAdminQuickStatus("owner")).toBe(true);
    expect(canUseAdminQuickStatus("admin")).toBe(true);
    expect(canUseAdminQuickStatus("dispatcher")).toBe(true);
    expect(canUseAdminQuickStatus("employee")).toBe(false);
  });

  it("blocks employees from skipping to invoice workflow statuses", () => {
    expect(canQuickChangeToStatus("employee", "in-progress", "invoice-sent")).toBe(false);
    expect(canQuickChangeToStatus("employee", "in-progress", "paid")).toBe(false);
    expect(canQuickChangeToStatus("employee", "in-progress", "ready-to-invoice")).toBe(false);
    expect(canQuickChangeToStatus("employee", "in-progress", "pending-review")).toBe(false);
  });

  it("allows employees to change field statuses", () => {
    expect(canQuickChangeToStatus("employee", "scheduled", "en-route")).toBe(true);
    expect(canQuickChangeToStatus("employee", "en-route", "in-progress")).toBe(true);
    expect(canQuickChangeToStatus("employee", "in-progress", "completed")).toBe(true);
  });

  it("requires pending-review before ready-to-invoice for admins", () => {
    expect(canQuickChangeToStatus("admin", "in-progress", "ready-to-invoice")).toBe(false);
    expect(canQuickChangeToStatus("admin", "pending-review", "ready-to-invoice")).toBe(true);
  });

  it("returns role-appropriate quick actions", () => {
    const employeeActions = getQuickStatusActions("employee", "scheduled");
    expect(employeeActions).toContain("en-route");
    expect(employeeActions).toContain("in-progress");
    expect(employeeActions).toContain("completed");
    expect(employeeActions).not.toContain("paid");

    const adminActions = getQuickStatusActions("admin", "pending-review");
    expect(adminActions).toContain("ready-to-invoice");
    expect(adminActions).not.toContain("pending-review");
  });

  it("always shows En travail button for field employees including when already in progress", () => {
    const buttons = getFieldQuickStatusButtonOrder("employee");
    expect(buttons).toEqual(["en-route", "in-progress"]);
    expect(buttons).toContain("in-progress");
    expect(canQuickChangeToStatus("employee", "en-route", "in-progress")).toBe(true);
    expect(canQuickChangeToStatus("employee", "in-progress", "in-progress")).toBe(false);
    expect(getQuickStatusActions("employee", "in-progress")).not.toContain("in-progress");
  });
});
