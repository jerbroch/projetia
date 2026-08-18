import { addDays, format, parseISO } from "date-fns";
import type {
  ToolAssignment,
  ToolAssignmentStatus,
  ToolBaseStatus,
  ToolEffectiveStatus,
  ToolListItem,
  EmployeeToolSummary,
} from "@/types";

export const TOOL_CATEGORIES = [
  "Perceuse",
  "Scie",
  "Hilti",
  "Caméra d'inspection",
  "Machine à drain",
  "Pompe",
  "Échelle",
  "Détecteur",
  "Instrument de mesure",
  "Outillage électrique",
  "Outillage manuel",
  "Autre",
] as const;

export const TOOL_STATUS_LABELS: Record<ToolEffectiveStatus, string> = {
  available: "Disponible",
  reserved: "Réservé",
  in_use: "En utilisation",
  overdue: "En retard",
  in_repair: "En réparation",
  out_of_service: "Hors service",
};

export const TOOL_CONDITION_LABELS: Record<string, string> = {
  good: "Bon état",
  damaged: "Endommagé",
  needs_repair: "À réparer",
  missing_part: "Pièce manquante",
  other: "Autre",
};

export function todayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function computeExpectedReturnDate(startDate: string, durationDays: number): string {
  return format(addDays(parseISO(startDate), durationDays), "yyyy-MM-dd");
}

export function dateRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 <= end2 && start2 <= end1;
}

export function isAssignmentOpen(assignment: Pick<ToolAssignment, "status" | "actualReturnDate">): boolean {
  return assignment.status !== "returned" && !assignment.actualReturnDate;
}

export function assignmentsOverlap(
  a: Pick<ToolAssignment, "startDate" | "expectedReturnDate" | "status" | "actualReturnDate">,
  b: Pick<ToolAssignment, "startDate" | "expectedReturnDate" | "status" | "actualReturnDate">,
): boolean {
  if (!isAssignmentOpen(a) || !isAssignmentOpen(b)) return false;
  return dateRangesOverlap(a.startDate, a.expectedReturnDate, b.startDate, b.expectedReturnDate);
}

export function findOverlappingAssignment(
  assignments: ToolAssignment[],
  startDate: string,
  expectedReturnDate: string,
  excludeAssignmentId?: string,
): ToolAssignment | undefined {
  const candidate = {
    startDate,
    expectedReturnDate,
    status: "active" as ToolAssignmentStatus,
    actualReturnDate: undefined,
  };

  return assignments.find((existing) => {
    if (excludeAssignmentId && existing.id === excludeAssignmentId) return false;
    return assignmentsOverlap(existing, candidate);
  });
}

export function resolveAssignmentStatus(
  startDate: string,
  today: string = todayDateString(),
): ToolAssignmentStatus {
  return startDate > today ? "reserved" : "active";
}

export function computeEffectiveStatus(
  baseStatus: ToolBaseStatus,
  assignments: ToolAssignment[],
  today: string = todayDateString(),
): ToolEffectiveStatus {
  if (baseStatus === "out_of_service") return "out_of_service";
  if (baseStatus === "in_repair") return "in_repair";

  const open = assignments.filter(isAssignmentOpen);
  const current = open.find((a) => a.startDate <= today);

  if (current) {
    if (current.expectedReturnDate < today) return "overdue";
    return "in_use";
  }

  const hasFuture = open.some((a) => a.startDate > today);
  if (hasFuture) return "reserved";

  return "available";
}

export function daysOverdue(expectedReturnDate: string, today: string = todayDateString()): number {
  if (expectedReturnDate >= today) return 0;
  const start = parseISO(expectedReturnDate);
  const end = parseISO(today);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function canManageTools(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function findEmployeeByUserEmail(employees: { id: string; email: string }[], email: string) {
  const normalized = email.trim().toLowerCase();
  return employees.find((e) => e.email.trim().toLowerCase() === normalized);
}

export function computeEmployeeToolSummary(
  employeeId: string,
  tools: ToolListItem[],
  history: Array<ToolAssignment & { toolName: string; internalNumber: string }> = [],
): EmployeeToolSummary {
  const today = todayDateString();

  const current = tools
    .filter(
      (t) =>
        t.currentEmployeeId === employeeId &&
        t.effectiveStatus !== "available" &&
        t.expectedReturnDate,
    )
    .map((t) => ({ ...t, expectedReturnDate: t.expectedReturnDate! }));

  const reservations = tools
    .filter(
      (t) =>
        t.effectiveStatus === "reserved" &&
        t.currentEmployeeId === employeeId,
    )
    .map((t) => ({
      ...t,
      startDate: t.checkoutDate ?? today,
      expectedReturnDate: t.expectedReturnDate ?? today,
    }));

  return { current, reservations, history };
}

export function buildOverdueSmsTemplate(input: {
  employeeFirstName: string;
  toolName: string;
  internalNumber: string;
  expectedReturnDate: string;
  companyName: string;
}): string {
  return `Bonjour ${input.employeeFirstName}, rappel amical : l'outil « ${input.toolName} » (${input.internalNumber}) devait être retourné le ${input.expectedReturnDate}. Merci de le remettre dès que possible. — ${input.companyName}`;
}

export function formatLastSmsReminder(sentAt: string): string {
  const date = parseISO(sentAt);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = format(date, "HH:mm");
  if (isToday) return `Dernier rappel envoyé aujourd'hui à ${time}`;
  return `Dernier rappel envoyé le ${format(date, "d MMM yyyy")} à ${time}`;
}
