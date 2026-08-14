"use client";

import { useState, useTransition } from "react";
import { Check, CreditCard, Gift, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConstructionIosLogo } from "@/components/brand/construction-ios-logo";
import {
  applyPromoCodeAction,
  selectSubscriptionPlanAction,
} from "@/lib/actions/subscription-access";
import {
  annualSavingsLabel,
  formatPrice,
  type PricingConfig,
} from "@/lib/pricing-config";

interface ChoosePlanClientProps {
  pricing: PricingConfig;
  companyName: string;
  pendingPlan?: string | null;
}

export function ChoosePlanClient({ pricing, companyName, pendingPlan }: ChoosePlanClientProps) {
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    pendingPlan
      ? `Votre choix (${pendingPlan === "monthly" ? "mensuel" : "annuel"}) est enregistré. Le paiement sera disponible sous peu.`
      : "",
  );
  const [showPromo, setShowPromo] = useState(false);
  const [isPending, startTransition] = useTransition();

  const savings = annualSavingsLabel(pricing);

  function handlePlan(plan: "monthly" | "annual") {
    setError("");
    setInfo("");
    startTransition(async () => {
      const result = await selectSubscriptionPlanAction(plan);
      if (!result.success) {
        setInfo(result.error);
      }
    });
  }

  function handlePromo(formData: FormData) {
    setError("");
    setInfo("");
    startTransition(async () => {
      const result = await applyPromoCodeAction(formData);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center p-4">
      <div className="mb-8 text-center">
        <ConstructionIosLogo size="sm" showName={false} className="mx-auto justify-center" />
        <h1 className="text-2xl font-bold">Choisissez votre accès</h1>
        <p className="mt-2 text-muted-foreground">
          Bienvenue, {companyName}. Sélectionnez un abonnement ou utilisez un code promo pour
          accéder à ConstructionIOS.
        </p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative flex flex-col">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <CardTitle>1 mois</CardTitle>
            <CardDescription>Facturation mensuelle, annulable à tout moment</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-3xl font-bold">{formatPrice(pricing.monthlyPriceCents, pricing.currency)}</p>
            <p className="text-sm text-muted-foreground">par mois</p>
            <ul className="my-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Accès complet à la plateforme
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Annulation possible à tout moment
              </li>
            </ul>
            <Button
              className="mt-auto w-full"
              onClick={() => handlePlan("monthly")}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Choisir le plan mensuel
            </Button>
          </CardContent>
        </Card>

        <Card className="relative flex flex-col border-primary/30">
          {savings && (
            <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {savings}
            </span>
          )}
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <CardTitle>1 an</CardTitle>
            <CardDescription>Facturation annuelle</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <p className="text-3xl font-bold">{formatPrice(pricing.annualPriceCents, pricing.currency)}</p>
            <p className="text-sm text-muted-foreground">par année</p>
            <ul className="my-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Même accès complet
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {savings ?? "Meilleur rapport qualité-prix"}
              </li>
            </ul>
            <Button
              className="mt-auto w-full"
              onClick={() => handlePlan("annual")}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Choisir le plan annuel
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
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
                  disabled={isPending}
                />
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Valider
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
