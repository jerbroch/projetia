"use client";

import { useEffect, useRef } from "react";

/**
 * L'INVENTAIRE SE RAFRAÎCHIT SEUL SUR UN ÉCRAN RESTÉ OUVERT.
 *
 * Un outil change de main entre deux personnes qui regardent chacune leur
 * écran : le bureau sur son ordinateur, l'homme sur son téléphone au dépôt.
 * Sans cela, l'un des deux lit un inventaire vieux d'une heure et téléphone
 * pour une perceuse déjà rendue.
 *
 * C'EST UNE RELECTURE PÉRIODIQUE, PAS UNE NOTIFICATION POUSSÉE. Le serveur
 * n'annonce rien ; on redemande. La différence compte : l'écran peut avoir
 * jusqu'à un intervalle de retard, et il faut le dire plutôt que de laisser
 * croire à de l'instantané.
 *
 * TROIS PRÉCAUTIONS, chacune pour un vrai défaut :
 *   • on ne demande rien quand l'onglet est caché — un téléphone en poche
 *     n'a pas besoin d'interroger le serveur toutes les trente secondes ;
 *   • on redemande dès le retour à l'écran et dès le retour du réseau, sans
 *     attendre le prochain tour ;
 *   • deux relectures ne se chevauchent jamais : sur un réseau de chantier,
 *     elles s'empileraient jusqu'à se répondre dans le désordre.
 */
export function useInventaireVivant(
  relire: () => Promise<void>,
  intervalleMs = 30_000,
): void {
  const enCours = useRef(false);
  const fn = useRef(relire);
  fn.current = relire;

  useEffect(() => {
    let vivant = true;

    async function relireUneFois() {
      if (!vivant || enCours.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      enCours.current = true;
      try {
        await fn.current();
      } catch {
        /* Hors réseau : on garde ce qu'on a plutôt que de vider l'écran. */
      } finally {
        enCours.current = false;
      }
    }

    const minuterie = window.setInterval(relireUneFois, intervalleMs);
    document.addEventListener("visibilitychange", relireUneFois);
    window.addEventListener("online", relireUneFois);

    return () => {
      vivant = false;
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", relireUneFois);
      window.removeEventListener("online", relireUneFois);
    };
  }, [intervalleMs]);
}
