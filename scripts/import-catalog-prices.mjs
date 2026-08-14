#!/usr/bin/env node
/**
 * Import reference catalog prices from CSV into company_catalog_prices.
 *
 * Usage:
 *   node scripts/import-catalog-prices.mjs <company_id> <csv_file>
 *
 * CSV format (header required):
 *   sku,name,diameter,reference_price,source_url
 *   ,Coude 90° cuivre,3/4",12.50,https://example.com/product/123
 *
 * custom_price rows with manually_overridden=TRUE are never overwritten.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const companyId = process.argv[2];
const csvPath = process.argv[3];

if (!companyId || !csvPath) {
  console.error("Usage: node scripts/import-catalog-prices.mjs <company_id> <csv_file>");
  process.exit(1);
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.every((c) => !c)) continue;

    const referencePrice = parseFloat(
      cols[idx("reference_price")] ?? cols[idx("prix_reference")] ?? cols[idx("price")] ?? "0"
    );
    if (!referencePrice || Number.isNaN(referencePrice)) continue;

    rows.push({
      sku: cols[idx("sku")] || undefined,
      name: cols[idx("name")] ?? cols[idx("nom")] ?? "",
      diameter: cols[idx("diameter")] ?? cols[idx("diametre")] ?? undefined,
      referencePrice,
      sourceUrl: cols[idx("source_url")] ?? cols[idx("url")] ?? undefined,
    });
  }
  return rows.filter((r) => r.name);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const csvContent = readFileSync(csvPath, "utf8");
const rows = parseCsv(csvContent);

console.log(`Importing ${rows.length} price row(s) for company ${companyId}…`);

let imported = 0;
let skipped = 0;
const errors = [];

for (const [index, row] of rows.entries()) {
  let query = admin
    .from("material_catalog_items")
    .select("id")
    .eq("name", row.name)
    .or("company_id.is.null");

  if (row.diameter) query = query.eq("diameter", row.diameter);

  const { data: items, error: findError } = await query.limit(5);
  if (findError) {
    errors.push(`Ligne ${index + 2}: ${findError.message}`);
    continue;
  }
  if (!items?.length) {
    errors.push(`Ligne ${index + 2}: article « ${row.name} » introuvable`);
    continue;
  }
  if (items.length > 1 && !row.diameter) {
    errors.push(`Ligne ${index + 2}: « ${row.name} » — précisez le diamètre`);
    continue;
  }

  const catalogItemId = items[0].id;
  const { data: existing } = await admin
    .from("company_catalog_prices")
    .select("*")
    .eq("company_id", companyId)
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (existing?.manually_overridden) {
    skipped++;
    continue;
  }

  if (existing) {
    const { error } = await admin
      .from("company_catalog_prices")
      .update({
        reference_price: row.referencePrice,
        price_source: row.sourceUrl ?? existing.price_source,
      })
      .eq("id", existing.id);
    if (error) errors.push(`Ligne ${index + 2}: ${error.message}`);
    else imported++;
  } else {
    const { error } = await admin.from("company_catalog_prices").insert({
      company_id: companyId,
      catalog_item_id: catalogItemId,
      reference_price: row.referencePrice,
      price_source: row.sourceUrl ?? null,
      manually_overridden: false,
    });
    if (error) errors.push(`Ligne ${index + 2}: ${error.message}`);
    else imported++;
  }
}

console.log(`Done: ${imported} imported, ${skipped} skipped (manual override)`);
if (errors.length) {
  console.log("Errors:");
  for (const e of errors) console.log(" -", e);
}
