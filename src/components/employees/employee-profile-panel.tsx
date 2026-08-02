"use client";

import { Mail, Phone, Truck, User } from "lucide-react";
import type { Employee } from "@/types";
import { getEmployeeFullName, getEmployeeInitials } from "@/lib/employee-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
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

interface EmployeeProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employeeId: string) => void;
}

export function EmployeeProfilePanel({
  open,
  onOpenChange,
  employee,
  onEdit,
  onDeactivate,
}: EmployeeProfilePanelProps) {
  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Employee Profile</DialogTitle>
          <DialogDescription>Contact details, trade, and truck assignment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              {employee.profilePhoto ? <AvatarImage src={employee.profilePhoto} alt={getEmployeeFullName(employee)} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary">{getEmployeeInitials(employee)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{getEmployeeFullName(employee)}</h3>
              <p className="text-sm text-muted-foreground">{employee.trade}</p>
              <div className="mt-2"><StatusBadge status={employee.status} /></div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-4 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{employee.mobilePhone || "—"}</span></div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{employee.email || "—"}</span></div>
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /><span>Truck {employee.truckNumber || "—"}</span></div>
            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{employee.department} · {formatCurrency(employee.hourlyRate)}/hr</span></div>
            <p className="text-muted-foreground">Hired {formatDate(employee.hireDate)}</p>
          </div>

          {employee.notes && (
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium">Notes</p>
              <p className="mt-1 text-muted-foreground">{employee.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {employee.mobilePhone && (
              <Button variant="outline" asChild>
                <a href={`tel:${employee.mobilePhone}`}>Call</a>
              </Button>
            )}
            {employee.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${employee.email}`}>Email</a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {employee.status !== "inactive" && (
              <Button variant="outline" onClick={() => onDeactivate(employee.id)}>Deactivate</Button>
            )}
            <Button onClick={() => { onEdit(employee); onOpenChange(false); }}>Edit Profile</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
