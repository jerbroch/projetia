"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  createQuoteAction,
  updateQuoteAction,
} from "@/lib/actions/quotes";
import {
  buildDemoQuoteNumber,
  buildQuoteFromForm,
  getDefaultQuoteFormValues,
  QUOTE_STATUS_LABELS,
  type QuoteFormValues,
} from "@/lib/quote-utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Company, Customer, LaborRateTemplate, Quote } from "@/types";
import { CostEstimationSection } from "@/components/quotes/cost-estimation-section";
import { hasCostEstimationLines } from "@/lib/quote-cost-utils";

interface QuoteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  quote?: Quote;
  customers: Customer[];
  company: Company;
  laborTemplates: LaborRateTemplate[];
  companyId: string;
  isDemo?: boolean;
  existingQuotes: Quote[];
  onSave: (quote: Quote) => void;
}

export function QuoteForm({
  open,
  onOpenChange,
  mode,
  quote,
  customers,
  company,
  laborTemplates,
  companyId,
  isDemo,
  existingQuotes,
  onSave,
}: QuoteFormProps) {
  const [form, setForm] = useState<QuoteFormValues>(() => getDefaultQuoteFormValues(quote));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(getDefaultQuoteFormValues(quote));
      setError("");
    }
  }, [open, quote]);

  function updateField<K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCustomerSelect(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setForm((prev) => ({
      ...prev,
      customerId,
      customerName: customer.name,
      customerEmail: customer.email || prev.customerEmail,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    if (!form.customerName.trim()) {
      setError("Le nom du client est requis.");
      return;
    }

    startTransition(async () => {
      if (isDemo) {
        const quoteNumber =
          mode === "edit" && quote
            ? quote.quoteNumber
            : buildDemoQuoteNumber(existingQuotes);
        const saved = buildQuoteFromForm(
          form,
          companyId,
          quoteNumber,
          mode === "edit" ? quote?.id : undefined,
          company
        );
        onSave(saved);
        onOpenChange(false);
        return;
      }

      const formData = new FormData();
      if (mode === "edit" && quote) formData.set("id", quote.id);
      formData.set("title", form.title);
      formData.set("description", form.description);
      formData.set("customerId", form.customerId);
      formData.set("customerName", form.customerName);
      formData.set("customerEmail", form.customerEmail);
      formData.set("amount", form.amount);
      formData.set("status", form.status);
      formData.set("validUntil", form.validUntil);
      formData.set("depositRequired", String(form.depositRequired));
      formData.set("depositPercentage", form.depositPercentage);
      formData.set("terms", form.terms);
      formData.set("manualPriceOverride", String(form.manualPriceOverride));
      if (hasCostEstimationLines(form.costEstimation)) {
        formData.set("costEstimation", JSON.stringify(form.costEstimation));
      }

      const result =
        mode === "edit" ? await updateQuoteAction(formData) : await createQuoteAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSave(result.quote);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nouvelle soumission" : "Modifier la soumission"}
          </DialogTitle>
          <DialogDescription>
            Créez une estimation pour un client et suivez son statut.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Rénovation cuisine"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Détails des travaux..."
            />
          </div>
          {customers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="customerSelect">Client existant</Label>
              <Select
                value={form.customerId || undefined}
                onValueChange={handleCustomerSelect}
              >
                <SelectTrigger id="customerSelect">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="customerName">Nom du client</Label>
            <Input
              id="customerName"
              value={form.customerName}
              onChange={(e) => updateField("customerName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Courriel du client</Label>
            <Input
              id="customerEmail"
              type="email"
              value={form.customerEmail}
              onChange={(e) => updateField("customerEmail", e.target.value)}
              placeholder="client@exemple.com"
            />
          </div>
          {open && (
            <CostEstimationSection
              company={company}
              laborTemplates={laborTemplates ?? []}
              estimation={form.costEstimation}
              amount={form.amount}
              manualPriceOverride={form.manualPriceOverride}
              onEstimationChange={(costEstimation) => updateField("costEstimation", costEstimation)}
              onAmountChange={(amount) => updateField("amount", amount)}
              onManualPriceOverrideChange={(manualPriceOverride) =>
                updateField("manualPriceOverride", manualPriceOverride)
              }
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant ($)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => {
                  updateField("amount", e.target.value);
                  if (!form.manualPriceOverride && hasCostEstimationLines(form.costEstimation)) {
                    updateField("manualPriceOverride", true);
                  }
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valide jusqu&apos;au</Label>
              <Input
                id="validUntil"
                type="date"
                value={form.validUntil}
                onChange={(e) => updateField("validUntil", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField("status", v as QuoteFormValues["status"])}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(QUOTE_STATUS_LABELS) as Quote["status"][]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {QUOTE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.depositRequired}
                onChange={(e) => updateField("depositRequired", e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">
                Demander un dépôt lors de l&apos;acceptation
              </span>
            </label>
            {form.depositRequired && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="depositPercentage">Pourcentage du dépôt (%)</Label>
                <Input
                  id="depositPercentage"
                  type="number"
                  min="1"
                  max="100"
                  value={form.depositPercentage}
                  onChange={(e) => updateField("depositPercentage", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms">Conditions et modalités</Label>
            <textarea
              id="terms"
              value={form.terms}
              onChange={(e) => updateField("terms", e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Conditions de paiement, garanties, délais..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Créer" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
