/**
 * Barrière sur la base visée par la suite e2e.
 *
 * Définie ici et nulle part ailleurs : `global-setup` s'en sert pour refuser
 * de démarrer, et le nettoyage de `global-teardown` pour refuser de supprimer.
 * Deux définitions séparées finiraient par diverger, et la seconde est
 * destructrice.
 */

/**
 * Projets sur lesquels la suite ne doit jamais s'exécuter, même déclarés
 * explicitement. Une référence de projet Supabase n'est pas un secret : elle
 * voyage dans le bundle client via NEXT_PUBLIC_SUPABASE_URL.
 */
export const PROJETS_INTERDITS: Record<string, string> = {
  dxobukushgxuciqhgrpf: "ConstructionIOS-Production",
};

/** Domaine des comptes engendrés par globalSetup. Aucun humain ne le possède. */
export const DOMAINE_E2E = "@e2e.constructionios.test";

/** `https://abc.supabase.co` → `abc` */
export function refDuProjet(url: string): string | null {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url.trim())?.[1] ?? null;
}

/**
 * Retourne la référence du projet visé, ou lève si la cible n'est pas confirmée.
 *
 * Corriger l'ordre de chargement des variables ne suffisait pas : un `.env.e2e`
 * absent ou incomplet ferait silencieusement retomber sur la production. Il
 * faut donc une déclaration explicite, qui doit correspondre au projet
 * réellement visé. Deux gestes délibérés sont nécessaires pour viser la
 * production, et aucun oubli n'y mène.
 */
export function cibleConfirmee(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const cible = refDuProjet(url);
  const declare = process.env.E2E_SUPABASE_REF?.trim();

  const refus = (raison: string): never => {
    throw new Error(
      `\n\n❌ Cible e2e refusée — ${raison}\n` +
        `   projet visé      : ${cible ?? "(URL illisible)"}\n` +
        `   E2E_SUPABASE_REF : ${declare || "(absente)"}\n\n` +
        `   Déclarez E2E_SUPABASE_REF dans .env.e2e, avec la référence du\n` +
        `   projet de développement. Les tests créent des entreprises et des\n` +
        `   comptes : ils ne doivent jamais viser une base réelle.\n`,
    );
  };

  if (!cible) refus("NEXT_PUBLIC_SUPABASE_URL absente ou malformée");
  if (PROJETS_INTERDITS[cible!]) {
    refus(`${PROJETS_INTERDITS[cible!]} est une base protégée`);
  }
  if (!declare) refus("aucune cible déclarée");
  if (declare !== cible) refus("la cible déclarée ne correspond pas au projet visé");

  return cible!;
}
