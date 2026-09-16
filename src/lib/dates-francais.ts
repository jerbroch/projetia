/**
 * LES DATES DE LA MAQUETTE, EN FRANÇAIS DU QUÉBEC.
 *
 * `Intl` fait le travail : aucune liste de mois écrite à la main, donc aucune
 * liste à corriger quand on en oublie un. La majuscule initiale est ajoutée
 * après coup — `fr-CA` rend « mercredi 16 septembre » en minuscules, ce qui
 * est correct dans une phrase mais pas en tête d'écran.
 */

/** « Mercredi 16 septembre » — la date du jour, telle que l'écran l'annonce. */
export function dateLongueFrancais(date: Date = new Date()): string {
  const texte = new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Le jour et le mois abrégé d'une pastille : « 21 » et « SEP ».
 *
 * Le point abréviatif de `fr-CA` (« sept. ») est retiré : dans une pastille
 * en capitales, il ne se lit pas comme une abréviation mais comme une tache.
 */
export function jourEtMois(date: string | Date): { jour: string; mois: string } {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { jour: "—", mois: "" };
  return {
    jour: new Intl.DateTimeFormat("fr-CA", { day: "numeric" }).format(d),
    mois: new Intl.DateTimeFormat("fr-CA", { month: "short" })
      .format(d)
      .replace(/\./g, "")
      .toUpperCase(),
  };
}

/** Le prénom seul, pour « Bonjour Jérôme ». */
export function prenomDe(nomComplet: string | null | undefined): string {
  const premier = (nomComplet ?? "").trim().split(/\s+/)[0];
  return premier || "";
}
