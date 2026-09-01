import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs.filter(Boolean)));
}

/**
 * Montant en dollars canadiens, écrit à la québécoise : « 5 000,00 $ ».
 *
 * C'était `en-US` et `USD`, ce qui affichait « $5,000.00 » sur les soumissions
 * et les factures d'entrepreneurs québécois. Deux fautes en une : le format
 * (virgule décimale, symbole après le nombre, espace insécable pour les
 * milliers) et la DEVISE elle-même, qui annonçait des dollars américains.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

/** Date courte en français : « 31 août 2026 » plutôt que « Aug 31, 2026 ». */
export function formatDate(date: string | Date): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "—";

  const timeFmt = new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${timeFmt.format(startDate)} → ${timeFmt.format(endDate)}`;
}
