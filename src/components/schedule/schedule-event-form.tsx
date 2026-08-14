"use client";

import { useEffect, useState } from "react";
import { Trash2, Receipt, Wrench } from "lucide-react";
import type { Customer, Employee, ScheduleEvent } from "@/types";
import { canSubmitJobStatus } from "@/lib/job-workflow";
import {
  buildScheduleEvent,
  createCustomerFromForm,
  fillCustomerFields,
  getDefaultFormValues,
  type ScheduleFormDefaults,
  type ScheduleFormValues,
} from "@/lib/schedule-utils";
import { getEmployeeFullName } from "@/lib/employee-utils";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ScheduleEventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  event?: ScheduleEvent;
  formDefaults?: ScheduleFormDefaults;
  customers: Customer[];
  employees: Employee[];
  companyId: string;
  onSave: (event: ScheduleEvent, newCustomer?: Customer) => void;
  onCancelJob: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onBilling?: (event: ScheduleEvent) => void;
  onCloseWork?: (event: ScheduleEvent) => void;
}

export function ScheduleEventForm({
  open,
  onOpenChange,
  mode,
  event,
  formDefaults,
  customers,
  employees,
  companyId,
  onSave,
  onCancelJob,
  onDelete,
  onBilling,
  onCloseWork,
}: ScheduleEventFormProps) {
  const [form, setForm] = useState<ScheduleFormValues>(() =>
    getDefaultFormValues(formDefaults, event)
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(getDefaultFormValues(formDefaults, event));
      setError("");
    }
  }, [open, event, formDefaults]);

  function updateField<K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCustomerSelect(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const fields = fillCustomerFields(customer);
    setForm((prev) => ({
      ...prev,
      customerId,
      customerName: fields.customerName,
      customerPhone: fields.customerPhone,
      customerEmail: fields.customerEmail,
      billingAddress: fields.billingAddress,
      jobSiteAddress: fields.jobSiteAddress,
    }));
  }

  function toggleEmployee(employeeId: string) {
    setForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(employeeId)
        ? prev.employeeIds.filter((id) => id !== employeeId)
        : [...prev.employeeIds, employeeId],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Job title is required.");
      return;
    }
    if (form.startTime >= form.endTime) {
      setError("End time must be after start time.");
      return;
    }
    if (form.customerMode === "existing" && !form.customerId) {
      setError("Please select a customer.");
      return;
    }
    if (form.customerMode === "new" && !form.newCustomerName.trim()) {
      setError("Customer name is required for new customers.");
      return;
    }

    let updatedCustomers = customers;
    let customerId = form.customerId;

    if (form.customerMode === "new") {
      const newCustomer = createCustomerFromForm(form, companyId);
      updatedCustomers = [...customers, newCustomer];
      customerId = newCustomer.id;
    }

    const eventData = buildScheduleEvent(
      { ...form, customerId },
      updatedCustomers,
      employees,
      mode === "edit" ? event?.id : undefined
    );

    onSave(
      eventData,
      form.customerMode === "new" ? updatedCustomers[updatedCustomers.length - 1] : undefined
    );
    onOpenChange(false);
  }

  const activeEmployees = employees.filter((e) => e.status === "active" || e.status === "vacation");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Schedule New Job" : "Edit Scheduled Job"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new job on the schedule."
              : "Update job details, crew assignment, or status."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Job Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Kitchen remodel - phase 1"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Work Description</Label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the scope of work..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Job Type</Label>
                <Select value={form.type} onValueChange={(v) => updateField("type", v as ScheduleFormValues["type"])}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField("startTime", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField("endTime", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => updateField("status", v as ScheduleFormValues["status"])}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Planifié</SelectItem>
                    <SelectItem value="en-route">En route</SelectItem>
                    <SelectItem value="in-progress">En travail</SelectItem>
                    <SelectItem value="completed">Travaux terminés</SelectItem>
                    <SelectItem value="pending-review">À vérifier</SelectItem>
                    <SelectItem value="ready-to-invoice">Prêt à facturer</SelectItem>
                    <SelectItem value="invoice-sent">Facture envoyée</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === "edit" && event?.jobNumber && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>No. de travail</Label>
                  <Input value={event.jobNumber} readOnly disabled className="bg-muted" />
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clientPoNumber">Numéro de P.O. client</Label>
                <Input
                  id="clientPoNumber"
                  value={form.clientPoNumber}
                  onChange={(e) => updateField("clientPoNumber", e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Customer</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.customerMode === "existing" ? "default" : "outline"}
                onClick={() => updateField("customerMode", "existing")}
              >
                Existing Customer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.customerMode === "new" ? "default" : "outline"}
                onClick={() => updateField("customerMode", "new")}
              >
                New Customer
              </Button>
            </div>

            {form.customerMode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="customer">Select Customer</Label>
                <Select value={form.customerId} onValueChange={handleCustomerSelect}>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company} — {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newCustomerName">Contact Name</Label>
                  <Input
                    id="newCustomerName"
                    value={form.newCustomerName}
                    onChange={(e) => updateField("newCustomerName", e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newCustomerCompany">Company</Label>
                  <Input
                    id="newCustomerCompany"
                    value={form.newCustomerCompany}
                    onChange={(e) => updateField("newCustomerCompany", e.target.value)}
                    placeholder="Smith Construction LLC"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={form.customerPhone}
                  onChange={(e) => updateField("customerPhone", e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => updateField("customerEmail", e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billingAddress">Billing Address</Label>
                <Input
                  id="billingAddress"
                  value={form.billingAddress}
                  onChange={(e) => updateField("billingAddress", e.target.value)}
                  placeholder="123 Main St, City, ST 12345"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="jobSiteAddress">Job-Site Address</Label>
                <Input
                  id="jobSiteAddress"
                  value={form.jobSiteAddress}
                  onChange={(e) => updateField("jobSiteAddress", e.target.value)}
                  placeholder="456 Work Site Rd, City, ST 12345"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Assigned Employees</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeEmployees.map((employee) => {
                const selected = form.employeeIds.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggleEmployee(employee.id)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div>
                      <p className="font-medium">{getEmployeeFullName(employee)}</p>
                      <p className="text-xs text-muted-foreground">{employee.trade} · Truck {employee.truckNumber}</p>
                    </div>
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border",
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal Notes</Label>
            <textarea
              id="internalNotes"
              value={form.internalNotes}
              onChange={(e) => updateField("internalNotes", e.target.value)}
              placeholder="Notes visible only to your team..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {mode === "edit" && event && (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {onCloseWork && event && canSubmitJobStatus(event.status) && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      onCloseWork(event);
                      onOpenChange(false);
                    }}
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Fermer le travail
                  </Button>
                )}
                {onBilling && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onBilling(event);
                    }}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    Facturation
                  </Button>
                )}
                {event.status !== "cancelled" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onCancelJob(event.id);
                      onOpenChange(false);
                    }}
                  >
                    Cancel Job
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onDelete(event.id);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit">{mode === "create" ? "Create Job" : "Save Changes"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
