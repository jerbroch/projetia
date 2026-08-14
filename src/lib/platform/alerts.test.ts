import { describe, expect, it } from "vitest";
import {
  buildInactiveCompanyAlert,
  buildTrialEndingAlert,
  shouldCreateInactiveCompanyAlert,
  shouldCreateTrialEndingAlert,
} from "@/lib/platform/alerts";

describe("alert creation rules", () => {
  const now = new Date("2026-08-12");

  it("creates trial ending alert within 3 days", () => {
    expect(
      shouldCreateTrialEndingAlert("trial", "2026-08-14T00:00:00Z", now),
    ).toBe(true);
  });

  it("skips trial ending alert when not on trial", () => {
    expect(
      shouldCreateTrialEndingAlert("active", "2026-08-14T00:00:00Z", now),
    ).toBe(false);
  });

  it("creates inactive company alert after 30 days", () => {
    expect(
      shouldCreateInactiveCompanyAlert(
        "2026-06-01T00:00:00Z",
        "2026-06-01T00:00:00Z",
        now,
      ),
    ).toBe(true);
  });

  it("builds alert drafts with company context", () => {
    const alert = buildTrialEndingAlert("id1", "Acme", "2026-08-14T00:00:00Z");
    expect(alert.alertType).toBe("trial_ending");
    expect(alert.companyId).toBe("id1");
    expect(alert.title).toContain("Essai");

    const inactive = buildInactiveCompanyAlert("id2", "Acme");
    expect(inactive.alertType).toBe("inactive_company");
  });
});
