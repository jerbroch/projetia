import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { tools as demoTools, toolAssignments as demoToolAssignments, toolSmsReminders as demoToolSmsReminders } from "@/lib/mock-data";
import { getEmployeeFullName } from "@/lib/employee-utils";
import {
  computeEffectiveStatus,
  daysOverdue,
  findOverlappingAssignment,
  isAssignmentOpen,
  resolveAssignmentStatus,
  todayDateString,
} from "@/lib/tool-utils";
import type {
  Employee,
  Tool,
  ToolAssignment,
  ToolBaseStatus,
  ToolCondition,
  ToolListItem,
  ToolReturnCondition,
  ToolSmsReminder,
  ToolWithDetails,
  EmployeeToolSummary,
} from "@/types";

function filterDemo<T extends { companyId: string }>(items: T[], companyId: string): T[] {
  return items.filter((item) => item.companyId === companyId);
}

export function mapToolRow(row: Record<string, unknown>): Tool {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name ?? ""),
    category: String(row.category ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    internalNumber: String(row.internal_number ?? ""),
    description: String(row.description ?? ""),
    condition: (row.condition as ToolCondition) ?? "good",
    baseStatus: (row.base_status as ToolBaseStatus) ?? "available",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function mapToolAssignmentRow(row: Record<string, unknown>): ToolAssignment {
  return {
    id: String(row.id),
    toolId: String(row.tool_id),
    employeeId: String(row.employee_id),
    companyId: String(row.company_id),
    startDate: String(row.start_date ?? "").slice(0, 10),
    expectedReturnDate: String(row.expected_return_date ?? "").slice(0, 10),
    actualReturnDate: row.actual_return_date
      ? String(row.actual_return_date).slice(0, 10)
      : undefined,
    status: (row.status as ToolAssignment["status"]) ?? "active",
    notes: row.notes ? String(row.notes) : undefined,
    returnCondition: row.return_condition as ToolReturnCondition | undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
  };
}

export function mapToolSmsReminderRow(row: Record<string, unknown>): ToolSmsReminder {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    toolId: String(row.tool_id),
    employeeId: String(row.employee_id),
    phone: String(row.phone ?? ""),
    message: String(row.message ?? ""),
    sentAt: String(row.sent_at ?? row.created_at ?? ""),
    sentByUserId: String(row.sent_by_user_id ?? ""),
    status: (row.status as ToolSmsReminder["status"]) ?? "sent",
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    provider: (row.provider as ToolSmsReminder["provider"]) ?? "console",
  };
}

function enrichToolListItem(
  tool: Tool,
  assignments: ToolAssignment[],
  employees: Employee[],
  smsReminders: ToolSmsReminder[],
  today: string,
): ToolListItem {
  const toolAssignments = assignments.filter((a) => a.toolId === tool.id);
  const effectiveStatus = computeEffectiveStatus(tool.baseStatus, toolAssignments, today);
  const open = toolAssignments.filter(isAssignmentOpen);
  const current = open.find((a) => a.startDate <= today);
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const lastSms = smsReminders
    .filter((s) => s.toolId === tool.id)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];

  return {
    ...tool,
    effectiveStatus,
    currentEmployeeId: current?.employeeId,
    currentEmployeeName: current
      ? getEmployeeFullName(
          employeeMap.get(current.employeeId) ?? {
            firstName: "?",
            lastName: "",
            id: current.employeeId,
            companyId: tool.companyId,
            trade: "",
            mobilePhone: "",
            email: "",
            truckNumber: "",
            status: "active",
            department: "",
            hireDate: "",
            hourlyRate: 0,
          },
        )
      : undefined,
    checkoutDate: current?.startDate,
    expectedReturnDate: current?.expectedReturnDate,
    daysOverdue:
      current && current.expectedReturnDate < today
        ? daysOverdue(current.expectedReturnDate, today)
        : undefined,
    lastSmsReminder: lastSms,
  };
}

export async function getToolsWithDetails(
  companyId: string,
  isDemo: boolean,
  employees: Employee[],
): Promise<ToolListItem[]> {
  const today = todayDateString();

  if (isDemo) {
    const tools = filterDemo(demoTools, companyId);
    const assignments = filterDemo(demoToolAssignments, companyId);
    const sms = filterDemo(demoToolSmsReminders, companyId);
    return tools.map((tool) => enrichToolListItem(tool, assignments, employees, sms, today));
  }

  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const [toolsRes, assignmentsRes, smsRes] = await Promise.all([
    supabase.from("tools").select("*").eq("company_id", companyId).order("name"),
    supabase.from("tool_assignments").select("*").eq("company_id", companyId),
    supabase
      .from("tool_sms_reminders")
      .select("*")
      .eq("company_id", companyId)
      .order("sent_at", { ascending: false }),
  ]);

  const tools = (toolsRes.data ?? []).map(mapToolRow);
  const assignments = (assignmentsRes.data ?? []).map(mapToolAssignmentRow);
  const sms = (smsRes.data ?? []).map(mapToolSmsReminderRow);

  return tools.map((tool) => enrichToolListItem(tool, assignments, employees, sms, today));
}

export async function getToolById(
  companyId: string,
  toolId: string,
  isDemo: boolean,
  employees: Employee[],
): Promise<ToolWithDetails | null> {
  const today = todayDateString();
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  function enrichAssignment(a: ToolAssignment) {
    const emp = employeeMap.get(a.employeeId);
    return {
      ...a,
      employeeName: emp ? getEmployeeFullName(emp) : "Employé inconnu",
      employeePhone: emp?.mobilePhone ?? "",
    };
  }

  if (isDemo) {
    const tool = filterDemo(demoTools, companyId).find((t) => t.id === toolId);
    if (!tool) return null;
    const assignments = filterDemo(demoToolAssignments, companyId).filter((a) => a.toolId === toolId);
    const sms = filterDemo(demoToolSmsReminders, companyId)
      .filter((s) => s.toolId === toolId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const open = assignments.filter(isAssignmentOpen);
    const current = open.find((a) => a.startDate <= today);

    return {
      ...tool,
      effectiveStatus: computeEffectiveStatus(tool.baseStatus, assignments, today),
      currentAssignment: current ? enrichAssignment(current) : undefined,
      futureReservations: open
        .filter((a) => a.startDate > today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map(enrichAssignment),
      assignmentHistory: assignments
        .filter((a) => a.status === "returned")
        .sort((a, b) => (b.actualReturnDate ?? b.updatedAt).localeCompare(a.actualReturnDate ?? a.updatedAt))
        .map(enrichAssignment),
      lastSmsReminder: sms[0],
    };
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: toolRow } = await supabase
    .from("tools")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", toolId)
    .maybeSingle();

  if (!toolRow) return null;

  const tool = mapToolRow(toolRow as Record<string, unknown>);

  const [assignmentsRes, smsRes] = await Promise.all([
    supabase.from("tool_assignments").select("*").eq("tool_id", toolId).eq("company_id", companyId),
    supabase
      .from("tool_sms_reminders")
      .select("*")
      .eq("tool_id", toolId)
      .eq("company_id", companyId)
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);

  const assignments = (assignmentsRes.data ?? []).map(mapToolAssignmentRow);
  const open = assignments.filter(isAssignmentOpen);
  const current = open.find((a) => a.startDate <= today);

  return {
    ...tool,
    effectiveStatus: computeEffectiveStatus(tool.baseStatus, assignments, today),
    currentAssignment: current ? enrichAssignment(current) : undefined,
    futureReservations: open
      .filter((a) => a.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(enrichAssignment),
    assignmentHistory: assignments
      .filter((a) => a.status === "returned")
      .sort((a, b) => (b.actualReturnDate ?? b.updatedAt).localeCompare(a.actualReturnDate ?? a.updatedAt))
      .map(enrichAssignment),
    lastSmsReminder: smsRes.data?.[0]
      ? mapToolSmsReminderRow(smsRes.data[0] as Record<string, unknown>)
      : undefined,
  };
}

export async function getEmployeeToolSummary(
  companyId: string,
  employeeId: string,
  isDemo: boolean,
  employees: Employee[],
): Promise<EmployeeToolSummary> {
  const allTools = await getToolsWithDetails(companyId, isDemo, employees);
  const today = todayDateString();

  let assignments: ToolAssignment[] = [];
  if (isDemo) {
    assignments = filterDemo(demoToolAssignments, companyId);
  } else if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tool_assignments")
      .select("*")
      .eq("company_id", companyId)
      .eq("employee_id", employeeId);
    assignments = (data ?? []).map(mapToolAssignmentRow);
  }

  const toolMap = new Map(allTools.map((t) => [t.id, t]));

  const current = allTools.filter(
    (t) =>
      t.currentEmployeeId === employeeId &&
      t.effectiveStatus !== "available" &&
      t.expectedReturnDate,
  ) as Array<ToolListItem & { expectedReturnDate: string }>;

  const reservations = assignments
    .filter((a) => a.employeeId === employeeId && isAssignmentOpen(a) && a.startDate > today)
    .map((a) => {
      const tool = toolMap.get(a.toolId);
      return tool
        ? {
            ...tool,
            startDate: a.startDate,
            expectedReturnDate: a.expectedReturnDate,
          }
        : null;
    })
    .filter(Boolean) as Array<ToolListItem & { startDate: string; expectedReturnDate: string }>;

  const history = assignments
    .filter((a) => a.employeeId === employeeId && a.status === "returned")
    .map((a) => ({
      ...a,
      toolName: toolMap.get(a.toolId)?.name ?? "Outil",
      internalNumber: toolMap.get(a.toolId)?.internalNumber ?? "",
    }))
    .sort((a, b) => (b.actualReturnDate ?? b.updatedAt).localeCompare(a.actualReturnDate ?? a.updatedAt));

  return { current, reservations, history };
}

export async function createToolForCompany(
  companyId: string,
  input: {
    name: string;
    category: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    internalNumber?: string;
    description?: string;
    condition: ToolCondition;
    baseStatus: ToolBaseStatus;
  },
) {
  const supabase = await createClient();
  return supabase
    .from("tools")
    .insert({
      company_id: companyId,
      name: input.name,
      category: input.category,
      brand: input.brand ?? null,
      model: input.model ?? null,
      serial_number: input.serialNumber ?? null,
      internal_number: input.internalNumber ?? null,
      description: input.description ?? null,
      condition: input.condition,
      base_status: input.baseStatus,
    })
    .select("*")
    .single();
}

export async function updateToolForCompany(
  companyId: string,
  toolId: string,
  input: Partial<{
    name: string;
    category: string;
    brand: string;
    model: string;
    serialNumber: string;
    internalNumber: string;
    description: string;
    condition: ToolCondition;
    baseStatus: ToolBaseStatus;
  }>,
) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (input.name != null) payload.name = input.name;
  if (input.category != null) payload.category = input.category;
  if (input.brand != null) payload.brand = input.brand;
  if (input.model != null) payload.model = input.model;
  if (input.serialNumber != null) payload.serial_number = input.serialNumber;
  if (input.internalNumber != null) payload.internal_number = input.internalNumber;
  if (input.description != null) payload.description = input.description;
  if (input.condition != null) payload.condition = input.condition;
  if (input.baseStatus != null) payload.base_status = input.baseStatus;

  return supabase
    .from("tools")
    .update(payload)
    .eq("company_id", companyId)
    .eq("id", toolId)
    .select("*")
    .single();
}

export async function getToolAssignmentsForTool(companyId: string, toolId: string) {
  const supabase = await createClient();
  return supabase
    .from("tool_assignments")
    .select("*")
    .eq("company_id", companyId)
    .eq("tool_id", toolId);
}

export async function createToolAssignment(
  companyId: string,
  toolId: string,
  input: {
    employeeId: string;
    startDate: string;
    expectedReturnDate: string;
    notes?: string;
    createdByUserId?: string;
  },
) {
  const supabase = await createClient();
  const status = resolveAssignmentStatus(input.startDate);
  return supabase
    .from("tool_assignments")
    .insert({
      company_id: companyId,
      tool_id: toolId,
      employee_id: input.employeeId,
      start_date: input.startDate,
      expected_return_date: input.expectedReturnDate,
      status,
      notes: input.notes ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select("*")
    .single();
}

export async function returnToolAssignment(
  companyId: string,
  assignmentId: string,
  input: {
    actualReturnDate: string;
    returnCondition: ToolReturnCondition;
    notes?: string;
  },
) {
  const supabase = await createClient();
  return supabase
    .from("tool_assignments")
    .update({
      actual_return_date: input.actualReturnDate,
      return_condition: input.returnCondition,
      status: "returned",
      notes: input.notes ?? null,
    })
    .eq("company_id", companyId)
    .eq("id", assignmentId)
    .select("*")
    .single();
}

export async function insertToolSmsReminder(
  companyId: string,
  input: {
    toolId: string;
    employeeId: string;
    phone: string;
    message: string;
    sentByUserId: string;
    status: ToolSmsReminder["status"];
    provider: ToolSmsReminder["provider"];
    providerId?: string;
  },
) {
  const supabase = await createClient();
  return supabase
    .from("tool_sms_reminders")
    .insert({
      company_id: companyId,
      tool_id: input.toolId,
      employee_id: input.employeeId,
      phone: input.phone,
      message: input.message,
      sent_by_user_id: input.sentByUserId,
      status: input.status,
      provider: input.provider,
      provider_id: input.providerId ?? null,
    })
    .select("*")
    .single();
}

export function checkAssignmentOverlap(
  assignments: ToolAssignment[],
  startDate: string,
  expectedReturnDate: string,
  excludeAssignmentId?: string,
): string | null {
  const conflict = findOverlappingAssignment(assignments, startDate, expectedReturnDate, excludeAssignmentId);
  if (conflict) {
    return "Cet outil n'est plus disponible pour cette période. Veuillez choisir d'autres dates.";
  }
  return null;
}
