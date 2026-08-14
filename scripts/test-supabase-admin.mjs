/**
 * One-off admin client smoke test. Run: node scripts/test-supabase-admin.mjs
 * Loads .env.local via dotenv (devDependency).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=== Supabase Admin Smoke Test ===");
console.log("URL:", url ?? "(missing)");
console.log("Publishable key prefix:", publishableKey?.slice(0, 20) ?? "(missing)");
console.log("Secret key prefix:", secretKey?.slice(0, 12) ?? "(missing)");

if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Test auth admin API
const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 5 });
if (usersError) {
  console.error("listUsers FAILED:", usersError.message);
} else {
  console.log("listUsers OK — count:", usersData.users.length);
}

// Test table access
for (const table of ["companies", "profiles", "company_members"]) {
  const { error } = await admin.from(table).select("id").limit(1);
  if (error) {
    console.log(`table ${table}: MISSING or error —`, error.message);
  } else {
    console.log(`table ${table}: OK`);
  }
}

// Test publishable key client (anon replacement)
if (publishableKey) {
  const pub = createClient(url, publishableKey);
  const { error: pubError } = await pub.auth.getSession();
  console.log("publishable key client:", pubError ? `FAIL — ${pubError.message}` : "OK");
}

console.log("=== Done ===");
