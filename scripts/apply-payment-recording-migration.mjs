#!/usr/bin/env node
/**
 * Applique la migration 026 (enregistrement des paiements) sur Supabase.
 *
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[mot-de-passe]@[hote]:5432/postgres" \
 *     node scripts/apply-payment-recording-migration.mjs
 *
 * La chaîne se trouve dans Supabase → Project Settings → Database →
 * Connection string → URI. Ce n'est PAS le DATABASE_URL de .env.local, qui
 * pointe sur Prisma Postgres.
 *
 * Les instructions sont exécutées une par une, hors transaction :
 * `ALTER TYPE ... ADD VALUE` ne peut pas cohabiter avec l'usage de la valeur
 * ajoutée dans une même transaction, et certains hébergeurs le refusent
 * carrément dans un bloc transactionnel.
 *
 * Idempotent : `IF NOT EXISTS` partout, sauf le renommage de `ach`, qui est
 * détecté et sauté s'il a déjà eu lieu.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("❌ SUPABASE_DB_URL absente.");
  console.error("   Supabase → Project Settings → Database → Connection string → URI");
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/026_payment_recording.sql", "utf8");

// Découpe naïve mais suffisante : la migration ne contient ni fonction ni
// bloc DO, donc aucun point-virgule imbriqué.
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

let applied = 0;
let skipped = 0;

for (const statement of statements) {
  const label = statement.replace(/\s+/g, " ").slice(0, 72);
  try {
    await client.query(statement);
    console.log(`✓ ${label}`);
    applied += 1;
  } catch (err) {
    // Le renommage a déjà eu lieu lors d'une exécution précédente.
    const dejaFait =
      /does not exist/i.test(err.message) && /RENAME VALUE/i.test(statement);
    if (dejaFait) {
      console.log(`· déjà appliqué — ${label}`);
      skipped += 1;
      continue;
    }
    console.error(`\n❌ Échec sur : ${label}`);
    console.error(`   ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

// Contrôle : les modes de paiement attendus sont-ils tous là ?
const { rows } = await client.query(
  `SELECT enumlabel FROM pg_enum
   JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
   WHERE pg_type.typname = 'payment_method'
   ORDER BY enumsortorder`,
);
const modes = rows.map((r) => r.enumlabel);
console.log(`\nModes de paiement : ${modes.join(", ")}`);

const attendus = ["interac", "check", "cash", "transfer", "other"];
const manquants = attendus.filter((m) => !modes.includes(m));

await client.end();

if (manquants.length) {
  console.error(`❌ Modes manquants : ${manquants.join(", ")}`);
  process.exit(1);
}

console.log(`\n✓ Migration 026 appliquée — ${applied} instruction(s), ${skipped} déjà en place.`);
