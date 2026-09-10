/**
 * Applique un fichier SQL POUR VRAI. Le projet cible doit être nommé en
 * argument : une variable d'environnement mal chargée ne peut pas envoyer
 * la migration sur la mauvaise base sans qu'on s'en aperçoive.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const [fichier, refAttendue] = process.argv.slice(2);
const url = process.env.SUPABASE_DB_URL ?? "";
const ref = url.match(/postgres\.([a-z0-9]+):/)?.[1] ?? "?";
if (ref !== refAttendue) {
  console.error(`REFUS : cible « ${ref} », attendu « ${refAttendue} ». Rien n'est appliqué.`);
  process.exit(1);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log(`cible : ${ref}\nfichier : ${fichier}\n`);
try {
  await c.query(readFileSync(fichier, "utf8"));   // le fichier porte son begin/commit
  const { rows: o } = await c.query(`
    select relname, case relkind when 'r' then 'table' else 'vue' end k
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relname in
      ('quote_versions','quote_line_items','quote_line_versions',
       'job_hours_reconciliation','job_materials_reconciliation','job_reconciliation')
    order by relname`);
  const { rows: p } = await c.query(`select count(*)::int n from pg_policies where schemaname='public'
    and tablename in ('quote_versions','quote_line_items','quote_line_versions')`);
  const { rows: col } = await c.query(`select table_name||'.'||column_name c from information_schema.columns
    where table_schema='public' and (
      (table_name='field_hours' and column_name in ('quote_line_item_id','labor_rate_id')) or
      (table_name='field_materials' and column_name='quote_line_item_id') or
      (table_name='scheduled_jobs' and column_name='quote_version_id')) order by 1`);
  const { rows: fk } = await c.query(`select conname,
    case confdeltype when 'r' then 'RESTRICT' when 'n' then 'SET NULL' when 'c' then 'CASCADE'
         when 'a' then 'NO ACTION' end r
    from pg_constraint where contype='f' and (
      conname like 'quote_%company_id_fkey' or conname like '%labor_rate_id_fkey')
    and conrelid::regclass::text in ('quote_versions','quote_line_items','quote_line_versions','field_hours')
    order by conname`);

  console.log("APPLIQUÉ.\n");
  o.forEach(x => console.log(`  ${x.k.padEnd(6)} ${x.relname}`));
  console.log(`\n  ${p[0].n} politiques RLS`);
  console.log(`  colonnes ajoutées : ${col.map(x => x.c).join(", ")}`);
  console.log("\n  règles de suppression :");
  fk.forEach(x => console.log(`    ${x.conname.padEnd(40)} ${x.r}`));
} catch (e) {
  console.error("ÉCHEC :", e.message, "\nLe fichier est transactionnel : rien n'a été appliqué.");
  process.exitCode = 1;
} finally { await c.end(); }
