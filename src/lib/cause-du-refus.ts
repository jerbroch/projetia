/**
 * DIRE CE QUI BLOQUE, PAS QUE ÇA BLOQUE.
 *
 * Les actions d'enregistrement avalaient l'erreur de Postgres et rendaient
 * « Impossible d'enregistrer. » — une phrase qui n'apprend rien et n'indique
 * aucun geste. L'entrepreneur reclique, réessaie, puis abandonne.
 *
 * Ce module traduit ce que la base a réellement répondu. Il ne l'invente pas :
 * quand le code d'erreur est inconnu, il rend le message brut plutôt que de le
 * remplacer par une généralité rassurante.
 */

export interface ErreurBase {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Le refus SILENCIEUX de la RLS.
 *
 * Sans politique correspondante, Postgres ne lève aucune erreur : il ne touche
 * simplement AUCUNE rangée. L'action rendait alors « succès » et l'écran
 * affichait « enregistré » pendant que rien n'avait changé. C'est le pire des
 * deux mondes — pire qu'une erreur, parce qu'on ne cherche même pas.
 */
export const REFUS_SILENCIEUX =
  "Rien n'a été enregistré. Votre compte n'a pas les droits de modifier cette " +
  "entreprise — demandez au propriétaire de vérifier votre rôle.";

/** Traduit un code Postgres en une phrase qui nomme l'obstacle. */
export function causeDuRefus(erreur: ErreurBase | null | undefined): string | null {
  if (!erreur) return null;

  const brut = (erreur.message ?? "").trim();
  const detail = (erreur.details ?? "").trim();

  switch (erreur.code) {
    case "23505":
      return `Cette valeur existe déjà${detail ? ` : ${detail}` : ""}.`;
    case "23503":
      return "Cet enregistrement renvoie à un élément qui n'existe plus.";
    case "23502": {
      const champ = brut.match(/column "([^"]+)"/)?.[1];
      return champ
        ? `Le champ « ${champ} » est obligatoire et n'a pas été rempli.`
        : "Un champ obligatoire n'a pas été rempli.";
    }
    case "23514":
      return `Une valeur n'est pas dans les limites permises${detail ? ` : ${detail}` : ""}.`;
    case "22001":
      return "Un des textes saisis est trop long.";
    case "22P02":
      return "Une valeur n'est pas du bon type — vérifiez les champs numériques.";
    case "42501":
      return "Droits insuffisants pour cette modification.";
    case "PGRST301":
    case "42P01":
      return "La base a refusé l'accès à cette donnée.";
    default:
      // Inconnu : on rend ce que la base a dit. Un message technique aide plus
      // qu'une phrase vide, et il est reportable tel quel.
      return brut || "La base de données a refusé l'enregistrement sans préciser pourquoi.";
  }
}

/**
 * Le message complet montré à l'écran : ce qu'on tentait, puis l'obstacle.
 *
 * L'ordre compte. « Coordonnées Interac : le champ X est obligatoire » se lit
 * d'un coup ; l'inverse oblige à relire pour savoir de quoi on parle.
 */
export function messageDeRefus(quoi: string, erreur: ErreurBase | null | undefined): string {
  const cause = causeDuRefus(erreur);
  return cause ? `${quoi} : ${cause}` : `${quoi} : refus sans cause précisée.`;
}
