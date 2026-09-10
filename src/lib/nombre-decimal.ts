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
 * La forme normalisée, à pleine précision : chiffres, un seul point décimal.
 * Ne tronque rien — c'est le rôle du filtre de frappe, pas de la lecture.
 */
function normaliser(texte: string): string {
  let t = texte.replace(/[\s  ]/g, "").replace(/[^0-9.,-]/g, "");
  const negatif = t.startsWith("-");
  t = t.replace(/-/g, "");

  // Le PREMIER séparateur est le point décimal ; les suivants sont du bruit.
  // Pas de séparateur de milliers ici : voir l'en-tête du fichier.
  const premier = t.search(/[.,]/);
  if (premier >= 0) {
    t = `${t.slice(0, premier)}.${t.slice(premier + 1).replace(/[.,]/g, "")}`;
  }
  return (negatif ? "-" : "") + t;
}

/**
 * CE QU'ON PEUT TAPER. Filtre de frappe : chiffres, un seul séparateur, et pas
 * plus de décimales que permis. Tronque volontairement — au clavier, un
 * troisième chiffre après la virgule ne doit tout simplement pas s'inscrire.
 *
 * À ne pas confondre avec `decimalDepuisTexte`, qui dit ce qu'un texte VEUT
 * DIRE et arrondit au lieu de tronquer. Les deux règles sont voulues : on
 * empêche de taper une troisième décimale, mais si elle arrive par un autre
 * chemin, on l'arrondit plutôt que de la jeter.
 */
export function texteDecimalNettoye(texte: string, decimales = 2): string {
  // On garde la frappe en cours telle quelle — « 1, » doit survivre le temps
  // que le doigt trouve le 5. Nettoyer trop tôt efface ce qu'on est en train
  // d'écrire.
  let t = texte.replace(/[\s  ]/g, "").replace(/[^0-9.,-]/g, "");

  const negatif = t.startsWith("-");
  t = t.replace(/-/g, "");

  // Un seul séparateur : le premier rencontré. Les suivants sont ignorés.
  const premier = t.search(/[.,]/);
  if (premier >= 0) {
    const entier = t.slice(0, premier);
    const reste = t.slice(premier + 1).replace(/[.,]/g, "");
    t = `${entier},${reste.slice(0, decimales)}`;
  }

  return (negatif ? "-" : "") + t;
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
