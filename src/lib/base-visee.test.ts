import { describe, expect, it } from "vitest";
import { baseVisee, refDuProjet } from "./base-visee";

describe("refDuProjet", () => {
  it("extrait la référence de l'URL Supabase", () => {
    expect(refDuProjet("https://axqbfqywufapstiktmcn.supabase.co")).toBe("axqbfqywufapstiktmcn");
  });

  it("rend null sur une URL absente ou étrangère", () => {
    expect(refDuProjet(undefined)).toBeNull();
    expect(refDuProjet("")).toBeNull();
    expect(refDuProjet("https://exemple.com")).toBeNull();
  });
});

describe("baseVisee", () => {
  const DEV = "https://axqbfqywufapstiktmcn.supabase.co";
  const PROD = "https://dxobukushgxuciqhgrpf.supabase.co";

  it("se tait quand la base visée est celle déclarée sûre", () => {
    const b = baseVisee({
      NEXT_PUBLIC_SUPABASE_URL: DEV,
      DEV_SAFE_SUPABASE_REF: "axqbfqywufapstiktmcn",
      NODE_ENV: "development",
    });
    expect(b.sure).toBe(true);
    expect(b.alerter).toBe(false);
  });

  it("ALERTE quand le serveur local vise une autre base", () => {
    // Le cas réel : `npm run dev` charge .env.local et parle à la production.
    const b = baseVisee({
      NEXT_PUBLIC_SUPABASE_URL: PROD,
      DEV_SAFE_SUPABASE_REF: "axqbfqywufapstiktmcn",
      NODE_ENV: "development",
    });
    expect(b.alerter).toBe(true);
    expect(b.message).toContain("dxobukushgxuciqhgrpf");
    expect(b.message).toContain("dev:e2e");
  });

  it("alerte aussi quand AUCUNE base sûre n'est déclarée", () => {
    // Se taire par défaut referait exactement l'erreur qu'on veut éviter :
    // l'absence de garantie n'est pas une garantie d'absence de danger.
    const b = baseVisee({ NEXT_PUBLIC_SUPABASE_URL: PROD, NODE_ENV: "development" });
    expect(b.alerter).toBe(true);
  });

  it("ne dit rien en production — le bandeau n'a rien à y faire", () => {
    const b = baseVisee({ NEXT_PUBLIC_SUPABASE_URL: PROD, NODE_ENV: "production" });
    expect(b.alerter).toBe(false);
  });

  it("nomme la base même sans configuration", () => {
    expect(baseVisee({ NODE_ENV: "development" }).message).toContain("Aucune base");
  });

  it("ne confond pas deux références proches", () => {
    const b = baseVisee({
      NEXT_PUBLIC_SUPABASE_URL: "https://axqbfqywufapstiktmcm.supabase.co",
      DEV_SAFE_SUPABASE_REF: "axqbfqywufapstiktmcn",
      NODE_ENV: "development",
    });
    expect(b.sure).toBe(false);
  });
});
