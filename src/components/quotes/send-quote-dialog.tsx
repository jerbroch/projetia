"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { sendQuoteAction } from "@/lib/actions/quotes";
import { getPublicQuoteUrl } from "@/lib/quote-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Quote } from "@/types";

interface SendQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote;
  isDemo?: boolean;
  onSent: (quote: Quote, publicUrl?: string) => void;
}

export function SendQuoteDialog({
  open,
  onOpenChange,
  quote,
  isDemo,
  onSent,
}: SendQuoteDialogProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next && quote) {
      setEmail(quote.customerEmail ?? "");
      setError("");
      setPublicUrl("");
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    if (!email.trim()) {
      setError("Le courriel du destinataire est requis.");
      return;
    }

    startTransition(async () => {
      if (isDemo) {
        const token = `demo-${quote.id}`;
        const url = getPublicQuoteUrl(token, window.location.origin);
        setPublicUrl(url);
        onSent(
          {
            ...quote,
            status: "sent",
            customerEmail: email,
            sentAt: new Date().toISOString(),
            publicToken: token,
          },
          url
        );
        return;
      }

      const formData = new FormData();
      formData.set("quoteId", quote.id);
      formData.set("recipientEmail", email);

      const result = await sendQuoteAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setPublicUrl(result.publicUrl);
      onSent(result.quote, result.publicUrl);
    });
  }

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer la soumission</DialogTitle>
          <DialogDescription>
            Un lien sécurisé sera envoyé à {quote.customerName} pour consulter et répondre à la
            soumission {quote.quoteNumber}.
          </DialogDescription>
        </DialogHeader>

        {publicUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Soumission envoyée avec succès!
            </p>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">Lien public (copier)</p>
              <p className="mt-1 break-all text-sm">{publicUrl}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Courriel du client</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@exemple.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Envoyer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
