"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { sendInvoiceEmailAction } from "@/lib/actions/job-workflow";
import { buildInvoiceEmailSubject } from "@/lib/email/invoice-email-template";
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
import type { ScheduleEvent } from "@/types";

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent pour une facture rapide, qui n'a pas de call derrière elle. */
  job?: ScheduleEvent;
  /** Nom du client, quand il ne vient pas d'un call. */
  customerName?: string;
  invoiceId: string;
  invoiceNumber: string;
  companyName: string;
  defaultEmail?: string;
  isDemo?: boolean;
  onSent: (sentTo: string) => void;
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  job,
  customerName,
  invoiceId,
  invoiceNumber,
  companyName,
  defaultEmail,
  isDemo,
  onSent,
}: SendInvoiceDialogProps) {
  const nomClient = job?.customerName ?? customerName ?? "";
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? job?.customerEmail ?? "");
      setSubject(buildInvoiceEmailSubject({ invoiceNumber, companyName }));
      setMessage(
        `Bonjour${nomClient ? ` ${nomClient}` : ""},\n\nVeuillez trouver ci-joint votre facture ${invoiceNumber}.\n\nMerci de votre confiance,\n${companyName}`
      );
      setError("");
    }
  }, [open, defaultEmail, job?.customerEmail, nomClient, invoiceNumber, companyName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Le courriel du destinataire est requis.");
      return;
    }

    if (isDemo) {
      onSent(email.trim());
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await sendInvoiceEmailAction({
        jobId: job?.id ?? null,
        invoiceId,
        recipientEmail: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSent(result.data?.sentTo ?? email.trim());
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer la facture
          </DialogTitle>
          <DialogDescription>
            Facture {invoiceNumber} — le client ne verra que les prix de vente, jamais les coûts ou
            marges.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invoiceEmail">Destinataire</Label>
            <Input
              id="invoiceEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceSubject">Objet</Label>
            <Input
              id="invoiceSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoiceMessage">Message</Label>
            <textarea
              id="invoiceMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
