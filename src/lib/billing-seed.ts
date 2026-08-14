/**
 * Canonical billing seed definitions — mirrored in supabase/migrations/009_billing_seed_data.sql
 */

export const BILLING_DIAMETERS = [
  '1/2"',
  '3/4"',
  '1"',
  '1-1/4"',
  '1-1/2"',
  '2"',
  '2-1/2"',
  '3"',
  '3-1/2"',
  '4"',
] as const;

export const BILLING_DIAMETERS_SMALL = BILLING_DIAMETERS.slice(0, 6);

export type LaborRateTypeSeed = "regular" | "overtime" | "double_time";

export interface LaborTemplateSeed {
  name: string;
  workerCount: number;
  rateType: LaborRateTypeSeed;
  sortOrder: number;
  /** Crew templates get overtime / double_time variants */
  withRateVariants?: boolean;
}

const CREW_TEMPLATES: Omit<LaborTemplateSeed, "rateType" | "sortOrder">[] = [
  { name: "1 compagnon", workerCount: 1, withRateVariants: true },
  { name: "1 apprenti", workerCount: 1, withRateVariants: true },
  { name: "1 compagnon + 1 apprenti", workerCount: 2, withRateVariants: true },
  { name: "2 compagnons", workerCount: 2, withRateVariants: true },
  { name: "2 apprentis", workerCount: 2, withRateVariants: true },
  { name: "2 compagnons + 1 apprenti", workerCount: 3, withRateVariants: true },
  { name: "1 compagnon + 2 apprentis", workerCount: 3, withRateVariants: true },
  { name: "3 compagnons", workerCount: 3, withRateVariants: true },
  { name: "3 compagnons + 1 apprenti", workerCount: 4, withRateVariants: true },
];

const SPECIAL_TEMPLATES: Omit<LaborTemplateSeed, "rateType" | "sortOrder">[] = [
  { name: "Contremaître", workerCount: 1 },
  { name: "Technicien/service", workerCount: 1 },
  { name: "Transport", workerCount: 1 },
];

/** Required bill rates (regular) — seeded in migration 013 for all companies. */
export const REQUIRED_LABOR_BILL_RATES: Record<string, number> = {
  "1 compagnon": 125,
  "1 compagnon + 1 apprenti": 235,
  Transport: 75,
};

const RATE_TYPE_SUFFIX: Record<Exclude<LaborRateTypeSeed, "regular">, string> = {
  overtime: " (temps et demi)",
  double_time: " (temps double)",
};

function expandRateVariants(
  base: Omit<LaborTemplateSeed, "rateType" | "sortOrder">,
  startOrder: number
): LaborTemplateSeed[] {
  const variants: LaborRateTypeSeed[] = base.withRateVariants
    ? ["regular", "overtime", "double_time"]
    : ["regular"];

  return variants.map((rateType, index) => ({
    name:
      rateType === "regular"
        ? base.name
        : `${base.name}${RATE_TYPE_SUFFIX[rateType as Exclude<LaborRateTypeSeed, "regular">]}`,
    workerCount: base.workerCount,
    rateType,
    sortOrder: startOrder + index,
  }));
}

export function buildLaborTemplateSeeds(): LaborTemplateSeed[] {
  const seeds: LaborTemplateSeed[] = [];
  let order = 1;

  for (const crew of CREW_TEMPLATES) {
    const expanded = expandRateVariants(crew, order);
    seeds.push(...expanded);
    order += expanded.length;
  }

  for (const special of SPECIAL_TEMPLATES) {
    seeds.push({ ...special, rateType: "regular", sortOrder: order++ });
  }

  return seeds;
}

export const LABOR_TEMPLATE_SEEDS = buildLaborTemplateSeeds();

export const LABOR_TEMPLATE_BASE_NAMES = [
  ...CREW_TEMPLATES.map((t) => t.name),
  ...SPECIAL_TEMPLATES.map((t) => t.name),
];

/** Global material category slugs seeded in migration 008 */
export const MATERIAL_CATEGORY_SLUGS = [
  "tuyau-cuivre",
  "fittings-cuivre",
  "pvc-dwv",
  "pvc-pression",
  "cpvc",
  "abs",
  "fonte",
  "acier-noir",
  "acier-galvanise",
  "stainless",
  "pex",
  "propress",
  "megapress",
  "fittings-filetes",
  "fittings-mecaniques",
  "victaulic",
  "valves",
  "clapets",
  "regulateurs",
  "drains",
  "puisards",
  "pompes",
  "chauffe-eau",
  "chaudieres",
  "robinets",
  "toilettes",
  "lavabos",
  "douches",
  "supports",
  "isolants",
  "gaz-naturel",
  "accessoires",
  "divers",
] as const;

export interface MaterialCatalogSeed {
  categorySlug: string;
  name: string;
  diameter?: string;
  fittingType?: string;
  unit: string;
}

interface CategoryProductDef {
  slug: string;
  products: { name: string; fittingType?: string; unit?: string }[];
  diameters?: readonly string[];
}

const PIPE_FITTING_DEFS: CategoryProductDef[] = [
  {
    slug: "tuyau-cuivre",
    products: [
      { name: "Tuyau cuivre type L", unit: "pi" },
      { name: "Tuyau cuivre type M", unit: "pi" },
    ],
  },
  {
    slug: "fittings-cuivre",
    products: [
      { name: "Coude 90° cuivre", fittingType: "coude 90" },
      { name: "Coude 45° cuivre", fittingType: "coude 45" },
      { name: "Té cuivre", fittingType: "tee" },
      { name: "Union cuivre", fittingType: "union" },
      { name: "Coude 90° rue cuivre", fittingType: "coude 90 rue" },
      { name: "Manchon cuivre", fittingType: "manchon" },
    ],
  },
  {
    slug: "pvc-dwv",
    products: [
      { name: "Tuyau PVC DWV", unit: "pi" },
      { name: "Coude 90° PVC DWV", fittingType: "coude 90" },
      { name: "Coude 45° PVC DWV", fittingType: "coude 45" },
      { name: "Té PVC DWV", fittingType: "tee" },
      { name: "Y PVC DWV", fittingType: "y" },
      { name: "P-trap PVC DWV", fittingType: "p-trap" },
    ],
  },
  {
    slug: "pvc-pression",
    products: [
      { name: "Tuyau PVC pression", unit: "pi" },
      { name: "Coude 90° PVC pression", fittingType: "coude 90" },
      { name: "Té PVC pression", fittingType: "tee" },
    ],
  },
  {
    slug: "cpvc",
    products: [
      { name: "Tuyau CPVC", unit: "pi" },
      { name: "Coude 90° CPVC", fittingType: "coude 90" },
      { name: "Té CPVC", fittingType: "tee" },
    ],
  },
  {
    slug: "abs",
    products: [
      { name: "Tuyau ABS", unit: "pi" },
      { name: "Coude 90° ABS", fittingType: "coude 90" },
      { name: "Coude 45° ABS", fittingType: "coude 45" },
      { name: "Té ABS", fittingType: "tee" },
    ],
  },
  {
    slug: "fonte",
    products: [
      { name: "Tuyau fonte", unit: "pi" },
      { name: "Coude 90° fonte", fittingType: "coude 90" },
      { name: "Té fonte", fittingType: "tee" },
    ],
  },
  {
    slug: "acier-noir",
    products: [
      { name: "Tuyau acier noir", unit: "pi" },
      { name: "Coude 90° acier noir", fittingType: "coude 90" },
      { name: "Té acier noir", fittingType: "tee" },
    ],
  },
  {
    slug: "acier-galvanise",
    products: [
      { name: "Tuyau acier galvanisé", unit: "pi" },
      { name: "Coude 90° acier galvanisé", fittingType: "coude 90" },
      { name: "Té acier galvanisé", fittingType: "tee" },
    ],
  },
  {
    slug: "stainless",
    products: [
      { name: "Tuyau acier inox", unit: "pi" },
      { name: "Coude 90° acier inox", fittingType: "coude 90" },
    ],
  },
  {
    slug: "pex",
    products: [
      { name: "Tuyau PEX-A", unit: "pi" },
      { name: "Tuyau PEX-B", unit: "pi" },
      { name: "Coude PEX", fittingType: "coude 90" },
      { name: "Té PEX", fittingType: "tee" },
    ],
  },
  {
    slug: "propress",
    products: [
      { name: "Tuyau ProPress", unit: "pi" },
      { name: "Coude 90° ProPress", fittingType: "coude 90" },
      { name: "Té ProPress", fittingType: "tee" },
      { name: "Manchon ProPress", fittingType: "manchon" },
    ],
  },
  {
    slug: "megapress",
    products: [
      { name: "Tuyau MegaPress", unit: "pi" },
      { name: "Coude 90° MegaPress", fittingType: "coude 90" },
      { name: "Té MegaPress", fittingType: "tee" },
      { name: "Manchon MegaPress", fittingType: "manchon" },
    ],
  },
  {
    slug: "fittings-filetes",
    products: [
      { name: "Mamelon fileté", fittingType: "mamelon" },
      { name: "Coude 90° fileté", fittingType: "coude 90" },
      { name: "Té fileté", fittingType: "tee" },
      { name: "Bouchon fileté", fittingType: "bouchon" },
    ],
  },
  {
    slug: "fittings-mecaniques",
    products: [
      { name: "Raccord mécanique", fittingType: "raccord" },
      { name: "Manchon mécanique", fittingType: "manchon" },
    ],
  },
  {
    slug: "victaulic",
    products: [
      { name: "Coude Victaulic", fittingType: "coude 90" },
      { name: "Té Victaulic", fittingType: "tee" },
    ],
  },
  {
    slug: "valves",
    products: [
      { name: "Vanne à boisseau", fittingType: "vanne boisseau" },
      { name: "Vanne papillon", fittingType: "vanne papillon" },
      { name: "Clapet anti-retour", fittingType: "clapet" },
      { name: "Robinet-équerre", fittingType: "robinet" },
    ],
  },
  {
    slug: "clapets",
    products: [{ name: "Clapet anti-retour", fittingType: "clapet" }],
    diameters: BILLING_DIAMETERS_SMALL,
  },
  {
    slug: "regulateurs",
    products: [{ name: "Régulateur de pression", fittingType: "regulateur" }],
    diameters: BILLING_DIAMETERS_SMALL,
  },
  {
    slug: "drains",
    products: [
      { name: "Drain plancher", fittingType: "drain" },
      { name: "Drain garage", fittingType: "drain" },
    ],
    diameters: BILLING_DIAMETERS_SMALL,
  },
  {
    slug: "puisards",
    products: [{ name: "Puisard", fittingType: "puisard" }],
    diameters: ['2"', '3"', '4"'],
  },
  {
    slug: "supports",
    products: [
      { name: "Support tuyau", fittingType: "support" },
      { name: "Collerette", fittingType: "collerette" },
      { name: "Étrier", fittingType: "etrier" },
    ],
  },
  {
    slug: "isolants",
    products: [
      { name: "Isolant tuyau", unit: "pi" },
      { name: "Manchon isolant", fittingType: "manchon" },
    ],
  },
  {
    slug: "gaz-naturel",
    products: [
      { name: "Tuyau gaz CSST", unit: "pi" },
      { name: "Raccord gaz", fittingType: "raccord" },
    ],
    diameters: BILLING_DIAMETERS_SMALL,
  },
];

const FIXED_CATALOG_ITEMS: MaterialCatalogSeed[] = [
  { categorySlug: "pompes", name: "Pompe de puisard", unit: "unité" },
  { categorySlug: "pompes", name: "Pompe eau chaude", unit: "unité" },
  { categorySlug: "chauffe-eau", name: "Chauffe-eau 40 gal", unit: "unité" },
  { categorySlug: "chauffe-eau", name: "Chauffe-eau 60 gal", unit: "unité" },
  { categorySlug: "chauffe-eau", name: "Chauffe-eau 80 gal", unit: "unité" },
  { categorySlug: "chaudieres", name: "Chaudière murale", unit: "unité" },
  { categorySlug: "chaudieres", name: "Chaudière plancher", unit: "unité" },
  { categorySlug: "robinets", name: "Robinet d'arrêt", diameter: '3/8"', unit: "unité" },
  { categorySlug: "robinets", name: "Robinet d'arrêt", diameter: '1/2"', unit: "unité" },
  { categorySlug: "robinets", name: "Robinet cuisine", unit: "unité" },
  { categorySlug: "robinets", name: "Robinet salle de bain", unit: "unité" },
  { categorySlug: "robinets", name: "Robinet buanderie", unit: "unité" },
  { categorySlug: "toilettes", name: "Toilette standard", unit: "unité" },
  { categorySlug: "toilettes", name: "Toilette elongated", unit: "unité" },
  { categorySlug: "toilettes", name: "Toilette suspendue", unit: "unité" },
  { categorySlug: "lavabos", name: "Lavabo pédestal", unit: "unité" },
  { categorySlug: "lavabos", name: "Lavabo vanité", unit: "unité" },
  { categorySlug: "lavabos", name: "Lavabo mural", unit: "unité" },
  { categorySlug: "douches", name: "Base douche", unit: "unité" },
  { categorySlug: "douches", name: "Douche sans seuil", unit: "unité" },
  { categorySlug: "douches", name: "Colonne douche", unit: "unité" },
  { categorySlug: "accessoires", name: "Ruban téflon", unit: "unité" },
  { categorySlug: "accessoires", name: "Pâte à joint", unit: "unité" },
  { categorySlug: "accessoires", name: "Nettoyant tuyau", unit: "unité" },
  { categorySlug: "accessoires", name: "Flux soudure", unit: "unité" },
  { categorySlug: "accessoires", name: "Fil d'étanchéité", unit: "unité" },
  { categorySlug: "accessoires", name: "Cadenas vanne", unit: "unité" },
  { categorySlug: "accessoires", name: "Étiquette tuyau", unit: "unité" },
  { categorySlug: "accessoires", name: "Mastic silicone", unit: "unité" },
  { categorySlug: "accessoires", name: "Mousse isolante", unit: "unité" },
  { categorySlug: "accessoires", name: "Boulons support", unit: "unité" },
  { categorySlug: "divers", name: "Bac rétention", unit: "unité" },
  { categorySlug: "divers", name: "Flexible décharge", unit: "unité" },
  { categorySlug: "divers", name: "Flexible alimentation", unit: "unité" },
  { categorySlug: "divers", name: "Siphon", unit: "unité" },
  { categorySlug: "divers", name: "Bonde", unit: "unité" },
];

export function buildMaterialCatalogSeeds(): MaterialCatalogSeed[] {
  const items: MaterialCatalogSeed[] = [...FIXED_CATALOG_ITEMS];

  for (const def of PIPE_FITTING_DEFS) {
    const diameters = def.diameters ?? BILLING_DIAMETERS;
    for (const product of def.products) {
      for (const diameter of diameters) {
        items.push({
          categorySlug: def.slug,
          name: product.name,
          diameter,
          fittingType: product.fittingType,
          unit: product.unit ?? "unité",
        });
      }
    }
  }

  return items;
}

export const MATERIAL_CATALOG_SEEDS = buildMaterialCatalogSeeds();

export const MATERIAL_CATALOG_FAMILY_SLUGS = [
  "tuyau-cuivre",
  "fittings-cuivre",
  "pvc-dwv",
  "abs",
  "fonte",
  "acier-noir",
  "gaz-naturel",
  "pex",
  "propress",
  "megapress",
  "valves",
  "drains",
  "pompes",
  "chauffe-eau",
  "robinets",
  "toilettes",
  "lavabos",
  "douches",
  "supports",
  "accessoires",
] as const;
