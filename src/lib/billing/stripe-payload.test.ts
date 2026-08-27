import { describe, expect, it } from "vitest";
import {
  invoiceSubscriptionId,
  stripeIdOf,
  subscriptionPeriodEnd,
} from "./stripe-payload";

// 2026-09-08T22:25:58Z — la valeur réellement observée en mode test.
const PERIOD_END = 1788906358;
const SUB_ID = "sub_1U8Sn5061aVmyk8tyDz6UnZN";
const ITEM_ID = "si_V8kHRAiYbHQOwZ";

/** Abonnement tel que le renvoie l'API épinglée du SDK : champ à la racine. */
function acaciaSubscription() {
  return {
    id: SUB_ID,
    object: "subscription",
    status: "trialing",
    current_period_start: 1787696758,
    current_period_end: PERIOD_END,
    trial_end: PERIOD_END,
    items: {
      object: "list",
      data: [{ id: ITEM_ID, object: "subscription_item" }],
    },
  };
}

/** Abonnement tel qu'il arrive par webhook : la date vit sur l'item. */
function dahliaSubscription() {
  return {
    id: SUB_ID,
    object: "subscription",
    status: "trialing",
    trial_end: PERIOD_END,
    items: {
      object: "list",
      data: [
        {
          id: ITEM_ID,
          object: "subscription_item",
          current_period_start: 1787696758,
          current_period_end: PERIOD_END,
        },
      ],
    },
  };
}

/** Facture acacia : l'abonnement est référencé à la racine. */
function acaciaInvoice() {
  return {
    id: "in_1U8Sn5061aVmyk8tHPKxp1Ha",
    object: "invoice",
    subscription: SUB_ID,
  };
}

/** Facture dahlia : l'abonnement est sous `parent.subscription_details`. */
function dahliaInvoice() {
  return {
    id: "in_1U8Sn5061aVmyk8tHPKxp1Ha",
    object: "invoice",
    parent: {
      quote_details: null,
      subscription_details: {
        metadata: { companyId: "c1", cycle: "monthly", tier: "entreprise" },
        subscription: SUB_ID,
      },
    },
  };
}

describe("stripeIdOf", () => {
  it("accepte un id brut comme un objet étendu", () => {
    expect(stripeIdOf(SUB_ID)).toBe(SUB_ID);
    expect(stripeIdOf({ id: SUB_ID, object: "subscription" })).toBe(SUB_ID);
  });

  it("renvoie null sur une valeur absente ou vide", () => {
    expect(stripeIdOf(null)).toBeNull();
    expect(stripeIdOf(undefined)).toBeNull();
    expect(stripeIdOf("")).toBeNull();
    expect(stripeIdOf({})).toBeNull();
    expect(stripeIdOf({ id: 42 })).toBeNull();
  });
});

describe("subscriptionPeriodEnd", () => {
  it("lit la date à la racine (acacia)", () => {
    expect(subscriptionPeriodEnd(acaciaSubscription())).toBe(PERIOD_END);
  });

  it("lit la date sur l'item quand la racine a disparu (dahlia)", () => {
    expect(subscriptionPeriodEnd(dahliaSubscription())).toBe(PERIOD_END);
  });

  it("préfère la racine quand les deux emplacements sont présents", () => {
    const both = { ...acaciaSubscription(), ...dahliaSubscription() };
    both.current_period_end = PERIOD_END;
    both.items.data[0].current_period_end = 1;
    expect(subscriptionPeriodEnd(both)).toBe(PERIOD_END);
  });

  it("ignore un premier item sans date et prend le suivant", () => {
    const sub = dahliaSubscription();
    sub.items.data = [
      { id: "si_sans_date", object: "subscription_item" },
      { id: ITEM_ID, object: "subscription_item", current_period_end: PERIOD_END },
    ] as never;
    expect(subscriptionPeriodEnd(sub)).toBe(PERIOD_END);
  });

  it("renvoie null plutôt qu'une date bidon sur un payload inutilisable", () => {
    expect(subscriptionPeriodEnd(null)).toBeNull();
    expect(subscriptionPeriodEnd({})).toBeNull();
    expect(subscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
    expect(subscriptionPeriodEnd({ items: { data: [{}] } })).toBeNull();
    expect(subscriptionPeriodEnd({ current_period_end: 0 })).toBeNull();
    expect(subscriptionPeriodEnd({ current_period_end: "1788906358" })).toBeNull();
  });
});

describe("invoiceSubscriptionId", () => {
  it("lit l'abonnement à la racine (acacia)", () => {
    expect(invoiceSubscriptionId(acaciaInvoice())).toBe(SUB_ID);
  });

  it("lit l'abonnement sous parent.subscription_details (dahlia)", () => {
    expect(invoiceSubscriptionId(dahliaInvoice())).toBe(SUB_ID);
  });

  it("accepte un abonnement étendu aux deux emplacements", () => {
    expect(invoiceSubscriptionId({ subscription: { id: SUB_ID } })).toBe(SUB_ID);
    expect(
      invoiceSubscriptionId({
        parent: { subscription_details: { subscription: { id: SUB_ID } } },
      }),
    ).toBe(SUB_ID);
  });

  it("renvoie null sur une facture hors abonnement", () => {
    expect(invoiceSubscriptionId(null)).toBeNull();
    expect(invoiceSubscriptionId({})).toBeNull();
    expect(invoiceSubscriptionId({ subscription: null })).toBeNull();
    expect(invoiceSubscriptionId({ parent: null })).toBeNull();
    expect(
      invoiceSubscriptionId({ parent: { subscription_details: null } }),
    ).toBeNull();
    expect(
      invoiceSubscriptionId({ parent: { quote_details: { quote: "qt_1" } } }),
    ).toBeNull();
  });
});
