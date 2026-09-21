import { isoToZonedDateKey } from "@/lib/schedule-timezone";
import { getActiveFieldJobs } from "@/lib/field-workers";
import type { Quote, ScheduleEvent, ToolListItem } from "@/types";

/**
 * LES QUATRE CHIFFRES DE LA JOURNÉE, ET LES TROIS CHOSES À FAIRE AVANCER.
 *
 * L'accueil affichait des totaux d'entreprise — clients, projets actifs,
 * revenus. Utiles une fois par mois. La question du lundi matin est plus
 * étroite : combien de travaux aujourd'hui, qui est dehors, qu'est-ce qui
 * attend une décision.
 *
 * AUCUN DE CES CHIFFRES N'EST INVENTÉ. Chacun se calcule à partir de données
 * que l'application possède déjà. Là où une donnée manque, la fonction n'est
 * pas écrite — un compteur plausible mais faux coûte plus cher qu'un compteur
 * absent.
 */

/** Les travaux planifiés aujourd'hui, dans le fuseau de l'entreprise. */
export function travauxDuJour(
  events: ScheduleEvent[],
  aujourdhui: string = isoToZonedDateKey(new Date().toISOString()),
): ScheduleEvent[] {
  return events
    .filter((e) => e.status !== "cancelled" && isoToZonedDateKey(e.start) === aujourdhui)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Les équipes dehors en ce moment.
 *
 * On compte les TRAVAUX actifs, pas les têtes : deux hommes sur le même
 * chantier forment une équipe, pas deux. C'est ce que le mot « équipe »
 * promet, et c'est aussi le chiffre qu'un répartiteur utilise pour savoir
 * combien d'endroits il a à couvrir.
 */
export function equipesActives(events: ScheduleEvent[], maintenant: Date = new Date()): number {
  return getActiveFieldJobs(events, maintenant).length;
}

/**
 * Les soumissions acceptées qui n'ont encore aucun travail au calendrier.
 *
 * Un dépôt payé compte aussi : le client a dit oui deux fois. Ce qui décide
 * ici, c'est l'absence de travail planifié — une soumission acceptée déjà au
 * calendrier n'attend plus personne.
 */
export function aPlanifier(quotes: Quote[], events: ScheduleEvent[]): Quote[] {
  const dejaPlanifiees = new Set(
    events.filter((e) => e.status !== "cancelled" && e.quoteId).map((e) => e.quoteId as string),
  );
  return quotes.filter(
    (q) =>
      (q.status === "accepted" || q.status === "deposit_paid") && !dejaPlanifiees.has(q.id),
  );
}

/** Les travaux prêts à être facturés — le statut existe, on le lit. */
export function aFacturer(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => e.status === "ready-to-invoice");
}

/** Les outils dont la date de retour est dépassée. */
export function outilsEnRetard(outils: ToolListItem[]): ToolListItem[] {
  return outils.filter((o) => (o.daysOverdue ?? 0) > 0);
}

/**
 * Les initiales affichées dans les pastilles d'équipe.
 *
 * Deux lettres au plus : une pastille de 28 px n'en contient pas davantage, et
 * trois lettres tassées se lisent moins bien qu'une seule.
 */
export function initialesDe(nom: string): string {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((m) => m[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * « Lundi 21 septembre » — la date écrite comme on la dit.
 *
 * Dans le fuseau de l'entreprise : le bureau et le chantier doivent lire la
 * même journée, même consultés depuis un autre fuseau.
 */
export function dateDuJourEnLettres(maintenant: Date = new Date()): string {
  const brut = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Montreal",
  }).format(maintenant);
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/**
 * « 07:30 » dans le fuseau de l'entreprise.
 *
 * Deux-points, pas « 07 h 30 » : c'est la forme de la maquette, et celle
 * qu'on lit dans une colonne d'horaire où les heures s'alignent. `fr-CA`
 * imposerait le « h », on passe donc par `en-CA` pour le séparateur — la
 * langue n'entre pas en jeu, il n'y a que des chiffres.
 */
export function heureCourte(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Montreal",
  }).format(new Date(iso));
}
