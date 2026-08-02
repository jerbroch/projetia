"use client";

import { useEffect, useState } from "react";
import type { Employee } from "@/types";
import {
  buildEmployeeFromForm,
  getDefaultEmployeeFormValues,
  type EmployeeFormValues,
} from "@/lib/employee-utils";
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

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employee?: Employee;
  onSave: (employee: Employee) => void;
}

export function EmployeeForm({ open, onOpenChange, mode, employee, onSave }: EmployeeFormProps) {
  const [form, setForm] = useState<EmployeeFormValues>(() => getDefaultEmployeeFormValues(employee));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(getDefaultEmployeeFormValues(employee));
      setError("");
    }
  }, [open, employee]);

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!form.trade.trim()) {
      setError("Trade / job title is required.");
      return;
    }

    onSave(buildEmployeeFromForm(form, mode === "edit" ? employee?.id : undefined));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Employee" : "Edit Employee"}</DialogTitle>
          <DialogDescription>Manage worker profile, trade, contact info, and truck assignment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade">Trade / Job Title</Label>
              <Input id="trade" value={form.trade} onChange={(e) => updateField("trade", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="truckNumber">Truck Number</Label>
              <Input id="truckNumber" value={form.truckNumber} onChange={(e) => updateField("truckNumber", e.target.value)} placeholder="T-101" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Mobile Phone</Label>
              <Input id="mobilePhone" value={form.mobilePhone} onChange={(e) => updateField("mobilePhone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={form.department} onChange={(e) => updateField("department", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v as EmployeeFormValues["status"])}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input id="hireDate" type="date" value={form.hireDate} onChange={(e) => updateField("hireDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input id="hourlyRate" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => updateField("hourlyRate", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profilePhoto">Profile Photo URL (optional)</Label>
              <Input id="profilePhoto" value={form.profilePhoto} onChange={(e) => updateField("profilePhoto", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{mode === "create" ? "Add Employee" : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
