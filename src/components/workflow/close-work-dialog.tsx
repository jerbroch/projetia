"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { loadBillingSheetAction } from "@/lib/actions/billing";
import { submitJobForReviewAction } from "@/lib/actions/job-workflow";
import { canSubmitJobStatus } from "@/lib/job-workflow";
import { JobBillingDialog } from "@/components/billing/job-billing-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { Company, ProfileRole, ScheduleEvent } from "@/types";

interface CloseWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent;
  company: Company;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  onSubmitted?: (event: ScheduleEvent) => void;
}

export function CloseWorkDialog({
  open,
  onOpenChange,
  event,
  company,
  membershipRole,
  isDemo,
  onSubmitted,
}: CloseWorkDialogProps) {
  const [workDescription, setWorkDescription] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [lineCount, setLineCount] = useState(0);
  const [billingTotal, setBillingTotal] = useState(0);
  const [error, setError] = useState("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshBillingSummary = useCallback(async () => {
    if (isDemo) {
      setLineCount(1);
      setBillingTotal(0);
      return;
    }
    const result = await loadBillingSheetAction(event.id);
    if (result.success && result.data) {
      setLineCount(result.data.sheet.lines.length);
      setBillingTotal(result.data.sheet.total);
    }
  }, [event.id, isDemo]);

  useEffect(() => {
    if (open) {
      setWorkDescription(event.workDescription ?? event.description ?? "");
      setClosureNotes(event.closureNotes ?? "");
      setError("");
      refreshBillingSummary();
    }
  }, [open, event, refreshBillingSummary]);

  function handleSubmit() {
    setError("");
    if (!workDescription.trim()) {
      setError("La description des travaux est requise.");
      return;
    }
    if (lineCount === 0) {
      setError("Ajoutez au moins une ligne de main-d'œuvre ou de matériel.");
      return;
    }

    if (isDemo) {
      const now = new Date().toISOString();
      onSubmitted?.({
        ...event,
        status: "completed",
        workDescription,
        submittedForReviewAt: now,
        workCompletedAt: now,
      });
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await submitJobForReviewAction({
        jobId: event.id,
        workDescription,
        closureNotes,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) onSubmitted?.(result.data);
      onOpenChange(false);
    });
  }

  const canClose = canSubmitJobStatus(event.status);
  /** Une feuille vide empêche la fermeture : c'est elle qui deviendra la facture. */
  const feuilleVide = !isDemo && lineCount === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Fermer le travail
            </DialogTitle>
            <DialogDescription>
              Saisissez les heures, le matériel et la description des travaux. Aucune facture ne sera
              envoyée automatiquement.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {!canClose ? (
            <p className="text-sm text-muted-foreground">
              Ce travail ne peut plus être fermé depuis le terrain (statut actuel : {event.status}).
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workDescription">Travaux effectués *</Label>
                <textarea
                  id="workDescription"
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Décrivez les travaux réalisés sur place…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closureNotes">Notes internes</Label>
                <textarea
                  id="closureNotes"
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Notes pour le gestionnaire (optionnel)"
                />
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Facturation terrain</p>
                    <p className="text-muted-foreground">
                      {lineCount} ligne{lineCount !== 1 ? "s" : ""}
                      {billingTotal > 0 && ` · ${formatCurrency(billingTotal)}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={feuilleVide ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBillingOpen(true)}
                  >
                    Saisir heures / matériel
                  </Button>
                </div>

                {/*
                  LE REFUS DOIT ÊTRE DIT, ET AVANT LE CLIC.
                  Le bouton « Fermer le travail » était simplement grisé quand la
                  feuille était vide. Rien ne reliait le « 0 ligne » affiché
                  ci-dessus au bouton qui ne répondait pas : on croyait à une
                  panne. C'est le même défaut que le statut « envoyée » posé sans
                  envoi — l'écran laissait deviner au lieu de dire.
                */}
                {feuilleVide && (
                  <p className="mt-3 border-t pt-3 text-muted-foreground">
                    Ajoutez au moins une ligne d&apos;heures ou de matériel avant de fermer.
                    C&apos;est cette feuille qui deviendra la facture.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            {canClose && (
              <Button onClick={handleSubmit} disabled={isPending || feuilleVide}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fermer le travail
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobBillingDialog
        open={billingOpen}
        onOpenChange={(next) => {
          setBillingOpen(next);
          if (!next) refreshBillingSummary();
        }}
        event={event}
        company={company}
        membershipRole={membershipRole}
        isDemo={isDemo}
        fieldMode
      />
    </>
  );
}
