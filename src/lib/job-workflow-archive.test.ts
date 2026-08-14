import { describe, expect, it } from "vitest";
import {
  canDeleteArchivedJob,
  canEditArchivedInvoice,
  canRestoreArchivedJob,
  resolveRestoredJobStatus,
} from "@/lib/job-workflow";

describe("archived invoice permissions", () => {
  it("allows owner and admin to edit and restore", () => {
    expect(canEditArchivedInvoice("owner")).toBe(true);
    expect(canEditArchivedInvoice("admin")).toBe(true);
    expect(canRestoreArchivedJob("owner")).toBe(true);
    expect(canRestoreArchivedJob("admin")).toBe(true);
    expect(canDeleteArchivedJob("owner")).toBe(true);
    expect(canDeleteArchivedJob("admin")).toBe(true);
  });

  it("denies other roles", () => {
    expect(canEditArchivedInvoice("dispatcher")).toBe(false);
    expect(canRestoreArchivedJob("accountant")).toBe(false);
    expect(canDeleteArchivedJob("dispatcher")).toBe(false);
    expect(canDeleteArchivedJob("accountant")).toBe(false);
  });
});

describe("resolveRestoredJobStatus", () => {
  it("returns invoice-sent when invoice was sent", () => {
    expect(resolveRestoredJobStatus("2026-01-01T12:00:00Z")).toBe("invoice-sent");
  });

  it("returns ready-to-invoice when invoice was never sent", () => {
    expect(resolveRestoredJobStatus(null)).toBe("ready-to-invoice");
    expect(resolveRestoredJobStatus(undefined)).toBe("ready-to-invoice");
  });
});
