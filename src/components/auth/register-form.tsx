"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { registerAction } from "@/lib/actions/auth";

export function RegisterForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerAction(formData);
      if (result && !result.success) {
        setError(result.error);
        setLoading(false);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Créer votre compte</CardTitle>
          <CardDescription>
            Inscrivez votre entreprise et profitez de 14 jours d&apos;essai gratuit
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
              <Input id="companyName" name="companyName" placeholder="Construction ABC Inc." required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" name="firstName" placeholder="Jean" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" placeholder="Tremblay" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Courriel professionnel</Label>
              <Input id="email" name="email" type="email" placeholder="jean@constructionabc.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone mobile (optionnel)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="(514) 555-1234" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" required minLength={10} />
              <p className="text-xs text-muted-foreground">
                Min. 10 caractères, majuscule, minuscule, chiffre et caractère spécial
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required />
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="acceptTerms" className="mt-1" required />
                <span>J&apos;accepte les conditions d&apos;utilisation</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="acceptPrivacy" className="mt-1" required />
                <span>J&apos;accepte la politique de confidentialité</span>
              </label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading || isPending}>
              {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
