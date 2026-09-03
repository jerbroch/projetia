"use client";

import { useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Loader2, Mail, Receipt } from "lucide-react";
import {
  generateInvoiceFromBillingAction,
  getBillingSummaryForJobAction,
} from "@/lib/actions/billing";
import { approveJobForBillingAction } from "@/lib/actions/job-workflow";
import { JobBillingDialog } from "@/components/billing/job-billing-dialog";
import { SendInvoiceDialog } from "@/components/invoices/send-invoice-dialog";
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
import {
  canApproveBilling,
  canApproveJobStatus,
  canGenerateInvoiceStatus,
  canSendInvoiceToClient,
} from "@/lib/job-workflow";
import { getJobDisplayNumber } from "@/lib/job-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Company, ProfileRole, ScheduleEvent } from "@/types";

interface JobReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent;
  company: Company;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  onUpdated?: (event: ScheduleEvent) => void;
}

export function JobReviewDialog({
  open,
  onOpenChange,
  event,
  company,
  membershipRole,
  isDemo,
  onUpdated,
}: JobReviewDialogProps) {
  const [currentEvent, setCurrentEvent] = useState(event);
  const [invoiceId, setInvoiceId] = useState<string | undefined>();
  const [invoiceNumber, setInvoiceNumber] = useState<string | undefined>();
  const [invoiceSentAt, setInvoiceSentAt] = useState<string | null>(null);
  const [billingTotal, setBillingTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canApprove = canApproveBilling(membershipRole);
  const canInvoice = canSendInvoiceToClient(membershipRole);

  useEffect(() => {
    if (open) {
      setCurrentEvent(event);
      setError("");
      setMessage("");
      if (!isDemo) {
        getBillingSummaryForJobAction(event.id).then((result) => {
          if (result.success && result.data) {
            setBillingTotal(result.data.sheet?.total ?? null);
            setInvoiceId(result.data.invoiceId);
            setInvoiceNumber(result.data.invoiceNumber);
            setInvoiceSentAt(result.data.invoiceSentAt ?? null);
          }
        });
      }
    }
  }, [open, event, isDemo]);

  function handleApprove() {
    if (isDemo) {
      const updated = { ...currentEvent, status: "ready-to-invoice" as const };
      setCurrentEvent(updated);
      setMessage("Travail approuvé pour facturation (démo).");
      onUpdated?.(updated);
      return;
    }

    startTransition(async () => {
      const result = await approveJobForBillingAction(currentEvent.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setCurrentEvent(result.data);
        onUpdated?.(result.data);
        setMessage("Travail approuvé — prêt à facturer.");
      }
    });
  }

  function handleGenerateInvoice() {
    if (isDemo) {
      setInvoiceNumber("FA-DEMO-002");
      setMessage("Facture générée (démo).");
      return;
    }

    startTransition(async () => {
      const result = await generateInvoiceFromBillingAction(currentEvent.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setInvoiceId(result.data.invoiceId);
        setInvoiceNumber(result.data.invoiceNumber);
        setMessage(`Facture ${result.data.invoiceNumber} créée.`);
      }
    });
  }

  const jobDate = format(parseISO(currentEvent.start), "d MMMM yyyy", { locale: fr });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vérification — {getJobDisplayNumber(currentEvent)}</DialogTitle>
            <DialogDescription>
              {currentEvent.customerName ?? "—"} · {currentEvent.jobSiteAddress ?? currentEvent.location ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {message && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={currentEvent.status} />
            {currentEvent.clientPoNumber && (
              <span className="text-xs text-muted-foreground">P.O. {currentEvent.clientPoNumber}</span>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Date · Employés</p>
              <p className="font-medium">
                {jobDate}
                {currentEvent.employeeNames.length > 0 && ` · ${currentEvent.employeeNames.join(", ")}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Soumis pour vérification</p>
              <p className="font-medium">
                {currentEvent.submittedForReviewAt
                  ? formatDate(currentEvent.submittedForReviewAt)
                  : "—"}
              </p>
            </div>
            {billingTotal != null && (
              <div>
                <p className="text-xs text-muted-foreground">Montant facturation</p>
                <p className="font-medium">{formatCurrency(billingTotal)}</p>
              </div>
            )}
            {currentEvent.approvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Approuvé le</p>
                <p className="font-medium">{formatDate(currentEvent.approvedAt)}</p>
              </div>
            )}
          </div>

          {currentEvent.workDescription && (
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Rapport du plombier</p>
              <p className="whitespace-pre-wrap">{currentEvent.workDescription}</p>
            </div>
          )}

          {currentEvent.closureNotes && (
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Notes internes</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{currentEvent.closureNotes}</p>
            </div>
          )}

          <Separator />

          {canApprove && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBillingOpen(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                Modifier la facturation
              </Button>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <div className="flex flex-wrap gap-2">
              {canApprove && canApproveJobStatus(currentEvent) && (
                <Button onClick={handleApprove} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approuver pour facturation
                </Button>
              )}
              {canInvoice && canGenerateInvoiceStatus(currentEvent.status) && !invoiceNumber && (
                <Button onClick={handleGenerateInvoice} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Générer la facture
                </Button>
              )}
              {/*
                La condition portait avant sur le STATUT du call, et elle se
                contredisait : cette fenêtre ne s'ouvrait que sur un call non
                encore approuvé, alors que l'envoi exigeait un call déjà
                approuvé. Ce qui compte est qu'une facture existe et ne soit pas
                encore partie.
              */}
              {canInvoice && invoiceId && !invoiceSentAt && (
                  <Button onClick={() => setSendOpen(true)}>
                    <Mail className="mr-2 h-4 w-4" />
                    Envoyer la facture
                  </Button>
                )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobBillingDialog
        open={billingOpen}
        onOpenChange={setBillingOpen}
        event={currentEvent}
        company={company}
        membershipRole={membershipRole}
        isDemo={isDemo}
        reviewMode
        onBillingUpdated={() => {
          getBillingSummaryForJobAction(currentEvent.id).then((result) => {
            if (result.success && result.data?.sheet) {
              setBillingTotal(result.data.sheet.total);
            }
          });
        }}
      />

      {invoiceId && (
        <SendInvoiceDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          job={currentEvent}
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber ?? ""}
          companyName={company.name}
          company={company}
          defaultEmail={currentEvent.customerEmail ?? ""}
          isDemo={isDemo}
          onSent={(sentTo) => {
            setInvoiceSentAt(new Date().toISOString());
            const updated = {
              ...currentEvent,
              status: "invoice-sent" as const,
              sentTo,
              sentAt: new Date().toISOString(),
            };
            setCurrentEvent(updated);
            onUpdated?.(updated);
            setMessage(`Facture envoyée à ${sentTo}.`);
          }}
        />
      )}
    </>
  );
}
