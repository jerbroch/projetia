/** Les politiques confinent-elles vraiment ? Transaction TOUJOURS annulée. */
import { readFileSync } from "node:fs";
import pg from "pg";
const sql = readFileSync("supabase/migrations/045_quote_versioning.sql","utf8")
  .replace(/^\s*begin\s*;\s*$/gim,"").replace(/^\s*commit\s*;\s*$/gim,"");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl:{rejectUnauthorized:false} });
await c.connect();
const cas=[];
try {
  await c.query("BEGIN");
  await c.query(sql);

  // Deux entreprises distinctes, avec une soumission chacune.
  const { rows:[A] } = await c.query(
    `select c.id from companies c join quotes q on q.company_id=c.id group by c.id limit 1`);
  if (!A) throw new Error("aucune entreprise avec une soumission");
  // La voisine est fabriquée ici même : la transaction est annulée de toute façon.
  const { rows:[B] } = await c.query(
    `insert into companies (name) values ('Voisine — essai RLS') returning id`);
  // Copie côté serveur : les valeurs ne repassent jamais par JavaScript,
  // donc aucun jsonb ni tableau ne se fait abîmer au retour.
  await c.query(`do $co$
    declare cols text;
    begin
      select string_agg(quote_ident(column_name), ', ') into cols
      from information_schema.columns
      where table_schema='public' and table_name='quotes'
        and column_name not in ('id','company_id','created_at','updated_at')
        and is_generated='NEVER' and identity_generation is null;
      execute format(
        'insert into quotes (company_id, %s) select %L::uuid, %s from quotes where company_id=%L::uuid limit 1',
        cols, '${B.id}', cols, '${A.id}');
    end $co$;`);

  // Un utilisateur bureau de A.
  const { rows:[u] } = await c.query(
    `select cm.user_id from company_members cm
     where cm.company_id=$1 and cm.role in ('owner','admin','dispatcher','estimator','accountant') limit 1`, [A.id]);
  if (!u) throw new Error("aucun membre bureau chez l'entreprise A");

  for (const [nom, id] of [["A", A.id], ["B", B.id]]) {
    const { rows:[q] } = await c.query(`select id from quotes where company_id=$1 limit 1`, [id]);
    await c.query(`insert into quote_versions (quote_id, company_id, version_number)
                   values ($1,$2,900) `, [q.id, id]);
    const { rows:[li] } = await c.query(
      `insert into quote_line_items (quote_id, company_id) values ($1,$2) returning id`, [q.id, id]);
    await c.query(`insert into quote_line_versions (quote_line_item_id, quote_version_id, company_id, description)
      select $1, qv.id, $2, 'ligne '||$3 from quote_versions qv where qv.company_id=$2 and qv.version_number=900`,
      [li.id, id, nom]);
  }

  // Les ids sont relevés AVANT le changement de rôle : une fois dans la peau
  // de A, la RLS de `quotes` cache déjà la soumission de la voisine, et un
  // `undefined` en JavaScript se ferait passer pour un refus de Postgres.
  const { rows:[qa] } = await c.query(`select id from quotes where company_id=$1 limit 1`, [A.id]);
  const { rows:[qb] } = await c.query(`select id from quotes where company_id=$1 limit 1`, [B.id]);
  if (!qa?.id || !qb?.id) throw new Error("soumissions d'essai manquantes");

  // On se met dans la peau de l'utilisateur de A.
  await c.query(`SET LOCAL role authenticated`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`,
                [JSON.stringify({ sub: u.user_id, role: "authenticated" })]);

  for (const t of ["quote_versions","quote_line_items","quote_line_versions"]) {
    const { rows:[r] } = await c.query(
      `select count(*) filter (where company_id=$1)::int mien,
              count(*) filter (where company_id=$2)::int autrui from ${t}`, [A.id, B.id]);
    cas.push([r.mien>0 && r.autrui===0, `${t} : voit les siennes, pas celles d'autrui`,
              `${r.mien} sienne(s), ${r.autrui} d'autrui`]);
  }

  // Écrire chez le voisin doit être refusé.
  try {
    await c.query("SAVEPOINT s");
    await c.query(`insert into quote_line_items (quote_id, company_id) values ($1,$2)`, [qb.id, B.id]);
    await c.query("RELEASE SAVEPOINT s");
    cas.push([false, "écrire chez l'entreprise voisine", "ACCEPTÉ — fuite"]);
  } catch(e) { await c.query("ROLLBACK TO SAVEPOINT s");
    cas.push([true, "écrire chez l'entreprise voisine", "refusé : "+e.message.slice(0,50)]); }

  // Écrire chez soi doit passer.
  try {
    await c.query("SAVEPOINT s");
    await c.query(`insert into quote_line_items (quote_id, company_id) values ($1,$2)`, [qa.id, A.id]);
    await c.query("RELEASE SAVEPOINT s");
    cas.push([true, "écrire chez soi", "accepté"]);
  } catch(e) { await c.query("ROLLBACK TO SAVEPOINT s");
    cas.push([false, "écrire chez soi", "REFUSÉ : "+e.message.slice(0,60)]); }

  // Pas de récursion : une lecture répétée ne doit jamais boucler.
  try {
    await c.query(`select count(*) from quote_line_versions`);
    cas.push([true, "aucune récursion RLS", "lecture normale"]);
  } catch(e) { cas.push([false, "aucune récursion RLS", e.message.slice(0,60)]); }

  console.log("══ CONFINEMENT ══");
  cas.forEach(([ok,n,d])=>console.log(`${ok?"✓":"✗"} ${n.padEnd(48)} ${d}`));
  const e=cas.filter(([ok])=>!ok).length;
  console.log(`\n${cas.length-e}/${cas.length} conformes${e?` — ${e} ÉCHEC(S)`:""}`);
} catch(e){ console.log("✗ erreur :", e.message); }
finally {
  await c.query("ROLLBACK");
  const { rows } = await c.query(`select count(*)::int n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname='quote_versions'`);
  console.log(`ROLLBACK — quote_versions après annulation : ${rows[0].n?"OUI (PROBLÈME)":"non"}`);
  await c.end();
}
