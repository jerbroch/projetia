/** Éprouve les règles de la migration 001, dans une transaction TOUJOURS annulée. */
import { readFileSync } from "node:fs";
import pg from "pg";

const sql = readFileSync("supabase/migrations/045_quote_versioning.sql", "utf8")
  .replace(/^\s*begin\s*;\s*$/gim, "").replace(/^\s*commit\s*;\s*$/gim, "");

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const cas = [];
async function doitPasser(nom, q, p) {
  try { await c.query("SAVEPOINT s"); await c.query(q, p); await c.query("RELEASE SAVEPOINT s");
        cas.push([true, nom, "accepté"]); }
  catch (e) { await c.query("ROLLBACK TO SAVEPOINT s"); cas.push([false, nom, "REFUSÉ : " + e.message]); }
}
async function doitEchouer(nom, q, p) {
  try { await c.query("SAVEPOINT s"); await c.query(q, p); await c.query("RELEASE SAVEPOINT s");
        cas.push([false, nom, "ACCEPTÉ alors qu'il fallait refuser"]); }
  catch (e) { await c.query("ROLLBACK TO SAVEPOINT s");
              cas.push([true, nom, "refusé : " + e.message.slice(0, 70)]); }
}

try {
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("SET LOCAL row_security = off");   // on éprouve les triggers, pas la RLS

  const { rows: [q] } = await c.query(
    `select id, company_id from quotes order by created_at desc limit 1`);
  if (!q) throw new Error("aucune soumission dans la base d'essai");

  const { rows: [v] } = await c.query(
    `insert into quote_versions (quote_id, company_id, version_number)
     values ($1,$2,999) returning id`, [q.id, q.company_id]);
  const { rows: [li] } = await c.query(
    `insert into quote_line_items (quote_id, company_id) values ($1,$2) returning id`,
    [q.id, q.company_id]);
  const { rows: [lv] } = await c.query(
    `insert into quote_line_versions (quote_line_item_id, quote_version_id, company_id, description)
     values ($1,$2,$3,'Drain de fondation') returning id`, [li.id, v.id, q.company_id]);

  console.log("— version en 'draft' —");
  await doitPasser("modifier une ligne",  `update quote_line_versions set unit_price=120 where id=$1`, [lv.id]);
  await doitPasser("SUPPRIMER une ligne", `delete from quote_line_versions where id=$1`, [lv.id]);
  await c.query(`insert into quote_line_versions (id, quote_line_item_id, quote_version_id, company_id, description)
                 values ($1,$2,$3,$4,'Drain de fondation')`, [lv.id, li.id, v.id, q.company_id]);

  console.log("— transitions de statut —");
  await doitEchouer("draft -> sent (saute finalizing)", `update quote_versions set status='sent' where id=$1`, [v.id]);
  await doitPasser ("draft -> finalizing",              `update quote_versions set status='finalizing' where id=$1`, [v.id]);

  console.log("— version en 'finalizing' —");
  await doitEchouer("supprimer une ligne", `delete from quote_line_versions where id=$1`, [lv.id]);
  await doitEchouer("modifier une ligne",  `update quote_line_versions set unit_price=200 where id=$1`, [lv.id]);
  await doitEchouer("ajouter une ligne",
    `insert into quote_line_versions (quote_line_item_id, quote_version_id, company_id, description)
     values ($1,$2,$3,'Ajout tardif')`, [li.id, v.id, q.company_id]);
  await doitEchouer("changer version_number", `update quote_versions set version_number=998 where id=$1`, [v.id]);
  await doitEchouer("finalizing -> sent sans preuve", `update quote_versions set status='sent' where id=$1`, [v.id]);
  await doitPasser ("écrire la preuve pendant finalizing",
    `update quote_versions set content_hash='abc', canonicalization_algo='RFC8785',
       content_schema_version='1', render_context='{}'::jsonb where id=$1`, [v.id]);
  await doitPasser ("finalizing -> sent avec preuve", `update quote_versions set status='sent' where id=$1`, [v.id]);

  console.log("— version 'sent' —");
  const { rows: [s] } = await c.query(`select sent_at, locked_at from quote_versions where id=$1`, [v.id]);
  cas.push([!!s.sent_at && !!s.locked_at, "sent_at et locked_at posés d'office", `${!!s.sent_at} / ${!!s.locked_at}`]);
  await doitEchouer("sent -> draft",   `update quote_versions set status='draft' where id=$1`, [v.id]);
  await doitEchouer("modifier la preuve", `update quote_versions set content_hash='falsifié' where id=$1`, [v.id]);
  await doitPasser ("sent -> accepted", `update quote_versions set status='accepted' where id=$1`, [v.id]);

  console.log("\n══ RÉSULTATS ══");
  cas.forEach(([ok, nom, d]) => console.log(`${ok ? "✓" : "✗"} ${nom.padEnd(42)} ${d}`));
  const echecs = cas.filter(([ok]) => !ok).length;
  console.log(`\n${cas.length - echecs}/${cas.length} conformes${echecs ? ` — ${echecs} ÉCHEC(S)` : ""}`);
} catch (e) {
  console.log("✗ erreur :", e.message);
} finally {
  await c.query("ROLLBACK");
  const { rows } = await c.query(`select count(*)::int n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname='quote_versions'`);
  console.log(`ROLLBACK — quote_versions après annulation : ${rows[0].n ? "OUI (PROBLÈME)" : "non"}`);
  await c.end();
}
