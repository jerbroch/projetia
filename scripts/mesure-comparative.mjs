/**
 * Avant/après, même méthode, plusieurs échantillons.
 * Une requête HTTP isolée par échantillon : un chargement de navigateur
 * mélange trente requêtes et masque le gain par requête.
 */
import pg from "pg";
import fs from "node:fs";

const PAGES = ["/schedule", "/quotes", "/invoices", "/customers", "/terrain"];
const ECHANTILLONS = 5;
const etiquette = process.argv[2] ?? "mesure";

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const compte = async () => (await db.query(
  `SELECT COALESCE(sum(calls),0)::int AS n FROM pg_stat_statements WHERE query NOT ILIKE '%pg_stat_statements%'`)).rows[0].n;

const etat = JSON.parse(fs.readFileSync("e2e/.auth/tenant.json", "utf8"));
const cookie = etat.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const mediane = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const resultat = {};
for (const chemin of PAGES) {
  // Une visite à blanc : on mesure une page chaude, pas le premier rendu.
  await fetch(`http://localhost:3000${chemin}`, { headers: { cookie }, redirect: "manual" }).then((r) => r.text());

  const temps = [], requetes = [];
  for (let i = 0; i < ECHANTILLONS; i++) {
    const avant = await compte();
    const t = Date.now();
    const r = await fetch(`http://localhost:3000${chemin}`, { headers: { cookie }, redirect: "manual" });
    await r.text();
    temps.push(Date.now() - t);
    requetes.push((await compte()) - avant);
  }
  resultat[chemin] = { ms: mediane(temps), sql: mediane(requetes) };
  console.log(`${chemin.padEnd(12)} ${String(mediane(temps)).padStart(5)} ms · ${String(mediane(requetes)).padStart(4)} requêtes SQL`);
}
fs.writeFileSync(`/tmp/perf-${etiquette}.json`, JSON.stringify(resultat, null, 2));
await db.end();
