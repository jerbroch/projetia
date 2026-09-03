import { describe, expect, it } from "vitest";
import {
  buildDemoJobNumber,
  formatJobNumber,
  isArchivedJob,
  parseJobNumber,
  resolveJobNumberType,
} from "@/lib/job-utils";
import type { ScheduleEvent } from "@/types";

describe("formatJobNumber", () => {
  it("formats CON numbers with 4-digit padding", () => {
    expect(formatJobNumber("contract", 2026, 1)).toBe("CON-2026-0001");
    expect(formatJobNumber("contract", 2026, 42)).toBe("CON-2026-0042");
  });

  it("formats BT numbers with 4-digit padding", () => {
    expect(formatJobNumber("service_call", 2026, 1)).toBe("BT-2026-0001");
  });
});

describe("parseJobNumber", () => {
  it("parses valid job numbers", () => {
    expect(parseJobNumber("CON-2026-0001")).toEqual({
      prefix: "CON",
      year: 2026,
      sequence: 1,
    });
  });

  it("returns null for invalid values", () => {
    expect(parseJobNumber("SO-2026-001")).toBeNull();
    expect(parseJobNumber("")).toBeNull();
  });
});

describe("buildDemoJobNumber", () => {
  it("increments per type without reusing deleted numbers", () => {
    const existing: Pick<ScheduleEvent, "jobNumber">[] = [
      { jobNumber: "CON-2026-0001" },
      { jobNumber: "CON-2026-0003" },
    ];

    expect(buildDemoJobNumber(existing, "contract", 2026)).toBe("CON-2026-0004");
    expect(buildDemoJobNumber([], "service_call", 2026)).toBe("BT-2026-0001");
  });
});

describe("resolveJobNumberType", () => {
  it("infers contract from quote link", () => {
    expect(resolveJobNumberType({ quoteId: "quote-1" })).toBe("contract");
  });

  it("defaults to service call for direct jobs", () => {
    expect(resolveJobNumberType({})).toBe("service_call");
  });
});

describe("isArchivedJob", () => {
  it("archive ce qui est encaissé ou abandonné", () => {
    expect(isArchivedJob({ status: "paid" })).toBe(true);
    expect(isArchivedJob({ status: "cancelled" })).toBe(true);
  });

  // C'était le défaut : un travail fait mais pas encore facturé était rangé aux
  // archives, pendant qu'un call payé restait indéfiniment dans le courant.
  it("n'archive PAS un travail qui attend encore une action", () => {
    expect(isArchivedJob({ status: "completed" })).toBe(false);
    expect(isArchivedJob({ status: "pending-review" })).toBe(false);
    expect(isArchivedJob({ status: "ready-to-invoice" })).toBe(false);
    expect(isArchivedJob({ status: "invoice-sent" })).toBe(false);
    expect(isArchivedJob({ status: "scheduled" })).toBe(false);
  });

  // L'archivage suit le paiement, sans bouton de plus : c'est la même règle qui
  // décide, et elle ne dépend que du statut.
  it("suit le paiement sans geste supplémentaire", () => {
    const call = { status: "invoice-sent" as const };
    expect(isArchivedJob(call)).toBe(false);
    expect(isArchivedJob({ ...call, status: "paid" as const })).toBe(true);
  });
});
