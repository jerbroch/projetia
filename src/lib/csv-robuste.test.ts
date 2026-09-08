import { describe, expect, it } from "vitest";
import { champ, decouperLigne, devineSeparateur, lireCsv, nombreDepuisTexte } from "@/lib/csv-robuste";

describe("nombreDepuisTexte", () => {
  // LE CAS QUI COÛTE CHER : l'ancien `parseFloat` rendait 1234 pour « 1234,56 »
  // et 1 pour « 1 180,00 $ ». Il n'échouait pas — il importait un mauvais prix.
  it("lit la virgule décimale du Québec", () => {
    expect(nombreDepuisTexte("1234,56")).toBe(1234.56);
    expect(nombreDepuisTexte("10,50")).toBe(10.5);
  });

  it("lit un prix formaté par un tableur", () => {
    expect(nombreDepuisTexte("1 180,00 $")).toBe(1180);
    expect(nombreDepuisTexte("1 234,56 $")).toBe(1234.56); // insécable étroit
    expect(nombreDepuisTexte("2 500,00 CAD")).toBe(2500);
  });

  it("lit aussi l'écriture anglaise", () => {
    expect(nombreDepuisTexte("1,234.56")).toBe(1234.56);
    expect(nombreDepuisTexte("1234.56")).toBe(1234.56);
  });

  it("distingue le millier de la décimale", () => {
    expect(nombreDepuisTexte("1,500")).toBe(1500); // mille cinq cents
    expect(nombreDepuisTexte("1,50")).toBe(1.5);   // un et demi
  });

  it("rend null plutôt que zéro quand rien n'est lisible", () => {
    // Zéro serait un prix. Un prix faux vaut moins que pas de prix.
    expect(nombreDepuisTexte("")).toBeNull();
    expect(nombreDepuisTexte("à venir")).toBeNull();
    expect(nombreDepuisTexte(undefined)).toBeNull();
    expect(nombreDepuisTexte("N/D")).toBeNull();
  });

  it("lit un négatif, entre parenthèses comme en comptabilité", () => {
    expect(nombreDepuisTexte("-12,50")).toBe(-12.5);
    expect(nombreDepuisTexte("(12,50)")).toBe(-12.5);
  });
});

describe("decouperLigne", () => {
  it("respecte les guillemets autour d'un nom qui contient une virgule", () => {
    expect(decouperLigne('A1,"Tuyau 1/2, cuivre",10.50', ",")).toEqual(["A1", "Tuyau 1/2, cuivre", "10.50"]);
  });

  it("comprend le guillemet doublé", () => {
    expect(decouperLigne('A1,"Tuyau 1/2"" cuivre",10', ",")).toEqual(["A1", 'Tuyau 1/2" cuivre', "10"]);
  });
});

describe("devineSeparateur", () => {
  // Excel en français écrit `;` quand la virgule est le séparateur décimal.
  it("reconnaît le point-virgule d'Excel en français", () => {
    expect(devineSeparateur("sku;name;reference_price")).toBe(";");
  });
  it("reconnaît la virgule et la tabulation", () => {
    expect(devineSeparateur("sku,name,reference_price")).toBe(",");
    expect(devineSeparateur("sku\tname\treference_price")).toBe("\t");
  });
});

describe("lireCsv", () => {
  it("retire le BOM qu'Excel place en tête", () => {
    const { entetes } = lireCsv("﻿sku,name,reference_price\nA1,Tuyau,10");
    expect(entetes[0]).toBe("sku");
  });

  it("saute les lignes vides sans perdre les suivantes", () => {
    const { lignes } = lireCsv("sku,name,prix\nA1,Tuyau,10\n\n,,\nA2,Valve,22");
    expect(lignes).toHaveLength(2);
  });

  it("ne se laisse pas déranger par une colonne en trop", () => {
    const { entetes, lignes } = lireCsv("sku,name,fournisseur,reference_price\nA1,Tuyau,Wolseley,10.50");
    expect(champ(entetes, lignes[0], "name")).toBe("Tuyau");
    expect(champ(entetes, lignes[0], "reference_price")).toBe("10.50");
  });

  it("rend vide un fichier sans ligne de données", () => {
    expect(lireCsv("sku,name,prix").lignes).toHaveLength(0);
    expect(lireCsv("").lignes).toHaveLength(0);
  });
});

describe("champ", () => {
  it("accepte plusieurs libellés pour la même colonne", () => {
    const { entetes, lignes } = lireCsv("nom,prix_reference\nTuyau,10");
    expect(champ(entetes, lignes[0], "name", "nom")).toBe("Tuyau");
    expect(champ(entetes, lignes[0], "reference_price", "prix_reference")).toBe("10");
  });

  it("rend undefined quand la colonne manque", () => {
    const { entetes, lignes } = lireCsv("name,prix\nTuyau,10");
    expect(champ(entetes, lignes[0], "sku")).toBeUndefined();
  });
});

describe("le symbole pouce n'est pas un délimiteur", () => {
  // En plomberie, un diamètre s'écrit 3/4" — et c'est le même caractère qu'un
  // guillemet fermant. Un analyseur naïf du CSV avale la fin de la ligne.
  it("garde un diamètre en pouces", () => {
    expect(decouperLigne('A1,Coude cuivre,3/4",12.50', ",")).toEqual([
      "A1", "Coude cuivre", '3/4"', "12.50",
    ]);
  });

  it("ouvre quand même un champ correctement mis entre guillemets", () => {
    expect(decouperLigne('A1,"Tuyau 1/2, cuivre",10', ",")).toEqual(["A1", "Tuyau 1/2, cuivre", "10"]);
  });

  it("supporte les deux dans la même ligne", () => {
    expect(decouperLigne('"Coude 90°, cuivre",3/4",12.50', ",")).toEqual([
      "Coude 90°, cuivre", '3/4"', "12.50",
    ]);
  });
});

describe("une ligne ambiguë est refusée, pas devinée", () => {
  // « 1234,56 » dans un fichier séparé par des virgules se coupe en deux : la
  // colonne de prix reçoit « 1234 ». Importer ça revient à perdre les cents de
  // chaque ligne sans que rien ne le signale.
  it("compte plus de valeurs que de colonnes", () => {
    const { entetes, lignes } = lireCsv("sku,name,reference_price\nA1,Tuyau,1234,56");
    expect(entetes).toHaveLength(3);
    expect(lignes[0]).toHaveLength(4);
  });

  it("mais pas quand le fichier utilise le point-virgule", () => {
    const { entetes, lignes } = lireCsv("sku;name;reference_price\nA1;Tuyau;1234,56");
    expect(entetes).toHaveLength(3);
    expect(lignes[0]).toHaveLength(3);
    expect(nombreDepuisTexte(lignes[0][2])).toBe(1234.56);
  });
});
