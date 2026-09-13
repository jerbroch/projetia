/**
 * Compare les événements abonnés chez Stripe à ceux que le code traite.
 *
 * Le désalignement du 13 septembre 2026 ne faisait échouer RIEN : le webhook
 * répondait 200, les journaux étaient propres, et une annulation ne coupait
 * simplement jamais l'accès. C'est le genre de défaut qu'aucun test du code ne
 * peut voir, parce qu'il est dans un réglage, chez Stripe.
 *
 *   npm run verify:webhook            lit la clé de STRIPE_SECRET_KEY
 *   npm run verify:webhook -- --strict  sort en erreur si désaligné
 */
import { EVENEMENTS_WEBHOOK_TRAITES, comparerEvenements } from "../src/lib/billing/evenements-webhook.ts";

const strict = process.argv.includes("--strict");
const cle = process.env.STRIPE_SECRET_KEY;
if (!cle) {
  console.error("STRIPE_SECRET_KEY absente — impossible de vérifier.");
  process.exit(strict ? 1 : 0);
}
console.log(`Mode de la clé : ${cle.startsWith("sk_live") ? "LIVE" : "TEST"}\n`);

const r = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
  headers: { Authorization: `Bearer ${cle}` },
});
const j = await r.json();
if (j.error) {
  console.error("Stripe :", j.error.message);
  process.exit(1);
}
if (!j.data?.length) {
  console.error("Aucun point de terminaison webhook déclaré.");
  process.exit(strict ? 1 : 0);
}

let desaligne = false;
for (const w of j.data) {
  const ecart = comparerEvenements(w.enabled_events);
  console.log(`${w.url}  [${w.status}]`);
  console.log(`  ${w.enabled_events.length} abonné(s), ${EVENEMENTS_WEBHOOK_TRAITES.length} traité(s) par le code`);
  if (ecart.manquants.length) {
    desaligne = true;
    console.log("  ✗ ATTENDUS, JAMAIS ENVOYÉS — le code ne les verra jamais :");
    ecart.manquants.forEach((e) => console.log(`      ${e}`));
  }
  if (ecart.superflus.length) {
    desaligne = true;
    console.log("  ✗ ENVOYÉS POUR RIEN — ignorés par le `default` :");
    ecart.superflus.forEach((e) => console.log(`      ${e}`));
  }
  if (ecart.aligne) console.log("  ✓ aligné");
  console.log();
}
if (desaligne && strict) process.exit(1);
