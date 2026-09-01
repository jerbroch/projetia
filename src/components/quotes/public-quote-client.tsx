"use client";

import { useState, useTransition } from "react";
import {
  acceptPublicQuoteAction,
  rejectPublicQuoteAction,
} from "@/lib/actions/public-quote";
import {
  calculateQuoteTotals,
  canClientRespond,
  getQuoteLineItems,
  montantDuDepot,
  normalizePublicQuote,
} from "@/lib/quote-utils";
import { formatCurrency } from "@/lib/utils";
import { QuoteTemplate } from "@/components/quotes/quote-template";
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
            ? montantDuDepot(subtotal, quote.depositPercentage ?? 20, company)
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
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Dépôt à verser</h3>
          <p className="mt-2 text-muted-foreground">
            Pour finaliser l&apos;acceptation, veuillez verser un dépôt de{" "}
            <strong>
              {quote.depositAmount != null && Number.isFinite(Number(quote.depositAmount))
                ? formatCurrency(Number(quote.depositAmount))
                : ""}
            </strong>
            .
          </p>

          {company.interac?.enabled && company.interac.email ? (
            <div className="mt-4 space-y-2 rounded-md border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Virement Interac</p>
              <dl className="space-y-1">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Destinataire :</dt>
                  <dd className="font-medium">
                    {company.interac.recipientName ?? company.name}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Courriel :</dt>
                  <dd className="font-medium">{company.interac.email}</dd>
                </div>
                {company.interac.securityQuestion && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">Question de sécurité :</dt>
                    <dd className="font-medium">{company.interac.securityQuestion}</dd>
                  </div>
                )}
              </dl>
              {company.interac.instructions && (
                <p className="text-muted-foreground">{company.interac.instructions}</p>
              )}
              <p className="text-muted-foreground">
                Indiquez le numéro de soumission {quote.quoteNumber} dans le message du
                virement.
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              {company.name} vous contactera pour convenir des modalités de paiement du
              dépôt.
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            La soumission sera confirmée dès que {company.name} aura constaté la réception
            du dépôt.
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
