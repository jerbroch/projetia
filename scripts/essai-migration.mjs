/**
 * Exécute un fichier SQL dans une transaction TOUJOURS ANNULÉE.
 * Le ROLLBACK est dans un `finally` : même une erreur inattendue ne peut pas
 * laisser la base modifiée.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

// Plusieurs fichiers : ils s'enchaînent dans UNE transaction, dans l'ordre
// donné. Une migration qui dépend de la précédente ne peut pas être éprouvée
// seule — l'annulation de la première effacerait ce dont la seconde a besoin.
const fichiers = process.argv.slice(2);
const sql = fichiers
  .map((f) =>
    readFileSync(f, "utf8")
      // Chaque fichier porte ses begin/commit ; on gère la transaction ici.
      .replace(/^\s*begin\s*;\s*$/gim, "")
      .replace(/^\s*commit\s*;\s*$/gim, "")
  )
  .join("\n");

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

/** Empreinte du schéma : relations, colonnes, politiques. */
async function empreinte() {
  const { rows } = await c.query(`
    select
      (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('r','v'))::int rel,
      (select count(*) from information_schema.columns where table_schema='public')::int col,
      (select count(*) from pg_policies where schemaname='public')::int pol`);
  return rows[0];
}
const avant = await empreinte();
console.log("cible :", process.env.SUPABASE_DB_URL.replace(/:[^:@]+@/, ":****@"));
console.log("fichiers :", fichiers.join(" → "), "\n");

let ok = false;
try {
  await c.query("BEGIN");
  await c.query(sql);
  ok = true;
  console.log("✓ le fichier passe au complet");

  const { rows: t } = await c.query(`
    SELECT relname, relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND relname IN
      ('quote_versions','quote_line_items','quote_line_versions',
       'job_hours_reconciliation','job_materials_reconciliation','job_reconciliation')
    ORDER BY relname`);
  console.log("\nobjets créés :");
  t.forEach((r) => console.log(`   ${r.relname.padEnd(30)} ${r.relkind === "r" ? "table" : "vue"}`));

  const { rows: p } = await c.query(`
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('quote_versions','quote_line_items','quote_line_versions')
    ORDER BY tablename, policyname`);
  console.log(`\npolitiques RLS : ${p.length}`);
  p.forEach((r) => console.log(`   ${r.tablename.padEnd(22)} ${r.cmd.padEnd(6)} ${r.policyname}`));
} catch (e) {
  console.log("✗ ÉCHEC");
  console.log("   message :", e.message);
  if (e.where) console.log("   où      :", String(e.where).split("\n")[0]);
  if (e.hint) console.log("   piste   :", e.hint);
} finally {
  await c.query("ROLLBACK");
  // On compare le schéma à ce qu'il était : nommer un objet en dur donnerait
  // un faux positif dès qu'une migration précédente a été appliquée pour vrai.
  const apres = await empreinte();
  const intact =
    avant.rel === apres.rel && avant.col === apres.col && avant.pol === apres.pol;
  console.log(
    `\nROLLBACK effectué — schéma ${intact ? "intact" : "MODIFIÉ (PROBLÈME)"} : ` +
    `${apres.rel} relations, ${apres.col} colonnes, ${apres.pol} politiques`);
  await c.end();
  process.exit(ok ? 0 : 1);
}
