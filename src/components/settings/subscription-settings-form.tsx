"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { openBillingPortalAction } from "@/lib/actions/subscription-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/billing/tiers";
import type { CompanySubscriptionSummary } from "@/lib/billing/company-subscription";

interface SubscriptionSettingsFormProps {
  subscription: CompanySubscriptionSummary;
  isDemo: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trial: "Essai gratuit",
  past_due: "Paiement en retard",
  cancelled: "Inactif",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "long" }).format(date);
}

export function SubscriptionSettingsForm({
  subscription,
  isDemo,
}: SubscriptionSettingsFormProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const statusLabel = subscription.status
    ? (STATUS_LABELS[subscription.status] ?? subscription.status)
    : "—";
  const renewalDate = formatDate(subscription.currentPeriodEnd);
  const price =
    subscription.priceCents != null ? formatPrice(subscription.priceCents) : null;

  function handlePortal() {
    setError("");
    startTransition(async () => {
      const result = await openBillingPortalAction("/settings");
      if (result.success && result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      if (!result.success) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Mon abonnement</CardTitle>
            <CardDescription>
              Plan, carte de crédit et factures de votre accès à ConstructionIOS
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {subscription.schemaMissing && (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            La migration de facturation (022_subscription_billing.sql) n&apos;est pas encore
            appliquée.
          </div>
        )}

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Forfait</dt>
            <dd className="font-medium">{subscription.tierLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Utilisateurs inclus</dt>
            <dd className="font-medium">{subscription.userLimitLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Statut</dt>
            <dd className="font-medium">{statusLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {subscription.cancelAtPeriodEnd ? "Accès jusqu'au" : "Prochain renouvellement"}
            </dt>
            <dd className="font-medium">{renewalDate ?? "—"}</dd>
          </div>
        </dl>

        {price && (
          <p className="text-sm text-muted-foreground">
            Facturation {subscription.cycleLabel.toLowerCase()} — {price}
            {subscription.cycle === "annual" ? " par année" : " par mois"}
            {subscription.accessType && subscription.accessTypeLabel !== "—"
              ? ` · accès ${subscription.accessTypeLabel.toLowerCase()}`
              : ""}
          </p>
        )}

        {subscription.cancelAtPeriodEnd && (
          <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
            Annulation demandée. Votre accès reste ouvert jusqu&apos;à la fin de la période payée.
          </div>
        )}

        {isDemo ? (
          <p className="text-sm text-muted-foreground">
            Gestion de l&apos;abonnement non disponible sur le compte de démonstration.
          </p>
        ) : subscription.hasStripeSubscription || subscription.hasStripeCustomer ? (
          <Button onClick={handlePortal} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gérer mon abonnement
          </Button>
        ) : (
          <Button asChild>
            <Link href="/choose-plan">Choisir un abonnement</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
