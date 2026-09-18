import type { ToolListItem } from "@/types";
import { todayDateString } from "@/lib/tool-utils";

/**
 * CE QU'IL FAUT SAVOIR EN OUVRANT L'APPLICATION À 6 H 30.
 *
 * L'écran d'accueil du travailleur répondait « voici vos calls » et rien
 * d'autre. Les trois questions qu'on se pose vraiment en montant dans le
 * camion — où je vais d'abord, combien il m'en reste, ai-je un outil à
 * rapporter — demandaient de compter soi-même ou de changer d'écran.
 *
 * Ces fonctions sont pures : ce sont des réponses, pas des requêtes.
 */

/**
 * Le prénom, pour saluer quelqu'un par son nom.
 *
 * « Bonjour, Marc Tremblay » sonne comme une convocation. Le prénom seul est
 * la façon dont on s'adresse à un homme qu'on connaît.
 */
export function prenomDe(nomComplet: string | null | undefined): string {
  const premier = (nomComplet ?? "").trim().split(/\s+/)[0];
  return premier || "";
}

/** « Bonjour, Marc » — ou « Bonjour » tout court si le nom manque. */
export function salutation(nomComplet: string | null | undefined): string {
  const prenom = prenomDe(nomComplet);
  return prenom ? `Bonjour, ${prenom}` : "Bonjour";
}

/**
 * L'itinéraire, confié à l'application de cartes du téléphone.
 *
 * `?q=` plutôt qu'une API d'itinéraire : le téléphone ouvre alors SON
 * application par défaut — Plans sur iPhone, Google Maps sur Android — avec
 * le mode de transport et les habitudes de son propriétaire. Imposer un
 * service reviendrait à choisir à sa place.
 */
export function lienItineraire(adresse: string | null | undefined): string | null {
  const propre = (adresse ?? "").trim();
  if (!propre) return null;
  return `https://maps.google.com/?q=${encodeURIComponent(propre)}`;
}

/**
 * Les outils qu'il doit rapporter : échéance atteinte ou dépassée.
 *
 * On compte AUSSI les retards. Un outil attendu hier n'a pas cessé d'être
 * attendu, et c'est précisément celui qu'on oublie.
 */
export function outilsARetourner(
  outils: ToolListItem[],
  aujourdhui: string = todayDateString(),
): ToolListItem[] {
  return outils.filter((o) => !!o.expectedReturnDate && o.expectedReturnDate <= aujourdhui);
}

/** « Retour prévu aujourd'hui », « En retard de 2 jours », ou la date. */
export function libelleRetour(
  outil: Pick<ToolListItem, "expectedReturnDate" | "daysOverdue">,
  aujourdhui: string = todayDateString(),
): string {
  if (!outil.expectedReturnDate) return "Sans date de retour";
  const retard = outil.daysOverdue ?? 0;
  if (retard > 0) return `En retard de ${retard} jour${retard > 1 ? "s" : ""}`;
  if (outil.expectedReturnDate === aujourdhui) return "Retour prévu aujourd'hui";
  return `Retour prévu le ${dateCourte(outil.expectedReturnDate)}`;
}

/** « 21 sept. » — la forme qu'on lit d'un coup d'œil sur un écran étroit. */
export function dateCourte(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return iso;
  const mois = [
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juill.", "août", "sept.", "oct.", "nov.", "déc.",
  ];
  return `${j} ${mois[m - 1]}`;
}

/**
 * L'accord du compte, écrit une fois pour toutes.
 *
 * « 1 interventions » est le genre de détail qui fait douter du reste de
 * l'écran.
 */
export function pluriel(n: number, singulier: string, plurielMot = `${singulier}s`): string {
  return n === 1 ? singulier : plurielMot;
}
