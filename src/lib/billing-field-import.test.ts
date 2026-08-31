import { describe, expect, it } from "vitest";
import {
  ligneAvecAutreGabarit,
  lignesDeMainOeuvre,
  lignesDeMateriaux,
  lignesQueLImportEcraserait,
  resumeDesHeures,
  saisiesNonImportees,
  type HeureTerrain,
  type MateriauTerrain,
} from "./billing-field-import";

const GABARIT = { id: "g1", name: "Plombier régulier", billRate: 95 };
const h = (id: string, employeeId: string, nom: string, hours: number): HeureTerrain => ({
  id, employeeId, employeeName: nom, hours,
});
const m = (id: string, name: string, quantity: number, catalogItemId?: string): MateriauTerrain => ({
  id, name, quantity, unit: "unité", catalogItemId,
});

describe("lignesDeMainOeuvre", () => {
  it("fait une ligne PAR EMPLOYÉ, au taux du gabarit", () => {
    const r = lignesDeMainOeuvre([h("1","e1","Marc",8), h("2","e2","Julie",4)], GABARIT);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ description: "Julie — Plombier régulier", quantity: 4, unitSellPrice: 95 });
    expect(r[1]).toMatchObject({ description: "Marc — Plombier régulier", quantity: 8 });
  });

  it("additionne les journées d'un même employé", () => {
    const r = lignesDeMainOeuvre([h("1","e1","Marc",8), h("2","e1","Marc",7.5)], GABARIT);
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe(15.5);
    expect(r[0].sourceIds).toEqual(["1","2"]);
  });

  it("ne regroupe PAS tout le monde en une seule ligne", () => {
    // Sinon on ne sait plus qui a travaillé, et corriger la part d'un seul
    // gars devient impossible.
    expect(lignesDeMainOeuvre([h("1","e1","Marc",8), h("2","e2","Julie",8)], GABARIT)).toHaveLength(2);
  });

  it("signale un prix à saisir quand aucun gabarit n'est choisi", () => {
    const r = lignesDeMainOeuvre([h("1","e1","Marc",8)], null);
    expect(r[0].unitSellPrice).toBe(0);
    expect(r[0].prixAsaisir).toBe(true);
  });

  it("ignore une saisie à zéro heure", () => {
    expect(lignesDeMainOeuvre([h("1","e1","Marc",0)], GABARIT)).toHaveLength(0);
  });
});

describe("lignesDeMateriaux", () => {
  const prix = { "cat-1": 12.5 };

  it("prend le prix du catalogue", () => {
    const r = lignesDeMateriaux([m("1","Tuyau ABS",3,"cat-1")], prix);
    expect(r[0]).toMatchObject({ description: "Tuyau ABS", quantity: 3, unitSellPrice: 12.5, prixAsaisir: false });
  });

  it("garde un matériau HORS CATALOGUE, à prix zéro et signalé", () => {
    // Le supprimer ferait facturer un chantier en oubliant du matériel ; lui
    // inventer un prix serait pire.
    const r = lignesDeMateriaux([m("1","Vis spéciale",10)], prix);
    expect(r[0].description).toContain("hors catalogue");
    expect(r[0].unitSellPrice).toBe(0);
    expect(r[0].prixAsaisir).toBe(true);
  });

  it("signale aussi un article du catalogue sans prix connu", () => {
    const r = lignesDeMateriaux([m("1","Coude",2,"cat-inconnu")], prix);
    expect(r[0].prixAsaisir).toBe(true);
  });

  it("additionne les quantités d'un même article", () => {
    const r = lignesDeMateriaux([m("1","Tuyau ABS",3,"cat-1"), m("2","Tuyau ABS",2,"cat-1")], prix);
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe(5);
    expect(r[0].sourceIds).toEqual(["1","2"]);
  });

  it("ne mélange pas deux matériaux libres de noms différents", () => {
    expect(lignesDeMateriaux([m("1","Vis",1), m("2","Boulon",1)], prix)).toHaveLength(2);
  });
});

describe("saisiesNonImportees", () => {
  it("repère ce qui est arrivé après le dernier import", () => {
    // Le cas qui fait facturer un chantier en oubliant les heures du gars qui
    // a saisi en retard.
    const lignes = [{ id:"l1", sourceKind:"field_hours", sourceIds:["1"], description:"Marc" }];
    const r = saisiesNonImportees(lignes, [h("1","e1","Marc",8), h("2","e1","Marc",4)], []);
    expect(r.heures.map((x) => x.id)).toEqual(["2"]);
  });

  it("ne signale rien quand tout est déjà importé", () => {
    const lignes = [{ id:"l1", sourceKind:"field_hours", sourceIds:["1","2"], description:"Marc" }];
    expect(saisiesNonImportees(lignes, [h("1","e1","Marc",8), h("2","e1","Marc",4)], []).heures).toHaveLength(0);
  });
});

describe("lignesQueLImportEcraserait", () => {
  it("ne retient que les lignes importées ET retouchées", () => {
    const lignes = [
      { id:"a", sourceKind:"field_hours", sourceIds:["1"], manuallyEdited:true, description:"Marc" },
      { id:"b", sourceKind:"field_hours", sourceIds:["2"], manuallyEdited:false, description:"Julie" },
      { id:"c", sourceKind:null, sourceIds:[], manuallyEdited:true, description:"Ligne ajoutée à la main" },
    ];
    expect(lignesQueLImportEcraserait(lignes).map((l) => l.id)).toEqual(["a"]);
  });
});

describe("resumeDesHeures", () => {
  it("donne prévu, réel, écart et ce qui n'est pas encore facturé", () => {
    const lignes = [{ id:"l1", sourceKind:"field_hours", sourceIds:["1"], description:"Marc" }];
    expect(resumeDesHeures(8, [h("1","e1","Marc",8), h("2","e1","Marc",3)], lignes)).toEqual({
      prevu: 8, reel: 11, ecart: 3, nonImportees: 3,
    });
  });

  it("montre un écart négatif quand le chantier a pris moins de temps", () => {
    expect(resumeDesHeures(16, [h("1","e1","Marc",10)], []).ecart).toBe(-6);
  });
});

describe("un réimport ne facture jamais deux fois", () => {
  it("écarte une proposition qui recoupe une ligne conservée", () => {
    // Le défaut trouvé en navigateur : la ligne corrigée couvrait 3 saisies,
    // une 4e est arrivée, et la proposition — qui couvrait les 4 — s'ajoutait
    // À CÔTÉ. L'employé était facturé deux fois.
    const conservees = [{ id:"gardee", sourceKind:"field_hours", sourceIds:["1","2","3"], manuallyEdited:true, description:"Marc" }];
    const couvertes = new Set(conservees.flatMap((l) => l.sourceIds));
    const proposition = { sourceIds:["1","2","3","4"] };
    const recoupe = proposition.sourceIds.some((id) => couvertes.has(id));
    expect(recoupe).toBe(true);
  });

  it("laisse passer une proposition sans recoupement", () => {
    const couvertes = new Set(["1","2"]);
    expect(["3","4"].some((id) => couvertes.has(id))).toBe(false);
  });
});

describe("ligneAvecAutreGabarit", () => {
  it("recalcule le prix sans toucher aux heures", () => {
    // Les heures viennent du terrain et ne se discutent pas. Seul le TAUX est
    // une décision de bureau.
    const r = ligneAvecAutreGabarit(11, { id: "g2", name: "Temps supplémentaire", billRate: 142.5 });
    expect(r.unitSellPrice).toBe(142.5);
    expect(r.lineTotal).toBe(1567.5);
    expect(r.prixAsaisir).toBe(false);
  });

  it("signale un gabarit sans taux facturable", () => {
    expect(ligneAvecAutreGabarit(8, { id: "g3", name: "Interne", billRate: 0 })).toEqual({
      unitSellPrice: 0,
      lineTotal: 0,
      prixAsaisir: true,
    });
  });

  it("supporte l'absence de gabarit", () => {
    expect(ligneAvecAutreGabarit(8, null).prixAsaisir).toBe(true);
  });

  it("arrondit au cent", () => {
    expect(ligneAvecAutreGabarit(3.33, { id: "g", name: "x", billRate: 99.99 }).lineTotal).toBe(332.97);
  });
});

describe("la ligne importée retient son gabarit", () => {
  it("porte l'identifiant, pour pouvoir en changer ensuite", () => {
    const r = lignesDeMainOeuvre([h("1", "e1", "Marc", 8)], GABARIT);
    expect(r[0].laborTemplateId).toBe("g1");
  });

  it("le laisse vide quand aucun gabarit ne s'applique", () => {
    expect(lignesDeMainOeuvre([h("1", "e1", "Marc", 8)], null)[0].laborTemplateId).toBeNull();
  });
});
