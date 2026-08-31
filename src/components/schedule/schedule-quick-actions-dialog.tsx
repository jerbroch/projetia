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
  Receipt,
  Truck,
  User,
} from "lucide-react";
import { getBillingSummaryForJobAction } from "@/lib/actions/billing";
import { approveJobForBillingAction } from "@/lib/actions/job-workflow";
import { updateScheduleJobStatusAction } from "@/lib/actions/schedule";
import {
  canQuickChangeToStatus,
  canSubmitJobStatus,
  canUseAdminQuickStatus,
  canUseFieldQuickStatus,
  getFieldQuickStatusButtonOrder,
  getJobStatusLabel,
  getQuickStatusActions,
  isPendingReviewJob,
  isReadyToInvoiceJob,
  QUICK_STATUS_BUTTON_LABELS,
  type JobWorkflowStatus,
} from "@/lib/job-workflow";
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
  onReview: (event: ScheduleEvent) => void;
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
  isDemo,
  onEventUpdated,
  onViewDetail,
  onCloseWork,
  onReview,
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && event) {
      setCurrentEvent(event);
      setError("");
      setInvoiceId(undefined);
      setInvoiceNumber(undefined);

      if (!isDemo) {
        getBillingSummaryForJobAction(event.id).then((result) => {
          if (result.success && result.data) {
            setInvoiceId(result.data.invoiceId);
            setInvoiceNumber(result.data.invoiceNumber);
          }
        });
      }
    }
  }, [open, event, isDemo]);

  if (!currentEvent) return null;

  const selectedEvent = currentEvent;
  const quickActions = getQuickStatusActions(membershipRole, selectedEvent.status);
  const fieldStatusButtons = getFieldQuickStatusButtonOrder(membershipRole);
  const showCloseWork =
    canUseFieldQuickStatus(membershipRole) &&
    canSubmitJobStatus(selectedEvent.status) &&
    selectedEvent.status !== "completed";
  const adminActions = quickActions.filter(
    (status) =>
      status === "pending-review" ||
      status === "ready-to-invoice" ||
      status === "invoice-sent" ||
      status === "paid"
  );

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
        </div>

        {(fieldStatusButtons.length > 0 || showCloseWork || adminActions.length > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Changer le statut
              </p>
              {(fieldStatusButtons.length > 0 || showCloseWork) && (
                <div className="flex flex-wrap gap-2">
                  {fieldStatusButtons.map(renderStatusButton)}
                  {showCloseWork && renderStatusButton("completed")}
                </div>
              )}
              {canUseAdminQuickStatus(membershipRole) && adminActions.length > 0 && (
                <div className="flex flex-wrap gap-2">{adminActions.map(renderStatusButton)}</div>
              )}
            </div>
          </>
        )}

        {canUseAdminQuickStatus(membershipRole) &&
          (isPendingReviewJob(selectedEvent) || isReadyToInvoiceJob(selectedEvent) || invoiceId) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Actions gestionnaire
                </p>
                <div className="flex flex-wrap gap-2">
                  {isPendingReviewJob(selectedEvent) && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onReview(selectedEvent);
                      }}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Vérifier le travail
                    </Button>
                  )}
                  {isReadyToInvoiceJob(selectedEvent) && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onBilling(selectedEvent);
                      }}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Voir / Générer la facture
                    </Button>
                  )}
                  {invoiceId && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        onViewDetail(selectedEvent);
                      }}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Voir la facture{invoiceNumber ? ` (${invoiceNumber})` : ""}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

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
  );
}
