import { describe, expect, it } from "vitest";
import {
  assignmentsOverlap,
  computeEffectiveStatus,
  computeExpectedReturnDate,
  daysOverdue,
  ensureArray,
  findOverlappingAssignment,
  normalizeEmployeeToolSummary,
  normalizeToolWithDetails,
  resolveAssignmentStatus,
} from "@/lib/tool-utils";
import type { ToolAssignment, ToolListItem, ToolWithDetails } from "@/types";

function assignment(
  overrides: Partial<ToolAssignment> & Pick<ToolAssignment, "id" | "startDate" | "expectedReturnDate">,
): ToolAssignment {
  return {
    toolId: "tool-1",
    employeeId: "emp-1",
    companyId: "co-1",
    status: "active",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

describe("computeExpectedReturnDate", () => {
  it("adds duration days to start date", () => {
    expect(computeExpectedReturnDate("2025-08-18", 3)).toBe("2025-08-21");
  });
});

describe("assignmentsOverlap", () => {
  it("detects overlapping periods", () => {
    const a = assignment({ id: "a", startDate: "2025-08-18", expectedReturnDate: "2025-08-20" });
    const b = assignment({ id: "b", startDate: "2025-08-19", expectedReturnDate: "2025-08-22" });
    expect(assignmentsOverlap(a, b)).toBe(true);
  });

  it("allows back-to-back periods", () => {
    const a = assignment({ id: "a", startDate: "2025-08-18", expectedReturnDate: "2025-08-20" });
    const b = assignment({ id: "b", startDate: "2025-08-21", expectedReturnDate: "2025-08-25" });
    expect(assignmentsOverlap(a, b)).toBe(false);
  });

  it("ignores returned assignments", () => {
    const a = assignment({
      id: "a",
      startDate: "2025-08-18",
      expectedReturnDate: "2025-08-20",
      status: "returned",
      actualReturnDate: "2025-08-19",
    });
    const b = assignment({ id: "b", startDate: "2025-08-19", expectedReturnDate: "2025-08-22" });
    expect(assignmentsOverlap(a, b)).toBe(false);
  });
});

describe("findOverlappingAssignment", () => {
  it("finds conflict for same tool period", () => {
    const existing = [
      assignment({ id: "a", startDate: "2025-08-18", expectedReturnDate: "2025-08-20" }),
    ];
    const conflict = findOverlappingAssignment(existing, "2025-08-19", "2025-08-21");
    expect(conflict?.id).toBe("a");
  });

  it("allows reservation after current checkout ends", () => {
    const existing = [
      assignment({ id: "a", startDate: "2025-08-18", expectedReturnDate: "2025-08-20" }),
    ];
    const conflict = findOverlappingAssignment(existing, "2025-08-21", "2025-08-25");
    expect(conflict).toBeUndefined();
  });
});

describe("computeEffectiveStatus", () => {
  it("returns out_of_service from base status", () => {
    expect(computeEffectiveStatus("out_of_service", [], "2025-08-18")).toBe("out_of_service");
  });

  it("returns in_use for active assignment", () => {
    const assignments = [
      assignment({ id: "a", startDate: "2025-08-15", expectedReturnDate: "2025-08-25" }),
    ];
    expect(computeEffectiveStatus("available", assignments, "2025-08-18")).toBe("in_use");
  });

  it("returns overdue when past expected return", () => {
    const assignments = [
      assignment({ id: "a", startDate: "2025-08-10", expectedReturnDate: "2025-08-15" }),
    ];
    expect(computeEffectiveStatus("available", assignments, "2025-08-18")).toBe("overdue");
  });

  it("returns reserved for future assignment only", () => {
    const assignments = [
      assignment({
        id: "a",
        startDate: "2025-08-21",
        expectedReturnDate: "2025-08-25",
        status: "reserved",
      }),
    ];
    expect(computeEffectiveStatus("available", assignments, "2025-08-18")).toBe("reserved");
  });

  it("returns available when no open assignments", () => {
    expect(computeEffectiveStatus("available", [], "2025-08-18")).toBe("available");
  });
});

describe("resolveAssignmentStatus", () => {
  it("marks future start as reserved", () => {
    expect(resolveAssignmentStatus("2025-08-21", "2025-08-18")).toBe("reserved");
  });

  it("marks current start as active", () => {
    expect(resolveAssignmentStatus("2025-08-18", "2025-08-18")).toBe("active");
  });
});

describe("daysOverdue", () => {
  it("computes days past expected return", () => {
    expect(daysOverdue("2025-08-15", "2025-08-18")).toBe(3);
  });

  it("returns zero when not overdue", () => {
    expect(daysOverdue("2025-08-20", "2025-08-18")).toBe(0);
  });
});

describe("ensureArray", () => {
  it("returns empty array for null and undefined", () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
  });

  it("returns the same array when already an array", () => {
    const arr = [1, 2];
    expect(ensureArray(arr)).toBe(arr);
  });
});

describe("normalizeToolWithDetails", () => {
  const baseListItem: ToolListItem = {
    id: "tool-1",
    companyId: "co-1",
    name: "Perceuse",
    category: "Perceuse",
    brand: "Makita",
    model: "X",
    serialNumber: "",
    internalNumber: "T-001",
    description: "",
    condition: "good",
    baseStatus: "available",
    createdAt: "",
    updatedAt: "",
    effectiveStatus: "available",
  };

  it("defaults missing list fields from ToolListItem", () => {
    const normalized = normalizeToolWithDetails(baseListItem);
    expect(normalized?.futureReservations).toEqual([]);
    expect(normalized?.assignmentHistory).toEqual([]);
  });

  it("preserves existing reservations and history", () => {
    const reservation = {
      id: "res-1",
      toolId: "tool-1",
      employeeId: "emp-1",
      companyId: "co-1",
      startDate: "2025-08-21",
      expectedReturnDate: "2025-08-25",
      status: "reserved" as const,
      createdAt: "",
      updatedAt: "",
      employeeName: "Jean Dupont",
      employeePhone: "5145551234",
    };
    const normalized = normalizeToolWithDetails({
      ...baseListItem,
      effectiveStatus: "reserved",
      futureReservations: [reservation],
    } as unknown as ToolWithDetails);
    expect(normalized?.futureReservations).toHaveLength(1);
    expect(normalized?.assignmentHistory).toEqual([]);
  });

  it("returns null for null input", () => {
    expect(normalizeToolWithDetails(null)).toBeNull();
  });
});

describe("normalizeEmployeeToolSummary", () => {
  it("defaults missing arrays", () => {
    expect(normalizeEmployeeToolSummary(undefined)).toEqual({
      current: [],
      reservations: [],
      history: [],
    });
  });

  it("preserves populated summary", () => {
    const summary = {
      current: [{ ...({} as ToolListItem), expectedReturnDate: "2025-08-20" }],
      reservations: [],
      history: [],
    };
    const normalized = normalizeEmployeeToolSummary(summary);
    expect(normalized.current).toHaveLength(1);
    expect(normalized.reservations).toEqual([]);
  });
});
