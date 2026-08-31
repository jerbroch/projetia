import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countPendingInvitations } from "@/lib/billing/pending-invitations";
import { seatUsage } from "@/lib/billing/seat-limit";

const SOURCE = readFileSync(path.resolve(__dirname, "./employee-access.ts"), "utf8");

/**
 * Corps de la fonction nommée.
 *
 * On saute d'abord la liste de paramètres : `function f(params: { … })` ouvre
 * une accolade AVANT le corps, et s'arrêter à la première donnerait le type
 * des paramètres au lieu du code.
 */
function corpsDeFonction(source: string, nom: string): string {
  const debut = source.indexOf(`function ${nom}(`);
  if (debut === -1) throw new Error(`${nom} introuvable`);

  const parenthese = source.indexOf("(", debut);
  let niveau = 0;
  let finDesParametres = -1;
  for (let i = parenthese; i < source.length; i++) {
    if (source[i] === "(") niveau++;
    else if (source[i] === ")") {
      niveau--;
      if (niveau === 0) {
        finDesParametres = i;
        break;
      }
    }
  }
  if (finDesParametres === -1) throw new Error(`parenthèses déséquilibrées dans ${nom}`);

  const ouvrante = source.indexOf("{", finDesParametres);
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i++) {
    if (source[i] === "{") profondeur++;
    else if (source[i] === "}") {
      profondeur--;
      if (profondeur === 0) return source.slice(ouvrante, i + 1);
    }
  }
  throw new Error(`accolades déséquilibrées dans ${nom}`);
}

/**
 * Le décompte des places additionne les profils actifs ET les invitations en
 * attente. Tant que le profil d'un invité naît « active », la même personne
 * est comptée deux fois — une invitation mangeait deux places. Sur un
 * abonnement Solo, l'entrepreneur était bloqué dès sa première invitation.
 *
 * La garde `enabled === true` de `invitationHoldsSeat` ne protège pas de ça :
 * elle ne se déclenche qu'APRÈS l'activation, donc jamais pendant la fenêtre
 * où le double compte a lieu.
 */
describe("une invitation en attente ne réserve qu'une place", () => {
  const corps = corpsDeFonction(SOURCE, "ensureEmployeeProfileAndMembership");

  it("crée le profil d'un invité avec le statut « invited »", () => {
    expect(corps).toContain('status: "invited"');
  });

  it("ne rend jamais un profil actif au moment de l'invitation", () => {
    // Si ce test échoue, le double comptage est revenu.
    expect(corps).not.toContain('status: "active"');
  });

  it("laisse l'activation faire passer le profil à « active »", () => {
    const activation = corpsDeFonction(SOURCE, "activateEmployeeAccessAfterConfirmation");
    expect(activation).toContain('status: "active"');
  });

  it("compte une place, pas deux, pour un employé invité et pas encore actif", () => {
    // Le profil de l'invité n'est pas « active », il ne pèse donc que par son
    // invitation en attente.
    const profilsActifs = 1; // le propriétaire seul
    const invitations = countPendingInvitations([{ invitedAt: new Date().toISOString() }]);
    const usage = seatUsage(
      { activeProfiles: profilsActifs, pendingInvitations: invitations },
      "solo",
    );
    expect(usage.used).toBe(2);
  });
});
