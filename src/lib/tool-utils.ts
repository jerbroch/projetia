import { addDays, format, parseISO } from "date-fns";
import type {
  ToolAssignment,
  ToolAssignmentStatus,
  ToolBaseStatus,
  ToolEffectiveStatus,
  ToolListItem,
  ToolWithDetails,
  EmployeeToolSummary,
} from "@/types";

/** Ensures a value is always a usable array (never null/undefined). */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Normalizes tool detail payloads so list fields are always arrays. */
export function normalizeToolWithDetails(
  tool: ToolWithDetails | ToolListItem | null | undefined,
): ToolWithDetails | null {
  if (!tool) return null;

  const detailed = tool as ToolWithDetails;

  return {
    ...tool,
    effectiveStatus: tool.effectiveStatus,
    currentAssignment: detailed.currentAssignment,
    futureReservations: ensureArray(detailed.futureReservations),
    assignmentHistory: ensureArray(detailed.assignmentHistory),
    lastSmsReminder: detailed.lastSmsReminder,
  };
}

/** Normalizes employee tool summary so list fields are always arrays. */
export function normalizeEmployeeToolSummary(
  summary: EmployeeToolSummary | null | undefined,
): EmployeeToolSummary {
  return {
    current: ensureArray(summary?.current),
    reservations: ensureArray(summary?.reservations),
    history: ensureArray(summary?.history),
  };
}

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

  // Future-only reservations: tool remains available today (shown in detail).
  return "available";
}

function isToolActivelyAssigned(
  tool: Pick<ToolListItem, "effectiveStatus" | "currentEmployeeId"> & {
    currentAssignment?: unknown;
  },
): boolean {
  return (
    !!tool.currentEmployeeId ||
    !!tool.currentAssignment ||
    tool.effectiveStatus === "in_use" ||
    tool.effectiveStatus === "overdue"
  );
}

export function canAssignTool(
  tool: Pick<ToolListItem, "baseStatus" | "effectiveStatus" | "currentEmployeeId"> & {
    currentAssignment?: unknown;
  },
): boolean {
  if (tool.baseStatus === "out_of_service" || tool.baseStatus === "in_repair") return false;
  if (isToolActivelyAssigned(tool)) return false;
  return true;
}

export function canReserveTool(
  tool: Pick<ToolListItem, "baseStatus" | "effectiveStatus" | "currentEmployeeId"> & {
    currentAssignment?: unknown;
  },
): boolean {
  return canAssignTool(tool);
}

export type ToolCheckoutMode = "assign" | "reserve";

export function validateCheckoutStartDate(
  mode: ToolCheckoutMode,
  startDate: string,
  today: string = todayDateString(),
): string | null {
  if (mode === "reserve" && startDate <= today) {
    return "La réservation doit commencer dans le futur.";
  }
  if (mode === "assign" && startDate > today) {
    return "Pour une assignation immédiate, la date de début doit être aujourd'hui ou antérieure.";
  }
  return null;
}

/** Keeps optimistic list updates when server refresh is briefly stale. */
export function syncToolListFromServer(
  local: ToolListItem[],
  server: ToolListItem[],
): ToolListItem[] {
  const localMap = new Map(local.map((t) => [t.id, t]));
  const merged = server.map((serverTool) => {
    const localTool = localMap.get(serverTool.id);
    if (!localTool) return serverTool;

    const localActive = isToolActivelyAssigned(localTool);
    const serverActive = isToolActivelyAssigned(serverTool);
    if (localActive && !serverActive) return localTool;

    const localReserved = localTool.hasFutureReservation && !serverTool.hasFutureReservation;
    if (localReserved) return localTool;

    return serverTool;
  });

  for (const tool of local) {
    if (!server.some((s) => s.id === tool.id)) {
      merged.unshift(tool);
    }
  }

  return merged;
}

export function buildToolListItemFromDetails(tool: ToolWithDetails): ToolListItem {
  const current = tool.currentAssignment;
  const today = todayDateString();
  const future = tool.futureReservations;
  const nextReservation = future[0];

  return {
    id: tool.id,
    companyId: tool.companyId,
    name: tool.name,
    category: tool.category,
    brand: tool.brand,
    model: tool.model,
    serialNumber: tool.serialNumber,
    internalNumber: tool.internalNumber,
    description: tool.description,
    condition: tool.condition,
    baseStatus: tool.baseStatus,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
    effectiveStatus: tool.effectiveStatus,
    currentEmployeeId: current?.employeeId,
    currentScheduledJobId: current?.scheduledJobId ?? null,
    currentEmployeeName: current?.employeeName,
    checkoutDate: current?.startDate,
    expectedReturnDate: current?.expectedReturnDate,
    daysOverdue:
      current && current.expectedReturnDate < today
        ? daysOverdue(current.expectedReturnDate, today)
        : undefined,
    hasFutureReservation: future.length > 0,
    nextReservationStart: nextReservation?.startDate,
    nextReservationExpectedReturn: nextReservation?.expectedReturnDate,
    nextReservationEmployeeId: nextReservation?.employeeId,
    lastSmsReminder: tool.lastSmsReminder,
  };
}

export function mergeToolIntoList(tools: ToolListItem[], updated: ToolListItem): ToolListItem[] {
  const exists = tools.some((t) => t.id === updated.id);
  if (exists) return tools.map((t) => (t.id === updated.id ? updated : t));
  return [updated, ...tools];
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
        t.hasFutureReservation &&
        t.nextReservationEmployeeId === employeeId &&
        t.nextReservationStart,
    )
    .map((t) => ({
      ...t,
      startDate: t.nextReservationStart!,
      expectedReturnDate: t.nextReservationExpectedReturn ?? t.nextReservationStart!,
    }));

  return normalizeEmployeeToolSummary({ current, reservations, history });
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

/**
 * Numéro interne déjà porté par un autre outil, ou `null`.
 *
 * Le numéro interne est ce qui est gravé ou collé sur l'outil : c'est par lui
 * qu'on le retrouve au magasin. Deux outils qui le partagent rendent
 * l'inventaire inutilisable — on ne sait plus lequel est sorti.
 *
 * Rend l'outil fautif, pas un booléen, pour que le message puisse le NOMMER.
 * « Le numéro OUT-001 est déjà porté par la scie ronde Makita » se corrige ;
 * « ce numéro est déjà utilisé » oblige à fouiller la liste.
 *
 * La comparaison ignore la casse et les espaces de bord : « out-001 » et
 * « OUT-001 » désignent le même outil sur le plancher. Un numéro vide n'est
 * jamais un conflit — il est facultatif, et plusieurs outils peuvent ne pas
 * en avoir.
 */
export function outilAvecLeMemeNumero<T extends { id: string; name: string; internalNumber?: string | null }>(
  outils: readonly T[],
  numero: string | null | undefined,
  exclureId?: string,
): T | null {
  const cible = (numero ?? "").trim().toLowerCase();
  if (!cible) return null;

  return (
    outils.find(
      (o) => o.id !== exclureId && (o.internalNumber ?? "").trim().toLowerCase() === cible,
    ) ?? null
  );
}

/** Message nommant l'outil qui bloque le numéro interne. */
export function refusDeNumeroInterne(numero: string, outil: { name: string }): string {
  return `Le numéro interne « ${numero.trim()} » est déjà porté par « ${outil.name} ». Choisissez-en un autre, ou corrigez celui de l'autre outil.`;
}
