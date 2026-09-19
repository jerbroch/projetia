import { SCHEDULE_TIMEZONE } from "@/lib/schedule-timezone";
import type { ToolAssignment, ToolListItem } from "@/types";

/**
 * QUI A CET OUTIL, ET DEPUIS QUAND.
 *
 * La question se pose dans les deux interfaces, et elle doit y recevoir la
 * MÊME réponse : un employé qui lit « détenue par Alexandre Tremblay » et un
 * employeur qui lit autre chose sur la même ligne, c'est un appel
 * téléphonique de plus.
 *
 * Ce module est donc la seule source. Les deux écrans en affichent le
 * résultat ; aucun ne recalcule sa version.
 */

/** Ce qu'il faut afficher pour un outil, selon qui regarde. */
export type EtatDeLOutil =
  | { genre: "disponible" }
  | { genre: "a-moi"; depuis: MomentDePrise; enRetard: boolean }
  | { genre: "detenu"; nom: string; depuis: MomentDePrise; enRetard: boolean }
  | { genre: "indisponible"; raison: string };

export interface MomentDePrise {
  /** Instant ISO quand l'heure est connue, sinon la date seule « AAAA-MM-JJ ». */
  iso: string;
  /**
   * L'heure exacte est-elle connue ?
   *
   * On ne l'invente pas. Une prise saisie au dépôt porte son horodatage ; une
   * attribution préparée la veille par le bureau ne dit que le JOUR où l'outil
   * doit sortir. Afficher « à 00 h 00 » dans ce cas serait une précision
   * fausse, et c'est ce genre de détail qui fait douter du reste de l'écran.
   */
  heureConnue: boolean;
}

/**
 * Le moment où l'outil est réellement parti.
 *
 * `created_at` est l'instant où la ligne a été écrite. Quand elle l'a été le
 * jour du départ ou après — le cas d'une prise au dépôt — c'est exactement
 * l'heure de sortie. Quand elle a été préparée à l'avance, l'outil est parti
 * le jour prévu, à une heure que personne n'a enregistrée.
 */
export function debutDeDetention(
  assignation: Pick<ToolAssignment, "startDate" | "createdAt">,
): MomentDePrise {
  const jourDeCreation = (assignation.createdAt ?? "").slice(0, 10);
  if (jourDeCreation && jourDeCreation >= assignation.startDate) {
    return { iso: assignation.createdAt, heureConnue: true };
  }
  return { iso: assignation.startDate, heureConnue: false };
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * « Depuis le 18 septembre à 7 h 30 » — ou sans l'heure quand on l'ignore.
 *
 * L'année n'apparaît que si ce n'est pas l'année en cours : sur un écran de
 * téléphone, « 2026 » répété sur chaque ligne ne dit rien à personne.
 */
export function libelleDepuis(
  moment: MomentDePrise,
  maintenant: Date = new Date(),
): string {
  const d = new Date(moment.heureConnue ? moment.iso : `${moment.iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((x) => x.type === t)?.value ?? 0);

  const jour = p("day");
  const mois = MOIS[p("month") - 1];
  const annee = p("year");
  const anneeCourante = Number(
    new Intl.DateTimeFormat("fr-CA", { timeZone: SCHEDULE_TIMEZONE, year: "numeric" }).format(
      maintenant,
    ),
  );

  const date = `${jour} ${mois}${annee !== anneeCourante ? ` ${annee}` : ""}`;
  if (!moment.heureConnue) return `Depuis le ${date}`;

  // « 7 h 30 » à la québécoise : espaces autour du h, minutes sur deux chiffres.
  const heure = p("hour");
  const minute = String(p("minute")).padStart(2, "0");
  return `Depuis le ${date} à ${heure} h ${minute}`;
}

/** Les raisons d'indisponibilité qui n'ont PAS de détenteur. */
const RAISONS_SANS_DETENTEUR: Record<string, string> = {
  in_repair: "En réparation",
  out_of_service: "Hors service",
};

/**
 * Ce qu'il faut afficher pour cet outil, à cette personne.
 *
 * `employeId` absent = on regarde en employeur : il n'y a pas de « à moi ».
 *
 * UNE RÉSERVATION N'EST PAS UNE DÉTENTION. Le statut effectif le sait déjà —
 * un outil seulement réservé pour plus tard reste `available` — mais le dire
 * ici évite qu'un futur écran affiche « détenu par » pour quelqu'un qui n'a
 * encore rien pris.
 */
export function etatDeLOutil(
  outil: Pick<
    ToolListItem,
    "effectiveStatus" | "baseStatus" | "currentEmployeeId" | "currentEmployeeName"
  > & { depuis?: MomentDePrise },
  employeId?: string,
): EtatDeLOutil {
  const raison = RAISONS_SANS_DETENTEUR[outil.baseStatus];
  if (raison) return { genre: "indisponible", raison };

  const detenu = outil.effectiveStatus === "in_use" || outil.effectiveStatus === "overdue";
  if (!detenu || !outil.currentEmployeeId) return { genre: "disponible" };

  const depuis = outil.depuis ?? { iso: "", heureConnue: false };
  const enRetard = outil.effectiveStatus === "overdue";
  if (employeId && outil.currentEmployeeId === employeId) {
    return { genre: "a-moi", depuis, enRetard };
  }
  return {
    genre: "detenu",
    nom: outil.currentEmployeeName?.trim() || "Un collègue",
    depuis,
    enRetard,
  };
}

/** Le titre court d'un état, celui de la pastille. */
export function titreDeLEtat(etat: EtatDeLOutil): string {
  switch (etat.genre) {
    case "disponible":
      return "Disponible";
    case "a-moi":
      return etat.enRetard ? "En ma possession — en retard" : "En ma possession";
    case "detenu":
      /*
       * « EN RETARD » N'EST PAS UN SYNONYME D'« INDISPONIBLE ».
       *
       * Les deux disent que l'outil n'est pas là, mais seul le premier appelle
       * un geste : relancer la personne. Fondre les deux dans un mot unique
       * ferait disparaître du tableau la seule ligne sur laquelle le bureau
       * doit agir aujourd'hui.
       */
      return etat.enRetard ? "En retard" : "Indisponible";
    case "indisponible":
      return etat.raison;
  }
}

/** La ligne explicative sous la pastille, ou rien. */
export function detailDeLEtat(etat: EtatDeLOutil): string | null {
  switch (etat.genre) {
    case "detenu":
      return `Détenue par : ${etat.nom}`;
    case "a-moi":
    case "disponible":
    case "indisponible":
      return null;
  }
}

/** Depuis quand, si on le sait. */
export function depuisDeLEtat(etat: EtatDeLOutil, maintenant: Date = new Date()): string | null {
  if (etat.genre !== "detenu" && etat.genre !== "a-moi") return null;
  if (!etat.depuis.iso) return null;
  return libelleDepuis(etat.depuis, maintenant);
}
