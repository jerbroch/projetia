"use client";

import { useState, useTransition } from "react";
import { blocDePaiement } from "@/lib/paiement/bloc-de-paiement";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /**
   * Confirmation en attente, ou `null`.
   *
   * C'était `window.confirm`. Les clients ouvrent leur soumission depuis
   * Messenger ou Gmail, dans une vue web intégrée où `confirm` peut être
   * bloqué : le bouton ne faisait alors rien, sans le moindre message, et
   * personne n'aurait signalé une soumission qu'on ne peut pas accepter.
   */
  const [confirmation, setConfirmation] = useState<"accepter" | "refuser" | null>(null);

  const canRespond = canClientRespond(quote);
  const lineItems = getQuoteLineItems(quote);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totals = calculateQuoteTotals(subtotal, company);

  // Le CONTENU du bloc de paiement, produit par le module commun. Il rend
  // `null` quand rien n'est configuré, et c'est lui seul qui en décide :
  // aucune surface ne peut afficher un cadre « Comment payer » vide.
  //
  // Le montant vient de `montantDuDepot` — le calcul du dépôt vit à un seul
  // endroit depuis qu'il s'était mis à donner deux résultats différents pour
  // la même soumission.
  const blocPaiement = blocDePaiement({
    interac: company.interac,
    reference: quote.quoteNumber,
    montant: quote.depositRequired
      ? montantDuDepot(subtotal, quote.depositPercentage ?? 20, company)
      : undefined,
    // Jamais la réponse à la question de sécurité sur une soumission :
    // l'écrire sous la question annule la question.
    afficherLaReponse: false,
  });

  function accepterVraiment() {
    setConfirmation(null);
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

  function refuserVraiment() {
    setConfirmation(null);
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
        onAccept={() => setConfirmation("accepter")}
        onReject={() => setConfirmation("refuser")}
        actionsDisabled={isPending}
        showDepositSection={quote.depositRequired}
      />

      <Dialog open={confirmation !== null} onOpenChange={(o) => !o && setConfirmation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmation === "refuser"
                ? "Refuser cette soumission ?"
                : "Accepter cette soumission ?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "refuser"
                ? "L'entreprise en sera informée. Vous pourrez toujours la contacter pour en discuter."
                : quote.depositRequired
                  ? "L'entreprise en sera informée et vous indiquera le dépôt à verser."
                  : "L'entreprise en sera informée et pourra planifier les travaux."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmation(null)} disabled={isPending}>
              Annuler
            </Button>
            <Button
              variant={confirmation === "refuser" ? "destructive" : "default"}
              onClick={confirmation === "refuser" ? refuserVraiment : accepterVraiment}
              disabled={isPending}
            >
              {confirmation === "refuser" ? "Refuser la soumission" : "Accepter la soumission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

          {/*
            Le bloc « Comment payer » est déjà sur la soumission au-dessus, dès
            sa réception : le répéter ici en ferait deux à l'écran. On garde
            seulement le repli, pour l'entrepreneur qui n'a rien configuré.
          */}
          {!blocPaiement && (
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
