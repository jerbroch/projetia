#!/usr/bin/env node
/**
 * Rattrape dans `platform_invoices` toutes les factures d'abonnement déjà
 * émises chez Stripe.
 *
 *   npm run invoices:backfill -- --dry-run   # n'écrit rien, montre le compte
 *   npm run invoices:backfill                # applique
 *
 * Sert deux usages :
 *   — la reprise initiale, pour que l'historique antérieur au webhook existe ;
 *   — la réconciliation, ensuite : relancé périodiquement, il rattrape les
 *     factures dont le webhook s'est perdu. L'upsert sur l'id Stripe rend
 *     l'opération idempotente, donc relançable sans précaution.
 *
 * Stripe reste la source de vérité : ce script ne recalcule rien, il recopie.
 */
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error("❌ STRIPE_SECRET_KEY absente.");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const { taxRateIdsOf, toInvoiceRecord, companyIdOf } = await import(
  "../src/lib/billing/invoice-record.ts"
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ Configuration Supabase absente.");
  process.exit(1);
}

const livemode = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
const stripe = new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia" });
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== Rattrapage des factures d'abonnement ===");
console.log(`Mode de la clé : ${livemode ? "🔴 LIVE" : "TEST"}`);
console.log(`Base           : ${url.replace(/https:\/\/([a-z0-9]{6}).*/, "$1…")}`);
console.log(`Action         : ${dryRun ? "simulation" : "application"}\n`);

// Cache des natures de taxe : quelques taux pour des centaines de factures.
const typesConnus = new Map();
async function resolveTypes(ids) {
  const lookup = {};
  for (const id of ids) {
    if (!typesConnus.has(id)) {
      try {
        const taux = await stripe.taxRates.retrieve(id);
        typesConnus.set(id, taux.tax_type ?? undefined);
      } catch {
        typesConnus.set(id, undefined);
      }
    }
    lookup[id] = typesConnus.get(id);
  }
  return lookup;
}

let vues = 0;
let ecrites = 0;
let sansEntreprise = 0;
const echecs = [];
const parStatut = {};

// `autoPagingEach` suit la pagination : un rattrapage sur trois ans peut
// dépasser largement les 100 factures d'une page.
for await (const invoice of stripe.invoices.list({ limit: 100 })) {
  vues += 1;
  parStatut[invoice.status ?? "?"] = (parStatut[invoice.status ?? "?"] ?? 0) + 1;

  const types = await resolveTypes(taxRateIdsOf(invoice));
  const record = toInvoiceRecord(invoice, types);
  if (!record) continue;

  // Même détachement que dans recordPlatformInvoice : une entreprise absente
  // ne doit pas faire perdre la facture. Les deux voies doivent produire la
  // même ligne, sinon la réconciliation signalerait de faux écarts.
  if (record.company_id) {
    const { data: entreprise } = await admin
      .from("companies")
      .select("id")
      .eq("id", record.company_id)
      .maybeSingle();
    if (!entreprise) record.company_id = null;
  }
  if (!record.company_id) sansEntreprise += 1;

  if (dryRun) {
    ecrites += 1;
    continue;
  }

  const { error } = await admin
    .from("platform_invoices")
    .upsert(record, { onConflict: "id" });

  if (error) echecs.push(`${record.id} — ${error.message}`);
  else ecrites += 1;
}

console.log(`Factures parcourues chez Stripe : ${vues}`);
console.log(`Par statut : ${Object.entries(parStatut).map(([s, n]) => `${s}=${n}`).join(", ") || "—"}`);
console.log(`${dryRun ? "Seraient écrites" : "Écrites"} : ${ecrites}`);

if (sansEntreprise) {
  console.log(
    `\n⚠ ${sansEntreprise} facture(s) sans entreprise rattachée — métadonnées\n` +
      "  absentes, typiquement des factures antérieures à leur pose. Elles sont\n" +
      "  enregistrées quand même : un revenu orphelin vaut mieux qu'un revenu perdu.",
  );
}

if (echecs.length) {
  console.error(`\n❌ ${echecs.length} échec(s) :`);
  for (const e of echecs.slice(0, 10)) console.error(`   ${e}`);
  process.exit(1);
}

if (!dryRun) {
  const { count } = await admin
    .from("platform_invoices")
    .select("*", { count: "exact", head: true });
  console.log(`\nTotal dans platform_invoices : ${count}`);
}

console.log(`\n${dryRun ? "Simulation terminée." : "Terminé."}`);
