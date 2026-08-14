/**
 * Apply migration 005 to remote Supabase via direct Postgres connection.
 * Run: SUPABASE_DB_URL="postgresql://..." node scripts/apply-company-logos-rls-fix.mjs
 *
 * Get the connection string from Supabase Dashboard → Project Settings → Database → URI.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../supabase/migrations/005_fix_company_logos_storage_rls.sql"
);
const sql = readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Migration 005 applied successfully.");
} finally {
  await client.end();
}
