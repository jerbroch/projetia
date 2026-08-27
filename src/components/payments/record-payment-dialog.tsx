"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { recordInvoicePaymentAction } from "@/lib/actions/payments";
import {
  invoiceBalance,
  paymentMethodLabel,
  refusePayment,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/billing/payment-recording";
import { formatCurrency } from "@/lib/utils";

/** La carte n'encaisse rien aujourd'hui : elle n'est pas proposée à la saisie. */
const SAISISSABLES = PAYMENT_METHODS.filter((m) => m !== "card");

interface RecordPaymentDialogProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    paidAmount: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const solde = invoiceBalance(invoice);

  // Le solde restant est le cas de loin le plus fréquent — un client règle sa
  // facture en entier. Il reste modifiable pour les acomptes.
  const [amount, setAmount] = useState(String(solde));
  const [method, setMethod] = useState<PaymentMethod>("interac");
  const [receivedAt, setReceivedAt] = useState(aujourdhui);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Rouvrir sur une autre facture doit repartir de son solde à elle.
  useEffect(() => {
    if (open) {
      setAmount(String(invoiceBalance(invoice)));
      setMethod("interac");
      setReceivedAt(aujourdhui());
      setReference("");
      setError("");
      setNotice("");
    }
  }, [open, invoice]);

  const montant = Number(amount.replace(",", "."));
  // Le même refus que côté serveur, pour le dire avant l'envoi plutôt qu'après.
  const refus = amount.trim() ? refusePayment(invoice, montant) : null;

  function handleSubmit() {
    setError("");
    setNotice("");

    const refusAvantEnvoi = refusePayment(invoice, montant);
    if (refusAvantEnvoi) {
      setError(refusAvantEnvoi.message);
      return;
    }

    startTransition(async () => {
      const result = await recordInvoicePaymentAction({
        invoiceId: invoice.id,
        amount: montant,
        method,
        receivedAt,
        reference: reference.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.receiptError) {
        setNotice(
          `Paiement enregistré. Le reçu n'a pas pu être envoyé : ${result.receiptError}`,
        );
        router.refresh();
        return;
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Facture {invoice.invoiceNumber} — {invoice.customerName}. Solde à payer :{" "}
            <strong>{formatCurrency(solde)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Montant reçu</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(refus)}
            />
            {refus ? (
              <p className="text-xs text-destructive">{refus.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pré-rempli avec le solde. Modifiez-le pour un acompte.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Mode de paiement</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAISISSABLES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentMethodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-date">Reçu le</Label>
              <Input
                id="payment-date"
                type="date"
                max={aujourdhui()}
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              Référence <span className="text-muted-foreground">(facultatif)</span>
            </Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° de chèque, confirmation Interac…"
            />
            <p className="text-xs text-muted-foreground">
              Sert à retrouver le paiement dans votre compte bancaire.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              {notice}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || Boolean(refus)}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
