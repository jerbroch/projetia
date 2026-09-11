import { z } from "zod";

/**
 * LIRE UN NOMBRE TAPÉ PAR QUELQU'UN, AVEC LA VIRGULE OU LE POINT.
 *
 * Au Québec on écrit « 1,5 heure ». Un `<input type="number">` refuse la
 * virgule dans la plupart des navigateurs : la valeur lue devient une chaîne
 * vide, `Number("")` rend 0, et l'entrepreneur voit sa journée et demie
 * enregistrée comme zéro heure sans un mot d'avertissement. C'est un défaut qui
 * ment — il n'échoue pas, il donne un chiffre faux.
 *
 * POURQUOI PAS `nombreDepuisTexte` DE csv-robuste.ts : ce lecteur-là sert à
 * l'argent importé d'un tableur, où « 1,500 » vaut mille cinq cents. Pour des
 * heures et des taux tapés à la main, personne n'écrit de séparateur de
 * milliers : « 1,500 » veut dire une heure et demie. Les deux règles sont
 * justes chacune chez elle, et les confondre donnerait mille fois trop.
 */

/**
 * LA RÈGLE, UNE SEULE, QUEL QUE SOIT LE GESTE.
 *
 * Un séparateur : il est décimal. Deux : le DERNIER est décimal, l'autre
 * sépare les milliers. La position tranche — c'est déterministe, on ne devine
 * rien.
 *
 * Elle vaut à la frappe comme au collage. Deux règles selon le geste voudrait
 * dire que coller « 1,5 » donne 15 alors que le taper donne 1,5 : même texte,
 * deux valeurs, et personne ne saurait laquelle il a obtenue.
 *
 * Le filtre de frappe empêche d'ajouter un second séparateur au clavier ; tout
 * texte qu'on PEUT taper n'en a donc qu'un, et donne le même résultat collé.
 */
function normaliser(texte: string): string {
  let t = texte
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[$€£]/g, "")
    .replace(/[^0-9.,-]/g, "");
  const negatif = t.startsWith("-");
  t = t.replace(/-/g, "");

  const positions: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "." || t[i] === ",") positions.push(i);
  }

  if (positions.length) {
    const dernier = positions[positions.length - 1];
    const enCours = dernier === t.length - 1;

    if (enCours && positions.length > 1) {
      // Un séparateur posé en fin de frappe alors qu'il y en a déjà un : on
      // jette celui qu'on vient de taper, plutôt que de réinterpréter le
      // précédent sous les doigts.
      const avantDernier = positions[positions.length - 2];
      const sansLeDernier = t.slice(0, dernier);
      t = sansLeDernier.slice(0, avantDernier).replace(/[.,]/g, "") +
          "." + sansLeDernier.slice(avantDernier + 1).replace(/[.,]/g, "");
    } else if (enCours) {
      t = t.slice(0, dernier).replace(/[.,]/g, "") + ".";
    } else {
      // Le dernier séparateur est le point décimal ; ceux d'avant séparaient
      // les milliers et disparaissent.
      t = t.slice(0, dernier).replace(/[.,]/g, "") + "." + t.slice(dernier + 1);
    }
  }

  return (negatif ? "-" : "") + t;
}

/**
 * CE QU'ON PEUT TAPER. Même règle que la lecture, plus une limite de
 * décimales : au clavier, un troisième chiffre après la virgule ne s'inscrit
 * pas. La LECTURE, elle, arrondit au lieu de tronquer — voir
 * `decimalDepuisTexte`.
 */
export function texteDecimalNettoye(texte: string, decimales = 2): string {
  const t = normaliser(texte);
  if (!t) return "";

  const point = t.indexOf(".");
  if (point < 0) return t;

  const entier = t.slice(0, point);
  const fraction = t.slice(point + 1).slice(0, decimales);
  return `${entier},${fraction}`;
}


/**
 * Le nombre, ou `null` si le texte n'en contient pas.
 *
 * `null` et non 0 : « rien de saisi » et « zéro heure » sont deux réponses
 * différentes, et les confondre est exactement ce qui produisait le zéro
 * silencieux.
 */
export function decimalDepuisTexte(
  texte: string | number | null | undefined,
  decimales = 2
): number | null {
  if (typeof texte === "number") {
    return Number.isFinite(texte) ? arrondir(texte, decimales) : null;
  }
  if (texte == null) return null;

  // Pleine précision d'abord, arrondi ensuite : passer par le filtre de frappe
  // tronquerait, et la même valeur donnerait deux résultats selon qu'elle
  // arrive en texte ou en nombre.
  const t = normaliser(String(texte));
  if (!t || t === "-" || t === "." || t === "-.") return null;

  const n = Number(t);
  return Number.isFinite(n) ? arrondir(n, decimales) : null;
}

/**
 * Arrondi décimal sûr. `Math.round(x * 100) / 100` seul se trompe sur les
 * valeurs que la virgule flottante ne représente pas exactement — 1,005 rend
 * 1,00 au lieu de 1,01. Le passage par la notation exponentielle évite ça.
 */
function arrondir(n: number, decimales: number): number {
  const f = Number(`${n}e${decimales}`);
  return Number(`${Math.round(f)}e-${decimales}`);
}

/** Pour l'affichage : la virgule, comme on l'écrit ici. */
export function texteDepuisDecimal(n: number | null | undefined, decimales = 2): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(arrondir(n, decimales)).replace(".", ",");
}

/**
 * Le même lecteur, côté serveur. `z.coerce.number()` sur « 1,5 » rend NaN et
 * la validation refuse la saisie sans dire pourquoi : le formulaire répond
 * « les heures doivent être supérieures à 0 » alors qu'une heure et demie a
 * bien été tapée. Le champ n'est qu'une moitié de la correction.
 */
export function zNombreDecimal(interne: z.ZodNumber = z.number(), decimales = 2) {
  return z.preprocess((v) => {
    if (typeof v === "number" || typeof v === "string") {
      return decimalDepuisTexte(v, decimales);
    }
    return v;
  }, interne);
}
