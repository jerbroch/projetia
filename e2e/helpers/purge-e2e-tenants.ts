/**
 * Suppression des entreprises et des comptes engendrés par la suite e2e.
 *
 * `cleanupE2ESeedData` ne retirait que les DONNÉES d'amorçage — clients,
 * soumissions, chantiers — d'une seule entreprise. Les entreprises elles-mêmes
 * et les comptes auth créés par `globalSetup` à chaque exécution restaient.
 * La base de développement passait ainsi de 4 à 18 entreprises en une suite ;
 * c'est exactement le mécanisme qui en a accumulé 151 en production.
 *
 * L'IDENTIFICATION se fait sur le domaine `@e2e.constructionios.test` des
 * comptes propriétaires, jamais sur le nom de l'entreprise : un vrai client
 * peut s'appeler « Test Co », personne ne possède ce domaine. C'est le même
 * marqueur qui a permis de distinguer sans risque les 151 artefacts des 7
 * entreprises réelles en production.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cibleConfirmee, DOMAINE_E2E } from "../target-guard";

/**
 * Âge en deçà duquel une entreprise e2e est considérée comme APPARTENANT À UN
 * PASSAGE EN COURS, et donc intouchable.
 *
 * La purge effaçait toutes les entreprises e2e sans distinction. Le
 * 3 septembre 2026, deux passages se sont chevauchés — celui de `main` et
 * celui d'une branche — et le premier à finir a supprimé l'entreprise du
 * second : dix-sept épreuves sont tombées avec
 * `customers_company_id_fkey`, un symptôme qui ne désigne pas du tout sa
 * cause.
 *
 * Le verrou de `run-lock.ts` ne pouvait rien : c'est un fichier local, et deux
 * coureurs GitHub ne partagent aucun disque.
 */
export const AGE_MINIMAL_MS = 90 * 60 * 1000;

/**
 * Vrai quand l'entreprise est assez ancienne pour être un résidu, et non le
 * plateau de travail d'un passage en cours. Sans date, on s'abstient.
 */
export function purgeableParAge(creeLe: string | null | undefined, maintenant: number): boolean {
  if (!creeLe) return false;
  const t = Date.parse(creeLe);
  if (Number.isNaN(t)) return false;
  return maintenant - t >= AGE_MINIMAL_MS;
}

export interface ResultatPurge {
  entreprises: number;
  comptes: number;
}

/**
 * Supprime les entreprises e2e et leurs comptes.
 *
 * Vérifie la cible une seconde fois, indépendamment de `globalSetup` :
 * supprimer est irréversible, et une barrière franchie en amont ne dispense
 * pas de la reposer devant l'opération destructrice.
 */
export async function purgeE2ETenants(
  admin: SupabaseClient,
): Promise<ResultatPurge> {
  cibleConfirmee();

  // 1. Les comptes au domaine e2e, et les entreprises auxquelles ils
  //    appartiennent. On part des profils : le lien compte → entreprise y vit.
  const { data: profils, error } = await admin
    .from("profiles")
    .select("id, email, company_id")
    .ilike("email", `%${DOMAINE_E2E}`);

  if (error) throw new Error(`lecture des profils impossible : ${error.message}`);

  const candidates = [
    ...new Set((profils ?? []).map((p) => p.company_id).filter(Boolean).map(String)),
  ];

  // ON NE TOUCHE PAS À UNE ENTREPRISE FRAÎCHE. Elle appartient peut-être à un
  // passage qui tourne en ce moment sur une autre machine, et la supprimer lui
  // arracherait le sol sous les pieds.
  const maintenant = Date.now();
  const entreprises: string[] = [];
  if (candidates.length) {
    const { data: fiches } = await admin
      .from("companies")
      .select("id, created_at")
      .in("id", candidates);
    for (const f of fiches ?? []) {
      if (purgeableParAge(f.created_at as string | null, maintenant)) {
        entreprises.push(String(f.id));
      }
    }
  }

  const gardees = candidates.length - entreprises.length;
  if (gardees > 0) {
    console.log(
      `[purge] ${gardees} entreprise(s) e2e épargnée(s) — trop récente(s) pour ` +
        `être un résidu, un autre passage s'en sert peut-être.`,
    );
  }

  // Les comptes suivent leur entreprise : purger un compte dont l'entreprise
  // est épargnée casserait le passage qui s'en sert.
  const comptes = (profils ?? [])
    .filter((p) => p.company_id && entreprises.includes(String(p.company_id)))
    .map((p) => String(p.id));

  // 2. Les entreprises d'abord : neuf tables cascadent avec elles, dont
  //    `profiles`. Deux passent en SET NULL — `platform_test_users` et
  //    `admin_activity_log` — ce qui préserve le journal d'audit.
  if (entreprises.length) {
    const { error: suppression } = await admin
      .from("companies")
      .delete()
      .in("id", entreprises);
    if (suppression) {
      throw new Error(`suppression des entreprises impossible : ${suppression.message}`);
    }
  }

  // 3. Les comptes auth ensuite : ils ne cascadent pas avec l'entreprise et
  //    resteraient orphelins, ce qui finirait par bloquer une réinscription
  //    sur le même courriel.
  let comptesSupprimes = 0;
  for (const id of comptes) {
    const { error: suppression } = await admin.auth.admin.deleteUser(id);
    if (!suppression) comptesSupprimes += 1;
  }

  return { entreprises: entreprises.length, comptes: comptesSupprimes };
}
