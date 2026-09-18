import {
  computeExpectedReturnDate,
  findOverlappingAssignment,
  todayDateString,
} from "@/lib/tool-utils";
import type { ToolAssignment, ToolListItem } from "@/types";

/**
 * CE QUE LE TERRAIN A LE DROIT DE PRENDRE, ET POURQUOI PAS.
 *
 * Le bureau assigne un outil à quelqu'un ; le travailleur, lui, se sert au
 * dépôt. Ce n'est pas le même geste : il n'arbitre entre personne, il constate
 * qu'il emporte un outil. Les règles sont donc plus étroites — il ne peut ni
 * réserver pour plus tard, ni sortir un outil au nom d'un collègue.
 *
 * Ces fonctions sont PURES et dites en français, parce que ce sont elles qui
 * décident si un homme repart du dépôt avec sa perceuse ou non. Elles doivent
 * pouvoir se lire sans ouvrir Supabase.
 */

/** Une semaine : la durée d'emprunt proposée par le bureau. On s'aligne. */
export const DUREE_EMPRUNT_PAR_DEFAUT_JOURS = 7;

export type RefusDePrise =
  | { possible: true }
  | { possible: false; motif: string };

/**
 * Peut-on prendre cet outil, maintenant, pour soi ?
 *
 * L'ordre des refus suit ce que la personne peut faire ensuite : un outil en
 * réparation ne sera pas disponible demain non plus, alors qu'un outil sorti
 * par un collègue le sera. Dire d'abord la cause définitive évite de faire
 * revenir quelqu'un pour rien.
 */
export function peutPrendreLOutil(
  outil: Pick<ToolListItem, "baseStatus" | "effectiveStatus" | "currentEmployeeId" | "name">,
  employeId: string,
): RefusDePrise {
  if (outil.baseStatus === "out_of_service") {
    return { possible: false, motif: "Cet outil est hors service." };
  }
  if (outil.baseStatus === "in_repair") {
    return { possible: false, motif: "Cet outil est en réparation." };
  }
  if (outil.currentEmployeeId && outil.currentEmployeeId === employeId) {
    return { possible: false, motif: "Vous avez déjà cet outil." };
  }
  if (outil.currentEmployeeId) {
    return { possible: false, motif: "Un collègue a cet outil en ce moment." };
  }
  return { possible: true };
}

/**
 * La réservation d'un collègue bloque la prise ; la sienne ne la bloque pas.
 *
 * UNE RÉSERVATION N'EST PAS UNE SORTIE. L'outil est encore au dépôt, et
 * quelqu'un l'attend pour une date donnée. Deux conséquences opposées :
 *
 *  • si la période demandée chevauche la réservation d'un AUTRE, la prise est
 *    refusée — sinon le réservataire se déplacerait pour rien ;
 *  • si la réservation est la SIENNE, la prise est au contraire le geste
 *    attendu : il vient chercher ce qu'il avait réservé.
 */
export function reservationQuiBloque(
  assignations: ToolAssignment[],
  employeId: string,
  debut: string,
  finPrevue: string,
): ToolAssignment | null {
  const chevauche = findOverlappingAssignment(assignations, debut, finPrevue);
  if (!chevauche) return null;
  if (chevauche.employeeId === employeId) return null;
  return chevauche;
}

/** Sa propre réservation en cours, s'il en a une sur cette période. */
export function saReservation(
  assignations: ToolAssignment[],
  employeId: string,
  debut: string,
  finPrevue: string,
): ToolAssignment | null {
  const chevauche = findOverlappingAssignment(assignations, debut, finPrevue);
  if (!chevauche) return null;
  return chevauche.employeeId === employeId ? chevauche : null;
}

/** La date de retour proposée quand le travailleur n'en choisit pas. */
export function retourProposeParDefaut(
  debut: string = todayDateString(),
  jours: number = DUREE_EMPRUNT_PAR_DEFAUT_JOURS,
): string {
  return computeExpectedReturnDate(debut, jours);
}

export type EtatDuRetour = "good" | "damaged" | "needs_repair" | "missing_part" | "other";

/** Un retour qui signale un problème sort l'outil du parc disponible. */
export function retourSignaleUnProbleme(etat: EtatDuRetour): boolean {
  return etat !== "good";
}

/**
 * La note conservée après un retour.
 *
 * Le retour ÉCRASAIT la note de la prise : « Pour le chantier Tremblay »
 * disparaissait au profit de « Mandrin coincé », et plus rien ne disait
 * pourquoi l'outil était sorti. On empile plutôt que de remplacer — une fiche
 * d'outil se lit comme un journal, pas comme un état courant.
 */
export function noteApresRetour(
  noteDePrise: string | null | undefined,
  noteDeRetour: string | null | undefined,
): string | null {
  const prise = noteDePrise?.trim();
  const retour = noteDeRetour?.trim();
  if (prise && retour) return `${prise}\nRetour : ${retour}`;
  if (retour) return `Retour : ${retour}`;
  return prise ?? null;
}

/**
 * Le message d'un refus de prise simultanée.
 *
 * L'index unique de la base est ce qui garantit vraiment qu'un seul homme
 * repart avec l'outil. Quand il refuse, l'erreur Postgres brute ne veut rien
 * dire pour quelqu'un debout dans un dépôt : on la traduit.
 */
export const MESSAGE_PRISE_SIMULTANEE =
  "Quelqu'un vient de prendre cet outil. Actualisez la liste pour voir ce qui reste.";

/** Postgres signale une violation d'unicité par le code 23505. */
export function estUnePriseSimultanee(code: string | undefined | null): boolean {
  return code === "23505";
}
