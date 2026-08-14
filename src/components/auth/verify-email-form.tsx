"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resendVerificationAction, logoutAction } from "@/lib/actions/auth";

interface VerifyEmailFormProps {
  email?: string;
}

export function VerifyEmailForm({ email }: VerifyEmailFormProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleResend() {
    setLoading(true);
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await resendVerificationAction(email);
      setLoading(false);
      if (!result.success) {
        setError(result.error);
      } else {
        setMessage("Courriel de vérification renvoyé.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Vérifiez votre courriel</CardTitle>
          <CardDescription>
            {email
              ? `Un courriel de confirmation a été envoyé à ${email}.`
              : "Consultez votre boîte de réception pour confirmer votre compte."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <p className="text-sm text-muted-foreground">
            Après confirmation, vous serez redirigé vers la configuration de votre entreprise.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="button" className="w-full" disabled={loading || isPending} onClick={handleResend}>
            {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Renvoyer le courriel
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" className="w-full">
              Se déconnecter
            </Button>
          </form>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
