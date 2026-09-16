import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = readFileSync(".env.e2e", "utf8");
const g = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const a = createClient(g("NEXT_PUBLIC_SUPABASE_URL"), g("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const m = JSON.parse(readFileSync("mesures/compte.json", "utf8"));

async function mes(nom, fn) {
  const t = [];
  for (let i = 0; i < 7; i++) {
    const d = Date.now();
    const r = await fn();
    t.push(Date.now() - d);
    if (i === 0 && r.error) return console.log(`  ${nom.padEnd(38)} ERREUR ${r.error.message}`);
  }
  t.sort((x, y) => x - y);
  console.log(`  ${nom.padEnd(38)} médiane ${String(t[3]).padStart(4)} ms`);
}

console.log("Lire le contexte du locataire :");
await mes("profil seul", () => a.from("profiles").select("*").eq("id", m.userId).maybeSingle());
await mes("entreprise seule", () => a.from("companies").select("*").eq("id", m.companyId).maybeSingle());
await mes("profil + entreprise (jointure)", () =>
  a.from("profiles").select("*, companies(*)").eq("id", m.userId).maybeSingle());
await mes("profil + entreprise + rôle", () =>
  a.from("profiles").select("*, companies(*), company_members(role, company_id)").eq("id", m.userId).maybeSingle());
