import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIELD_PREFIXES,
  TENANT_PREFIXES,
  isAdminTenantRoute,
} from "@/lib/middleware-access";

const MIDDLEWARE = readFileSync(path.resolve(__dirname, "../middleware.ts"), "utf8");

/**
 * La séparation bureau / terrain reposait sur DEUX listes tenues à la main.
 * En ajoutant /heures j'ai oublié la seconde, et un employé de terrain pouvait
 * consulter les heures de tous ses collègues en tapant l'adresse.
 *
 * Ces tests verrouillent l'invariant : toute route locataire est réservée au
 * bureau, sauf celles explicitement ouvertes au terrain.
 */
describe("séparation des rôles", () => {
  it("réserve au bureau TOUTE route locataire hors terrain", () => {
    for (const route of TENANT_PREFIXES) {
      if (FIELD_PREFIXES.includes(route)) continue;
      expect(isAdminTenantRoute(route), `${route} devrait être réservée au bureau`).toBe(true);
    }
  });

  it("laisse /terrain aux employés", () => {
    for (const route of FIELD_PREFIXES) {
      expect(isAdminTenantRoute(route)).toBe(false);
    }
  });

  it("couvre aussi les sous-chemins", () => {
    expect(isAdminTenantRoute("/heures/2026")).toBe(true);
    expect(isAdminTenantRoute("/employees/abc")).toBe(true);
    expect(isAdminTenantRoute("/terrain/calls/abc")).toBe(false);
  });

  it("n'attrape pas une route qui commence par les mêmes lettres", () => {
    // « /heuresupplementaires » n'est pas « /heures ».
    expect(isAdminTenantRoute("/heuresupplementaires")).toBe(false);
  });

  it("protège chaque route locataire par le matcher du middleware", () => {
    // Une route absente du matcher ne passe jamais par le middleware : aucune
    // garde ne s'appliquerait, quelle que soit la liste.
    for (const route of TENANT_PREFIXES) {
      expect(MIDDLEWARE, `${route} absente du matcher`).toContain(`"${route}/:path*"`);
    }
  });

  it("ne garde aucune seconde liste de routes en dur dans le middleware", () => {
    // C'est la recopie qui avait ouvert la brèche.
    expect(MIDDLEWARE).not.toMatch(/const TENANT_PREFIXES = \[/);
  });
});
