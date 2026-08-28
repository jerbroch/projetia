"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, Gift, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import {
  applyPromoCodeAction,
  confirmCheckoutSessionAction,
  selectSubscriptionPlanAction,
} from "@/lib/actions/subscription-access";
import {
  ANNUAL_MONTHS_FREE,
  SUBSCRIPTION_TIERS,
  formatPrice,
  monthlyEquivalentCents,
  priceCentsForTier,
  type BillingCycle,
  type SubscriptionTier,
} from "@/lib/billing/tiers";

interface ChoosePlanClientProps {
  companyName: string;
  /** Palier actuellement payé, s'il y en a un */
  currentTier?: SubscriptionTier | null;
  currentCycle?: BillingCycle | null;
  /**
   * Abonnement Stripe encore vivant : un changement de palier passe par le
   * portail Stripe (proration gérée), pas par un nouveau Checkout.
   */
  canSwitchTierInPortal?: boolean;
  /** Cycle enregistré lors d'un choix précédent */
  pendingPlan?: string | null;
  /** Retour de Stripe Checkout */
  checkoutStatus?: "success" | "cancel" | null;
  checkoutSessionId?: string | null;
}

export function ChoosePlanClient({
  companyName,
  currentTier = null,
  currentCycle = null,
  canSwitchTierInPortal = false,
  pendingPlan,
  checkoutStatus = null,
  checkoutSessionId = null,
}: ChoosePlanClientProps) {
  const [cycle, setCycle] = useState<BillingCycle>(
    currentCycle ?? (pendingPlan === "annual" ? "annual" : "monthly"),
  );
  const [error, setError] = useState(
    checkoutStatus === "cancel" ? "Paiement annulé. Aucun montant n'a été prélevé." : "",
  );
  const [info, setInfo] = useState(
    checkoutStatus === "success" ? "Confirmation du paiement en cours…" : "",
  );
  const [showPromo, setShowPromo] = useState(false);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(checkoutStatus === "success");
  const confirmedRef = useRef(false);

  const busy = isPending || isConfirming;

  const confirmCheckout = useCallback(async (sessionId: string) => {
    const result = await confirmCheckoutSessionAction(sessionId);
    if (result.success) {
      window.location.assign(result.redirectTo ?? "/dashboard");
      return;
    }
    setIsConfirming(false);
    setInfo("");
    setError(result.error);
  }, []);

  useEffect(() => {
    if (checkoutStatus !== "success") return;
    if (!checkoutSessionId) {
      setIsConfirming(false);
      setInfo("");
      setError("Session de paiement introuvable. Réessayez ou contactez le support.");
      return;
    }
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    void confirmCheckout(checkoutSessionId);
  }, [checkoutStatus, checkoutSessionId, confirmCheckout]);

  function handleTier(tier: SubscriptionTier) {
    setError("");
    setInfo("");
    setPendingTier(tier);
    startTransition(async () => {
      const result = await selectSubscriptionPlanAction(tier, cycle);
      if (result.success && result.redirectTo) {
        // Checkout est hébergé par Stripe : navigation pleine page.
        window.location.assign(result.redirectTo);
        return;
      }
      setPendingTier(null);
      if (!result.success) setInfo(result.error);
    });
  }

  function handlePromo(formData: FormData) {
    setError("");
    setInfo("");
    startTransition(async () => {
      const result = await applyPromoCodeAction(formData);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center p-4 py-10">
      <div className="mb-6 text-center">
        <ConstructionIosLogo size="sm" showName={false} className="mx-auto justify-center" />
        <h1 className="text-2xl font-bold">Choisissez votre forfait</h1>
        <p className="mt-2 text-muted-foreground">
          {currentTier
            ? `${companyName} — projets et chantiers illimités sur tous les forfaits.`
            : `Bienvenue, ${companyName}. Projets et chantiers illimités sur tous les forfaits.`}
        </p>
        {canSwitchTierInPortal && (
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Le changement de forfait se fait dans le portail Stripe : votre
            abonnement en cours est ajusté au prorata, aucun second abonnement
            n&apos;est créé.
          </p>
        )}
      </div>

      <div className="mb-8 flex justify-center">
        <div
          role="radiogroup"
          aria-label="Cycle de facturation"
          className="inline-flex rounded-lg border bg-muted p-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              cycle === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={cycle === "annual"}
            onClick={() => setCycle("annual")}
            disabled={busy}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              cycle === "annual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annuel
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {ANNUAL_MONTHS_FREE} mois offerts
            </span>
          </button>
        </div>
      </div>

      {(error || info) && (
        <div
          className={`mb-6 rounded-md p-4 text-sm ${
            error ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          }`}
        >
          {error || info}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const amount = priceCentsForTier(tier, cycle);
          const isTierBusy = busy && pendingTier === tier.id;
          // « Forfait actuel » seulement si le palier ET le cycle affiché
          // correspondent : sur la bascule annuel, un abonné mensuel doit
          // pouvoir passer à l'annuel de son propre palier.
          const isCurrent = currentTier === tier.id && currentCycle === cycle;
          const isCurrentTierOtherCycle =
            currentTier === tier.id && currentCycle !== cycle;

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/30"
                  : tier.highlighted
                    ? "border-primary shadow-md"
                    : ""
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Forfait actuel
                </span>
              )}
              {!isCurrent && tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Le plus populaire
                </span>
              )}
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>{tier.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="text-3xl font-bold">{formatPrice(amount)}</p>
                <p className="text-sm text-muted-foreground">
                  {cycle === "annual" ? "par année" : "par mois"}
                </p>
                {cycle === "annual" && (
                  <p className="mt-1 text-sm text-primary">
                    soit {formatPrice(monthlyEquivalentCents(tier))} par mois
                  </p>
                )}

                <ul className="my-5 space-y-2 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-auto w-full"
                  variant={isCurrent ? "outline" : tier.highlighted ? "default" : "outline"}
                  onClick={() => handleTier(tier.id)}
                  disabled={busy || isCurrent}
                >
                  {isTierBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrent
                    ? "Votre forfait"
                    : isCurrentTierOtherCycle
                      ? `Passer en ${cycle === "annual" ? "annuel" : "mensuel"}`
                      : canSwitchTierInPortal
                        ? `Passer à ${tier.name}`
                        : `Choisir ${tier.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/*
        Mention à RETIRER le jour de l'inscription à la TPS/TVQ. Tant que
        l'inscription n'est pas faite, Stripe marque les factures
        `not_collecting` et n'ajoute aucune taxe : un client qui s'attend à en
        voir doit comprendre pourquoi il n'y en a pas. Voir
        docs/JOURNAL-STRIPE.md §6.
      */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Prix affichés sans taxes. Aucune TPS ni TVQ n&apos;est facturée pour le moment.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">J&apos;ai un code promo</CardTitle>
                <CardDescription>Accès bêta ou promotion spéciale</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPromo((v) => !v)}>
              {showPromo ? "Masquer" : "Entrer un code"}
            </Button>
          </div>
        </CardHeader>
        {showPromo && (
          <CardContent>
            <form action={handlePromo} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="code">Code promo</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="ex. ios123"
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy && <Gift className="mr-2 h-4 w-4" />}
                Valider
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
