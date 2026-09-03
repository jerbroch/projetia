"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { getBillingSummaryForJobAction } from "@/lib/actions/billing";
import { deleteScheduleJobAction } from "@/lib/actions/schedule";
import { restoreArchivedJobAction } from "@/lib/actions/job-workflow";
import { getDemoBillingSheet } from "@/lib/demo/billing";
import {
  canDeleteArchivedJob,
  canEditArchivedInvoice,
  canRestoreArchivedJob,
} from "@/lib/job-workflow";
import {
  JOB_NUMBER_TYPE_LABELS,
  JOB_ORIGIN_LABELS,
  getJobDisplayNumber,
  isArchivedJob,
  resolveJobNumberType,
  resolveJobOrigin,
} from "@/lib/job-utils";
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
import { PiecesJointesSection } from "@/components/shared/pieces-jointes-section";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ProfileRole, Quote, ScheduleEvent } from "@/types";

interface ArchiveJobDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ScheduleEvent;
  quote?: Quote | null;
  membershipRole?: ProfileRole;
  isDemo?: boolean;
  onOpenBilling?: (event: ScheduleEvent) => void;
  onOpenInvoice?: (event: ScheduleEvent) => void;
  onEdit?: (event: ScheduleEvent) => void;
  onRestored?: (event: ScheduleEvent) => void;
  onDeleted?: (eventId: string) => void;
}

export function ArchiveJobDetailDialog({
  open,
  onOpenChange,
  event,
  quote,
  membershipRole,
  isDemo,
  onOpenBilling,
  onOpenInvoice,
  onEdit,
  onRestored,
  onDeleted,
}: ArchiveJobDetailDialogProps) {
  const [billingTotal, setBillingTotal] = useState<number | null>(null);
  const [billingMaterial, setBillingMaterial] = useState<number | null>(null);
  const [billingLabor, setBillingLabor] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | undefined>();
  const [invoiceId, setInvoiceId] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const canEditInvoice = membershipRole ? canEditArchivedInvoice(membershipRole) : false;
  const canRestore = membershipRole ? canRestoreArchivedJob(membershipRole) : false;
  const canDelete = membershipRole ? canDeleteArchivedJob(membershipRole) : false;

  useEffect(() => {
    if (!open || !event) return;
    setError("");
    setMessage("");

    if (isDemo) {
      const sheet = getDemoBillingSheet(event.id);
      if (sheet) {
        setBillingTotal(sheet.total);
        setBillingMaterial(sheet.materialSubtotal);
        setBillingLabor(sheet.laborSubtotal);
        if (sheet.status === "invoiced") setInvoiceNumber("FA-DEMO-001");
      } else {
        setBillingTotal(null);
      }
      return;
    }

    getBillingSummaryForJobAction(event.id).then((result) => {
      if (result.success && result.data?.sheet) {
        setBillingTotal(result.data.sheet.total);
        setBillingMaterial(result.data.sheet.materialSubtotal);
        setBillingLabor(result.data.sheet.laborSubtotal);
        setInvoiceNumber(result.data.invoiceNumber);
        setInvoiceId(result.data.invoiceId);
      } else {
        setBillingTotal(null);
      }
    });
  }, [open, event, isDemo]);

  function handleOpenInvoice() {
    if (!event) return;
    if (onOpenInvoice) {
      onOpenInvoice(event);
      return;
    }
    onOpenBilling?.(event);
  }

  function handleRestore() {
    if (!event) return;
    setError("");
    setMessage("");

    if (isDemo) {
      setMessage("Travail restauré dans Factures (démo).");
      onRestored?.({ ...event, status: "invoice-sent" });
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await restoreArchivedJobAction(event.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setMessage("Facture restaurée dans le module Factures.");
        onRestored?.(result.data);
        onOpenChange(false);
      }
    });
  }

  function handleDelete() {
    if (!event || !isArchivedJob(event)) return;

    const jobLabel = getJobDisplayNumber(event);
    if (
      !confirm(
        `Supprimer définitivement ${jobLabel} ? Cette action est irréversible et retirera le travail des archives.`
      )
    ) {
      return;
    }

    setError("");
    setMessage("");

    if (isDemo) {
      onDeleted?.(event.id);
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await deleteScheduleJobAction(event.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDeleted?.(event.id);
      onOpenChange(false);
    });
  }

  if (!event) return null;

  const jobType = resolveJobNumberType(event);
  const jobOrigin = resolveJobOrigin(event);
  const startDate = format(parseISO(event.start), "d MMMM yyyy", { locale: fr });
  const startTime = format(parseISO(event.start), "HH:mm");
  const endTime = format(parseISO(event.end), "HH:mm");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getJobDisplayNumber(event)}</DialogTitle>
          <DialogDescription>
            {JOB_NUMBER_TYPE_LABELS[jobType]} · {JOB_ORIGIN_LABELS[jobOrigin]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            {event.clientPoNumber && (
              <span className="rounded-md bg-muted px-2 py-1 text-xs">
                P.O. client : {event.clientPoNumber}
              </span>
            )}
          </div>

          <div>
            <p className="font-medium">{event.title}</p>
            {event.description && <p className="mt-1 text-muted-foreground">{event.description}</p>}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Client</p>
              <p>{event.customerName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Date</p>
              <p>{startDate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Téléphone</p>
              <p>{event.customerPhone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Courriel</p>
              <p>{event.customerEmail ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Adresse du chantier</p>
              <p>{event.jobSiteAddress ?? event.location ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Heures</p>
              <p>
                {startTime} – {endTime}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Employés</p>
              <p>{event.employeeNames.length > 0 ? event.employeeNames.join(", ") : "—"}</p>
            </div>
          </div>

          {event.internalNotes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Notes internes</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.internalNotes}</p>
              </div>
            </>
          )}

          {(event.workCompletedAt ||
            event.submittedForReviewAt ||
            event.approvedAt ||
            event.sentAt) && (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {event.workCompletedAt && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Travaux terminés</p>
                    <p>{formatDate(event.workCompletedAt)}</p>
                  </div>
                )}
                {event.submittedForReviewAt && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Soumis pour vérification</p>
                    <p>{formatDate(event.submittedForReviewAt)}</p>
                  </div>
                )}
                {event.approvedAt && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Vérifié / approuvé</p>
                    <p>{formatDate(event.approvedAt)}</p>
                  </div>
                )}
                {event.sentAt && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Facture envoyée</p>
                    <p>
                      {formatDate(event.sentAt)}
                      {event.sentTo && ` · ${event.sentTo}`}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {event.workDescription && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Travaux effectués</p>
                <p className="mt-1 whitespace-pre-wrap">{event.workDescription}</p>
              </div>
            </>
          )}

          {/*
            Les photos font partie de l'archive au même titre que la facture.
            Une archive qui ne garde que les chiffres ne prouve pas le travail ;
            c'est justement ce que les photos servent à établir.
          */}
          <Separator />
          <PiecesJointesSection scheduledJobId={event.id} compact />

          {billingTotal != null && billingTotal > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Facturation</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>Matériel : {formatCurrency(billingMaterial ?? 0)}</p>
                  <p>Main-d&apos;œuvre : {formatCurrency(billingLabor ?? 0)}</p>
                  <p className="font-semibold sm:col-span-2">Total : {formatCurrency(billingTotal)}</p>
                  {invoiceNumber && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Facture</p>
                      {invoiceId && (onOpenInvoice || onOpenBilling) ? (
                        <button
                          type="button"
                          className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
                          onClick={handleOpenInvoice}
                        >
                          {invoiceNumber}
                        </button>
                      ) : (
                        <p className="mt-1 text-muted-foreground">{invoiceNumber}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {message && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {onEdit && (
              <Button variant="default" onClick={() => onEdit(event)}>
                Modifier
              </Button>
            )}
            {invoiceId && (onOpenInvoice || onOpenBilling) && canEditInvoice && (
              <Button variant="secondary" onClick={handleOpenInvoice}>
                {invoiceId ? "Modifier la facture" : "Facturation"}
              </Button>
            )}
            {!invoiceId && onOpenBilling && (
              <Button variant="secondary" onClick={() => onOpenBilling(event)}>
                Facturation
              </Button>
            )}
            {invoiceId && canRestore && (
              <Button variant="outline" onClick={handleRestore} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Restaurer
              </Button>
            )}
            {canDelete && isArchivedJob(event) && (
              <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            {jobOrigin === "quote" && quote?.publicToken && (
              <Button variant="outline" asChild>
                <Link href={`/soumission/${quote.publicToken}`} target="_blank">
                  Voir la soumission
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
