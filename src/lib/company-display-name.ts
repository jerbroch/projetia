/**
 * Présentation du nom d'entreprise.
 *
 * Les noms sont saisis à l'inscription, souvent tout en minuscules
 * (« plomberie goutte d'eau »). Affiché tel quel dans une soumission, une
 * facture ou un courriel d'invitation, ça fait négligé.
 *
 * On ne corrige QUE les noms entièrement en minuscules. Dès qu'une majuscule
 * est présente, la saisie est réputée volontaire et rendue intacte : « ABC
 * INC. » doit rester « ABC INC. », et « McDonald Construction » ne doit pas
 * devenir « Mcdonald ». Cette règle est délibérément timide — se tromper en
 * corrigeant est pire que ne rien faire.
 *
 * On ne modifie pas la donnée stockée : c'est une couche d'affichage.
 */

/** Particules françaises qui restent minuscules sauf en tête de nom. */
const PARTICULES = new Set([
  "de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "sur", "sous",
]);

function capitaliser(mot: string): string {
  if (!mot) return mot;
  return mot[0].toUpperCase() + mot.slice(1);
}

export function formatCompanyName(nom: string | null | undefined): string {
  if (!nom) return "";
  const brut = nom.trim();
  if (!brut) return "";

  // Une majuscule quelque part = saisie volontaire, on n'y touche pas.
  if (/[A-ZÀ-Þ]/.test(brut)) return brut;

  return brut
    .split(/(\s+)/)
    .map((morceau, index) => {
      if (/^\s+$/.test(morceau)) return morceau;

      // « d'eau », « l'atelier » : l'élision garde sa minuscule en cours de
      // nom, mais se capitalise en tête.
      const elision = /^([dl])'(.*)$/.exec(morceau);
      if (elision) {
        return index === 0
          ? `${elision[1].toUpperCase()}'${elision[2]}`
          : morceau;
      }

      if (index > 0 && PARTICULES.has(morceau)) return morceau;
      return capitaliser(morceau);
    })
    .join("");
}
