import { describe, expect, it } from "vitest";
import { getRoleLabel } from "@/lib/role-labels";

describe("getRoleLabel", () => {
  it("maps known profile roles to French labels", () => {
    expect(getRoleLabel("owner")).toBe("Propriétaire");
    expect(getRoleLabel("admin")).toBe("Admin");
    expect(getRoleLabel("dispatcher")).toBe("Chargé de projet");
    expect(getRoleLabel("estimator")).toBe("Estimateur");
    expect(getRoleLabel("employee")).toBe("Employé terrain");
    expect(getRoleLabel("accountant")).toBe("Comptable");
    expect(getRoleLabel("manager")).toBe("Gestionnaire");
  });

  it("falls back for unknown roles", () => {
    expect(getRoleLabel("custom")).toBe("custom");
    expect(getRoleLabel(null)).toBe("Employé terrain");
  });
});
