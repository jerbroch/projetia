"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitFeedbackAction } from "@/lib/actions/platform/admin";

export function FeedbackForm() {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitFeedbackAction(formData);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggestions et commentaires</CardTitle>
        <CardDescription>
          Partagez une idée d&apos;amélioration avec l&apos;équipe Construction iOS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <input
            name="title"
            placeholder="Titre"
            className="w-full rounded-md border px-3 py-2 text-sm"
            required
          />
          <textarea
            name="description"
            placeholder="Décrivez votre suggestion..."
            className="min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
            required
          />
          <Button type="submit" size="sm" disabled={pending}>
            Envoyer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
