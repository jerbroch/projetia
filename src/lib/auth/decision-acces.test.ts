import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { deciderAcces, erreurDeDelaiDepasse } from "@/lib/auth/decision-acces";

const utilisateur = { id: "u1", email: "plombier@exemple.ca" };

describe("deciderAcces — « je n'ai pas pu vérifier »", () => {
  it("reconnaît une requête qui n'a pas abouti", () => {
    // `status: 0` : ce qui est revenu ne ressemblait même pas à une réponse.
    const e = new AuthRetryableFetchError("fetch failed", 0);
    expect(deciderAcces({ user: null, error: e })).toBe("verification-impossible");
  });

  it("reconnaît une panne d'infrastructure", () => {
    // 502, 503… la bibliothèque les classe elle-même comme rejouables :
    // « These are infrastructure errors and should not cause session invalidation. »
    for (const status of [500, 502, 503, 504, 520, 530]) {
      const e = new AuthRetryableFetchError("Bad Gateway", status);
      expect(deciderAcces({ user: null, error: e }), String(status)).toBe(
        "verification-impossible",
      );
    }
  });

  it("traite un délai dépassé comme une impossibilité de vérifier", () => {
    expect(deciderAcces({ user: null, error: erreurDeDelaiDepasse() })).toBe(
      "verification-impossible",
    );
  });
});

describe("deciderAcces — « Supabase dit que ce jeton ne vaut rien »", () => {
  it("un 401 est un verdict, pas un silence", () => {
    const e = new AuthApiError("invalid JWT", 401, "bad_jwt");
    expect(deciderAcces({ user: null, error: e })).toBe("non-connecte");
  });

  it("un 403 aussi", () => {
    expect(deciderAcces({ user: null, error: new AuthApiError("forbidden", 403, undefined) }))
      .toBe("non-connecte");
  });

  it("l'absence de session est un verdict", () => {
    expect(deciderAcces({ user: null, error: new AuthSessionMissingError() })).toBe(
      "non-connecte",
    );
  });

  it("ni utilisateur ni erreur : pas de session", () => {
    expect(deciderAcces({ user: null, error: null })).toBe("non-connecte");
  });
});

describe("deciderAcces — session valide", () => {
  it("un utilisateur sans erreur passe", () => {
    expect(deciderAcces({ user: utilisateur, error: null })).toBe("connecte");
  });

  it("l'ERREUR l'emporte sur l'utilisateur", () => {
    // Se fier d'abord à l'utilisateur ramènerait le défaut qu'on corrige :
    // un échec réseau rend aussi `user` nul, et on ne doit jamais conclure
    // de son absence.
    const e = new AuthRetryableFetchError("fetch failed", 0);
    expect(deciderAcces({ user: utilisateur, error: e })).toBe("verification-impossible");
  });
});
