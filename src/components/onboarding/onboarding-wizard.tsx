"use client";

import { useState, useTransition } from "react";
import { HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  finishOnboardingAction,
  saveOnboardingCompanyAction,
  saveOnboardingCustomerAction,
  saveOnboardingEmployeeAction,
} from "@/lib/actions/auth";

const STEPS = [
  { id: "company", title: "Informations de l'entreprise" },
  { id: "tax", title: "Taxes (TPS/TVQ)" },
  { id: "employee", title: "Premier employé" },
  { id: "customer", title: "Premier client" },
  { id: "finish", title: "Terminer" },
] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function submitStep(formData: FormData, action: (fd: FormData) => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    setError("");
    startTransition(async () => {
      const result = await action(formData);
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? "Erreur");
        return;
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    });
  }

  function skipStep() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function finish() {
    setLoading(true);
    startTransition(async () => {
      await finishOnboardingAction();
    });
  }

  const current = STEPS[step];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Configuration de votre entreprise</h1>
        <p className="text-muted-foreground">
          Étape {step + 1} sur {STEPS.length} — {current.title}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 w-8 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{current.title}</CardTitle>
          <CardDescription>
            {step < STEPS.length - 1
              ? "Vous pouvez passer cette étape et y revenir plus tard."
              : "Votre compte est prêt!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {current.id === "company" && (
            <form
              action={(fd) => submitStep(fd, saveOnboardingCompanyAction)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="legalName">Raison sociale</Label>
                <Input id="legalName" name="legalName" placeholder="Construction ABC Inc." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Courriel</Label>
                  <Input id="email" name="email" type="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" name="address" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Input id="province" name="province" defaultValue="QC" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input id="postalCode" name="postalCode" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL du logo (optionnel)</Label>
                <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://..." />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || isPending}>
                  {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuer
                </Button>
                <Button type="button" variant="ghost" onClick={skipStep}>
                  Passer
                </Button>
              </div>
            </form>
          )}

          {current.id === "tax" && (
            <form
              action={(fd) => submitStep(fd, saveOnboardingCompanyAction)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gstRate">TPS (%)</Label>
                  <Input id="gstRate" name="gstRate" type="number" step="0.001" defaultValue="0.05" />
                  <p className="text-xs text-muted-foreground">Défaut : 5%</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qstRate">TVQ (%)</Label>
                  <Input id="qstRate" name="qstRate" type="number" step="0.00001" defaultValue="0.09975" />
                  <p className="text-xs text-muted-foreground">Défaut : 9,975%</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || isPending}>
                  Continuer
                </Button>
                <Button type="button" variant="ghost" onClick={skipStep}>
                  Passer
                </Button>
              </div>
            </form>
          )}

          {current.id === "employee" && (
            <form
              action={(fd) => submitStep(fd, saveOnboardingEmployeeAction)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" name="firstName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" name="lastName" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade">Métier</Label>
                <Input id="trade" name="trade" placeholder="Contremaître" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || isPending}>
                  Continuer
                </Button>
                <Button type="button" variant="ghost" onClick={skipStep}>
                  Passer
                </Button>
              </div>
            </form>
          )}

          {current.id === "customer" && (
            <form
              action={(fd) => submitStep(fd, saveOnboardingCustomerAction)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nom du client</Label>
                <Input id="name" name="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" type="tel" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || isPending}>
                  Continuer
                </Button>
                <Button type="button" variant="ghost" onClick={skipStep}>
                  Passer
                </Button>
              </div>
            </form>
          )}

          {current.id === "finish" && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Votre espace ConstructionIOS est configuré. Choisissez maintenant votre formule
                d&apos;accès.
              </p>
              <Button onClick={finish} disabled={loading || isPending}>
                {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Choisir mon accès
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
