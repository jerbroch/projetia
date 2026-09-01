import { describe, expect, it } from "vitest";
import {
  avertissementDeModification,
  numeroDeRevision,
  refusDeModification,
  regimeDeModification,
} from "./modification-de-soumission";
import type { Quote } from "@/types";

const q = (over: Partial<Quote>) => over as Pick<Quote, "status" | "depositStatus">;

describe("regimeDeModification", () => {
  it("laisse modifier un brouillon sans rien dire", () => {
    expect(regimeDeModification(q({ status: "draft" }))).toBe("libre");
  });

  it("avertit sur une soumission envoyée ou consultée", () => {
    expect(regimeDeModification(q({ status: "sent" }))).toBe("avertir");
    expect(regimeDeModification(q({ status: "viewed" }))).toBe("avertir");
  });

  it("refuse une soumission acceptée", () => {
    // Une soumission acceptée est un accord. La changer tout seul après que le
    // client a dit oui, c'est modifier un contrat sans lui.
    expect(regimeDeModification(q({ status: "accepted" }))).toBe("refuser");
  });

  it("refuse dès que le dépôt est payé, quel que soit le statut", () => {
    // Le statut peut traîner ; l'argent reçu, lui, ne se discute pas.
    expect(regimeDeModification(q({ status: "sent", depositStatus: "paid" }))).toBe("refuser");
    expect(regimeDeModification(q({ status: "deposit_paid" }))).toBe("refuser");
  });

  it("refuse aussi pendant l'attente du dépôt", () => {
    expect(regimeDeModification(q({ status: "deposit_pending" }))).toBe("refuser");
  });

  it("laisse modifier une refusée ou une expirée", () => {
    // Rien n'engage plus personne : l'entrepreneur peut la reprendre.
    expect(regimeDeModification(q({ status: "rejected" }))).toBe("libre");
    expect(regimeDeModification(q({ status: "expired" }))).toBe("libre");
  });
});

describe("avertissementDeModification", () => {
  it("nomme la date d'envoi", () => {
    const m = avertissementDeModification({ sentAt: "2026-08-28T14:00:00.000Z" } as Quote);
    expect(m).toContain("28 août 2026");
    expect(m).toContain("au même lien");
  });

  it("signale que le client l'a déjà ouverte", () => {
    const m = avertissementDeModification({
      sentAt: "2026-08-28T14:00:00.000Z",
      viewedAt: "2026-08-29T09:00:00.000Z",
    } as Quote);
    expect(m).toContain("déjà consultée");
  });

  it("reste lisible sans date d'envoi", () => {
    const m = avertissementDeModification({} as Quote);
    expect(m).toContain("déjà été envoyée");
    expect(m).not.toContain("null");
    expect(m).not.toContain("Invalid");
  });

  it("ignore une date illisible plutôt que d'afficher « Invalid Date »", () => {
    const m = avertissementDeModification({ sentAt: "pas une date" } as unknown as Quote);
    expect(m).toContain("déjà été envoyée");
  });
});

describe("refusDeModification", () => {
  it("dit POURQUOI, et propose la suite", () => {
    const m = refusDeModification({
      status: "accepted",
      quoteNumber: "SO-2026-0141",
    } as Quote);
    expect(m).toContain("SO-2026-0141");
    expect(m).toContain("acceptée");
    expect(m).toContain("révision");
  });

  it("distingue le dépôt payé de la simple acceptation", () => {
    const m = refusDeModification({
      status: "deposit_paid",
      depositStatus: "paid",
      quoteNumber: "SO-1",
    } as Quote);
    expect(m).toContain("dépôt a été payé");
  });
});

describe("numeroDeRevision", () => {
  it("suffixe B à la première révision", () => {
    expect(numeroDeRevision("SO-2026-0141")).toBe("SO-2026-0141-B");
  });

  it("passe à C quand B existe déjà", () => {
    expect(numeroDeRevision("SO-2026-0141", ["SO-2026-0141-B"])).toBe("SO-2026-0141-C");
  });

  it("ne réempile pas les suffixes sur une révision", () => {
    // Sans ça, réviser SO-141-B donnerait SO-141-B-B.
    expect(numeroDeRevision("SO-2026-0141-B", ["SO-2026-0141-B"])).toBe("SO-2026-0141-C");
  });

  it("trouve le premier libre dans une suite trouée", () => {
    expect(numeroDeRevision("SO-1", ["SO-1-B", "SO-1-D"])).toBe("SO-1-C");
  });
});
