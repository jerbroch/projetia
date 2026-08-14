import { describe, expect, it } from "vitest";
import {
  customers as demoCustomers,
  quotes as demoQuotes,
} from "@/lib/mock-data";
import { DEMO_COMPANY_ID } from "@/lib/demo/constants";

const OTHER_COMPANY_ID = "other-company-999";

describe("tenant isolation (mock demo data)", () => {
  it("demo customers belong only to demo company", () => {
    const demoOnly = demoCustomers.filter((c) => c.companyId === DEMO_COMPANY_ID);
    expect(demoOnly.length).toBe(demoCustomers.length);
    expect(demoCustomers.every((c) => c.companyId !== OTHER_COMPANY_ID)).toBe(true);
  });

  it("filtering by company_id returns disjoint sets for two companies", () => {
    const companyA = demoQuotes.filter((q) => q.companyId === DEMO_COMPANY_ID);
    const companyB = demoQuotes.filter((q) => q.companyId === OTHER_COMPANY_ID);
    expect(companyA.length).toBeGreaterThan(0);
    expect(companyB.length).toBe(0);
    const idsA = new Set(companyA.map((q) => q.id));
    const overlap = companyB.filter((q) => idsA.has(q.id));
    expect(overlap.length).toBe(0);
  });
});

describe("role restrictions", () => {
  it("hasAdminAccess allows owner and admin only", async () => {
    const { hasAdminAccess } = await import("@/lib/session");
    expect(hasAdminAccess("owner")).toBe(true);
    expect(hasAdminAccess("admin")).toBe(true);
    expect(hasAdminAccess("employee")).toBe(false);
    expect(hasAdminAccess("dispatcher")).toBe(false);
  });
});

describe("secrets safety", () => {
  it("does not expose service role key in client-safe env example", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    const example = fs.readFileSync(".env.example", "utf-8") as string;
    expect(example).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(example).not.toContain("sk_live");
    expect(example).not.toContain("service_role_actual");
  });
});
