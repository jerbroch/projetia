import type { LaborRateTemplate } from "@/types";

/**
 * L'entrepreneur peut-il chiffrer une soumission avec ses gabarits actuels ?
 *
 * Les gabarits arrivent à zéro à l'inscription : ils portent le vocabulaire
 * générique — « Employé senior », « Employé », « Apprenti », « Transport » —
 * mais aucun taux, parce qu'un montant plausible mais faux est plus dangereux
 * qu'un champ vide. Il peut partir sur une soumission sans que personne s'en
 * aperçoive.
 *
 * Encore faut-il que l'entrepreneur SACHE qu'il doit les remplir, et où. Sans
 * message, il ajoute une ligne de main-d'œuvre, voit 0 $, et n'a aucune idée
 * de l'endroit où changer ça.
 */
export function gabaritsSansTaux(templates: readonly LaborRateTemplate[]): LaborRateTemplate[] {
  return templates.filter((t) => t.isActive !== false && (t.billRate ?? 0) <= 0);
}

/** Vrai quand AUCUN gabarit actif ne porte de taux : rien n'est facturable. */
export function aucunTauxFacturable(templates: readonly LaborRateTemplate[]): boolean {
  const actifs = templates.filter((t) => t.isActive !== false);
  if (actifs.length === 0) return true;
  return actifs.every((t) => (t.billRate ?? 0) <= 0);
}

/**
 * Message montré dans la soumission. Dit le problème, la conséquence, et
 * l'endroit exact où le régler — dans cet ordre, parce que c'est celui dans
 * lequel la question se pose.
 */
export function messageGabaritsARemplir(templates: readonly LaborRateTemplate[]): string | null {
  const actifs = templates.filter((t) => t.isActive !== false);
  if (actifs.length === 0) {
    return "Vous n'avez aucun taux de main-d'œuvre. Sans eux, vos heures seront chiffrées à 0 $.";
  }

  const vides = gabaritsSansTaux(templates);
  if (vides.length === 0) return null;

  if (vides.length === actifs.length) {
    return `Vos ${actifs.length} taux de main-d'œuvre sont encore à 0 $. Tant qu'ils ne sont pas remplis, vos heures seront chiffrées à 0 $.`;
  }

  const noms = vides.map((t) => `« ${t.name} »`).join(", ");
  return `${vides.length === 1 ? "Un taux n'est pas rempli" : `${vides.length} taux ne sont pas remplis`} : ${noms}. Les heures qui s'y rattachent seront chiffrées à 0 $.`;
}
