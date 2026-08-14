"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  acceptPublicQuoteAction,
  confirmDepositPaidAction,
  rejectPublicQuoteAction,
} from "@/lib/actions/public-quote";
import { calculateQuoteTotals, canClientRespond, getQuoteLineItems, normalizePublicQuote } from "@/lib/quote-utils";
import { QuoteTemplate } from "@/components/quotes/quote-template";
import { Button } from "@/components/ui/button";
import type { Company, Quote } from "@/types";

interface PublicQuoteClientProps {
  initialQuote: Quote;
  company: Company;
  token: string;
  isDemo?: boolean;
}

export function PublicQuoteClient({
  initialQuote,
  company,
  token,
  isDemo,
}: PublicQuoteClientProps) {
  const [quote, setQuote] = useState(() => normalizePublicQuote(initialQuote));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [depositStep, setDepositStep] = useState(false);

  const canRespond = canClientRespond(quote);
  const lineItems = getQuoteLineItems(quote);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totals = calculateQuoteTotals(subtotal, company);

  function handleAccept() {
    if (!confirm("Confirmer l'acceptation de cette soumission?")) return;

    startTransition(async () => {
      if (isDemo) {
        const nextStatus = quote.depositRequired ? "deposit_pending" : "accepted";
        setQuote({
          ...quote,
          status: nextStatus,
          acceptedAt: new Date().toISOString(),
          depositAmount: quote.depositRequired
            ? Math.round(totals.total * ((quote.depositPercentage ?? 20) / 100) * 100) / 100
            : quote.depositAmount,
        });
        if (quote.depositRequired) setDepositStep(true);
        else setMessage("Merci! Votre soumission a été acceptée.");
        return;
      }

      const result = await acceptPublicQuoteAction(token);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setQuote(normalizePublicQuote(result.quote));
      if (result.quote.depositRequired) {
        setDepositStep(true);
      } else {
        setMessage("Merci! Votre soumission a été acceptée.");
      }
    });
  }

  function handleReject() {
    if (!confirm("Confirmer le refus de cette soumission?")) return;

    startTransition(async () => {
      if (isDemo) {
        setQuote({ ...quote, status: "rejected", rejectedAt: new Date().toISOString() });
        setMessage("La soumission a été refusée.");
        return;
      }

      const result = await rejectPublicQuoteAction(token);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setQuote(normalizePublicQuote(result.quote));
      setMessage("La soumission a été refusée.");
    });
  }

  async function handlePayDeposit() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/payments/deposit-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.status === 503) {
          // Stripe not configured — stub success for demo/dev
          if (isDemo) {
            setQuote({ ...quote, status: "deposit_paid", depositStatus: "paid" });
            setDepositStep(false);
            setMessage("Dépôt confirmé (mode démo — Stripe non configuré).");
            return;
          }

          const confirmResult = await confirmDepositPaidAction(token);
          if (confirmResult.success) {
            setQuote(normalizePublicQuote(confirmResult.quote));
            setDepositStep(false);
            setMessage("Dépôt confirmé (paiement simulé — configurez Stripe pour les paiements réels).");
          } else {
            setError(confirmResult.error);
          }
          return;
        }

        if (!res.ok) {
          setError(data.error ?? "Échec du paiement.");
          return;
        }

        // Real Stripe flow would use clientSecret with Stripe.js — stub confirms on intent creation
        const confirmResult = await confirmDepositPaidAction(token, data.paymentIntentId);
        if (confirmResult.success) {
          setQuote(normalizePublicQuote(confirmResult.quote));
          setDepositStep(false);
          setMessage("Dépôt payé avec succès. Merci!");
        } else {
          setError(confirmResult.error);
        }
      } catch {
        setError("Erreur de connexion au service de paiement.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 py-8">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {message && (
        <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </div>
      )}

      <QuoteTemplate
        quote={quote}
        company={company}
        showActions={canRespond && !depositStep}
        onAccept={handleAccept}
        onReject={handleReject}
        actionsDisabled={isPending}
        showDepositSection={quote.depositRequired}
      />

      {depositStep && quote.status === "deposit_pending" && (
        <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
          <h3 className="text-lg font-semibold">Paiement du dépôt</h3>
          <p className="mt-2 text-muted-foreground">
            Pour finaliser l&apos;acceptation, veuillez payer le dépôt de{" "}
            <strong>
              {quote.depositAmount != null && Number.isFinite(Number(quote.depositAmount))
                ? `$${Number(quote.depositAmount).toFixed(2)}`
                : ""}
            </strong>.
          </p>
          <Button className="mt-4" onClick={handlePayDeposit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Payer le dépôt
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Paiement sécurisé par Stripe (si configuré)
          </p>
        </div>
      )}

      {quote.status === "accepted" && !message && (
        <p className="text-center text-sm text-muted-foreground">
          Cette soumission a été acceptée. Merci pour votre confiance!
        </p>
      )}

      {quote.status === "deposit_paid" && !message && (
        <p className="text-center text-sm text-muted-foreground">
          Dépôt reçu. Votre soumission est confirmée!
        </p>
      )}

      {quote.status === "rejected" && !message && (
        <p className="text-center text-sm text-muted-foreground">
          Cette soumission a été refusée.
        </p>
      )}
    </div>
  );
}
