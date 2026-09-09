import { describe, expect, it } from "vitest";
import {
  deviseDe,
  ligneAbonnementDepuisStripe,
  montantEnCents,
} from "@/lib/billing/enregistrement-abonnement";

const MAINTENANT = "2026-09-09T12:00:00.000Z";

function abonnement(surcharge: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    status: "active",
    customer: "cus_456",
    start_date: 1_757_000_000,
    items: {
      data: [
        {
          quantity: 1,
          current_period_start: 1_757_000_000,
          current_period_end: 1_759_678_400,
          price: { unit_amount: 9900, currency: "cad" },
        },
      ],
    },
    ...surcharge,
  };
}

describe("montantEnCents", () => {
  it("lit le prix unitaire", () => {
    expect(montantEnCents(abonnement())).toBe(9900);
  });

  // Prendre `unit_amount` seul afficherait la moitié du revenu réel — et
  // personne ne remarquerait l'écart, contrairement à un zéro.
  it("multiplie par la quantité", () => {
    const deuxSieges = abonnement({
      items: { data: [{ quantity: 2, price: { unit_amount: 9900, currency: "cad" } }] },
    });
    expect(montantEnCents(deuxSieges)).toBe(19800);
  });

  it("additionne plusieurs lignes", () => {
    const multiple = abonnement({
      items: {
        data: [
          { quantity: 1, price: { unit_amount: 9900, currency: "cad" } },
          { quantity: 3, price: { unit_amount: 1500, currency: "cad" } },
        ],
      },
    });
    expect(montantEnCents(multiple)).toBe(9900 + 4500);
  });

  it("rend zéro plutôt que d'inventer quand le prix manque", () => {
    expect(montantEnCents(abonnement({ items: { data: [{ quantity: 1, price: {} }] } }))).toBe(0);
    expect(montantEnCents(null)).toBe(0);
    expect(montantEnCents({})).toBe(0);
  });
});

describe("deviseDe", () => {
  it("prend la devise de la ligne, en minuscules", () => {
    const usd = abonnement({ items: { data: [{ price: { unit_amount: 100, currency: "USD" } }] } });
    expect(deviseDe(usd)).toBe("usd");
  });

  it("retombe sur le dollar canadien", () => {
    expect(deviseDe({})).toBe("cad");
  });
});

describe("ligneAbonnementDepuisStripe", () => {
  it("compose la rangée avec le montant et les périodes", () => {
    const l = ligneAbonnementDepuisStripe(abonnement(), "co-1", "Entrepreneur mensuel", MAINTENANT)!;
    expect(l.company_id).toBe("co-1");
    expect(l.stripe_subscription_id).toBe("sub_123");
    expect(l.stripe_customer_id).toBe("cus_456");
    expect(l.plan_amount_cents).toBe(9900);
    expect(l.currency).toBe("cad");
    expect(l.status).toBe("active");
    expect(l.plan_name).toBe("Entrepreneur mensuel");
    expect(l.current_period_start).toBe(new Date(1_757_000_000 * 1000).toISOString());
    expect(l.current_period_end).toBe(new Date(1_759_678_400 * 1000).toISOString());
    expect(l.cancelled_at).toBeNull();
  });

  it("lit le client donné comme objet plutôt que comme identifiant", () => {
    const l = ligneAbonnementDepuisStripe(
      abonnement({ customer: { id: "cus_objet" } }), "co-1", null, MAINTENANT)!;
    expect(l.stripe_customer_id).toBe("cus_objet");
  });

  it("garde la date d'annulation", () => {
    const l = ligneAbonnementDepuisStripe(
      abonnement({ status: "canceled", canceled_at: 1_760_000_000 }), "co-1", null, MAINTENANT)!;
    expect(l.status).toBe("canceled");
    expect(l.cancelled_at).toBe(new Date(1_760_000_000 * 1000).toISOString());
  });

  // Sans identifiant, l'insertion ne saurait pas quoi remplacer et
  // dupliquerait la ligne à chaque événement du webhook.
  it("refuse un abonnement sans identifiant", () => {
    expect(ligneAbonnementDepuisStripe({ status: "active" }, "co-1", null, MAINTENANT)).toBeNull();
  });

  it("ne s'effondre pas sur une charge utile inattendue", () => {
    const l = ligneAbonnementDepuisStripe({ id: "sub_x" }, "co-1", null, MAINTENANT)!;
    expect(l.plan_amount_cents).toBe(0);
    expect(l.current_period_end).toBeNull();
    expect(l.status).toBe("unknown");
  });
});
