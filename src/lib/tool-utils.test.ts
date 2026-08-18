import { describe, expect, it } from "vitest";
import {
  assignmentsOverlap,
  buildToolListItemFromDetails,
  canAssignTool,
  canReserveTool,
  computeEffectiveStatus,
  computeExpectedReturnDate,
  daysOverdue,
  ensureArray,
  findOverlappingAssignment,
  mergeToolIntoList,
  normalizeEmployeeToolSummary,
  normalizeToolWithDetails,
  resolveAssignmentStatus,
  syncToolListFromServer,
  validateCheckoutStartDate,
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

  it("returns in_repair from base status", () => {
    expect(computeEffectiveStatus("in_repair", [], "2025-08-18")).toBe("in_repair");
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

  it("returns available for future assignment only (scenario D)", () => {
    const assignments = [
      assignment({
        id: "a",
        startDate: "2025-08-21",
        expectedReturnDate: "2025-08-25",
        status: "reserved",
      }),
    ];
    expect(computeEffectiveStatus("available", assignments, "2025-08-18")).toBe("available");
  });

  it("returns available when no open assignments", () => {
    expect(computeEffectiveStatus("available", [], "2025-08-18")).toBe("available");
  });

  it("returns in_use even when base_status is available", () => {
    const assignments = [
      assignment({ id: "a", startDate: "2025-08-18", expectedReturnDate: "2025-08-23" }),
    ];
    expect(computeEffectiveStatus("available", assignments, "2025-08-18")).toBe("in_use");
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

describe("buildToolListItemFromDetails", () => {
  const details: ToolWithDetails = {
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
    effectiveStatus: "in_use",
    currentAssignment: {
      id: "a-1",
      toolId: "tool-1",
      employeeId: "emp-1",
      companyId: "co-1",
      startDate: "2025-08-18",
      expectedReturnDate: "2025-08-23",
      status: "active",
      createdAt: "",
      updatedAt: "",
      employeeName: "Jean Dupont",
      employeePhone: "5145551234",
    },
    futureReservations: [],
    assignmentHistory: [],
  };

  it("maps assignment fields to list item", () => {
    const item = buildToolListItemFromDetails(details);
    expect(item.effectiveStatus).toBe("in_use");
    expect(item.currentEmployeeId).toBe("emp-1");
    expect(item.currentEmployeeName).toBe("Jean Dupont");
    expect(item.checkoutDate).toBe("2025-08-18");
    expect(item.expectedReturnDate).toBe("2025-08-23");
  });

  it("tracks future reservations separately", () => {
    const withFuture = buildToolListItemFromDetails({
      ...details,
      effectiveStatus: "available",
      currentAssignment: undefined,
      futureReservations: [
        {
          id: "r-1",
          toolId: "tool-1",
          employeeId: "emp-2",
          companyId: "co-1",
          startDate: "2025-08-25",
          expectedReturnDate: "2025-08-30",
          status: "reserved",
          createdAt: "",
          updatedAt: "",
          employeeName: "Marie",
          employeePhone: "",
        },
      ],
    });
    expect(withFuture.hasFutureReservation).toBe(true);
    expect(withFuture.nextReservationEmployeeId).toBe("emp-2");
  });
});

describe("canAssignTool", () => {
  it("blocks in_repair and out_of_service tools", () => {
    expect(canAssignTool({ baseStatus: "in_repair", effectiveStatus: "in_repair" })).toBe(false);
    expect(canAssignTool({ baseStatus: "out_of_service", effectiveStatus: "out_of_service" })).toBe(
      false,
    );
  });

  it("blocks currently assigned tools", () => {
    expect(
      canAssignTool({
        baseStatus: "available",
        effectiveStatus: "in_use",
        currentEmployeeId: "emp-1",
      }),
    ).toBe(false);
  });

  it("allows available tools", () => {
    expect(canAssignTool({ baseStatus: "available", effectiveStatus: "available" })).toBe(true);
  });

  it("allows tools with only future reservations (scenario D)", () => {
    expect(
      canAssignTool({
        baseStatus: "available",
        effectiveStatus: "available",
        hasFutureReservation: true,
      } as ToolListItem),
    ).toBe(true);
  });
});

describe("canReserveTool", () => {
  it("mirrors assign eligibility for checkout", () => {
    expect(canReserveTool({ baseStatus: "available", effectiveStatus: "available" })).toBe(true);
    expect(
      canReserveTool({
        baseStatus: "available",
        effectiveStatus: "in_use",
        currentEmployeeId: "emp-1",
      }),
    ).toBe(false);
  });
});

describe("validateCheckoutStartDate", () => {
  it("requires future start for reserve mode", () => {
    expect(validateCheckoutStartDate("reserve", "2025-08-18", "2025-08-18")).toMatch(/futur/i);
    expect(validateCheckoutStartDate("reserve", "2025-08-21", "2025-08-18")).toBeNull();
  });

  it("requires today or past for assign mode", () => {
    expect(validateCheckoutStartDate("assign", "2025-08-21", "2025-08-18")).toMatch(/immédiate/i);
    expect(validateCheckoutStartDate("assign", "2025-08-18", "2025-08-18")).toBeNull();
  });
});

describe("syncToolListFromServer", () => {
  const base: ToolListItem = {
    id: "tool-1",
    companyId: "co-1",
    name: "A",
    category: "Perceuse",
    brand: "",
    model: "",
    serialNumber: "",
    internalNumber: "T-001",
    description: "",
    condition: "good",
    baseStatus: "available",
    createdAt: "",
    updatedAt: "",
    effectiveStatus: "available",
  };

  it("keeps local in_use state when server refresh is stale", () => {
    const local = [{ ...base, effectiveStatus: "in_use" as const, currentEmployeeId: "emp-1" }];
    const server = [{ ...base, effectiveStatus: "available" as const }];
    const merged = syncToolListFromServer(local, server);
    expect(merged[0].effectiveStatus).toBe("in_use");
    expect(merged[0].currentEmployeeId).toBe("emp-1");
  });

  it("prefers server when both have assignment data", () => {
    const local = [{ ...base, effectiveStatus: "in_use" as const, currentEmployeeId: "emp-1" }];
    const server = [
      {
        ...base,
        effectiveStatus: "in_use" as const,
        currentEmployeeId: "emp-2",
        currentEmployeeName: "Marie",
      },
    ];
    const merged = syncToolListFromServer(local, server);
    expect(merged[0].currentEmployeeId).toBe("emp-2");
  });

  it("preserves local-only tools until server catches up", () => {
    const localOnly = { ...base, id: "tool-new", internalNumber: "T-NEW" };
    const merged = syncToolListFromServer([localOnly], [base]);
    expect(merged).toHaveLength(2);
    expect(merged.some((t) => t.id === "tool-new")).toBe(true);
  });
});

describe("mergeToolIntoList", () => {
  const base: ToolListItem = {
    id: "tool-1",
    companyId: "co-1",
    name: "A",
    category: "Perceuse",
    brand: "",
    model: "",
    serialNumber: "",
    internalNumber: "",
    description: "",
    condition: "good",
    baseStatus: "available",
    createdAt: "",
    updatedAt: "",
    effectiveStatus: "available",
  };

  it("updates existing tool in list", () => {
    const updated = { ...base, effectiveStatus: "in_use" as const, currentEmployeeId: "emp-1" };
    const result = mergeToolIntoList([base], updated);
    expect(result).toHaveLength(1);
    expect(result[0].effectiveStatus).toBe("in_use");
  });

  it("prepends new tool", () => {
    const other = { ...base, id: "tool-2", name: "B" };
    const result = mergeToolIntoList([base], other);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tool-2");
  });
});
