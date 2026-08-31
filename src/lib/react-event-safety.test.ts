/**
 * Garde statique contre un motif qui a bloqué des employés sur un chantier.
 *
 * React remet `event.currentTarget` à `null` dès que le gestionnaire d'événement
 * rend la main. Le lire APRÈS un `await` — typiquement dans le corps d'un
 * `startTransition(async () => …)` — lève « Cannot read properties of null ».
 *
 * Ce n'est pas une erreur bénigne : l'exception interrompt la transition, la
 * suite du bloc n'est jamais atteinte (`router.refresh()` compris), et l'état
 * d'attente reste bloqué à `true`. Dans `field-call-detail-client.tsx`, un
 * employé de terrain voyait ses heures s'afficher puis la fiche se figer — plus
 * aucun bouton actif, ni matériaux ni « travaux terminés ».
 *
 * La parade : capturer l'élément dans une variable AVANT le premier `await`.
 *
 *   const form = e.currentTarget;        // ✅ synchrone
 *   startTransition(async () => {
 *     await action();
 *     form.reset();                      // ✅ la référence tient
 *   });
 *
 * Un test unitaire classique ne peut pas attraper ça — il faudrait un rendu
 * navigateur et le bon enchaînement. On inspecte donc la source.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "..");

function fichiersReact(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === "generated" || entree === "node_modules") continue;
    const complet = path.join(dossier, entree);
    if (statSync(complet).isDirectory()) out.push(...fichiersReact(complet));
    else if (complet.endsWith(".tsx")) out.push(complet);
  }
  return out;
}

/**
 * Emplacements où `currentTarget` est lu alors qu'un `await` le précède DANS LE
 * MÊME BLOC.
 *
 * On part de chaque occurrence et on remonte au bloc qui l'entoure, plutôt que
 * de descendre depuis les fonctions : le corps d'un composant contient de toute
 * façon des `await` et des `currentTarget`, ce qui rendrait toute lecture
 * suspecte. Ce qui compte est l'ordre à l'intérieur du bloc le plus proche.
 */
/** Les commentaires ne sont pas du code : un « await » en prose n'y compte pas. */
function sansCommentaires(source: string): string {
  // Remplacés par des espaces pour préserver les positions et les numéros de ligne.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (ligne) => " ".repeat(ligne.length));
}

function lecturesRisquees(brut: string): number[] {
  const source = sansCommentaires(brut);
  const risquees: number[] = [];

  for (let i = source.indexOf("currentTarget"); i !== -1; i = source.indexOf("currentTarget", i + 1)) {
    // Remonter jusqu'à l'accolade ouvrante du bloc englobant.
    let profondeur = 0;
    let debut = -1;
    for (let j = i; j >= 0; j--) {
      if (source[j] === "}") profondeur++;
      else if (source[j] === "{") {
        if (profondeur === 0) { debut = j; break; }
        profondeur--;
      }
    }
    if (debut === -1) continue;

    const avant = source.slice(debut, i);
    if (/\bawait\b/.test(avant)) {
      risquees.push(source.slice(0, i).split("\n").length);
    }
  }
  return risquees;
}

describe("currentTarget n'est jamais lu après un await", () => {
  const fichiers = fichiersReact(path.join(RACINE, "components"));

  it("inspecte bien l'ensemble des composants", () => {
    // Si cette garde tombe à zéro, le test passerait pour de mauvaises raisons.
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it.each(fichiers.map((f) => [path.relative(RACINE, f), f]))(
    "%s",
    (relatif, complet) => {
      const source = readFileSync(complet, "utf8");
      if (!source.includes("currentTarget")) return;

      const fautives = lecturesRisquees(source);

      expect(
        fautives,
        `${relatif} lit \`currentTarget\` après un \`await\`. React l'a remis à ` +
          "null entre-temps : capturez l'élément dans une variable AVANT le " +
          `premier await. Lignes : ${fautives.join(", ")}. Voir l'en-tête de ce fichier.`,
      ).toEqual([]);
    },
  );
});
