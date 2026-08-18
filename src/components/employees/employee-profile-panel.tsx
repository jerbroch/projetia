"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Truck, User } from "lucide-react";
import type { Company, Employee, ProfileRole, ToolListItem, ToolWithDetails } from "@/types";
import { getEmployeeFullName, getEmployeeInitials } from "@/lib/employee-utils";
import {
  canAssignTool,
  canManageTools,
  computeEmployeeToolSummary,
} from "@/lib/tool-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeToolsSection } from "@/components/outillage/employee-tools-section";
import { AssignToolDialog } from "@/components/outillage/assign-tool-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmployeeProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  tools: ToolListItem[];
  employees: Employee[];
  company: Company;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employeeId: string) => void;
  onToolUpdated?: (tool: ToolWithDetails) => void;
}

export function EmployeeProfilePanel({
  open,
  onOpenChange,
  employee,
  tools,
  employees,
  membershipRole,
  isDemo,
  onEdit,
  onDeactivate,
  onToolUpdated,
}: EmployeeProfilePanelProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [pickToolOpen, setPickToolOpen] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState("");

  const canManage = canManageTools(membershipRole);

  const toolSummary = useMemo(
    () => (employee ? computeEmployeeToolSummary(employee.id, tools) : { current: [], reservations: [], history: [] }),
    [employee, tools],
  );

  const availableTools = useMemo(() => tools.filter((t) => canAssignTool(t)), [tools]);

  const selectedTool = tools.find((t) => t.id === selectedToolId);

  if (!employee) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Profil employé</DialogTitle>
            <DialogDescription>Coordonnées, métier et outillage assigné.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14">
                {employee.profilePhoto ? (
                  <AvatarImage src={employee.profilePhoto} alt={getEmployeeFullName(employee)} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getEmployeeInitials(employee)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{getEmployeeFullName(employee)}</h3>
                <p className="text-sm text-muted-foreground">{employee.trade}</p>
                <div className="mt-2">
                  <StatusBadge status={employee.status} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{employee.mobilePhone || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{employee.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>Camion {employee.truckNumber || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {employee.department} · {formatCurrency(employee.hourlyRate)}/h
                </span>
              </div>
              <p className="text-muted-foreground">Embauché le {formatDate(employee.hireDate)}</p>
            </div>

            {employee.notes && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">Notes</p>
                <p className="mt-1 text-muted-foreground">{employee.notes}</p>
              </div>
            )}

            <EmployeeToolsSection
              summary={toolSummary}
              employee={employee}
              canManage={canManage}
              onAssign={canManage ? () => setPickToolOpen(true) : undefined}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {employee.mobilePhone && (
                <Button variant="outline" asChild>
                  <a href={`tel:${employee.mobilePhone}`}>Appeler</a>
                </Button>
              )}
              {employee.email && (
                <Button variant="outline" asChild>
                  <a href={`mailto:${employee.email}`}>Courriel</a>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {employee.status !== "inactive" && canManage && (
                <Button variant="outline" onClick={() => onDeactivate(employee.id)}>
                  Désactiver
                </Button>
              )}
              {canManage && (
                <Button
                  onClick={() => {
                    onEdit(employee);
                    onOpenChange(false);
                  }}
                >
                  Modifier
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickToolOpen} onOpenChange={setPickToolOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner un outil</DialogTitle>
            <DialogDescription>
              Choisir un outil disponible pour {getEmployeeFullName(employee)}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedToolId} onValueChange={setSelectedToolId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un outil" />
            </SelectTrigger>
            <SelectContent>
              {availableTools.map((tool) => (
                <SelectItem key={tool.id} value={tool.id}>
                  {tool.name} {tool.internalNumber ? `(${tool.internalNumber})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickToolOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!selectedToolId}
              onClick={() => {
                setPickToolOpen(false);
                setAssignOpen(true);
              }}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignToolDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        tool={selectedTool}
        employees={employees}
        isDemo={isDemo}
        defaultEmployeeId={employee.id}
        onAssigned={(tool) => {
          onToolUpdated?.(tool);
          setAssignOpen(false);
        }}
      />
    </>
  );
}
