/**
 * Le parcours d'un échec de paiement, de la carte refusée à la reprise.
 *
 * C'est le filet de sécurité le moins exercé de l'intégration : il ne se
 * déclenche qu'avec une vraie carte expirée, des semaines après la mise en
 * ligne. Il a aussi été inerte pendant un temps — le gestionnaire
 * `invoice.payment_failed` ne retrouvait pas son abonnement, faute de lire le
 * bon emplacement du payload (voir docs/JOURNAL-STRIPE.md §2).
 *
 * Ces tests parcourent la chaîne de fonctions pures dans l'ordre où Stripe les
 * sollicite réellement, pour les deux formes de payload.
 */
import { describe, expect, it } from "vitest";
import { invoiceSubscriptionId } from "./stripe-payload";
import {
  buildCompanySubscriptionUpdate,
  hasModifiableSubscription,
  normalizeSubscriptionStatus,
  subscriptionGrantsAccess,
} from "./subscription-status";
import { companyHasAppAccess } from "@/lib/access-control";

const NOW = "2026-09-10T12:00:00.000Z";
const PERIOD_END = 1788906358; // 2026-09-08T22:25:58Z
const SUB_ID = "sub_1U8Sn5061aVmyk8tyDz6UnZN";

/** Facture d'échec, forme livrée par un endpoint webhook ancien. */
const acaciaFailedInvoice = {
  id: "in_echec",
  object: "invoice",
  billing_reason: "subscription_cycle",
  attempt_count: 1,
  subscription: SUB_ID,
};

/** Facture d'échec, forme livrée depuis basil. */
const dahliaFailedInvoice = {
  id: "in_echec",
  object: "invoice",
  billing_reason: "subscription_cycle",
  attempt_count: 1,
  parent: {
    quote_details: null,
    subscription_details: {
      metadata: { companyId: "c1", cycle: "monthly", tier: "entrepreneur" },
      subscription: SUB_ID,
    },
  },
};

/** L'état en base tel qu'il est au moment où le paiement échoue. */
const existingRow = {
  accessGrantedAt: "2026-08-25T22:26:04.000Z",
  subscriptionStartedAt: "2026-08-25T22:26:04.000Z",
};

function snapshotFor(status: string) {
  return {
    status,
    cycle: "monthly" as const,
    tier: "entrepreneur" as const,
    priceId: "price_entrepreneur_monthly",
    subscriptionId: SUB_ID,
    customerId: "cus_V8itkmKTaA5EaZ",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
  };
}

describe("échec de paiement — étape 1 : retrouver l'abonnement", () => {
  it("résout l'abonnement quelle que soit la forme du payload", () => {
    expect(invoiceSubscriptionId(acaciaFailedInvoice)).toBe(SUB_ID);
    expect(invoiceSubscriptionId(dahliaFailedInvoice)).toBe(SUB_ID);
  });

  it("sans cette résolution, rien de la suite ne se produit", () => {
    // Le gestionnaire sort en `return null` sur un id absent : ni bascule en
    // past_due, ni journalisation. C'est exactement le bogue corrigé.
    const sansAbonnement = { id: "in_echec", object: "invoice" };
    expect(invoiceSubscriptionId(sansAbonnement)).toBeNull();
  });
});

describe("échec de paiement — étape 2 : le délai de grâce", () => {
  it("past_due garde l'accès pendant que Stripe relance", () => {
    expect(normalizeSubscriptionStatus("past_due")).toBe("past_due");
    expect(subscriptionGrantsAccess("past_due")).toBe(true);
  });

  it("l'entreprise continue d'utiliser l'application", () => {
    const update = buildCompanySubscriptionUpdate(snapshotFor("past_due"), NOW, existingRow);

    expect(update.subscription_status).toBe("past_due");
    expect(update.requires_access_choice).toBe(false);
    expect(
      companyHasAppAccess({
        accessType: update.access_type as string,
        requiresAccessChoice: update.requires_access_choice as boolean,
        subscriptionStatus: update.subscription_status as string,
      }),
    ).toBe(true);
  });

  it("ne réécrit pas les dates du premier accès payant", () => {
    const update = buildCompanySubscriptionUpdate(snapshotFor("past_due"), NOW, existingRow);
    expect(update.access_granted_at).toBe(existingRow.accessGrantedAt);
    expect(update.subscription_started_at).toBe(existingRow.subscriptionStartedAt);
  });

  it("conserve la fin de période — elle sert à dater la fin de la grâce", () => {
    const update = buildCompanySubscriptionUpdate(snapshotFor("past_due"), NOW, existingRow);
    expect(update.subscription_current_period_end).toBe("2026-09-08T22:25:58.000Z");
  });
});

describe("échec de paiement — étape 3 : le client doit pouvoir corriger sa carte", () => {
  it("un abonnement past_due reste modifiable, donc mène au portail", () => {
    // Le point critique : sans cette garde, un client dont la carte a expiré
    // et qui reclique un palier ouvrirait un SECOND abonnement au lieu d'aller
    // mettre à jour son moyen de paiement.
    expect(
      hasModifiableSubscription({ stripeSubscriptionId: SUB_ID, status: "past_due" }),
    ).toBe(true);
  });

  it("une fois l'abonnement mort, le rachat par Checkout redevient légitime", () => {
    expect(
      hasModifiableSubscription({ stripeSubscriptionId: SUB_ID, status: "cancelled" }),
    ).toBe(false);
  });
});

describe("échec de paiement — étape 4 : l'escalade quand les relances échouent", () => {
  it.each([
    ["unpaid", "toutes les relances ont échoué"],
    ["canceled", "Stripe a fermé l'abonnement"],
    ["incomplete_expired", "le premier paiement n'a jamais abouti"],
  ])("%s coupe l'accès (%s)", (stripeStatus) => {
    expect(normalizeSubscriptionStatus(stripeStatus)).toBe("cancelled");
    expect(subscriptionGrantsAccess(stripeStatus)).toBe(false);
  });

  it("l'entreprise est renvoyée vers le choix d'un palier", () => {
    const update = buildCompanySubscriptionUpdate(snapshotFor("unpaid"), NOW, existingRow);

    expect(update.subscription_status).toBe("cancelled");
    expect(update.requires_access_choice).toBe(true);
    expect(update.pending_plan).toBe("monthly");
    expect(
      companyHasAppAccess({
        accessType: update.access_type as string | null,
        requiresAccessChoice: update.requires_access_choice as boolean,
        subscriptionStatus: update.subscription_status as string,
      }),
    ).toBe(false);
  });
});

describe("échec de paiement — étape 5 : la reprise", () => {
  it("un paiement réussi après coup rétablit l'accès", () => {
    const update = buildCompanySubscriptionUpdate(snapshotFor("active"), NOW, existingRow);

    expect(update.subscription_status).toBe("active");
    expect(update.requires_access_choice).toBe(false);
    expect(update.pending_plan).toBeNull();
    expect(
      companyHasAppAccess({
        accessType: update.access_type as string,
        requiresAccessChoice: update.requires_access_choice as boolean,
        subscriptionStatus: update.subscription_status as string,
      }),
    ).toBe(true);
  });

  it("les dates du premier accès payant survivent à tout le cycle", () => {
    // Tant que l'accès est ouvert, les dates sont réécrites à l'identique.
    for (const status of ["past_due", "active"]) {
      const update = buildCompanySubscriptionUpdate(snapshotFor(status), NOW, existingRow);
      expect(update.access_granted_at).toBe(existingRow.accessGrantedAt);
      expect(update.subscription_started_at).toBe(existingRow.subscriptionStartedAt);
    }

    // Accès coupé : les clés sont ABSENTES du patch, et c'est cette absence
    // qui préserve l'historique — Supabase ne touche pas aux colonnes non
    // fournies. Les écrire à null effacerait la date du premier abonnement.
    const perdu = buildCompanySubscriptionUpdate(snapshotFor("unpaid"), NOW, existingRow);
    expect("access_granted_at" in perdu).toBe(false);
    expect("subscription_started_at" in perdu).toBe(false);
  });
});
