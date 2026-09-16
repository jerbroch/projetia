/**
 * COMBIEN COÛTE CHAQUE REQUÊTE, prise isolément.
 *
 * Les pages sont lentes côté serveur ; reste à savoir laquelle des lectures
 * pèse. On chronomètre chacune contre la vraie base, avec le vrai volume.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.e2e", "utf8");
const lire = (c) =>
  ((env.match(new RegExp(`^${c}=(.*)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");

const a = createClient(lire("NEXT_PUBLIC_SUPABASE_URL"), lire("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const { companyId } = JSON.parse(readFileSync("mesures/compte.json", "utf8"));

async function chrono(nom, fn) {
  const t = [];
  for (let i = 0; i < 5; i++) {
    const d = Date.now();
    const { error, count } = await fn();
    t.push(Date.now() - d);
    if (error) return console.log(`  ${nom.padEnd(28)} ERREUR ${error.message}`);
    if (i === 4) {
      const med = [...t].sort((x, y) => x - y)[2];
      console.log(`  ${nom.padEnd(28)} médiane ${String(med).padStart(4)} ms  (${count ?? "?"} lignes)`);
    }
  }
}

console.log("Requêtes, médiane sur 5 passages :");
await chrono("customers", () => a.from("customers").select("*", { count: "exact" }).eq("company_id", companyId));
await chrono("quotes (avec line_items)", () => a.from("quotes").select("*", { count: "exact" }).eq("company_id", companyId));
await chrono("quotes (sans line_items)", () => a.from("quotes").select("id,quote_number,customer_name,title,status,amount,valid_until,created_at", { count: "exact" }).eq("company_id", companyId));
await chrono("invoices", () => a.from("invoices").select("*", { count: "exact" }).eq("company_id", companyId));
await chrono("scheduled_jobs", () => a.from("scheduled_jobs").select("*", { count: "exact" }).eq("company_id", companyId));
await chrono("employees", () => a.from("employees").select("*", { count: "exact" }).eq("company_id", companyId));
await chrono("tools", () => a.from("tools").select("*", { count: "exact" }).eq("company_id", companyId));
