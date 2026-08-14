"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  calculateQuoteTotals,
  getQuoteLineItems,
  QUOTE_STATUS_LABELS,
} from "@/lib/quote-utils";
import type { Company, Quote } from "@/types";

interface QuoteTemplateProps {
  quote: Quote;
  company: Company;
  showActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  actionsDisabled?: boolean;
  showDepositSection?: boolean;
}

export function QuoteTemplate({
  quote,
  company,
  showActions = false,
  onAccept,
  onReject,
  actionsDisabled = false,
  showDepositSection = false,
}: QuoteTemplateProps) {
  const statusLabel = QUOTE_STATUS_LABELS[quote.status] ?? quote.status;
  const lineItems = getQuoteLineItems(quote);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totals = calculateQuoteTotals(subtotal, company);

  return (
    <div className="rounded-lg border bg-white p-6 text-foreground shadow-sm">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={`Logo ${company.name}`}
              className="h-16 w-16 rounded-md border object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-lg font-bold text-muted-foreground">
              {(company.name ?? "CO").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold">{company.name ?? "Entreprise"}</h2>
            {company.legalName && (
              <p className="text-sm text-muted-foreground">{company.legalName}</p>
            )}
            <div className="mt-1 text-sm text-muted-foreground">
              {company.address && <p>{company.address}</p>}
              {(company.city || company.province || company.postalCode) && (
                <p>
                  {[company.city, company.province, company.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              {company.phone && <p>{company.phone}</p>}
              {company.email && <p>{company.email}</p>}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-muted-foreground">Soumission</p>
          <p className="text-lg font-bold">{quote.quoteNumber}</p>
          <p className="text-sm text-muted-foreground">
            Date : {formatDate(quote.createdAt)}
          </p>
          <Badge variant="secondary" className="mt-2">
            {statusLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
          <p className="mt-1 font-medium">{quote.customerName}</p>
          {quote.customerEmail && (
            <p className="text-sm text-muted-foreground">{quote.customerEmail}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Valide jusqu&apos;au
          </p>
          <p className="mt-1 font-medium">
            {quote.validUntil ? formatDate(quote.validUntil) : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-b pb-6">
        <h3 className="text-lg font-semibold">{quote.title}</h3>
        {quote.description && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quote.description}</p>
        )}
      </div>

      <div className="overflow-x-auto py-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Description</th>
              <th className="pb-2 pr-4 text-right font-medium">Qté</th>
              <th className="pb-2 pr-4 text-right font-medium">Prix unit.</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={index} className="border-b border-border/50">
                <td className="py-2 pr-4">{item.description}</td>
                <td className="py-2 pr-4 text-right">{item.quantity}</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 border-b pb-6 text-sm">
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-muted-foreground">Sous-total</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-muted-foreground">
            TPS ({((company.gstRate ?? 0.05) * 100).toFixed(2)}%)
          </span>
          <span>{formatCurrency(totals.gst)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between">
          <span className="text-muted-foreground">
            TVQ ({((company.qstRate ?? 0.09975) * 100).toFixed(3)}%)
          </span>
          <span>{formatCurrency(totals.qst)}</span>
        </div>
        <div className="flex w-full max-w-xs justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>
      </div>

      {quote.terms && (
        <div className="border-b py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conditions
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{quote.terms}</p>
        </div>
      )}

      {showDepositSection && quote.depositRequired && quote.depositAmount != null && (
        <div className="border-b py-6">
          <p className="text-sm font-medium">Dépôt requis à l&apos;acceptation</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(quote.depositAmount)}
            {quote.depositPercentage != null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({quote.depositPercentage}% du total)
              </span>
            )}
          </p>
        </div>
      )}

      {showActions && (
        <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onReject}
            disabled={actionsDisabled}
            className="inline-flex items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-6 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            Refuser la soumission
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={actionsDisabled}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Accepter la soumission
          </button>
        </div>
      )}
    </div>
  );
}
