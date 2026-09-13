/**
 * REMET UNE ENTREPRISE EN ACCÈS BÊTA, APRÈS UN PAIEMENT DE TEST.
 *
 * Passer à la caisse écrase l'accès bêta : `access_type` devient `monthly` et
 * `is_beta` passe à faux. Annuler l'abonnement ensuite met `subscription_status`
 * à `cancelled` — et l'entreprise se retrouve à la porte de son propre compte,
 * renvoyée vers /choose-plan.
 *
 * POURQUOI CE SCRIPT EXISTE. Le 13 septembre 2026, le ménage s'est fait en deux
 * temps : une première requête a rendu l'accès, mais a laissé trois champs
 * derrière elle — `subscription_price_id`, `subscription_current_period_end` et
 * `pending_plan`. L'écran des réglages en tirait « Prochain renouvellement :
 * 13 octobre 2026 » pour un compte bêta sans aucun abonnement. Rien n'échouait ;
 * l'écran mentait. Tout est ici désormais, en un seul passage.
 *
 * CE QUI N'EST PAS TOUCHÉ, ET POURQUOI :
 *   stripe_customer_id       le client Stripe resservira au prochain abonnement
 *   trial_ends_at            un fait d'historique ; l'effacer réécrirait le passé
 *   subscription_started_at  idem — la date du PREMIER abonnement, antérieure
 *                            au paiement de test. L'essai à blanc l'a attrapée :
 *                            une première version la remettait à zéro.
 *   company_subscriptions    la trace du paiement de test est véridique et reste
 *
 * Usage :
 *   node --env-file=.env.local scripts/remettre-acces-beta.mjs <companyId>
 *   node --env-file=.env.local scripts/remettre-acces-beta.mjs <companyId> --essai
 *
 * `--essai` montre ce qui changerait sans rien écrire.
 */
import pg from "pg";

const PROJET_ATTENDU = "dxobukushgxuciqhgrpf";

const args = process.argv.slice(2);
const essai = args.includes("--essai");
const companyId = args.find((a) => !a.startsWith("--"));

if (!companyId) {
  console.error("Usage : node --env-file=.env.local scripts/remettre-acces-beta.mjs <companyId> [--essai]");
  process.exit(1);
}
if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
  console.error(`« ${companyId} » n'est pas un identifiant d'entreprise.`);
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL ?? "";
const ref = url.match(/postgres\.([a-z0-9]+):/)?.[1] ?? "?";
if (ref !== PROJET_ATTENDU) {
  console.error(`REFUS : cible « ${ref} », attendu « ${PROJET_ATTENDU} ». Rien n'est modifié.`);
  process.exit(1);
}

/** Tout ce que le passage à la caisse a pu poser, en un seul endroit. */
const REMISE_A_ZERO = {
  subscription_status: "active",
  access_type: "beta",
  is_beta: true,
  requires_access_choice: false,
  subscription_tier: null,
  subscription_plan: null,
  subscription_price_id: null,
  subscription_current_period_end: null,
  subscription_cancel_at_period_end: false,
  subscription_ends_at: null,
  stripe_subscription_id: null,
  pending_plan: null,
  plan_name: null,
};

const CHAMPS = [
  "name",
  ...Object.keys(REMISE_A_ZERO),
  "stripe_customer_id",
  "trial_ends_at",
].join(", ");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const avant = (await c.query(`select ${CHAMPS} from companies where id = $1`, [companyId])).rows[0];
if (!avant) {
  console.error("Entreprise introuvable. Rien n'est modifié.");
  await c.end();
  process.exit(1);
}

console.log(`── ${avant.name} ──${essai ? "   (ESSAI : rien ne sera écrit)" : ""}\n`);
console.log("AVANT :");
for (const [k, v] of Object.entries(avant)) {
  console.log(`  ${k.padEnd(36)} ${v === null ? "null" : v}`);
}

const colonnes = Object.keys(REMISE_A_ZERO);
const affectations = colonnes.map((col, i) => `${col} = $${i + 2}`).join(",\n         ");
const valeurs = colonnes.map((col) => REMISE_A_ZERO[col]);

if (essai) {
  console.log("\nCE QUI CHANGERAIT :");
  for (const col of colonnes) {
    const cible = REMISE_A_ZERO[col];
    if (String(avant[col]) !== String(cible)) {
      console.log(`  ${col.padEnd(36)} ${avant[col] === null ? "null" : avant[col]}  →  ${cible === null ? "null" : cible}`);
    }
  }
  await c.end();
  process.exit(0);
}

const { rowCount } = await c.query(
  `update companies set ${affectations} where id = $1`,
  [companyId, ...valeurs],
);
console.log(`\nlignes modifiées : ${rowCount}`);

const apres = (await c.query(`select ${CHAMPS} from companies where id = $1`, [companyId])).rows[0];
console.log("\nAPRÈS :");
for (const [k, v] of Object.entries(apres)) {
  const marque = String(avant[k]) !== String(v) ? "   ← changé" : "";
  console.log(`  ${k.padEnd(36)} ${v === null ? "null" : v}${marque}`);
}

const { rows: cs } = await c.query(
  `select plan_name, plan_amount_cents, status from company_subscriptions where company_id = $1`,
  [companyId],
);
console.log("\ncompany_subscriptions, intacte :", cs.length ? JSON.stringify(cs) : "aucune ligne");

await c.end();
