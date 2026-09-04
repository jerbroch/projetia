import { createClient } from "@supabase/supabase-js";
import { test, expect } from "../fixtures/base";
import { readTestCredentials } from "../helpers/test-data";

/**
 * GARDE CONTRE LA RÉCURSION DES POLITIQUES RLS.
 *
 * Le 4 septembre 2026, `company_members_manage` interrogeait `company_members`
 * depuis une politique posée sur `company_members`. Chaque lecture déclenchait
 * les politiques, qui relisaient la table, qui déclenchaient les politiques.
 *
 * Le défaut ne se voit PAS à la lecture du SQL : la requête est parfaitement
 * correcte, c'est son évaluation qui boucle. Il ne se voyait pas non plus à
 * l'usage courant, parce que la plupart des tables passent par
 * `auth_user_company_ids()`, qui est SECURITY DEFINER. Trois formulaires de
 * Paramètres étaient cassés depuis on ne sait quand, et deux chemins
 * échouaient EN SILENCE.
 *
 * Ces épreuves passent par une VRAIE SESSION UTILISATEUR, avec la clé anonyme :
 * c'est la seule façon de déclencher la RLS. Avec la clé de service, tout
 * passerait et l'épreuve ne prouverait rien.
 */
const RECURSION = /infinite recursion/i;

/** Les tables qu'un entrepreneur lit dans une journée normale. */
const TABLES_LUES = [
  "companies",
  "company_members",
  "profiles",
  "customers",
  "quotes",
  "invoices",
  "scheduled_jobs",
  "employees",
  "employee_roles",
  "labor_rate_templates",
  "job_billing_sheets",
  "job_attachments",
  "tools",
  "payments",
] as const;

async function sessionEntrepreneur() {
  const creds = readTestCredentials();
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: creds.tenantEmail!,
    password: creds.tenantPassword!,
  });
  expect(error, "connexion de l'entrepreneur").toBeNull();
  return { client: c, companyId: creds.tenantCompanyId! };
}

test.describe("19. Récursion des politiques RLS", () => {
  test("aucune table ne fait boucler ses propres politiques", async () => {
    const { client } = await sessionEntrepreneur();
    const boucles: string[] = [];

    for (const table of TABLES_LUES) {
      const { error } = await client.from(table).select("*").limit(1);
      if (error && RECURSION.test(error.message)) {
        boucles.push(`${table} : ${error.message}`);
      }
    }

    expect(boucles, `Politiques récursives détectées :\n${boucles.join("\n")}`).toEqual([]);
    console.log(`RÉCURSION >>> ${TABLES_LUES.length} tables lues, aucune boucle`);
    await client.auth.signOut();
  });

  // Le chemin exact qui a cassé : écrire dans `companies` évalue
  // `companies_update`, qui lit `company_members`, dont les politiques
  // bouclaient. C'est ce que font les trois formulaires de Paramètres.
  test("les formulaires de Paramètres peuvent écrire", async () => {
    const { client, companyId } = await sessionEntrepreneur();

    for (const [libelle, champs] of [
      ["Coordonnées Interac", { interac_recipient_name: "Garde RLS" }],
      ["Informations de l'entreprise", { phone: "514-555-0199" }],
      ["Marge par défaut", { default_material_margin: 0.4 }],
    ] as const) {
      const { error } = await client.from("companies").update(champs).eq("id", companyId).select("id");
      expect(error?.message ?? "", libelle).not.toMatch(RECURSION);
      console.log(`RÉCURSION >>> ${libelle} : ${error ? "erreur — " + error.message.slice(0, 50) : "écriture possible"}`);
    }
    await client.auth.signOut();
  });

  // `session.ts` et `middleware-access.ts` lisent le rôle avec le client de
  // l'utilisateur. Ils échouaient EN SILENCE et retombaient sur `profiles` —
  // le contrôle d'accès reposait donc sur un repli, sans que rien ne le dise.
  test("le rôle se lit, comme le font la session et le middleware", async () => {
    const { client, companyId } = await sessionEntrepreneur();
    const { data, error } = await client
      .from("company_members").select("role").eq("company_id", companyId).limit(1);
    expect(error?.message ?? "").not.toMatch(RECURSION);
    expect(error, "lecture du rôle").toBeNull();
    expect(data?.length ?? 0, "l'entrepreneur doit voir son propre rôle").toBeGreaterThan(0);
    console.log(`RÉCURSION >>> rôle lu : ${data?.[0]?.role}`);
    await client.auth.signOut();
  });
});
