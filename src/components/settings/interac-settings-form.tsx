"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateInteracSettingsAction } from "@/lib/actions/job-workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Company } from "@/types";

interface InteracSettingsFormProps {
  company: Company;
}

export function InteracSettingsForm({ company }: InteracSettingsFormProps) {
  const interac = company.interac;
  const [enabled, setEnabled] = useState(interac?.enabled ?? false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("interacEnabled", enabled ? "true" : "false");

    startTransition(async () => {
      const result = await updateInteracSettingsAction(formData);
      if (!result.success) {
        setError(result.error);
      } else {
        setMessage("Paramètres Interac enregistrés.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paiement Interac</CardTitle>
        <CardDescription>
          Ces informations seront ajoutées automatiquement aux courriels de facture si activées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="flex items-center gap-2">
            <input
              id="interacEnabledToggle"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={company.isDemo}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="interacEnabledToggle">Inclure les instructions Interac dans les factures</Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="interacEmail">Courriel de dépôt</Label>
              <Input
                id="interacEmail"
                name="interacEmail"
                type="email"
                defaultValue={interac?.email ?? ""}
                disabled={company.isDemo}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="interacRecipientName">Nom du destinataire</Label>
              <Input
                id="interacRecipientName"
                name="interacRecipientName"
                defaultValue={interac?.recipientName ?? ""}
                disabled={company.isDemo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interacSecurityQuestion">Question de sécurité</Label>
              <Input
                id="interacSecurityQuestion"
                name="interacSecurityQuestion"
                defaultValue={interac?.securityQuestion ?? ""}
                disabled={company.isDemo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interacSecurityAnswer">Réponse</Label>
              <Input
                id="interacSecurityAnswer"
                name="interacSecurityAnswer"
                defaultValue={interac?.securityAnswer ?? ""}
                disabled={company.isDemo}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="interacInstructions">Instructions supplémentaires</Label>
              <textarea
                id="interacInstructions"
                name="interacInstructions"
                defaultValue={interac?.instructions ?? ""}
                rows={3}
                disabled={company.isDemo}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending || company.isDemo}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer Interac
          </Button>
          {company.isDemo && (
            <p className="text-sm text-muted-foreground">Paramètres démo non modifiables.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
