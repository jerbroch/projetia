"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { scheduleQuoteAction, updateQuoteScheduleAction } from "@/lib/actions/schedule";
import { upsertDemoScheduleEvent } from "@/lib/demo/schedule-events";
import { buildDemoJobNumber } from "@/lib/job-utils";
import { buildQuoteScheduleNotes, canScheduleQuote } from "@/lib/quote-utils";
import {
  buildScheduleEventFromQuote,
  getDefaultQuoteScheduleFormValues,
  type QuoteScheduleFormValues,
} from "@/lib/schedule-utils";
import { getEmployeeFullName } from "@/lib/employee-utils";
import { formatCurrency } from "@/lib/utils";
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
import type { Customer, Employee, Quote, ScheduleEvent } from "@/types";

const UNASSIGNED = "__unassigned__";

interface ScheduleFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote;
  customers: Customer[];
  employees: Employee[];
  companyId: string;
  isDemo?: boolean;
  existingEvent?: ScheduleEvent;
  onScheduled: (quote: Quote, event: ScheduleEvent) => void;
}

export function ScheduleFromQuoteDialog({
  open,
  onOpenChange,
  quote,
  customers,
  employees,
  companyId,
  isDemo,
  existingEvent,
  onScheduled,
}: ScheduleFromQuoteDialogProps) {
  const isEdit = Boolean(existingEvent);
  const [form, setForm] = useState<QuoteScheduleFormValues>(() =>
    getDefaultQuoteScheduleFormValues(existingEvent)
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && quote) {
      const defaults = getDefaultQuoteScheduleFormValues(existingEvent);
      if (existingEvent) {
        const prefix = buildQuoteScheduleNotes(quote);
        let userNotes = existingEvent.internalNotes ?? "";
        if (userNotes.startsWith(prefix)) {
          userNotes = userNotes.slice(prefix.length).replace(/^\n/, "");
        }
        defaults.internalNotes = userNotes;
      }
      setForm(defaults);
      setError("");
    }
  }, [open, existingEvent, quote]);

  if (!quote) return null;

  const customer = customers.find((c) => c.id === quote.customerId);
  const jobSiteAddress = customer?.address ?? "";
  const customerPhone = customer?.phone ?? "";
  const customerEmail = quote.customerEmail ?? customer?.email ?? "";

  const selectedEmployee = form.employeeId
    ? employees.find((e) => e.id === form.employeeId)
    : undefined;

  const activeEmployees = employees.filter(
    (e) => e.status === "active" || e.status === "vacation"
  );

  function updateField<K extends keyof QuoteScheduleFormValues>(
    key: K,
    value: QuoteScheduleFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!quote) return;

    if (!canScheduleQuote(quote)) {
      setError("Cette soumission ne peut pas être planifiée.");
      return;
    }

    if (form.startTime >= form.endTime) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    startTransition(async () => {
      if (isDemo) {
        const notesPrefix = buildQuoteScheduleNotes(quote);
        const internalNotes = form.internalNotes
          ? `${notesPrefix}\n${form.internalNotes}`
          : notesPrefix;

        const event = buildScheduleEventFromQuote(
          quote,
          { ...form, internalNotes },
          customers,
          employees,
          companyId,
          existingEvent
        );

        const numberedEvent = event.jobNumber
          ? event
          : {
              ...event,
              jobNumber: buildDemoJobNumber([], "contract"),
              jobNumberType: "contract" as const,
              jobOrigin: "quote" as const,
            };

        upsertDemoScheduleEvent(numberedEvent);
        onScheduled({ ...quote, scheduledJobId: numberedEvent.id }, numberedEvent);
        onOpenChange(false);
        return;
      }

      const payload = new FormData();
      payload.set("quoteId", quote.id);
      payload.set("date", form.date);
      payload.set("startTime", form.startTime);
      payload.set("endTime", form.endTime);
      payload.set("employeeId", form.employeeId);
      payload.set("status", form.status);
      payload.set("internalNotes", form.internalNotes);
      payload.set("clientPoNumber", form.clientPoNumber);

      const result = isEdit
        ? await updateQuoteScheduleAction(payload)
        : await scheduleQuoteAction(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onScheduled({ ...quote, scheduledJobId: result.scheduledJobId }, result.event);
      onOpenChange(false);
    });
  }

  const scheduleDateParam = form.date || existingEvent?.start.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la planification" : "Planifier les travaux"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez la planification liée à cette soumission acceptée."
              : "Créez un travail au calendrier à partir de cette soumission acceptée."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <h3 className="font-semibold">Informations de la soumission</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">No. soumission</span>
                <p className="font-medium">{quote.quoteNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Montant</span>
                <p className="font-medium">{formatCurrency(quote.amount)}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Projet</span>
                <p className="font-medium">{quote.title}</p>
              </div>
              {quote.description && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Description</span>
                  <p>{quote.description}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Client</span>
                <p className="font-medium">{quote.customerName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Téléphone</span>
                <p>{customerPhone || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Courriel</span>
                <p>{customerEmail || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Adresse du chantier</span>
                <p>{jobSiteAddress || "—"}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Planification</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-date">Date des travaux</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-start">Heure de début</Label>
                <Input
                  id="schedule-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField("startTime", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end">Heure de fin</Label>
                <Input
                  id="schedule-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField("endTime", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-employee">Employé assigné</Label>
                <Select
                  value={form.employeeId || UNASSIGNED}
                  onValueChange={(v) => updateField("employeeId", v === UNASSIGNED ? "" : v)}
                >
                  <SelectTrigger id="schedule-employee">
                    <SelectValue placeholder="Choisir un employé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
                    {activeEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {getEmployeeFullName(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEmployee && (
                <>
                  <div className="space-y-2">
                    <Label>Métier</Label>
                    <Input value={selectedEmployee.trade || "—"} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Camion</Label>
                    <Input value={selectedEmployee.truckNumber || "—"} readOnly disabled />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-status">Statut du travail</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    updateField("status", v as QuoteScheduleFormValues["status"])
                  }
                >
                  <SelectTrigger id="schedule-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Planifié</SelectItem>
                    <SelectItem value="in-progress">En cours</SelectItem>
                    <SelectItem value="completed">Terminé</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-po">Numéro de P.O. client</Label>
                <Input
                  id="schedule-po"
                  value={form.clientPoNumber}
                  onChange={(e) => updateField("clientPoNumber", e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule-notes">Notes</Label>
                <textarea
                  id="schedule-notes"
                  value={form.internalNotes}
                  onChange={(e) => updateField("internalNotes", e.target.value)}
                  placeholder="Notes internes pour l'équipe..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {isEdit && quote.scheduledJobId && (
              <Button type="button" variant="outline" asChild>
                <Link href={`/schedule?date=${scheduleDateParam}`}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Voir dans le calendrier
                </Link>
              </Button>
            )}
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Enregistrement..."
                  : isEdit
                    ? "Enregistrer les modifications"
                    : "Confirmer la planification"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
