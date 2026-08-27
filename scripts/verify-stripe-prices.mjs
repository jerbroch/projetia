#!/usr/bin/env node
/**
 * Vérifie que ce que la page ANNONCE correspond à ce que Stripe FACTURE.
 *
 * Interroge les 8 Stripe Price IDs et compare montant, devise, cycle et mode
 * (test/live) à src/lib/billing/tiers.ts. Sort en erreur au moindre écart.
 *
 *   npm run verify:prices             # ignore si Stripe non configuré
 *   npm run verify:prices -- --strict  # exige la configuration
 *
 * Loads .env.local via dotenv (devDependency).
 */
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });

const strict = process.argv.includes("--strict");
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  const message =
    "STRIPE_SECRET_KEY absente — impossible de vérifier les prix chez Stripe.";
  if (strict) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.warn(`⚠ ${message}`);
  console.warn("  Les montants affichés ne sont donc PAS vérifiés contre Stripe.");
  console.warn("  Lancez-le avec vos clés avant chaque mise en ligne d'un tarif.");
  process.exit(0);
}

// price-audit.ts est en TypeScript : ce script se lance via tsx (npm run verify:prices).
const { expectedPricesFromConfig, auditPrice, summarizeAudit } = await import(
  "../src/lib/billing/price-audit.ts"
);

const keyLivemode = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });

console.log("=== Vérification des prix Stripe ===");
console.log(`Mode de la clé API : ${keyLivemode ? "LIVE" : "TEST"}\n`);

const expectations = expectedPricesFromConfig();
const rows = [];

for (const expected of expectations) {
  let actual = null;

  if (expected.priceId) {
    try {
      const price = await stripe.prices.retrieve(expected.priceId);
      actual = {
        id: price.id,
        active: price.active,
        currency: price.currency,
        unitAmount: price.unit_amount,
        type: price.type,
        interval: price.recurring?.interval ?? null,
        intervalCount: price.recurring?.interval_count ?? null,
        livemode: price.livemode,
      };
    } catch (err) {
      // "No such price" → traité comme introuvable par l'audit.
      if (err?.statusCode === 404 || err?.code === "resource_missing") {
        actual = null;
      } else if (err?.type === "StripeAuthenticationError") {
        console.error("\n❌ Clé Stripe refusée. Vérifiez STRIPE_SECRET_KEY.");
        process.exit(1);
      } else {
        console.error(`\n❌ Impossible de joindre Stripe : ${err?.message ?? err}`);
        console.error("   Vérifiez votre connexion et réessayez.");
        process.exit(1);
      }
    }
  }

  rows.push({ expected, issues: auditPrice(expected, actual, { keyLivemode }) });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad("PALIER", 14)}${pad("CYCLE", 9)}${pad("ANNONCÉ", 14)}${pad("FACTURÉ", 14)}ÉTAT`,
);
console.log("-".repeat(62));

for (const { expected, issues } of rows) {
  const annonce = `${(expected.expectedCents / 100).toFixed(2)} ${expected.expectedCurrency.toUpperCase()}`;
  const facture = issues.some((i) => i.code === "missing_env" || i.code === "not_found")
    ? "—"
    : annonce;
  console.log(
    `${pad(expected.tierName, 14)}${pad(expected.cycle, 9)}${pad(annonce, 14)}${pad(
      issues.length ? "?" : facture,
      14,
    )}${issues.length ? "✗" : "✓"}`,
  );
  for (const issue of issues) console.log(`               → ${issue.message}`);
}

const summary = summarizeAudit(rows);
console.log("-".repeat(62));

if (!summary.ok) {
  console.error(
    `\n❌ ${summary.failed} prix sur ${summary.total} ne correspondent pas à la configuration.`,
  );
  console.error("   La page annoncerait un montant et le client en paierait un autre.");
  process.exit(1);
}

console.log(`\n✓ Les ${summary.total} prix concordent avec src/lib/billing/tiers.ts`);
