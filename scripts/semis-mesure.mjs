/**
 * UN LOCATAIRE AVEC DE VRAIES QUANTITÉS, POUR MESURER.
 *
 * Mesurer une page vide ne dit rien : toutes les pages sont rapides quand
 * elles n'affichent rien. Ce script crée un compte avec le volume d'un
 * entrepreneur en activité — une trentaine de clients, une quarantaine de
 * soumissions, autant de factures, une soixantaine de travaux planifiés — de
 * sorte que les listes, les jointures et les agrégats travaillent vraiment.
 *
 * TOUT EST MARQUÉ `@e2e.constructionios.test` : le nettoyage habituel des
 * locataires de test l'emporte comme les autres. On ne laisse rien derrière.
 *
 * Il refuse de tourner ailleurs que sur la base de développement déclarée.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env.e2e", "utf8");
const lire = (c) =>
  ((env.match(new RegExp(`^${c}=(.*)$`, "m")) || [])[1] || "")
    .trim()
    .replace(/^["']|["']$/g, "");

const URL = lire("NEXT_PUBLIC_SUPABASE_URL");
const CLE = lire("SUPABASE_SERVICE_ROLE_KEY");
const REF_ATTENDUE = lire("DEV_SAFE_SUPABASE_REF");

const ref = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!REF_ATTENDUE || ref !== REF_ATTENDUE) {
  console.error(`REFUS : la cible « ${ref} » n'est pas la base de développement déclarée.`);
  process.exit(1);
}

const admin = createClient(URL, CLE, { auth: { persistSession: false } });
const id = Date.now().toString();
const courriel = `e2e+mesure${id}@e2e.constructionios.test`;
const motDePasse = "MesurePerf!2026";

const N_CLIENTS = 30;
const N_SOUMISSIONS = 40;
const N_FACTURES = 45;
const N_TRAVAUX = 60;
const N_OUTILS = 25;

function jourRelatif(decalage) {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d;
}

async function principal() {
  console.log(`Base : ${ref}`);

  const { data: u, error: eu } = await admin.auth.admin.createUser({
    email: courriel,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { first_name: "Mesure", last_name: "Perf", is_test_user: true },
  });
  if (eu) throw eu;

  const { data: entreprise, error: ec } = await admin
    .from("companies")
    .insert({
      name: `Mesure Perf ${id}`,
      email: courriel,
      subscription_status: "active",
      access_type: "beta",
      is_beta: true,
      promo_code: "ios123",
      requires_access_choice: false,
    })
    .select("id")
    .single();
  if (ec) throw ec;

  const { error: ep } = await admin.from("profiles").insert({
    id: u.user.id,
    company_id: entreprise.id,
    first_name: "Mesure",
    last_name: "Perf",
    email: courriel,
    role: "owner",
    status: "active",
  });
  if (ep) throw ep;

  const cid = entreprise.id;

  // ── Employés ──────────────────────────────────────────────────────────
  const employes = Array.from({ length: 8 }, (_, i) => ({
    company_id: cid,
    first_name: `Employé${i + 1}`,
    last_name: "Mesure",
    trade: ["Plombier", "Électricien", "Menuisier", "Manœuvre"][i % 4],
    phone: `514555${String(1000 + i)}`,
    email: `e2e+emp${i}-${id}@e2e.constructionios.test`,
    status: "active",
  }));
  const { data: emps, error: ee } = await admin.from("employees").insert(employes).select("id");
  if (ee) throw ee;

  // ── Clients ───────────────────────────────────────────────────────────
  const clients = Array.from({ length: N_CLIENTS }, (_, i) => ({
    company_id: cid,
    name: `Client Mesure ${String(i + 1).padStart(2, "0")}`,
    company: `Entreprise ${i + 1}`,
    email: `e2e+client${i}-${id}@e2e.constructionios.test`,
    phone: `438555${String(2000 + i)}`,
    address: `${100 + i} rue de la Mesure, Montréal, QC`,
    status: i % 7 === 0 ? "lead" : "active",
  }));
  const { data: cls, error: ecl } = await admin.from("customers").insert(clients).select("id");
  if (ecl) throw ecl;

  // ── Soumissions ───────────────────────────────────────────────────────
  const statuts = ["draft", "sent", "viewed", "accepted", "rejected"];
  const lignesDe = (i) =>
    Array.from({ length: 8 }, (_, l) => ({
      id: `${i}-${l}`,
      description: `Ligne ${l + 1} — matériaux et main-d'œuvre`,
      quantity: 1 + l,
      unitPrice: 75 + l * 25,
      total: (1 + l) * (75 + l * 25),
    }));

  const soumissions = Array.from({ length: N_SOUMISSIONS }, (_, i) => ({
    company_id: cid,
    customer_id: cls[i % cls.length].id,
    customer_name: clients[i % clients.length].name,
    quote_number: `MP-SO-${id}-${i}`,
    title: `Soumission de mesure ${i + 1} — réfection complète`,
    description: "Jeu de données de mesure de performance.",
    status: statuts[i % statuts.length],
    amount: 1500 + i * 137,
    valid_until: jourRelatif(45).toISOString().slice(0, 10),
    // Les lignes vivent en JSON sur la soumission : c'est le volume qui pèse
    // au chargement de la liste si la requête les rapatrie sans en avoir besoin.
    line_items: lignesDe(i),
  }));
  const { data: sos, error: es } = await admin.from("quotes").insert(soumissions).select("id");
  if (es) throw es;
  const lignes = { length: sos.length * 8 };

  // ── Travaux planifiés ─────────────────────────────────────────────────
  const travaux = Array.from({ length: N_TRAVAUX }, (_, i) => {
    const debut = jourRelatif(i - 20);
    debut.setHours(8 + (i % 8), 0, 0, 0);
    const fin = new Date(debut);
    fin.setHours(debut.getHours() + 4);
    return {
      company_id: cid,
      customer_id: cls[i % cls.length].id,
      title: `Travail de mesure ${i + 1}`,
      description: "Jeu de données de mesure.",
      start_at: debut.toISOString(),
      end_at: fin.toISOString(),
      status: ["scheduled", "completed", "in-progress"][i % 3],
      location: `${200 + i} boulevard du Test, Laval, QC`,
      employee_ids: [emps[i % emps.length].id],
      employee_names: [`Employé${(i % 8) + 1} Mesure`],
      customer_name: clients[i % clients.length].name,
    };
  });
  const { error: et } = await admin.from("scheduled_jobs").insert(travaux);
  if (et) console.warn("travaux :", et.message);

  // ── Factures ──────────────────────────────────────────────────────────
  const factures = Array.from({ length: N_FACTURES }, (_, i) => ({
    company_id: cid,
    customer_id: cls[i % cls.length].id,
    customer_name: clients[i % clients.length].name,
    invoice_number: `MP-FA-${id}-${i}`,
    amount: 900 + i * 211,
    paid_amount: i % 3 === 0 ? 900 + i * 211 : 0,
    status: ["draft", "sent", "paid", "overdue"][i % 4],
    due_date: jourRelatif(30 - i).toISOString().slice(0, 10),
  }));
  const { error: ef } = await admin.from("invoices").insert(factures);
  if (ef) console.warn("factures :", ef.message);

  // ── Outils ────────────────────────────────────────────────────────────
  const outils = Array.from({ length: N_OUTILS }, (_, i) => ({
    company_id: cid,
    name: `Outil de mesure ${i + 1}`,
    category: ["Électroportatif", "Mesure", "Levage"][i % 3],
    base_status: ["available", "in_repair", "out_of_service"][i % 3],
    serial_number: `SN-${id}-${i}`,
  }));
  const { error: eo } = await admin.from("tools").insert(outils);
  if (eo) console.warn("outils :", eo.message);

  writeFileSync(
    "mesures/compte.json",
    JSON.stringify({ courriel, motDePasse, companyId: cid, userId: u.user.id }, null, 2),
  );

  console.log(`Locataire de mesure : ${courriel}`);
  console.log(
    `  ${N_CLIENTS} clients · ${N_SOUMISSIONS} soumissions (${lignes.length} lignes) · ` +
      `${N_TRAVAUX} travaux · ${N_FACTURES} factures · ${N_OUTILS} outils · ${emps.length} employés`,
  );
}

principal().catch((e) => {
  console.error("ÉCHEC :", e.message ?? e);
  process.exit(1);
});
