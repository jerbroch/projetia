/**
 * LIRE UN CSV QUI VIENT D'UN VRAI TABLEUR QUÉBÉCOIS.
 *
 * L'analyse d'origine faisait `ligne.split(",")` et `parseFloat`. Mesuré sur
 * des cas ordinaires, ça donnait :
 *
 *   • `1234,56`            → 1234       les cents disparaissent EN SILENCE
 *   • `1 180,00 $`         → 1          un chauffe-eau facturé une piastre
 *   • séparateur `;`       → 0 ligne    c'est le défaut d'Excel en français
 *   • `"Tuyau 1/2, cuivre"` → 0 ligne   un nom avec une virgule casse tout
 *
 * Les deux premiers sont les pires : ils n'échouent pas, ils importent un
 * mauvais prix. Un fichier de 718 lignes passerait « avec succès » et la moitié
 * des articles seraient chiffrés à côté.
 */

/** Séparateurs qu'un tableur peut produire, par ordre de fréquence ici. */
const SEPARATEURS = [";", ",", "\t"] as const;

/**
 * Devine le séparateur d'après la ligne d'entête.
 *
 * Excel en français écrit `;` — c'est son réglage par défaut quand la virgule
 * est le séparateur décimal du système. Deviner plutôt qu'imposer évite de
 * renvoyer l'entrepreneur reconfigurer son tableur.
 */
export function devineSeparateur(entete: string): string {
  let meilleur = ",";
  let compte = 0;
  for (const s of SEPARATEURS) {
    const n = decouperLigne(entete, s).length;
    if (n > compte) {
      compte = n;
      meilleur = s;
    }
  }
  return meilleur;
}

/**
 * Découpe une ligne en respectant les guillemets.
 *
 * `"Tuyau 1/2, cuivre",10.50` doit donner deux champs, pas trois. Les
 * guillemets doublés (`""`) représentent un guillemet littéral, comme le veut
 * la convention CSV.
 */
export function decouperLigne(ligne: string, separateur: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else if (entreGuillemets) {
        entreGuillemets = false;
      } else if (courant === "") {
        // UN GUILLEMET N'OUVRE UN CHAMP QUE S'IL EST EN PREMIÈRE POSITION.
        //
        // En plomberie, un diamètre s'écrit 3/4" ou 1/2" : le symbole pouce EST
        // un guillemet. Le traiter comme un délimiteur avalait la fin de la
        // ligne et faisait disparaître l'article. C'est aussi ce que dit la
        // convention CSV — un guillemet au milieu d'un champ est un caractère
        // comme un autre.
        entreGuillemets = true;
      } else {
        courant += c;
      }
    } else if (c === separateur && !entreGuillemets) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs.map((c) => c.trim());
}

export interface CsvLu {
  entetes: string[];
  lignes: string[][];
  separateur: string;
}

/**
 * Lit le contenu d'un fichier CSV. Retire le BOM qu'Excel place en tête —
 * sans quoi la première colonne s'appelle `﻿sku` et n'est jamais trouvée.
 */
export function lireCsv(contenu: string): CsvLu {
  const sansBom = contenu.replace(/^﻿/, "");
  const lignesBrutes = sansBom.trim().split(/\r?\n/);
  if (lignesBrutes.length < 2) return { entetes: [], lignes: [], separateur: "," };

  const separateur = devineSeparateur(lignesBrutes[0]);
  const entetes = decouperLigne(lignesBrutes[0], separateur).map((h) => h.toLowerCase());

  const lignes: string[][] = [];
  for (let i = 1; i < lignesBrutes.length; i++) {
    const champs = decouperLigne(lignesBrutes[i], separateur);
    // Une ligne vide, ou faite seulement de séparateurs, ne dit rien.
    if (champs.every((c) => !c)) continue;
    lignes.push(champs);
  }

  return { entetes, lignes, separateur };
}

/** Accès par nom de colonne, en acceptant plusieurs libellés. */
export function champ(entetes: string[], champs: string[], ...noms: string[]): string | undefined {
  for (const nom of noms) {
    const i = entetes.indexOf(nom);
    if (i >= 0 && champs[i] !== undefined && champs[i] !== "") return champs[i];
  }
  return undefined;
}

/**
 * Lit un nombre écrit par un humain ou par un tableur.
 *
 * Accepte `1234.56`, `1234,56`, `1 234,56`, `1 234,56 $`, `1,234.56`.
 * Rend `null` — jamais zéro — quand rien de lisible ne s'y trouve : zéro
 * serait un prix, et un prix faux vaut moins que pas de prix du tout.
 */
export function nombreDepuisTexte(texte: string | undefined | null): number | null {
  if (texte == null) return null;

  // Espaces de toutes sortes, y compris l'insécable étroit que `fr-CA` utilise
  // comme séparateur de milliers, et les symboles monétaires.
  let t = texte
    .replace(/[\s   ]/g, "")
    .replace(/[$€£]/g, "")
    .replace(/CAD/gi, "")
    .trim();
  if (!t) return null;

  const negatif = t.startsWith("-") || (t.startsWith("(") && t.endsWith(")"));
  t = t.replace(/^[-(]/, "").replace(/\)$/, "");

  const dernierPoint = t.lastIndexOf(".");
  const derniereVirgule = t.lastIndexOf(",");

  if (dernierPoint >= 0 && derniereVirgule >= 0) {
    // Les deux : le SÉPARATEUR DÉCIMAL EST LE DERNIER. `1,234.56` est anglais,
    // `1.234,56` est européen — la position tranche sans qu'on ait à deviner.
    if (derniereVirgule > dernierPoint) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
  } else if (derniereVirgule >= 0) {
    // Une virgule seule : décimale si elle laisse une queue de 1 ou 2 chiffres,
    // séparateur de milliers sinon — `1,500` est mille cinq cents.
    const queue = t.length - derniereVirgule - 1;
    t = queue > 0 && queue <= 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  }

  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return negatif ? -n : n;
}
