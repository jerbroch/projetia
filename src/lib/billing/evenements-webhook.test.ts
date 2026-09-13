import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EVENEMENTS_WEBHOOK_TRAITES,
  comparerEvenements,
} from "@/lib/billing/evenements-webhook";

describe("comparerEvenements", () => {
  it("voit un événement attendu que Stripe n'envoie pas", () => {
    // Le cas grave : une annulation qui n'arrive jamais.
    const abonnes = EVENEMENTS_WEBHOOK_TRAITES.filter(
      (e) => e !== "customer.subscription.deleted",
    );
    const r = comparerEvenements(abonnes);
    expect(r.aligne).toBe(false);
    expect(r.manquants).toEqual(["customer.subscription.deleted"]);
  });

  it("voit un événement envoyé pour rien", () => {
    // `invoice.paid` était abonné et tombait dans le `default` : chaque
    // renouvellement payé n'enregistrait rien.
    const r = comparerEvenements([...EVENEMENTS_WEBHOOK_TRAITES, "invoice.paid"]);
    expect(r.aligne).toBe(false);
    expect(r.superflus).toEqual(["invoice.paid"]);
  });

  it("reconnaît une liste alignée, quel que soit l'ordre", () => {
    const melange = [...EVENEMENTS_WEBHOOK_TRAITES].reverse();
    expect(comparerEvenements(melange).aligne).toBe(true);
  });

  it("retrouve le désalignement exact du 13 septembre 2026", () => {
    const ceQueStripeEnvoyait = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.updated",
      "customer.deleted",
      "customer.created",
      "invoice.paid",
      "invoice.payment_failed",
    ];
    const r = comparerEvenements(ceQueStripeEnvoyait);
    expect(r.manquants).toEqual([
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.finalized",
      "invoice.marked_uncollectible",
      "invoice.payment_succeeded",
      "invoice.voided",
    ]);
    expect(r.superflus).toEqual([
      "customer.created",
      "customer.deleted",
      "customer.updated",
      "invoice.paid",
    ]);
  });
});

describe("la liste et le gestionnaire ne peuvent pas diverger", () => {
  it("chaque `case` du webhook est déclaré, et réciproquement", () => {
    // On lit le gestionnaire : si quelqu'un ajoute un `case` sans l'inscrire
    // dans la liste, Stripe ne l'enverra jamais et l'ajout sera sans effet.
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/api/stripe/webhook/route.ts"),
      "utf-8",
    );
    const cases = [...source.matchAll(/case "([a-z_]+\.[a-z_.]+)":/g)].map((m) => m[1]);
    expect(cases.length, "aucun `case` trouvé — le motif de lecture a changé").toBeGreaterThan(0);
    expect([...cases].sort()).toEqual([...EVENEMENTS_WEBHOOK_TRAITES].sort());
  });
});
