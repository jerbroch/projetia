import { describe, expect, it } from "vitest";
import { depotEncaissable } from "@/lib/quotes/depot-encaissable";

describe("depotEncaissable", () => {
  it("accepte un dépôt attendu après acceptation", () => {
    expect(depotEncaissable({ status: "deposit_pending", depositRequired: true })).toBe(true);
    // Même sans drapeau : si le statut est deposit_pending, un dépôt est attendu.
    expect(depotEncaissable({ status: "deposit_pending", depositRequired: false })).toBe(true);
  });

  it("accepte un dépôt reçu AVANT le clic du client", () => {
    // C'est le cas qui motive tout : le bloc « Comment payer » est sur la
    // soumission dès sa réception.
    expect(depotEncaissable({ status: "sent", depositRequired: true })).toBe(true);
    expect(depotEncaissable({ status: "viewed", depositRequired: true })).toBe(true);
  });

  it("refuse quand aucun dépôt n'est demandé", () => {
    expect(depotEncaissable({ status: "sent", depositRequired: false })).toBe(false);
    expect(depotEncaissable({ status: "viewed", depositRequired: false })).toBe(false);
  });

  it("refuse une soumission jamais envoyée ou déjà réglée", () => {
    for (const status of ["draft", "deposit_paid", "accepted", "rejected", "expired"] as const) {
      expect(depotEncaissable({ status, depositRequired: true }), status).toBe(false);
    }
  });
});
