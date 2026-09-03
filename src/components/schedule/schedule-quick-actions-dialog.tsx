"use client";

import { useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  isoToLocalDateTime,
} from "@/lib/schedule-timezone";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  ChevronDown,
  Mail,
  Receipt,
  Truck,
  User,
} from "lucide-react";
import { getBillingSummaryForJobAction } from "@/lib/actions/billing";
import { approveJobForBillingAction } from "@/lib/actions/job-workflow";
import { updateScheduleJobStatusAction } from "@/lib/actions/schedule";
import {
  canQuickChangeToStatus,
  getJobStatusLabel,
  isPendingReviewJob,
  isReadyToInvoiceJob,
  QUICK_STATUS_BUTTON_LABELS,
  type JobWorkflowStatus,
} from "@/lib/job-workflow";
import { prochaineAction, riensAFaire, statutsDeCorrection } from "@/lib/prochaine-action";
import { getJobDisplayNumber } from "@/lib/job-utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Company, ProfileRole, ScheduleEvent } from "@/types";
import { JobShiftsEditor } from "@/components/schedule/job-shifts-editor";
import type { JobShift } from "@/lib/job-shifts";
import { JobToolsSection } from "@/components/schedule/job-tools-section";
import { PiecesJointesSection } from "@/components/shared/pieces-jointes-section";
import { SendInvoiceDialog } from "@/components/invoices/send-invoice-dialog";
import { formatCurrency } from "@/lib/utils";
import type { CleAction } from "@/lib/prochaine-action";
import type { Employee, ToolListItem } from "@/types";

interface ScheduleQuickActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ScheduleEvent;
  membershipRole: ProfileRole;
  company: Company;
  isDemo?: boolean;
  onEventUpdated: (event: ScheduleEvent) => void;
  onViewDetail: (event: ScheduleEvent) => void;
  onCloseWork: (event: ScheduleEvent) => void;
  onBilling: (event: ScheduleEvent) => void;
  shifts?: JobShift[];
  onShiftsChanged?: () => void;
  tools?: ToolListItem[];
  /** Nommée « equipe » : « employees » désigne déjà la liste de noms affichée. */
  equipe?: Employee[];
}

export function ScheduleQuickActionsDialog({
  open,
  onOpenChange,
  event,
  membershipRole,
  company,
  isDemo,
  onEventUpdated,
  onViewDetail,
  onCloseWork,
  onBilling,
  shifts = [],
  onShiftsChanged,
  tools = [],
  equipe = [],
}: ScheduleQuickActionsDialogProps) {
  const [currentEvent, setCurrentEvent] = useState<ScheduleEvent | undefined>(event);
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | undefined>();
  const [invoiceNumber, setInvoiceNumber] = useState<string | undefined>();
  const [invoiceSentAt, setInvoiceSentAt] = useState<string | null>(null);
  const [totalFeuille, setTotalFeuille] = useState<number | null>(null);
  const [correctionsOuvertes, setCorrectionsOuvertes] = useState(false);
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && event) {
      setCurrentEvent(event);
      setError("");
      setInvoiceId(undefined);
      setInvoiceNumber(undefined);
      setInvoiceSentAt(null);
      setTotalFeuille(null);
      setCorrectionsOuvertes(false);

      if (!isDemo) {
        getBillingSummaryForJobAction(event.id).then((result) => {
          if (result.success && result.data) {
            setInvoiceId(result.data.invoiceId);
            setInvoiceNumber(result.data.invoiceNumber);
            setInvoiceSentAt(result.data.invoiceSentAt ?? null);
            setTotalFeuille(result.data.sheet ? result.data.sheet.total : null);
          }
        });
      }
    }
  }, [open, event, isDemo]);

  if (!currentEvent) return null;

  const selectedEvent = currentEvent;

  // UNE action principale, nommée par ce qu'elle fait. Les marches arrière sont
  // repliées : on les prend quand on s'est trompé, pas quand on avance.
  const action = prochaineAction(selectedEvent, {
    role: membershipRole,
    factureExiste: Boolean(invoiceId),
    factureEnvoyee: Boolean(invoiceSentAt),
  });
  const corrections = statutsDeCorrection(selectedEvent, membershipRole);
  const messageFin = riensAFaire(selectedEvent.status);

  const jobDate = format(parseISO(selectedEvent.start), "d MMMM yyyy", { locale: fr });
  const { time: startTime } = isoToLocalDateTime(selectedEvent.start);
  const { time: endTime } = isoToLocalDateTime(selectedEvent.end);
  const address = selectedEvent.jobSiteAddress ?? selectedEvent.location;
  const employees =
    selectedEvent.employeeNames.length > 0
      ? selectedEvent.employeeNames.join(", ")
      : "Non assigné";

  function applyLocalStatus(event: ScheduleEvent, status: JobWorkflowStatus): ScheduleEvent {
    const now = new Date().toISOString();
    const updated: ScheduleEvent = { ...event, status };

    if (status === "completed") updated.workCompletedAt = now;
    if (status === "pending-review") {
      updated.submittedForReviewAt = now;
      updated.workCompletedAt = updated.workCompletedAt ?? now;
    }
    if (status === "ready-to-invoice") updated.approvedAt = now;
    if (status === "invoice-sent") updated.sentAt = now;

    return updated;
  }

  function handleStatusClick(status: JobWorkflowStatus) {
    if (!currentEvent) return;
    const eventSnapshot = currentEvent;
    setError("");

    if (status === "completed") {
      onOpenChange(false);
      onCloseWork(eventSnapshot);
      return;
    }

    if (status === "ready-to-invoice" && isPendingReviewJob(eventSnapshot)) {
      if (isDemo) {
        const updated = applyLocalStatus(eventSnapshot, "ready-to-invoice");
        setCurrentEvent(updated);
        onEventUpdated(updated);
        return;
      }

      startTransition(async () => {
        const result = await approveJobForBillingAction(eventSnapshot.id);
        if (!result.success) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setCurrentEvent(result.data);
          onEventUpdated(result.data);
        }
      });
      return;
    }

    const previous = eventSnapshot;
    const optimistic = applyLocalStatus(eventSnapshot, status);
    setCurrentEvent(optimistic);
    onEventUpdated(optimistic);

    if (isDemo) return;

    startTransition(async () => {
      const result = await updateScheduleJobStatusAction(eventSnapshot.id, status);
      if (!result.success) {
        setError(result.error);
        setCurrentEvent(previous);
        onEventUpdated(previous);
        return;
      }
      if ("event" in result) {
        setCurrentEvent(result.event);
        onEventUpdated(result.event);
      }
    });
  }

  function approuver() {
    if (!currentEvent) return;
    const snapshot = currentEvent;
    setError("");

    if (isDemo) {
      const updated = applyLocalStatus(snapshot, "ready-to-invoice");
      setCurrentEvent(updated);
      onEventUpdated(updated);
      return;
    }

    startTransition(async () => {
      const result = await approveJobForBillingAction(snapshot.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setCurrentEvent(result.data);
        onEventUpdated(result.data);
      }
    });
  }

  function lancerAction(cle: CleAction) {
    if (!currentEvent) return;
    const snapshot = currentEvent;

    switch (cle) {
      case "demarrer":
        handleStatusClick("in-progress");
        return;
      case "terminer":
        onOpenChange(false);
        onCloseWork(snapshot);
        return;
      case "approuver":
        // L'approbation se fait ICI, sur le call, où l'entrepreneur est déjà.
        // Elle exigeait avant d'ouvrir une deuxième fenêtre depuis une page
        // qui n'était même pas dans le menu.
        approuver();
        return;
      case "generer":
        onOpenChange(false);
        onBilling(snapshot);
        return;
      case "envoyer":
        setEnvoiOuvert(true);
        return;
      case "payer":
        handleStatusClick("paid");
        return;
    }
  }

  function IconeAction({ cle }: { cle: CleAction }) {
    if (cle === "demarrer") return <Truck className="mr-2 h-4 w-4" />;
    if (cle === "terminer" || cle === "approuver") return <CheckCircle2 className="mr-2 h-4 w-4" />;
    if (cle === "envoyer") return <Mail className="mr-2 h-4 w-4" />;
    return <Receipt className="mr-2 h-4 w-4" />;
  }

  function renderStatusButton(status: JobWorkflowStatus) {
    const label = QUICK_STATUS_BUTTON_LABELS[status] ?? getJobStatusLabel(status);
    const isActive = selectedEvent.status === status;
    const canChange = canQuickChangeToStatus(
      membershipRole,
      selectedEvent.status,
      status
    );

    return (
      <Button
        key={status}
        type="button"
        variant={isActive ? "default" : "outline"}
        size="sm"
        disabled={isPending || isActive || !canChange}
        onClick={() => handleStatusClick(status)}
        className="justify-start"
      >
        {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
        {label}
      </Button>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getJobDisplayNumber(selectedEvent)}</DialogTitle>
          <DialogDescription>{selectedEvent.title}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <div className="flex items-center gap-2">
          <StatusBadge status={selectedEvent.status} />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{selectedEvent.customerName ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Adresse</p>
              <p className="font-medium">{address || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Employé assigné</p>
              <p className="font-medium">{employees}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Horaire</p>
            <p className="font-medium">
              {jobDate} · {startTime} – {endTime}
            </p>
          </div>

          <JobShiftsEditor
            jobId={selectedEvent.id}
            callStart={selectedEvent.start}
            callEnd={selectedEvent.end}
            employeeIds={selectedEvent.employeeIds}
            employeeNames={selectedEvent.employeeNames}
            shifts={shifts.filter((s) => s.scheduledJobId === selectedEvent.id)}
            onChanged={onShiftsChanged}
          />

          <JobToolsSection
            jobId={selectedEvent.id}
            employeeIds={selectedEvent.employeeIds}
            employees={equipe}
            tools={tools}
            onAssigned={onShiftsChanged}
          />

          <PiecesJointesSection scheduledJobId={selectedEvent.id} compact />
        </div>

        <Separator />

        <div className="space-y-3">
          {/*
            UNE seule action, nommée par ce qu'elle fait. L'écran offrait avant
            tous les statuts atteignables du même poids visuel — dont deux
            marches arrière — et le seul bouton qui menait quelque part ne
            portait le nom d'aucun statut.
          */}
          {totalFeuille !== null && totalFeuille > 0 && (
            <p className="text-center text-sm">
              Feuille de facturation&nbsp;:{" "}
              <strong className="tabular-nums">{formatCurrency(totalFeuille)}</strong>
            </p>
          )}

          {action && (
            <div className="space-y-1">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full justify-center"
                disabled={isPending}
                onClick={() => lancerAction(action.cle)}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconeAction cle={action.cle} />
                )}
                {action.libelle}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{action.aide}</p>
            </div>
          )}

          {!action && messageFin && (
            <p className="text-center text-sm text-muted-foreground">{messageFin}</p>
          )}

          {invoiceId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onViewDetail(selectedEvent);
              }}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Voir la facture{invoiceNumber ? ` ${invoiceNumber}` : ""}
              {invoiceSentAt ? "" : " (jamais envoyée)"}
            </Button>
          )}

          {isReadyToInvoiceJob(selectedEvent) && invoiceId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onBilling(selectedEvent);
              }}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Modifier la facturation
            </Button>
          )}

          {corrections.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCorrectionsOuvertes((v) => !v)}
                aria-expanded={correctionsOuvertes}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${correctionsOuvertes ? "rotate-180" : ""}`}
                />
                Corriger le statut
              </button>
              {correctionsOuvertes && (
                <div className="flex flex-wrap justify-center gap-2">
                  {corrections.map(renderStatusButton)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onViewDetail(selectedEvent);
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Voir le call
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {invoiceId && (
        <SendInvoiceDialog
          open={envoiOuvert}
          onOpenChange={setEnvoiOuvert}
          job={selectedEvent}
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber ?? ""}
          companyName={company.name}
          defaultEmail={selectedEvent.customerEmail ?? ""}
          isDemo={isDemo}
          onSent={(sentTo) => {
            const now = new Date().toISOString();
            setInvoiceSentAt(now);
            const updated: ScheduleEvent = {
              ...selectedEvent,
              status: "invoice-sent",
              sentAt: now,
              sentTo,
            };
            setCurrentEvent(updated);
            onEventUpdated(updated);
            setEnvoiOuvert(false);
          }}
        />
      )}
    </>
  );
}
