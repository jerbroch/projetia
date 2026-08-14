"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuoteTemplate } from "@/components/quotes/quote-template";
import type { Company, Quote } from "@/types";

interface QuotePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote;
  company: Company;
}

export function QuotePreviewDialog({
  open,
  onOpenChange,
  quote,
  company,
}: QuotePreviewDialogProps) {
  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu de la soumission</DialogTitle>
          <DialogDescription>
            Modèle de soumission avec l&apos;en-tête de votre entreprise
          </DialogDescription>
        </DialogHeader>
        <QuoteTemplate quote={quote} company={company} />
      </DialogContent>
    </Dialog>
  );
}
