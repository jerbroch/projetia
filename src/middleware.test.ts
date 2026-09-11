import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * LES DEUX CAS, SIMULÉS SÉPARÉMENT.
 *
 * Ils ne peuvent pas se jouer depuis un navigateur : l'appel de vérification
 * part du SERVEUR vers Supabase, pas du client. `page.route()` ne le voit
 * jamais. On les simule donc là où la décision se prend.
 *
 * Se tromper dans un sens renvoie un plombier à l'écran de connexion pour une
 * barre de réseau. Se tromper dans l'autre laisserait entrer quelqu'un qui
 * n'est pas connecté. Les deux méritent leur test.
 */

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

// Les contrôles d'accès interrogent la base ; ici on n'éprouve que la
// décision d'authentification, en amont.
vi.mock("@/lib/data/tenant-data", () => ({}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "cle-anon";

async function demander(chemin: string) {
  const { NextRequest } = await import("next/server");
  const { middleware } = await import("@/middleware");
  return middleware(new NextRequest(new URL(`https://projetia.ca${chemin}`)));
}

describe("middleware — « je n'ai pas pu joindre Supabase »", () => {
  beforeEach(() => {
    getUser.mockReset();
    vi.resetModules();
  });

  it("ne renvoie PAS à la connexion sur un échec réseau", async () => {
    getUser.mockRejectedValue(new AuthRetryableFetchError("fetch failed", 0));
    const r = await demander("/quotes");

    const destination = r.headers.get("x-middleware-rewrite") ?? r.headers.get("location") ?? "";
    expect(destination, "surtout pas /login").not.toContain("/login");
    expect(destination).toContain("/connexion-impossible");
    // Le service n'a pas pu répondre : ce n'est ni un refus ni un succès.
    expect(r.status).toBe(503);
  });

  it("garde la destination pour que « Réessayer » y ramène", async () => {
    getUser.mockRejectedValue(new AuthRetryableFetchError("fetch failed", 0));
    const r = await demander("/quotes");
    const destination = r.headers.get("x-middleware-rewrite") ?? "";
    expect(decodeURIComponent(destination)).toContain("suite=/quotes");
  });

  it("n'efface pas le témoin de session", async () => {
    // C'est toute la différence avec avant : la personne est probablement
    // connectée, on n'a pas pu le confirmer. Lui faire retaper son mot de
    // passe serait lui faire payer une coupure réseau.
    getUser.mockRejectedValue(new AuthRetryableFetchError("fetch failed", 0));
    const r = await demander("/quotes");
    const poses = r.headers.getSetCookie?.() ?? [];
    const efface = poses.filter((c) => /^sb-/.test(c) && /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c));
    expect(efface, "aucun témoin d'authentification effacé").toEqual([]);
  });

  it("traite une panne d'infrastructure comme un échec réseau", async () => {
    getUser.mockRejectedValue(new AuthRetryableFetchError("Bad Gateway", 502));
    const r = await demander("/quotes");
    const destination = r.headers.get("x-middleware-rewrite") ?? r.headers.get("location") ?? "";
    expect(destination).toContain("/connexion-impossible");
  });
});

describe("middleware — « Supabase dit que ce jeton ne vaut rien »", () => {
  beforeEach(() => {
    getUser.mockReset();
    vi.resetModules();
  });

  it("renvoie à la connexion sur un 401", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("invalid JWT", 401, "bad_jwt"),
    });
    const r = await demander("/quotes");
    const destination = r.headers.get("location") ?? r.headers.get("x-middleware-rewrite") ?? "";
    expect(destination).toContain("/login");
    expect(destination, "surtout pas la page intermédiaire").not.toContain("/connexion-impossible");
  });

  it("renvoie à la connexion quand il n'y a simplement aucune session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await demander("/quotes");
    const destination = r.headers.get("location") ?? r.headers.get("x-middleware-rewrite") ?? "";
    expect(destination).toContain("/login");
  });
});

describe("middleware — la page intermédiaire n'est pas protégée", () => {
  beforeEach(() => {
    getUser.mockReset();
    vi.resetModules();
  });

  it("ne boucle pas quand la vérification échoue sur la page elle-même", async () => {
    // La boucle ne se verrait qu'en production, le jour où le réseau tombe
    // pour de vrai — au moment précis où plus personne ne peut rien ouvrir.
    getUser.mockRejectedValue(new AuthRetryableFetchError("fetch failed", 0));
    const r = await demander("/connexion-impossible?suite=/quotes");
    expect(r.headers.get("location")).toBeNull();
    expect(r.headers.get("x-middleware-rewrite")).toBeNull();
    expect(r.status).toBe(200);
  });
});
