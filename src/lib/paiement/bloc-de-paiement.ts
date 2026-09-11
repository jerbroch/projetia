import type { InteracSettings } from "@/types";

/**
 * LE CONTENU DU BLOC DE PAIEMENT, DÉFINI UNE SEULE FOIS.
 *
 * Il vivait en deux exemplaires : un constructeur HTML pour le courriel de
 * facture (`buildInteracEmailBlock`) et une réécriture à la main en JSX sur la
 * page publique de soumission. Les deux ne disaient pas la même chose — l'un
 * numérotait les étapes et encadrait le numéro à inscrire, l'autre listait des
 * champs. Modifier l'un laissait l'autre en arrière.
 *
 * Ce module ne rend rien. Il dit CE QU'IL FAUT DIRE ; deux rendus s'en
 * chargent, un pour le courriel et un pour l'écran.
 */

export interface EtapeDePaiement {
  /** Le texte de l'étape. Peut contenir des passages à mettre en valeur. */
  texte: string;
  /** Une précision sous l'étape — la question de sécurité, par exemple. */
  precision?: string;
  /**
   * La référence à inscrire, mise en évidence. C'est la ligne qui permet
   * d'associer l'argent reçu au bon document : sans elle, un virement arrive
   * sans qu'on sache de qui ni pour quoi.
   */
  reference?: string;
  /** Ce qu'on explique sous la référence. */
  referenceNote?: string;
}

export interface BlocDePaiement {
  titre: string;
  etapes: EtapeDePaiement[];
  /** Le texte libre saisi par l'entrepreneur dans ses réglages. */
  instructions?: string;
  /** Le montant attendu, quand il y en a un. */
  montant?: number;
}

export interface EntreeBloc {
  interac: InteracSettings | null | undefined;
  /** `FA-2026-007` pour une facture, `SO-2026-002` pour une soumission. */
  reference: string | null | undefined;
  /** Le dépôt attendu. Calculé ailleurs — voir `montantDuDepot`. */
  montant?: number | null;
  /**
   * LA RÉPONSE À LA QUESTION DE SÉCURITÉ.
   *
   * Faux sur les soumissions : écrire la réponse sous la question, dans le
   * même courriel, annule la question. Les factures la montrent encore — c'est
   * le comportement d'avant, et le changer demande une décision à part. Voir
   * le journal des dettes.
   */
  afficherLaReponse: boolean;
}

/**
 * Rend `null` quand il n'y a rien à dire.
 *
 * C'est LE point de décision, et il est unique : aucune surface ne juge par
 * elle-même si elle doit afficher quelque chose, donc aucune ne peut afficher
 * un bloc vide. Un cadre « Comment payer » sans coordonnées est pire qu'une
 * absence : il promet une marche à suivre qui n'est pas là.
 */
export function blocDePaiement(e: EntreeBloc): BlocDePaiement | null {
  const courriel = e.interac?.enabled ? e.interac.email?.trim() : "";
  const reference = e.reference?.trim();

  if (!courriel && !reference) return null;

  const etapes: EtapeDePaiement[] = [];

  if (courriel) {
    const destinataire = e.interac?.recipientName?.trim();
    const question = e.interac?.securityQuestion?.trim();
    const reponse = e.afficherLaReponse ? e.interac?.securityAnswer?.trim() : undefined;

    etapes.push({ texte: "Ouvrez un virement Interac depuis votre institution bancaire." });
    etapes.push({
      texte: `Envoyez-le à ${courriel}${destinataire ? ` (${destinataire})` : ""}`,
      precision: question
        ? `Question de sécurité : ${question}${reponse ? `\nRéponse : ${reponse}` : ""}`
        : undefined,
    });
  }

  if (reference) {
    etapes.push({
      texte: "Dans le message du virement, écrivez :",
      reference,
      referenceNote: "C'est ce qui nous permet d'associer votre paiement.",
    });
  }

  const instructions = e.interac?.instructions?.trim();
  const montant =
    typeof e.montant === "number" && Number.isFinite(e.montant) && e.montant > 0
      ? e.montant
      : undefined;

  return {
    titre: "Comment payer",
    etapes,
    instructions: instructions || undefined,
    montant,
  };
}
