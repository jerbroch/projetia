import { describe, expect, it } from "vitest";
import {
  getEmployeeAppAccessStatusLabel,
  resolveEmployeeAppAccessStatus,
  validateEmployeeAccessEmail,
} from "@/lib/employee-access-utils";

const baseParams = {
  employeeEmail: "employee@example.com",
  adminUserId: "admin-user-id",
  adminEmail: "admin@example.com",
  companyId: "company-1",
  employeeId: "employee-1",
  existingProfile: null,
};

describe("resolveEmployeeAppAccessStatus", () => {
  it("returns none when no user is linked", () => {
    expect(resolveEmployeeAppAccessStatus({})).toBe("none");
  });

  it("returns active when access is enabled", () => {
    expect(
      resolveEmployeeAppAccessStatus({
        user_id: "user-1",
        app_access_enabled: true,
      })
    ).toBe("active");
  });

  it("returns invited when invitation was sent but access is disabled", () => {
    expect(
      resolveEmployeeAppAccessStatus({
        user_id: "user-1",
        app_access_enabled: false,
        app_access_invited_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe("invited");
  });

  it("returns pending when email is confirmed but access not yet enabled", () => {
    expect(
      resolveEmployeeAppAccessStatus(
        {
          user_id: "user-1",
          app_access_enabled: false,
          app_access_invited_at: "2026-01-01T00:00:00.000Z",
        },
        { emailConfirmed: true }
      )
    ).toBe("pending");
  });

  it("returns inactive when access was revoked", () => {
    expect(
      resolveEmployeeAppAccessStatus({
        user_id: "user-1",
        app_access_enabled: false,
      })
    ).toBe("inactive");
  });
});

describe("validateEmployeeAccessEmail", () => {
  it("rejects the admin's own email", () => {
    expect(
      validateEmployeeAccessEmail({
        ...baseParams,
        employeeEmail: "admin@example.com",
      })
    ).toMatch(/administrateur/i);
  });

  it("rejects reusing an existing office profile in the same company", () => {
    expect(
      validateEmployeeAccessEmail({
        ...baseParams,
        existingProfile: {
          id: "office-user",
          companyId: "company-1",
          role: "owner",
          employeeId: null,
        },
      })
    ).toMatch(/accès bureau/i);
  });

  it("rejects linking to another employee profile", () => {
    expect(
      validateEmployeeAccessEmail({
        ...baseParams,
        existingProfile: {
          id: "employee-user",
          companyId: "company-1",
          role: "employee",
          employeeId: "other-employee",
        },
      })
    ).toMatch(/autre employ/i);
  });

  it("allows a distinct employee email", () => {
    expect(validateEmployeeAccessEmail(baseParams)).toBeNull();
  });
});

describe("getEmployeeAppAccessStatusLabel", () => {
  it("returns French labels for each state", () => {
    expect(getEmployeeAppAccessStatusLabel("none")).toBe("Aucun accès");
    expect(getEmployeeAppAccessStatusLabel("invited")).toBe("Invitation envoyée");
    expect(getEmployeeAppAccessStatusLabel("pending")).toBe("Invitation en attente");
    expect(getEmployeeAppAccessStatusLabel("active")).toBe("Accès actif");
    expect(getEmployeeAppAccessStatusLabel("inactive")).toBe("Accès désactivé");
  });
});


describe("le refus nomme ce qui bloque", () => {
  const base = {
    employeeEmail: "partage@chantier.ca",
    adminUserId: "admin-1",
    adminEmail: "patron@chantier.ca",
    companyId: "co-1",
    employeeId: "emp-1",
  };

  it("nomme l'entreprise quand le compte est ailleurs", () => {
    // « Ce courriel est déjà utilisé par un autre compte » ne disait ni où ni
    // par qui : devant ce message, on ne peut ni corriger ni décider.
    const message = validateEmployeeAccessEmail({
      ...base,
      existingProfile: {
        id: "u-9",
        companyId: "co-2",
        role: "owner",
        employeeId: null,
        companyName: "Construction Brochu",
        personName: "Jérôme Brochu",
      },
    });
    expect(message).toContain("Construction Brochu");
    expect(message).toContain("Jérôme Brochu");
    // Aucun transfert possible : ce compte ne lui appartient pas.
    expect(message).toMatch(/une autre/i);
  });

  it("reste lisible quand le nom d'entreprise manque", () => {
    const message = validateEmployeeAccessEmail({
      ...base,
      existingProfile: { id: "u-9", companyId: "co-2", role: "owner", employeeId: null },
    });
    expect(message).toContain("une autre entreprise");
    expect(message).not.toContain("undefined");
    expect(message).not.toContain("null");
  });

  it("nomme la personne d'un accès bureau", () => {
    const message = validateEmployeeAccessEmail({
      ...base,
      existingProfile: {
        id: "u-2",
        companyId: "co-1",
        role: "admin",
        employeeId: null,
        personName: "Marie Dubois",
      },
    });
    expect(message).toContain("Marie Dubois");
  });

  it("nomme la fiche employé déjà liée", () => {
    const message = validateEmployeeAccessEmail({
      ...base,
      existingProfile: {
        id: "u-3",
        companyId: "co-1",
        role: "employee",
        employeeId: "emp-autre",
        personName: "Réal Lanthier",
      },
    });
    expect(message).toContain("Réal Lanthier");
    expect(message).toMatch(/Retirez-le/i);
  });
});
