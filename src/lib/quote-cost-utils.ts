import { generateId } from "@/lib/id";
import type {
  Company,
  LaborRateTemplate,
  Quote,
  QuoteCostEstimation,
  QuoteEstimationSnapshot,
  QuoteFeeLine,
  QuoteFeeType,
  QuoteLaborCategory,
  QuoteLaborLine,
  QuoteLineItem,
  QuoteMaterialLine,
} from "@/types";

export interface QuoteTotals {
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
}

/** Quebec-style tax: QST applies to subtotal + GST */
export function calculateQuoteTotals(
  subtotal: number,
  company: Pick<Company, "gstRate" | "qstRate">
): QuoteTotals {
  const gstRate = company.gstRate ?? 0.05;
  const qstRate = company.qstRate ?? 0.09975;
  const gst = Math.round(subtotal * gstRate * 100) / 100;
  const qst = Math.round((subtotal + gst) * qstRate * 100) / 100;
  const total = Math.round((subtotal + gst + qst) * 100) / 100;
  return { subtotal, gst, qst, total };
}

export const LABOR_CATEGORY_LABELS: Record<QuoteLaborCategory, string> = {
  compagnon: "Compagnon",
  apprenti: "Apprenti",
  equipe: "Équipe compagnon + apprenti",
  autre: "Autre",
};

export const FEE_TYPE_LABELS: Record<QuoteFeeType, string> = {
  transport: "Transport",
  location: "Location équipement",
  sous_traitance: "Sous-traitance",
  permis: "Permis",
  livraison: "Livraison",
  divers: "Divers",
  autre: "Autre",
};

const DEFAULT_LABOR_RATES: Record<QuoteLaborCategory, number> = {
  compagnon: 125,
  apprenti: 75,
  equipe: 235,
  autre: 125,
};

const LABOR_TEMPLATE_NAMES: Record<QuoteLaborCategory, string> = {
  compagnon: "1 compagnon",
  apprenti: "1 apprenti",
  equipe: "1 compagnon + 1 apprenti",
  autre: "1 compagnon",
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLaborLineTotal(
  hours: number,
  hourlyRate: number,
  workerCount: number
): number {
  return roundMoney(hours * hourlyRate * workerCount);
}

export function calculateMaterialSalePrice(costPrice: number, marginPct: number): number {
  return roundMoney(costPrice * (1 + marginPct));
}

export function calculateMaterialLineTotal(quantity: number, salePrice: number): number {
  return roundMoney(quantity * salePrice);
}

export function calculateFeeLineTotal(
  quantity: number,
  price: number,
  marginPct = 0
): number {
  const unitSell = roundMoney(price * (1 + marginPct));
  return roundMoney(quantity * unitSell);
}

export function resolveDefaultLaborRate(
  category: QuoteLaborCategory,
  templates: LaborRateTemplate[] = []
): number {
  const templateName = LABOR_TEMPLATE_NAMES[category];
  const match = templates.find(
    (template) =>
      template.rateType === "regular" &&
      template.name.toLowerCase() === templateName.toLowerCase()
  );
  if (match && match.billRate > 0) return match.billRate;
  return DEFAULT_LABOR_RATES[category];
}

export function resolveDefaultWorkerCount(category: QuoteLaborCategory): number {
  switch (category) {
    case "equipe":
      return 2;
    case "apprenti":
    case "compagnon":
    case "autre":
    default:
      return 1;
  }
}

export function createEmptyCostEstimation(): QuoteCostEstimation {
  return {
    labor: [],
    materials: [],
    fees: [],
    showLaborOnClient: false,
    showMaterialsOnClient: false,
    manualPriceOverride: false,
  };
}

/** Ensures labor/materials/fees arrays exist — safe for null DB values or partial JSON. */
export function normalizeCostEstimation(
  estimation?: QuoteCostEstimation | null
): QuoteCostEstimation {
  if (!estimation || typeof estimation !== "object") {
    return createEmptyCostEstimation();
  }
  return {
    ...createEmptyCostEstimation(),
    ...estimation,
    labor: Array.isArray(estimation.labor) ? estimation.labor : [],
    materials: Array.isArray(estimation.materials) ? estimation.materials : [],
    fees: Array.isArray(estimation.fees) ? estimation.fees : [],
  };
}

export function createDefaultLaborLine(templates: LaborRateTemplate[] = []): QuoteLaborLine {
  const category: QuoteLaborCategory = "compagnon";
  const hourlyRate = resolveDefaultLaborRate(category, templates);
  const workerCount = resolveDefaultWorkerCount(category);
  const hours = 1;
  return {
    id: generateId("ql"),
    category,
    hours,
    hourlyRate,
    workerCount,
    total: calculateLaborLineTotal(hours, hourlyRate, workerCount),
  };
}

/** Custom labor line — category "autre" with free-text label; rate is editable and persisted. */
export function createCustomLaborLine(
  templates: LaborRateTemplate[] = [],
  customLabel = ""
): QuoteLaborLine {
  const category: QuoteLaborCategory = "autre";
  const hourlyRate = resolveDefaultLaborRate(category, templates);
  const workerCount = 1;
  const hours = 1;
  return {
    id: generateId("ql"),
    category,
    employeeCategory: customLabel.trim() || undefined,
    hours,
    hourlyRate,
    workerCount,
    total: calculateLaborLineTotal(hours, hourlyRate, workerCount),
  };
}

export function isCustomLaborLine(line: QuoteLaborLine): boolean {
  return line.category === "autre" && Boolean(line.employeeCategory?.trim());
}

export function getLaborLineDisplayLabel(line: QuoteLaborLine): string {
  if (isCustomLaborLine(line)) {
    return line.employeeCategory!.trim();
  }
  const base = LABOR_CATEGORY_LABELS[line.category];
  if (line.employeeCategory?.trim()) {
    return `${base} (${line.employeeCategory.trim()})`;
  }
  return base;
}

export function createDefaultMaterialLine(defaultMargin = 0.4): QuoteMaterialLine {
  const costPrice = 0;
  const marginPct = defaultMargin;
  const salePrice = calculateMaterialSalePrice(costPrice, marginPct);
  return {
    id: generateId("qm"),
    name: "",
    quantity: 1,
    unit: "unité",
    costPrice,
    marginPct,
    salePrice,
    total: 0,
    isCustom: true,
  };
}

export function createDefaultFeeLine(): QuoteFeeLine {
  return {
    id: generateId("qf"),
    feeType: "divers",
    description: "",
    quantity: 1,
    price: 0,
    total: 0,
  };
}

export function recalculateLaborLine(line: QuoteLaborLine): QuoteLaborLine {
  return {
    ...line,
    total: calculateLaborLineTotal(line.hours, line.hourlyRate, line.workerCount),
  };
}

export function recalculateMaterialLine(line: QuoteMaterialLine): QuoteMaterialLine {
  const salePrice = calculateMaterialSalePrice(line.costPrice, line.marginPct);
  return {
    ...line,
    salePrice,
    total: calculateMaterialLineTotal(line.quantity, salePrice),
  };
}

export function recalculateFeeLine(line: QuoteFeeLine): QuoteFeeLine {
  return {
    ...line,
    total: calculateFeeLineTotal(line.quantity, line.price, line.marginPct ?? 0),
  };
}

export function recalculateCostEstimation(
  estimation: QuoteCostEstimation | null | undefined
): QuoteCostEstimation {
  const normalized = normalizeCostEstimation(estimation);
  return {
    ...normalized,
    labor: normalized.labor.map(recalculateLaborLine),
    materials: normalized.materials.map(recalculateMaterialLine),
    fees: normalized.fees.map(recalculateFeeLine),
  };
}

export interface QuoteCostSummary {
  laborSubtotal: number;
  materialsSubtotal: number;
  materialsCostSubtotal: number;
  feesSubtotal: number;
  calculatedSubtotal: number;
  proposedSubtotal: number;
  adjustment: number;
  gst: number;
  qst: number;
  totalWithTaxes: number;
  estimatedHours: number;
  estimatedMaterialsCost: number;
}

export function hasCostEstimationLines(estimation?: QuoteCostEstimation | null): boolean {
  if (!estimation) return false;
  const normalized = normalizeCostEstimation(estimation);
  return (
    normalized.labor.length > 0 ||
    normalized.materials.length > 0 ||
    normalized.fees.length > 0
  );
}

export function calculateCostEstimationSummary(
  estimation: QuoteCostEstimation,
  company: Pick<Company, "gstRate" | "qstRate">,
  proposedAmount?: number
): QuoteCostSummary {
  const normalized = recalculateCostEstimation(estimation);
  const laborSubtotal = roundMoney(
    normalized.labor.reduce((sum, line) => sum + line.total, 0)
  );
  const materialsSubtotal = roundMoney(
    normalized.materials.reduce((sum, line) => sum + line.total, 0)
  );
  const materialsCostSubtotal = roundMoney(
    normalized.materials.reduce((sum, line) => sum + line.costPrice * line.quantity, 0)
  );
  const feesSubtotal = roundMoney(
    normalized.fees.reduce((sum, line) => sum + line.total, 0)
  );
  const calculatedSubtotal = roundMoney(laborSubtotal + materialsSubtotal + feesSubtotal);
  const proposedSubtotal =
    proposedAmount != null && !Number.isNaN(proposedAmount)
      ? roundMoney(proposedAmount)
      : calculatedSubtotal;
  const adjustment = roundMoney(proposedSubtotal - calculatedSubtotal);
  const totals = calculateQuoteTotals(proposedSubtotal, company);
  const estimatedHours = roundMoney(
    normalized.labor.reduce((sum, line) => sum + line.hours * line.workerCount, 0)
  );

  return {
    laborSubtotal,
    materialsSubtotal,
    materialsCostSubtotal,
    feesSubtotal,
    calculatedSubtotal,
    proposedSubtotal,
    adjustment,
    gst: totals.gst,
    qst: totals.qst,
    totalWithTaxes: totals.total,
    estimatedHours,
    estimatedMaterialsCost: materialsCostSubtotal,
  };
}

export function buildProfitabilitySnapshot(
  estimation: QuoteCostEstimation,
  summary: QuoteCostSummary
): QuoteCostEstimation["profitability"] {
  return {
    estimatedHours: summary.estimatedHours,
    actualHours: null,
    estimatedMaterialsCost: summary.estimatedMaterialsCost,
    actualMaterialsCost: null,
    soldPrice: summary.proposedSubtotal,
    actualCost: null,
    profit: null,
  };
}

export function buildClientLineItemsFromEstimation(
  quote: Pick<Quote, "title" | "description" | "amount" | "costEstimation" | "proposedAmount">
): QuoteLineItem[] {
  const estimation = quote.costEstimation;
  if (!estimation || !hasCostEstimationLines(estimation)) {
    return [];
  }

  const normalized = recalculateCostEstimation(estimation);
  const items: QuoteLineItem[] = [];

  if (normalized.showLaborOnClient) {
    for (const line of normalized.labor) {
      items.push({
        description: `Main-d'œuvre — ${getLaborLineDisplayLabel(line)}`,
        quantity: line.hours * line.workerCount,
        unitPrice: line.hourlyRate,
        total: line.total,
      });
    }
  }

  if (normalized.showMaterialsOnClient) {
    for (const line of normalized.materials) {
      items.push({
        description: line.description ? `${line.name} — ${line.description}` : line.name,
        quantity: line.quantity,
        unitPrice: line.salePrice,
        total: line.total,
      });
    }
  }

  for (const line of normalized.fees) {
    items.push({
      description: `${FEE_TYPE_LABELS[line.feeType]}${line.description ? ` — ${line.description}` : ""}`,
      quantity: line.quantity,
      unitPrice: roundMoney(line.total / Math.max(line.quantity, 1)),
      total: line.total,
    });
  }

  if (items.length === 0) {
    const amount = quote.proposedAmount ?? quote.amount;
    items.push({
      description: quote.title + (quote.description ? ` — ${quote.description}` : ""),
      quantity: 1,
      unitPrice: amount,
      total: amount,
    });
  }

  return items;
}

export function buildQuoteEstimationSnapshot(quote: Quote): QuoteEstimationSnapshot {
  const summary = quote.costEstimation
    ? calculateCostEstimationSummary(quote.costEstimation, {}, quote.proposedAmount ?? quote.amount)
    : undefined;

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    costEstimation: quote.costEstimation,
    calculatedCost: quote.calculatedCost,
    proposedAmount: quote.proposedAmount ?? quote.amount,
    budget: quote.proposedAmount ?? quote.calculatedCost ?? quote.amount,
    estimatedHours: summary?.estimatedHours,
    capturedAt: new Date().toISOString(),
  };
}

export function mapCostEstimationFromDb(raw: unknown): QuoteCostEstimation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const labor = Array.isArray(data.labor)
    ? data.labor.map((line) => {
        const row = line as Record<string, unknown>;
        return {
          id: String(row.id ?? generateId("ql")),
          category: (row.category as QuoteLaborCategory) ?? "compagnon",
          employeeCategory: row.employee_category
            ? String(row.employee_category)
            : row.employeeCategory
              ? String(row.employeeCategory)
              : undefined,
          hours: Number(row.hours ?? 0),
          hourlyRate: Number(row.hourly_rate ?? row.hourlyRate ?? 0),
          workerCount: Number(row.worker_count ?? row.workerCount ?? 1),
          total: Number(row.total ?? 0),
        } satisfies QuoteLaborLine;
      })
    : [];
  const materials = Array.isArray(data.materials)
    ? data.materials.map((line) => {
        const row = line as Record<string, unknown>;
        return {
          id: String(row.id ?? generateId("qm")),
          catalogItemId: row.catalog_item_id
            ? String(row.catalog_item_id)
            : row.catalogItemId
              ? String(row.catalogItemId)
              : undefined,
          name: String(row.name ?? ""),
          description: row.description ? String(row.description) : undefined,
          quantity: Number(row.quantity ?? 1),
          unit: String(row.unit ?? "unité"),
          costPrice: Number(row.cost_price ?? row.costPrice ?? 0),
          marginPct: Number(row.margin_pct ?? row.marginPct ?? 0),
          salePrice: Number(row.sale_price ?? row.salePrice ?? 0),
          total: Number(row.total ?? 0),
          isCustom: Boolean(row.is_custom ?? row.isCustom ?? false),
        } satisfies QuoteMaterialLine;
      })
    : [];
  const fees = Array.isArray(data.fees)
    ? data.fees.map((line) => {
        const row = line as Record<string, unknown>;
        return {
          id: String(row.id ?? generateId("qf")),
          feeType: (row.fee_type ?? row.feeType ?? "divers") as QuoteFeeType,
          description: String(row.description ?? ""),
          quantity: Number(row.quantity ?? 1),
          price: Number(row.price ?? 0),
          marginPct:
            row.margin_pct != null
              ? Number(row.margin_pct)
              : row.marginPct != null
                ? Number(row.marginPct)
                : undefined,
          total: Number(row.total ?? 0),
        } satisfies QuoteFeeLine;
      })
    : [];

  if (labor.length === 0 && materials.length === 0 && fees.length === 0) {
    return undefined;
  }

  return recalculateCostEstimation({
    labor,
    materials,
    fees,
    showLaborOnClient: Boolean(data.show_labor_on_client ?? data.showLaborOnClient ?? false),
    showMaterialsOnClient: Boolean(
      data.show_materials_on_client ?? data.showMaterialsOnClient ?? false
    ),
    manualPriceOverride: Boolean(
      data.manual_price_override ?? data.manualPriceOverride ?? false
    ),
    profitability: data.profitability as QuoteCostEstimation["profitability"],
  });
}

export function serializeCostEstimationForDb(
  estimation: QuoteCostEstimation
): Record<string, unknown> {
  const normalized = recalculateCostEstimation(estimation);
  return {
    labor: normalized.labor.map((line) => ({
      id: line.id,
      category: line.category,
      employee_category: line.employeeCategory ?? null,
      hours: line.hours,
      hourly_rate: line.hourlyRate,
      worker_count: line.workerCount,
      total: line.total,
    })),
    materials: normalized.materials.map((line) => ({
      id: line.id,
      catalog_item_id: line.catalogItemId ?? null,
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      unit: line.unit,
      cost_price: line.costPrice,
      margin_pct: line.marginPct,
      sale_price: line.salePrice,
      total: line.total,
      is_custom: line.isCustom ?? false,
    })),
    fees: normalized.fees.map((line) => ({
      id: line.id,
      fee_type: line.feeType,
      description: line.description,
      quantity: line.quantity,
      price: line.price,
      margin_pct: line.marginPct ?? null,
      total: line.total,
    })),
    show_labor_on_client: normalized.showLaborOnClient ?? false,
    show_materials_on_client: normalized.showMaterialsOnClient ?? false,
    manual_price_override: normalized.manualPriceOverride ?? false,
    profitability: normalized.profitability ?? null,
  };
}

export function mapEstimationSnapshotFromDb(raw: unknown): QuoteEstimationSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const costEstimation = mapCostEstimationFromDb(data.cost_estimation ?? data.costEstimation);
  return {
    quoteId: String(data.quote_id ?? data.quoteId ?? ""),
    quoteNumber: String(data.quote_number ?? data.quoteNumber ?? ""),
    costEstimation,
    calculatedCost:
      data.calculated_cost != null
        ? Number(data.calculated_cost)
        : data.calculatedCost != null
          ? Number(data.calculatedCost)
          : undefined,
    proposedAmount:
      data.proposed_amount != null
        ? Number(data.proposed_amount)
        : data.proposedAmount != null
          ? Number(data.proposedAmount)
          : undefined,
    budget: data.budget != null ? Number(data.budget) : undefined,
    estimatedHours:
      data.estimated_hours != null
        ? Number(data.estimated_hours)
        : data.estimatedHours != null
          ? Number(data.estimatedHours)
          : undefined,
    capturedAt: String(data.captured_at ?? data.capturedAt ?? new Date().toISOString()),
  };
}

export function serializeEstimationSnapshotForDb(
  snapshot: QuoteEstimationSnapshot
): Record<string, unknown> {
  return {
    quote_id: snapshot.quoteId,
    quote_number: snapshot.quoteNumber,
    cost_estimation: snapshot.costEstimation
      ? serializeCostEstimationForDb(snapshot.costEstimation)
      : null,
    calculated_cost: snapshot.calculatedCost ?? null,
    proposed_amount: snapshot.proposedAmount ?? null,
    budget: snapshot.budget ?? null,
    estimated_hours: snapshot.estimatedHours ?? null,
    captured_at: snapshot.capturedAt,
  };
}
