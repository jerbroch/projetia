import type { ProfileRole } from "@/types";

export const DEFAULT_MATERIAL_MARGIN = 0.4;

export interface BillingLineInput {
  lineType: "labor" | "material";
  description: string;
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  marginPct?: number;
  isDivers?: boolean;
}

export interface BillingTotals {
  materialCostSubtotal: number;
  materialSubtotal: number;
  laborSubtotal: number;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
}

export interface InvoiceLineSnapshot {
  lineType: "labor" | "material";
  description: string;
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  marginPct: number;
  lineTotal: number;
}

/** Roles that can see and edit prices in billing UI */
const PRICE_VIEW_ROLES: ProfileRole[] = ["owner", "admin", "estimator", "accountant"];

export function canViewBillingPrices(role: ProfileRole): boolean {
  return PRICE_VIEW_ROLES.includes(role);
}

/** custom_price takes priority over reference_price */
export function resolveEffectiveCatalogPrice(
  customPrice?: number | null,
  referencePrice?: number | null
): number | undefined {
  if (customPrice != null && customPrice > 0) return customPrice;
  if (referencePrice != null && referencePrice > 0) return referencePrice;
  return undefined;
}

/** sell = cost × (1 + margin) — cost is never modified */
export function calculateSellPriceFromCost(cost: number, marginPct: number): number {
  return roundCurrency(cost * (1 + marginPct));
}

/** margin = (sell - cost) / cost */
export function calculateMarginFromPrices(cost: number, sellPrice: number): number {
  if (cost <= 0) return 0;
  return roundPct((sellPrice - cost) / cost);
}

export function calculateLineTotal(quantity: number, unitSellPrice: number): number {
  return roundCurrency(quantity * unitSellPrice);
}

export function calculateLaborLineFromTemplate(
  templateName: string,
  workerCount: number,
  billRate: number,
  costPerHr: number,
  hours: number
): BillingLineInput {
  const marginPct = costPerHr > 0 ? calculateMarginFromPrices(costPerHr, billRate) : 0;
  return {
    lineType: "labor",
    description: `${templateName} (${workerCount} × ${hours} h)`,
    quantity: hours,
    unitCost: costPerHr,
    unitSellPrice: billRate,
    marginPct,
  };
}

/** Material line — no per-item margin; global margin applied at sheet level */
export function calculateMaterialLineFromCatalog(
  itemName: string,
  quantity: number,
  unitPrice: number
): BillingLineInput {
  return {
    lineType: "material",
    description: itemName,
    quantity,
    unitCost: unitPrice,
    unitSellPrice: unitPrice,
  };
}

/** Divers line — qty × unit price, no per-line margin */
export function calculateDiversLine(
  description: string,
  quantity: number,
  unitPrice: number
): BillingLineInput {
  return {
    lineType: "material",
    description,
    quantity,
    unitCost: unitPrice,
    unitSellPrice: unitPrice,
    isDivers: true,
  };
}

export function applyGlobalMaterialMargin(
  materialCostSubtotal: number,
  materialMarginPct: number
): number {
  return roundCurrency(materialCostSubtotal * (1 + materialMarginPct));
}

export function calculateBillingTotals(
  lines: BillingLineInput[],
  company: Pick<{ gstRate?: number; qstRate?: number }, "gstRate" | "qstRate">,
  materialMarginPct: number = DEFAULT_MATERIAL_MARGIN
): BillingTotals {
  let materialCostSubtotal = 0;
  let laborSubtotal = 0;

  for (const line of lines) {
    if (line.lineType === "material") {
      materialCostSubtotal += calculateLineTotal(line.quantity, line.unitCost);
    } else {
      laborSubtotal += calculateLineTotal(line.quantity, line.unitSellPrice);
    }
  }

  materialCostSubtotal = roundCurrency(materialCostSubtotal);
  laborSubtotal = roundCurrency(laborSubtotal);
  const materialSubtotal = applyGlobalMaterialMargin(materialCostSubtotal, materialMarginPct);
  const subtotal = roundCurrency(materialSubtotal + laborSubtotal);

  const gstRate = company.gstRate ?? 0.05;
  const qstRate = company.qstRate ?? 0.09975;
  const gst = roundCurrency(subtotal * gstRate);
  const qst = roundCurrency((subtotal + gst) * qstRate);
  const total = roundCurrency(subtotal + gst + qst);

  return { materialCostSubtotal, materialSubtotal, laborSubtotal, subtotal, gst, qst, total };
}

/** Invoice snapshots — material lines include global margin in sell price */
export function buildInvoiceLineSnapshots(
  lines: BillingLineInput[],
  materialMarginPct: number = DEFAULT_MATERIAL_MARGIN
): InvoiceLineSnapshot[] {
  return lines.map((line) => {
    if (line.lineType === "labor") {
      return {
        lineType: line.lineType,
        description: line.description,
        quantity: line.quantity,
        unitCost: line.unitCost,
        unitSellPrice: line.unitSellPrice,
        marginPct: line.marginPct ?? calculateMarginFromPrices(line.unitCost, line.unitSellPrice),
        lineTotal: calculateLineTotal(line.quantity, line.unitSellPrice),
      };
    }

    const unitSellPrice = calculateSellPriceFromCost(line.unitCost, materialMarginPct);
    return {
      lineType: line.lineType,
      description: line.description,
      quantity: line.quantity,
      unitCost: line.unitCost,
      unitSellPrice,
      marginPct: materialMarginPct,
      lineTotal: calculateLineTotal(line.quantity, unitSellPrice),
    };
  });
}

export function buildInvoiceNumber(existingNumbers: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  const seq = existingNumbers
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.split("-").pop() ?? "0", 10))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(seq + 1).padStart(3, "0")}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 10000) / 10000;
}
