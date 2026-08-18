"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { assignToolAction } from "@/lib/actions/tools";
import { getEmployeeFullName } from "@/lib/employee-utils";
import {
  computeEffectiveStatus,
  computeExpectedReturnDate,
  resolveAssignmentStatus,
  todayDateString,
} from "@/lib/tool-utils";
import type { Employee, ToolListItem, ToolWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const textareaClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface AssignToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: ToolListItem;
  employees: Employee[];
  isDemo?: boolean;
  defaultEmployeeId?: string;
  onAssigned: (tool: ToolWithDetails) => void;
}

function buildDemoAssignedTool(
  tool: ToolListItem,
  employees: Employee[],
  input: {
    employeeId: string;
    startDate: string;
    expectedReturnDate: string;
    notes?: string;
  },
): ToolWithDetails {
  const employee = employees.find((e) => e.id === input.employeeId);
  const status = resolveAssignmentStatus(input.startDate);
  const assignment = {
    id: `demo-${Date.now()}`,
    toolId: tool.id,
    employeeId: input.employeeId,
    companyId: tool.companyId,
    startDate: input.startDate,
    expectedReturnDate: input.expectedReturnDate,
    status,
    notes: input.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    employeeName: employee ? getEmployeeFullName(employee) : "Employé",
    employeePhone: employee?.mobilePhone ?? "",
  };

  const isFuture = status === "reserved";
  const effectiveStatus = computeEffectiveStatus(
    tool.baseStatus,
    [assignment],
    todayDateString(),
  );

  return {
    ...tool,
    effectiveStatus,
    currentAssignment: isFuture ? undefined : assignment,
    futureReservations: isFuture ? [assignment] : [],
    assignmentHistory: [],
  };
}

export function AssignToolDialog({
  open,
  onOpenChange,
  tool,
  employees,
  isDemo,
  defaultEmployeeId,
  onAssigned,
}: AssignToolDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [durationDays, setDurationDays] = useState("7");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    const start = format(new Date(), "yyyy-MM-dd");
    setStartDate(start);
    setDurationDays("7");
    setExpectedReturnDate(computeExpectedReturnDate(start, 7));
    setEmployeeId(defaultEmployeeId ?? "");
  }, [open, defaultEmployeeId]);

  useEffect(() => {
    const days = Number(durationDays) || 1;
    setExpectedReturnDate(computeExpectedReturnDate(startDate, days));
  }, [startDate, durationDays]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tool) return;

    const formData = new FormData(e.currentTarget);
    formData.set("employeeId", employeeId);
    formData.set("startDate", startDate);
    formData.set("durationDays", durationDays);
    formData.set("expectedReturnDate", expectedReturnDate);

    startTransition(async () => {
      if (isDemo) {
        onAssigned(
          buildDemoAssignedTool(tool, employees, {
            employeeId,
            startDate,
            expectedReturnDate,
            notes: formData.get("notes")?.toString() || undefined,
          }),
        );
        onOpenChange(false);
        return;
      }

      const result = await assignToolAction(tool.id, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onAssigned(result.tool);
      onOpenChange(false);
    });
  }

  const activeEmployees = employees.filter((e) => e.status === "active" || e.status === "vacation");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner à un employé</DialogTitle>
          <DialogDescription>
            {tool ? `${tool.name} (${tool.internalNumber || "sans no."})` : "Sélectionnez les dates"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Employé *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un employé" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {getEmployeeFullName(emp)} — {emp.trade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationDays">Durée (jours)</Label>
              <Input
                id="durationDays"
                name="durationDays"
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedReturnDate">Retour prévu</Label>
            <Input
              id="expectedReturnDate"
              name="expectedReturnDate"
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" rows={2} className={textareaClassName} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !employeeId}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assigner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
