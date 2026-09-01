/**
 * Quelle base de données le serveur local est-il en train de viser ?
 *
 * `npm run dev` charge `.env.local`, qui pointe sur la PRODUCTION. Seul
 * `playwright.config.ts` chargeait `.env.e2e` en premier — et comme `dotenv`
 * n'écrase jamais une variable déjà posée, c'est lui qui gagnait. Relancer le
 * serveur à la main suffit donc à basculer sur les vraies données sans que
 * rien ne le dise.
 *
 * C'est arrivé le 1er septembre 2026. Rien n'a été écrit — les connexions
 * échouaient justement parce que les comptes de test vivent ailleurs — mais
 * un compte de production aurait suffi à modifier de vraies factures.
 *
 * D'où ce module : en développement, on AFFICHE toujours la base visée, et on
 * crie quand ce n'est pas celle qu'on a déclarée sûre.
 */

export interface BaseVisee {
  /** Référence du projet Supabase, extraite de l'URL. */
  ref: string | null;
  /** Vrai quand la base correspond à celle déclarée comme base de test. */
  sure: boolean;
  /** Vrai quand il faut avertir : on est en local ET la base n'est pas sûre. */
  alerter: boolean;
  message: string;
}

/** `https://abcd.supabase.co` → `abcd`. */
export function refDuProjet(url: string | null | undefined): string | null {
  const m = /^https?:\/\/([a-z0-9]+)\.supabase\./i.exec((url ?? "").trim());
  return m ? m[1] : null;
}

export function baseVisee(env: Record<string, string | undefined>): BaseVisee {
  const ref = refDuProjet(env.NEXT_PUBLIC_SUPABASE_URL);
  const refSure = (env.DEV_SAFE_SUPABASE_REF ?? "").trim() || null;
  const local = env.NODE_ENV !== "production";

  // Sans référence sûre déclarée, on ne peut RIEN garantir : on avertit.
  // Se taire par défaut ferait exactement l'erreur qu'on cherche à éviter.
  const sure = Boolean(refSure && ref && refSure === ref);
  const alerter = local && !sure;

  const message = !ref
    ? "Aucune base Supabase configurée."
    : sure
      ? `Base de développement (${ref}).`
      : `⚠ Ce serveur local écrit dans la base « ${ref} », qui n'est pas la base de test déclarée. Si c'est la production, arrêtez-vous : lancez « npm run dev:e2e ».`;

  return { ref, sure, alerter, message };
}
