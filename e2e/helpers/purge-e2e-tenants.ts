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

  const comptes = (profils ?? []).map((p) => String(p.id));
  const entreprises = [
    ...new Set((profils ?? []).map((p) => p.company_id).filter(Boolean).map(String)),
  ];

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
