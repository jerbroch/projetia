"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, MessageSquare, RotateCcw, UserPlus } from "lucide-react";
import { getToolDetailAction } from "@/lib/actions/tools";
import {
  canAssignTool,
  canReserveTool,
  formatLastSmsReminder,
  normalizeToolWithDetails,
  TOOL_CONDITION_LABELS,
} from "@/lib/tool-utils";
import { ToolStatusBadge } from "@/components/outillage/tool-status-badge";
import { AssignToolDialog } from "@/components/outillage/assign-tool-dialog";
import { ReturnToolDialog } from "@/components/outillage/return-tool-dialog";
import { SendSmsDialog } from "@/components/outillage/send-sms-dialog";
import type { Company, Employee, ToolListItem, ToolWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";

interface ToolDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolId?: string;
  listItem?: ToolListItem;
  employees: Employee[];
  company: Company;
  isDemo?: boolean;
  canManage: boolean;
  onToolUpdated: (tool: ToolWithDetails) => void;
}

export function ToolDetailDialog({
  open,
  onOpenChange,
  toolId,
  listItem,
  employees,
  company,
  isDemo,
  canManage,
  onToolUpdated,
}: ToolDetailDialogProps) {
  const [tool, setTool] = useState<ToolWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  useEffect(() => {
    if (!open || !toolId) {
      setTool(null);
      return;
    }

    if (isDemo && listItem) {
      setTool(
        normalizeToolWithDetails({
          ...listItem,
          currentAssignment: listItem.currentEmployeeId
            ? {
                id: "demo-assignment",
                toolId: listItem.id,
                employeeId: listItem.currentEmployeeId,
                companyId: listItem.companyId,
                startDate: listItem.checkoutDate ?? "",
                expectedReturnDate: listItem.expectedReturnDate ?? "",
                status: "active",
                createdAt: "",
                updatedAt: "",
                employeeName: listItem.currentEmployeeName ?? "",
                employeePhone:
                  employees.find((e) => e.id === listItem.currentEmployeeId)?.mobilePhone ?? "",
              }
            : undefined,
          futureReservations:
            listItem.hasFutureReservation && listItem.nextReservationStart
              ? [
                  {
                    id: "demo-reservation",
                    toolId: listItem.id,
                    employeeId: listItem.nextReservationEmployeeId ?? "",
                    companyId: listItem.companyId,
                    startDate: listItem.nextReservationStart,
                    expectedReturnDate:
                      listItem.nextReservationExpectedReturn ?? listItem.nextReservationStart,
                    status: "reserved" as const,
                    createdAt: "",
                    updatedAt: "",
                    employeeName:
                      employees.find((e) => e.id === listItem.nextReservationEmployeeId)
                        ?.firstName ?? "Employé",
                    employeePhone:
                      employees.find((e) => e.id === listItem.nextReservationEmployeeId)
                        ?.mobilePhone ?? "",
                  },
                ]
              : [],
          lastSmsReminder: listItem.lastSmsReminder,
        }),
      );
      return;
    }

    setLoading(true);
    getToolDetailAction(toolId).then((result) => {
      setLoading(false);
      if (result.success) setTool(normalizeToolWithDetails(result.tool));
    });
  }, [open, toolId, isDemo, listItem, employees]);

  function handleToolUpdated(tool: ToolWithDetails) {
    const normalized = normalizeToolWithDetails(tool);
    if (normalized) setTool(normalized);
    onToolUpdated(tool);
  }

  const display = normalizeToolWithDetails(tool ?? listItem);
  const assignable = display ? canAssignTool(display) : false;
  const reservable = display ? canReserveTool(display) : false;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{display?.name ?? "Détails de l'outil"}</DialogTitle>
            <DialogDescription>
              {display?.internalNumber ? `No. ${display.internalNumber}` : "Inventaire partagé"}
            </DialogDescription>
          </DialogHeader>

          {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

          {display && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <ToolStatusBadge status={display.effectiveStatus} />
                <span className="text-sm text-muted-foreground">{display.category}</span>
                {display.brand && (
                  <span className="text-sm text-muted-foreground">
                    {display.brand} {display.model}
                  </span>
                )}
              </div>

              <div className="grid gap-2 rounded-lg border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Numéro de série</span>
                  <span>{display.serialNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condition</span>
                  <span>{TOOL_CONDITION_LABELS[display.condition] ?? display.condition}</span>
                </div>
                {display.description && (
                  <p className="pt-1 text-muted-foreground">{display.description}</p>
                )}
              </div>

              {display.currentAssignment && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 font-medium">Assignation actuelle</p>
                  <div className="space-y-1 text-sm">
                    <p>{display.currentAssignment.employeeName}</p>
                    <p className="text-muted-foreground">
                      Depuis le {formatDate(display.currentAssignment.startDate)} — retour prévu le{" "}
                      {formatDate(display.currentAssignment.expectedReturnDate)}
                    </p>
                    {display.currentAssignment.notes && (
                      <p className="text-muted-foreground">{display.currentAssignment.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {display.futureReservations.length > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 font-medium">Réservations futures</p>
                  <ul className="space-y-2 text-sm">
                    {display.futureReservations.map((r) => (
                      <li key={r.id} className="text-muted-foreground">
                        {r.employeeName} — du {formatDate(r.startDate)} au{" "}
                        {formatDate(r.expectedReturnDate)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {display.lastSmsReminder && (
                <p className="text-xs text-muted-foreground">
                  {formatLastSmsReminder(display.lastSmsReminder.sentAt)}
                </p>
              )}

              {display.assignmentHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 font-medium">Historique</p>
                    <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                      {display.assignmentHistory.map((h) => (
                        <li key={h.id} className="text-muted-foreground">
                          {h.employeeName} — {formatDate(h.startDate)} →{" "}
                          {h.actualReturnDate ? formatDate(h.actualReturnDate) : "—"}
                          {h.returnCondition &&
                            ` (${TOOL_CONDITION_LABELS[h.returnCondition] ?? h.returnCondition})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {canManage && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {assignable && !display.currentAssignment && (
                    <>
                      <Button size="sm" onClick={() => setAssignOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assigner
                      </Button>
                      {reservable && (
                        <Button size="sm" variant="outline" onClick={() => setReserveOpen(true)}>
                          <CalendarPlus className="mr-2 h-4 w-4" />
                          Réserver
                        </Button>
                      )}
                    </>
                  )}
                  {display.currentAssignment && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Retour
                      </Button>
                      {display.effectiveStatus === "overdue" && (
                        <Button size="sm" variant="outline" onClick={() => setSmsOpen(true)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Envoyer un SMS
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AssignToolDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        tool={listItem}
        employees={employees}
        isDemo={isDemo}
        mode="assign"
        onAssigned={handleToolUpdated}
      />
      <AssignToolDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        tool={listItem}
        employees={employees}
        isDemo={isDemo}
        mode="reserve"
        onAssigned={handleToolUpdated}
      />
      <ReturnToolDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        tool={tool ?? undefined}
        isDemo={isDemo}
        onReturned={handleToolUpdated}
      />
      <SendSmsDialog
        open={smsOpen}
        onOpenChange={setSmsOpen}
        tool={tool ?? undefined}
        company={company}
        isDemo={isDemo}
        onSent={handleToolUpdated}
      />
    </>
  );
}
