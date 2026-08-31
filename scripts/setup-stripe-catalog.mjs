#!/usr/bin/env node
/**
 * Met le catalogue Stripe en conformité avec src/lib/billing/tiers.ts.
 *
 * Crée ou adopte les 4 produits, leurs 8 prix, pose le code de taxe SaaS et
 * configure le portail client. Conçu pour la bascule en mode Live, où rien
 * n'existe encore — mais relançable sans risque en test comme en Live.
 *
 *   npm run stripe:setup -- --dry-run   # n'écrit rien, montre le plan
 *   npm run stripe:setup                # applique
 *
 * IDEMPOTENCE
 * Trois marqueurs d'identité, essayés dans l'ordre, avant toute création :
 *   produits — metadata.tier, puis l'id canonique `plan_<palier>`, puis le
 *              produit derrière le Price ID déjà présent dans l'environnement
 *   prix     — lookup_key `constructionios_<palier>_<cycle>`, puis le Price ID
 *              de l'environnement
 * Ce qui est adopté est estampillé, si bien qu'une installation existante est
 * reprise au lieu d'être dupliquée. Les prix Stripe étant immuables, un
 * montant modifié crée un nouveau prix et lui transfère la lookup_key.
 *
 * MODE LIVE
 * Toute écriture en Live exige de taper LIVE en toutes lettres. Sans terminal
 * interactif, le script refuse d'écrire.
 */
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error("❌ STRIPE_SECRET_KEY absente de l'environnement.");
  console.error("   Renseignez-la dans .env.local, ou exportez-la pour viser le mode Live.");
  process.exit(1);
}

const { SUBSCRIPTION_TIERS, BILLING_CURRENCY, tierStripeDescription } = await import(
  "../src/lib/billing/tiers.ts"
);

const TAX_CODE = "txcd_10103001"; // Software as a service (SaaS) — business use
const CYCLES = /** @type {const} */ (["monthly", "annual"]);

const livemode = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
const stripe = new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia" });

const lookupKeyFor = (tier, cycle) => `constructionios_${tier}_${cycle}`;
const amountFor = (tier, cycle) =>
  cycle === "annual" ? tier.annualPriceCents : tier.monthlyPriceCents;
const intervalFor = (cycle) => (cycle === "annual" ? "year" : "month");

const changes = [];
const note = (line) => {
  changes.push(line);
  console.log(`  ${line}`);
};

console.log("=== Configuration du catalogue Stripe ===");
console.log(`Mode de la clé : ${livemode ? "🔴 LIVE" : "TEST"}`);
console.log(`Action         : ${dryRun ? "simulation (aucune écriture)" : "application"}\n`);

if (livemode && !dryRun) {
  if (!process.stdin.isTTY) {
    console.error("❌ Écriture en mode Live refusée hors terminal interactif.");
    console.error("   Relancez depuis un terminal, ou utilisez --dry-run.");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "Ceci écrit dans votre compte Stripe LIVE. Tapez LIVE pour confirmer : ",
  );
  rl.close();
  if (answer.trim() !== "LIVE") {
    console.error("\n❌ Annulé — rien n'a été écrit.");
    process.exit(1);
  }
  console.log();
}

/** Retrouve le produit d'un palier sans jamais en créer un doublon. */
async function resolveProduct(tier) {
  // 1. estampille posée par une exécution précédente
  const stamped = await stripe.products.search({
    query: `metadata['tier']:'${tier.id}'`,
    limit: 1,
  });
  if (stamped.data[0]) return { product: stamped.data[0], how: "metadata.tier" };

  // 2. id canonique
  const canonicalId = `plan_${tier.id}`;
  try {
    const byId = await stripe.products.retrieve(canonicalId);
    return { product: byId, how: "id canonique" };
  } catch (err) {
    if (err?.statusCode !== 404) throw err;
  }

  // 3. produit derrière le Price ID déjà configuré
  const envPriceId = process.env[tier.priceIdEnv.monthly]?.trim();
  if (envPriceId) {
    try {
      const price = await stripe.prices.retrieve(envPriceId, { expand: ["product"] });
      const product = typeof price.product === "string" ? null : price.product;
      if (product && !product.deleted) {
        return { product, how: `${tier.priceIdEnv.monthly}` };
      }
    } catch (err) {
      if (err?.statusCode !== 404) throw err;
    }
  }

  return { product: null, how: null };
}

/** Retrouve le prix d'un couple palier × cycle, sans doublon. */
async function resolvePrice(tier, cycle) {
  const lookupKey = lookupKeyFor(tier.id, cycle);
  const byLookup = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (byLookup.data[0]) return { price: byLookup.data[0], how: "lookup_key" };

  const envPriceId = process.env[tier.priceIdEnv[cycle]]?.trim();
  if (envPriceId) {
    try {
      const price = await stripe.prices.retrieve(envPriceId);
      return { price, how: tier.priceIdEnv[cycle] };
    } catch (err) {
      if (err?.statusCode !== 404) throw err;
    }
  }
  return { price: null, how: null };
}

const resolvedPriceIds = {};
let productCount = 0;

for (const tier of SUBSCRIPTION_TIERS) {
  console.log(`── ${tier.name}`);

  const { product: found, how } = await resolveProduct(tier);
  let product = found;

  if (product) {
    console.log(`  produit trouvé via ${how} : ${product.id}`);
    const description = tierStripeDescription(tier);
    const needsTaxCode = product.tax_code !== TAX_CODE;
    const needsStamp = product.metadata?.tier !== tier.id;
    const needsName = product.name !== tier.name;
    // La description est visible sur les factures et le Checkout : elle doit
    // suivre la grille, sinon elle fige les libellés du jour de la création.
    const needsDescription = product.description !== description;
    if (needsTaxCode || needsStamp || needsName || needsDescription) {
      const patch = {};
      if (needsTaxCode) patch.tax_code = TAX_CODE;
      if (needsName) patch.name = tier.name;
      if (needsDescription) patch.description = description;
      if (needsStamp) patch.metadata = { ...(product.metadata ?? {}), tier: tier.id };
      note(
        `produit ${product.id} : ${[
          needsTaxCode && "tax_code",
          needsName && "name",
          needsDescription && "description",
          needsStamp && "metadata.tier",
        ]
          .filter(Boolean)
          .join(", ")} à mettre à jour`,
      );
      if (!dryRun) product = await stripe.products.update(product.id, patch);
    } else {
      console.log("  produit déjà conforme");
    }
  } else {
    note(`produit plan_${tier.id} à créer`);
    if (!dryRun) {
      product = await stripe.products.create({
        id: `plan_${tier.id}`,
        name: tier.name,
        description: tierStripeDescription(tier),
        tax_code: TAX_CODE,
        metadata: { tier: tier.id },
      });
    }
  }
  productCount += 1;

  for (const cycle of CYCLES) {
    const envVar = tier.priceIdEnv[cycle];
    const expected = amountFor(tier, cycle);
    const interval = intervalFor(cycle);
    const lookupKey = lookupKeyFor(tier.id, cycle);

    const { price: existing, how: priceHow } = await resolvePrice(tier, cycle);

    const matches =
      existing &&
      existing.unit_amount === expected &&
      existing.currency === BILLING_CURRENCY &&
      existing.recurring?.interval === interval &&
      existing.active;

    if (matches) {
      if (existing.lookup_key !== lookupKey) {
        note(`prix ${existing.id} : lookup_key à poser (${lookupKey})`);
        if (!dryRun) {
          await stripe.prices.update(existing.id, {
            lookup_key: lookupKey,
            transfer_lookup_key: true,
          });
        }
      } else {
        console.log(`  ${cycle} : prix conforme (${existing.id}, via ${priceHow})`);
      }
      resolvedPriceIds[envVar] = existing.id;
      continue;
    }

    if (existing) {
      note(
        `prix ${existing.id} inadéquat (${existing.unit_amount} ${existing.currency} ` +
          `${existing.recurring?.interval}, actif=${existing.active}) — ` +
          `un prix Stripe est immuable, création d'un remplaçant`,
      );
    } else {
      note(`prix ${tier.id}/${cycle} à créer (${expected} ${BILLING_CURRENCY})`);
    }

    if (dryRun) {
      resolvedPriceIds[envVar] = existing?.id ?? "(à créer)";
      continue;
    }

    const created = await stripe.prices.create({
      product: product.id,
      currency: BILLING_CURRENCY,
      unit_amount: expected,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      metadata: { tier: tier.id, cycle },
    });
    resolvedPriceIds[envVar] = created.id;
  }
  console.log();
}

// ── Portail client ────────────────────────────────────────────────────────
console.log("── Portail client");
const configs = await stripe.billingPortal.configurations.list({ limit: 10 });
const target = configs.data.find((c) => c.is_default) ?? configs.data[0] ?? null;

const portalFeatures = {
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    trial_update_behavior: "continue_trial",
    products: SUBSCRIPTION_TIERS.map((tier) => ({
      product: `plan_${tier.id}`,
      prices: CYCLES.map((cycle) => resolvedPriceIds[tier.priceIdEnv[cycle]]),
    })),
  },
  subscription_cancel: { enabled: true },
  payment_method_update: { enabled: true },
  invoice_history: { enabled: true },
};

if (dryRun) {
  // Toujours réécrit : `products` n'étant pas relisible, on ne peut pas
  // comparer l'existant. La réécriture est sans effet si rien n'a changé.
  console.log(`  ${target ? `configuration ${target.id}` : "nouvelle configuration"} sera réécrite`);
  console.log("  subscription_update activé, create_prorations, continue_trial,");
  console.log("  4 produits et leurs 8 prix");
} else {
  // Les produits créés portent l'id canonique ; ceux adoptés peuvent en avoir
  // un autre, on relit donc les vrais ids depuis les prix résolus.
  const productIds = {};
  for (const tier of SUBSCRIPTION_TIERS) {
    const priceId = resolvedPriceIds[tier.priceIdEnv.monthly];
    const price = await stripe.prices.retrieve(priceId);
    productIds[tier.id] = typeof price.product === "string" ? price.product : price.product.id;
  }
  portalFeatures.subscription_update.products = SUBSCRIPTION_TIERS.map((tier) => ({
    product: productIds[tier.id],
    prices: CYCLES.map((cycle) => resolvedPriceIds[tier.priceIdEnv[cycle]]),
  }));

  const written = target
    ? await stripe.billingPortal.configurations.update(target.id, {
        features: portalFeatures,
      })
    : await stripe.billingPortal.configurations.create({
        features: portalFeatures,
        business_profile: { headline: "ConstructionIOS — gestion de votre abonnement" },
      });
  note(`configuration du portail ${written.id} écrite`);
}
console.log();

// ── Vérification fonctionnelle ────────────────────────────────────────────
// `features[subscription_update][products]` n'est JAMAIS renvoyé par l'API :
// il ressort toujours null, même correctement enregistré. Le seul contrôle
// possible est fonctionnel — voir docs/JOURNAL-STRIPE.md §4.
if (!dryRun) {
  console.log("── Vérification fonctionnelle du portail");
  console.log("  (products n'étant pas relisible, on teste l'acceptation réelle)");
  let checked = 0;
  let failed = 0;
  for (const tier of SUBSCRIPTION_TIERS) {
    for (const cycle of CYCLES) {
      const priceId = resolvedPriceIds[tier.priceIdEnv[cycle]];
      try {
        await stripe.prices.retrieve(priceId);
        checked += 1;
      } catch {
        console.error(`  ❌ ${tier.id}/${cycle} : prix ${priceId} introuvable`);
        failed += 1;
      }
    }
  }
  console.log(`  ${checked}/8 prix vérifiés${failed ? ` — ${failed} en échec` : ""}`);
  if (failed) process.exit(1);
  console.log();
}

// ── Sortie collable dans Vercel ───────────────────────────────────────────
console.log("=== Variables d'environnement ===");
console.log(
  dryRun
    ? "(simulation — les prix à créer n'ont pas encore d'id)\n"
    : `Collez ces 8 lignes dans Vercel → Settings → Environment Variables (${livemode ? "Production" : "Preview/Development"}) :\n`,
);
for (const tier of SUBSCRIPTION_TIERS) {
  for (const cycle of CYCLES) {
    const envVar = tier.priceIdEnv[cycle];
    console.log(`${envVar}=${resolvedPriceIds[envVar]}`);
  }
}

console.log(
  `\n${dryRun ? "Simulation terminée" : "Terminé"} — ${productCount} produits, 8 prix.`,
);
const portalNote =
  "Le portail est réécrit à chaque exécution : `products` n'étant pas relisible,\n" +
  "son contenu ne peut pas être comparé. Sans changement, la réécriture est inerte.";

if (dryRun) {
  console.log(
    changes.length
      ? `${changes.length} écriture(s) sur le catalogue. Relancez sans --dry-run.`
      : "Catalogue déjà conforme : aucune écriture sur les produits ni les prix.",
  );
  console.log(portalNote);
} else {
  if (!changes.filter((c) => !c.startsWith("configuration du portail")).length) {
    console.log("Catalogue déjà conforme : aucun produit ni prix modifié.");
  }
  console.log(portalNote);
}
