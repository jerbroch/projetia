/**
 * Apply migration 024 to Supabase Postgres.
 * Run: SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@..." node scripts/apply-employee-access-migration.mjs
 */
import { readFileSync } from "fs";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/024_employee_access_invitation.sql", "utf8");
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query(sql);
await client.end();
console.log("Migration 024 applied successfully.");
