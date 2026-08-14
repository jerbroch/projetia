"use client";

import {
  LABOR_TEMPLATE_SEEDS,
  MATERIAL_CATALOG_SEEDS,
  MATERIAL_CATEGORY_SLUGS,
} from "@/lib/billing-seed";
import type { JobBillingLine, JobBillingSheet, LaborRateTemplate, MaterialCatalogItem } from "@/types";

const SHEETS_KEY = "constructionios_demo_billing_sheets";
const TEMPLATES_KEY = "constructionios_demo_labor_templates";

const CATEGORY_NAMES: Record<string, string> = {
  "tuyau-cuivre": "Tuyau cuivre",
  "fittings-cuivre": "Fittings cuivre",
  "pvc-dwv": "PVC DWV",
  "pvc-pression": "PVC pression",
  cpvc: "CPVC",
  abs: "ABS",
  fonte: "Fonte",
  "acier-noir": "Acier noir",
  "acier-galvanise": "Acier galvanisé",
  stainless: "Stainless",
  pex: "PEX",
  propress: "ProPress",
  megapress: "MegaPress",
  "fittings-filetes": "Fittings filetés",
  "fittings-mecaniques": "Fittings mécaniques",
  victaulic: "Victaulic",
  valves: "Valves",
  clapets: "Clapets",
  regulateurs: "Régulateurs",
  drains: "Drains",
  puisards: "Puisards",
  pompes: "Pompes",
  "chauffe-eau": "Chauffe-eau",
  chaudieres: "Chaudières",
  robinets: "Robinets",
  toilettes: "Toilettes",
  lavabos: "Lavabos",
  douches: "Douches",
  supports: "Supports",
  isolants: "Isolants",
  "gaz-naturel": "Gaz naturel",
  accessoires: "Accessoires",
  divers: "Divers",
};

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(items));
}

/** Demo labor templates — costs at 0 until configured (matches DB seed). */
export function getDefaultDemoLaborTemplates(companyId: string): LaborRateTemplate[] {
  return LABOR_TEMPLATE_SEEDS.map((seed, index) => ({
    id: `lrt-demo-${index + 1}`,
    companyId,
    name: seed.name,
    workerCount: seed.workerCount,
    costPerHr: 0,
    billRate: 0,
    marginPct: 0,
    rateType: seed.rateType,
    sortOrder: seed.sortOrder,
    isActive: true,
  }));
}

export function getDemoLaborTemplates(companyId: string): LaborRateTemplate[] {
  const stored = readJson<LaborRateTemplate>(TEMPLATES_KEY);
  if (stored.length === 0) return getDefaultDemoLaborTemplates(companyId);
  return stored.filter((t) => t.companyId === companyId);
}

export function saveDemoLaborTemplates(templates: LaborRateTemplate[]) {
  writeJson(TEMPLATES_KEY, templates);
}

const DEMO_MATERIAL_CATALOG: MaterialCatalogItem[] = MATERIAL_CATALOG_SEEDS.map((seed, index) => ({
  id: `mci-demo-${index + 1}`,
  categoryId: `cat-${seed.categorySlug}`,
  categoryName: CATEGORY_NAMES[seed.categorySlug] ?? seed.categorySlug,
  name: seed.name,
  diameter: seed.diameter,
  fittingType: seed.fittingType,
  unit: seed.unit,
  isCustom: false,
}));

export function searchDemoMaterialCatalog(query: string): MaterialCatalogItem[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0 || query.trim().length < 3) return [];

  return DEMO_MATERIAL_CATALOG.filter((item) => {
    const haystack = [item.name, item.diameter, item.fittingType, item.categoryName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }).slice(0, 20);
}

export function getDemoMaterialCatalogCount(): number {
  return DEMO_MATERIAL_CATALOG.length;
}

export function getDemoCategorySlugs(): readonly string[] {
  return MATERIAL_CATEGORY_SLUGS;
}

export function getDemoBillingSheet(jobId: string): JobBillingSheet | null {
  return readJson<JobBillingSheet>(SHEETS_KEY).find((s) => s.scheduledJobId === jobId) ?? null;
}

export function upsertDemoBillingSheet(sheet: JobBillingSheet) {
  const sheets = readJson<JobBillingSheet>(SHEETS_KEY);
  const index = sheets.findIndex((s) => s.scheduledJobId === sheet.scheduledJobId);
  if (index >= 0) sheets[index] = sheet;
  else sheets.push(sheet);
  writeJson(SHEETS_KEY, sheets);
}

export function createDemoBillingLine(partial: Omit<JobBillingLine, "id">): JobBillingLine {
  return { ...partial, id: `dbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
}

export function createDemoBillingSheet(companyId: string, jobId: string): JobBillingSheet {
  return {
    id: `dbs-${jobId}`,
    companyId,
    scheduledJobId: jobId,
    status: "draft",
    materialSubtotal: 0,
    laborSubtotal: 0,
    subtotal: 0,
    gstAmount: 0,
    qstAmount: 0,
    total: 0,
    lines: [],
  };
}

export function formatLaborBillRate(billRate: number): string {
  return billRate > 0 ? `${billRate.toFixed(2)} $/h` : "À configurer";
}

export function formatEffectivePrice(price?: number | null): string {
  if (price == null || price <= 0) return "Prix à mettre à jour";
  return `${price.toFixed(2)} $`;
}

/** @deprecated use formatEffectivePrice */
export function formatMaterialUnitCost(unitCost?: number | null): string {
  return formatEffectivePrice(unitCost);
}
