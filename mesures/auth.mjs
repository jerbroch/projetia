import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.e2e", "utf8");
const g = (k) =>
  ((env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");

const URL = g("NEXT_PUBLIC_SUPABASE_URL");
const ANON = g("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const m = JSON.parse(readFileSync("mesures/compte.json", "utf8"));

const c = createClient(URL, ANON, { auth: { persistSession: false } });
const { data, error } = await c.auth.signInWithPassword({
  email: m.courriel,
  password: m.motDePasse,
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
const jeton = data.session.access_token;

async function mes(nom, fn) {
  const t = [];
  for (let i = 0; i < 7; i++) {
    const d = Date.now();
    try {
      await fn();
    } catch (e) {
      console.log(`  ${nom.padEnd(32)} indisponible (${String(e.message ?? e).slice(0, 40)})`);
      return;
    }
    t.push(Date.now() - d);
  }
  t.sort((a, b) => a - b);
  console.log(`  ${nom.padEnd(32)} médiane ${String(t[3]).padStart(4)} ms`);
}

console.log("Coût de la vérification d'identité :");
const c2 = createClient(URL, ANON, { auth: { persistSession: false } });
await mes("auth.getUser(jeton)", () => c2.auth.getUser(jeton));
await mes("auth.getClaims(jeton)", () => c2.auth.getClaims(jeton));

const c3 = createClient(URL, ANON, {
  global: { headers: { Authorization: `Bearer ${jeton}` } },
  auth: { persistSession: false },
});
await mes("une lecture de table", () => c3.from("customers").select("id").limit(1));
