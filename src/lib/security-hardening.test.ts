import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  canAccessAdminDashboard,
  canAccessFieldWorkerUI,
  canViewJobAsEmployee,
  toFieldSafeScheduleEvent,
} from "@/lib/field-permissions";
import type { ScheduleEvent } from "@/types";

/**
 * Static audit + app-layer isolation checks complementing migration 025.
 * Full RLS verification requires a live Supabase instance (see e2e specs).
 */

const MIGRATION_025 = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/025_security_hardening.sql"),
  "utf-8",
);

const SECURITY_DEFINER_FUNCTIONS = [
  "auth_user_company_ids",
  "auth_user_admin_company_ids",
  "auth_user_employee_id",
  "auth_user_has_office_role",
  "auth_employee_assigned_to_job",
  "is_platform_super_admin",
  "allocate_job_number",
  "seed_company_billing_defaults",
  "_seed_labor_rate_templates",
  "_seed_company_suppliers",
  "log_company_created",
  "log_feedback_sent",
] as const;

const RLS_HELPER_GRANTS_AUTHENTICATED = [
  "auth_user_company_ids",
  "auth_user_admin_company_ids",
  "auth_user_employee_id",
  "auth_user_has_office_role",
  "auth_employee_assigned_to_job",
  "is_platform_super_admin",
] as const;

const RPC_AUTHENTICATED_ONLY = ["allocate_job_number", "seed_company_billing_defaults"] as const;

const INTERNAL_NO_AUTHENTICATED = [
  "_seed_labor_rate_templates",
  "_seed_company_suppliers",
  "log_company_created",
  "log_feedback_sent",
] as const;

describe("migration 025 security hardening", () => {
  it("sets search_path on flagged utility functions", () => {
    expect(MIGRATION_025).toMatch(/CREATE OR REPLACE FUNCTION set_updated_at\(\)[\s\S]*SET search_path = public/);
    expect(MIGRATION_025).toMatch(
      /CREATE OR REPLACE FUNCTION effective_catalog_price\([\s\S]*SET search_path = public/,
    );
  });

  it("revokes PUBLIC and anon execute on all SECURITY DEFINER functions", () => {
    for (const fn of SECURITY_DEFINER_FUNCTIONS) {
      expect(MIGRATION_025).toContain(`REVOKE ALL ON FUNCTION public.${fn}`);
      expect(MIGRATION_025).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*FROM anon`));
    }
  });

  it("grants authenticated execute on RLS helpers and RPCs", () => {
    for (const fn of RLS_HELPER_GRANTS_AUTHENTICATED) {
      expect(MIGRATION_025).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*TO authenticated`),
      );
    }
    for (const fn of RPC_AUTHENTICATED_ONLY) {
      expect(MIGRATION_025).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*TO authenticated`),
      );
    }
  });

  it("blocks authenticated direct execute on internal seed/trigger functions", () => {
    for (const fn of INTERNAL_NO_AUTHENTICATED) {
      expect(MIGRATION_025).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*FROM authenticated`),
      );
      expect(MIGRATION_025).not.toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*TO authenticated`),
      );
    }
  });

  it("documents deferred fixes for pg_trgm, pgcrypto, and company-logos listing", () => {
    expect(MIGRATION_025).toMatch(/pg_trgm/);
    expect(MIGRATION_025).toMatch(/pgcrypto/);
    expect(MIGRATION_025).toMatch(/company-logos/);
    expect(MIGRATION_025).not.toMatch(/SET public = false/i);
  });
});

describe("multi-tenant isolation (app layer mirrors RLS intent)", () => {
  const companyAJob: ScheduleEvent = {
    id: "job-a",
    companyId: "company-a",
    title: "Job A",
    description: "",
    start: "2026-08-20T08:00:00",
    end: "2026-08-20T12:00:00",
    employeeIds: ["emp-a"],
    employeeNames: ["Alice"],
    location: "A",
    status: "scheduled",
    type: "job",
    internalNotes: "secret-a",
  };

  const companyBJob: ScheduleEvent = {
    ...companyAJob,
    id: "job-b",
    companyId: "company-b",
    employeeIds: ["emp-b"],
    employeeNames: ["Bob"],
    internalNotes: "secret-b",
  };

  it("employee A cannot view company B assigned job", () => {
    expect(canViewJobAsEmployee(companyAJob, "emp-a")).toBe(true);
    expect(canViewJobAsEmployee(companyBJob, "emp-a")).toBe(false);
    expect(canViewJobAsEmployee(companyAJob, "emp-b")).toBe(false);
  });

  it("field employee has no admin dashboard access", () => {
    expect(canAccessFieldWorkerUI({ membershipRole: "employee" })).toBe(true);
    expect(canAccessAdminDashboard("employee")).toBe(false);
  });

  it("field view strips financial and internal fields", () => {
    const jobWithBilling: ScheduleEvent = {
      ...companyAJob,
      billingAddress: "123 Billing",
      clientPoNumber: "PO-1",
      quoteEstimationSnapshot: {
        quoteId: "q-1",
        quoteNumber: "SO-1",
        estimatedHours: 4,
        capturedAt: "2026-08-01T00:00:00Z",
        calculatedCost: 900,
        proposedAmount: 1200,
      },
    };
    const safe = toFieldSafeScheduleEvent(jobWithBilling);
    expect(safe.internalNotes).toBeUndefined();
    expect(safe.billingAddress).toBeUndefined();
    expect(safe.clientPoNumber).toBeUndefined();
    expect(safe.quoteEstimationSnapshot?.calculatedCost).toBeUndefined();
    expect(safe.quoteEstimationSnapshot?.proposedAmount).toBeUndefined();
  });

  it("admin in company A does not get field-worker UI (office role)", () => {
    expect(canAccessFieldWorkerUI({ membershipRole: "admin" })).toBe(false);
    expect(canAccessAdminDashboard("admin")).toBe(true);
  });
});

describe("security advisor warning registry", () => {
  // Supabase emits one warning per role (PUBLIC + anon) for each SECURITY DEFINER function.
  const EXECUTE_ROLES = ["PUBLIC", "anon"] as const;

  const WARNINGS = [
    { id: 1, fn: "set_updated_at", category: "search_path", severity: "FAIBLE" },
    { id: 2, fn: "effective_catalog_price", category: "search_path", severity: "FAIBLE" },
    { id: 3, fn: "pg_trgm", category: "extension_in_public", severity: "ACCEPTABLE" },
    { id: 4, fn: "pgcrypto", category: "extension_in_public", severity: "ACCEPTABLE" },
    { id: 5, fn: "company-logos", category: "public_bucket_listing", severity: "ACCEPTABLE" },
    ...SECURITY_DEFINER_FUNCTIONS.flatMap((fn, fnIndex) =>
      EXECUTE_ROLES.map((role, roleIndex) => ({
        id: 6 + fnIndex * EXECUTE_ROLES.length + roleIndex,
        fn,
        role,
        category: "security_definer_public_execute",
        severity:
          fn.startsWith("_seed") || fn.startsWith("log_")
            ? "IMPORTANT"
            : fn === "allocate_job_number" || fn === "seed_company_billing_defaults"
              ? "IMPORTANT"
              : "FAIBLE",
      })),
    ),
  ];

  it("tracks 29 Security Advisor warnings", () => {
    // 5 misc + 12 SECURITY DEFINER × 2 execute roles = 29
    expect(WARNINGS.length).toBe(29);
  });

  it("classifies internal seed/trigger functions as higher risk if left public", () => {
    const highRisk = WARNINGS.filter((w) => w.severity === "IMPORTANT");
    expect(highRisk.map((w) => w.fn)).toEqual(
      expect.arrayContaining([
        "_seed_labor_rate_templates",
        "_seed_company_suppliers",
        "allocate_job_number",
        "seed_company_billing_defaults",
        "log_company_created",
        "log_feedback_sent",
      ]),
    );
  });
});
