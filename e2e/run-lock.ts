/**
 * Verrou empêchant deux passages e2e simultanés sur la même base.
 *
 * Le teardown supprime les entreprises et comptes marqués e2e — tous, pas
 * seulement les siens, pour rattraper ceux qu'un passage interrompu aurait
 * laissés. Deux passages qui se chevauchent se détruisent donc mutuellement :
 * la purge du premier efface le locataire que le second vient de créer, et la
 * session enregistrée pointe alors sur un compte supprimé. Tous les tests qui
 * s'appuient sur cette session se retrouvent sur la page de connexion.
 *
 * C'est arrivé : un passage lancé vingt secondes après un autre a produit
 * 21 échecs, tous des tests parfaitement sains, relancés seuls sans une
 * anomalie. Le diagnostic a coûté une demi-heure pour une cause qui n'était
 * pas dans le code testé.
 *
 * En CI le problème ne se pose pas — le groupe de concurrence sérialise les
 * exécutions. C'est en local qu'il faut se protéger.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const FICHIER = path.resolve(__dirname, "../.e2e-run.lock");

interface Verrou {
  pid: number;
  demarre: string;
}

/** Le processus qui détient le verrou tourne-t-il encore ? */
function processusVivant(pid: number): boolean {
  try {
    // Le signal 0 ne tue rien : il vérifie seulement l'existence.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pose le verrou, ou lève si un autre passage est en cours.
 *
 * Un verrou dont le processus est mort est repris sans bruit : un passage
 * interrompu par Ctrl+C ne doit pas bloquer tous les suivants.
 */
export function acquerirVerrou(): void {
  if (existsSync(FICHIER)) {
    try {
      const v: Verrou = JSON.parse(readFileSync(FICHIER, "utf8"));
      if (processusVivant(v.pid)) {
        throw new Error(
          `\n\n❌ Un passage e2e est déjà en cours (pid ${v.pid}, démarré à ${v.demarre}).\n\n` +
            "   Deux passages simultanés se détruisent mutuellement : le teardown\n" +
            "   de l'un supprime le locataire que l'autre vient de créer.\n\n" +
            "   Attendez la fin du premier, ou supprimez .e2e-run.lock s'il est\n" +
            "   resté après un arrêt brutal.\n",
        );
      }
    } catch (err) {
      // Un verrou illisible est un résidu : on le reprend. Mais on laisse
      // passer notre propre refus, qui n'est pas une erreur de lecture.
      if (err instanceof Error && err.message.includes("passage e2e est déjà en cours")) {
        throw err;
      }
    }
  }

  mkdirSync(path.dirname(FICHIER), { recursive: true });
  writeFileSync(
    FICHIER,
    JSON.stringify({ pid: process.pid, demarre: new Date().toISOString() } satisfies Verrou),
  );
}

/** Retire le verrou. Sans effet s'il a déjà disparu. */
export function libererVerrou(): void {
  rmSync(FICHIER, { force: true });
}
