"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { demoLoginAction, loginAction } from "@/lib/actions/auth";
import { isDemoLoginEnabled } from "@/lib/demo/constants";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const showDemo = isDemoLoginEnabled();

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setError("");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result && !result.success) {
        setError(result.error);
        setLoading(false);
      }
    });
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    setError("");
    startTransition(async () => {
      const result = await demoLoginAction();
      if (result && !result.success) {
        setError(result.error);
        setDemoLoading(false);
      }
    });
  }

  const successMessage = searchParams.get("reset") === "success"
    ? "Mot de passe mis à jour. Vous pouvez vous connecter."
    : null;

  // Destination posée par le middleware quand l'utilisateur a été intercepté.
  // Revalidée côté serveur dans loginAction — jamais suivie telle quelle.
  const nextPath = searchParams.get("next");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Bienvenue sur ConstructionIOS</CardTitle>
          <CardDescription>Connectez-vous pour gérer votre entreprise de construction</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <CardContent className="space-y-4">
            {successMessage && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{successMessage}</div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@entreprise.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Mot de passe oublié?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Votre mot de passe"
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading || isPending}>
              {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>

            {showDemo && (
              <div className="w-full space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-center text-xs font-medium text-muted-foreground">
                  Compte de démonstration
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={demoLoading || isPending}
                  onClick={handleDemoLogin}
                >
                  {demoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Explorer la démo
                </Button>
                {process.env.NODE_ENV === "development" && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    Dev seulement : admin@constructionios.com
                  </p>
                )}
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                S&apos;inscrire
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
