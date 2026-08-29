"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setInitialPasswordAction } from "@/lib/actions/set-initial-password";
import { createClient } from "@/lib/supabase/client";

/**
 * Écran où l'employé invité choisit son mot de passe.
 *
 * Il arrive ici avec une session ouverte par son lien d'invitation, mais sans
 * mot de passe : personne ne lui en a transmis, et c'est voulu. Tant qu'il n'a
 * pas choisi le sien, il ne pourrait plus se reconnecter une fois la session
 * du lien expirée.
 */
export function SetInitialPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState(false);
  const [ready, setReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function verifierSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setSessionError(true);
        return;
      }
      setReady(true);
    }
    void verifierSession();
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    // FormData est lu AVANT le await : après, React a déjà vidé currentTarget.
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await setInitialPasswordAction(formData);
      if (!result.success) {
        setError(result.error ?? "Impossible d'enregistrer le mot de passe.");
        return;
      }
      router.replace(result.destination ?? "/terrain");
    });
  }

  if (sessionError) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>Ce lien n&apos;est plus valide</CardTitle>
          <CardDescription>
            Il a peut-être déjà été utilisé, ou il a expiré. Demandez à votre
            employeur de vous renvoyer une invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          <CardTitle>Choisissez votre mot de passe</CardTitle>
        </div>
        <CardDescription>
          C&apos;est la dernière étape. Vous serez seul à le connaître — personne
          dans votre entreprise ne peut le voir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={!ready || isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmez le mot de passe</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={!ready || isPending}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={!ready || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer et accéder à l&apos;application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
