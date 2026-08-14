import type { FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { cleanupE2ESeedData } from "./helpers/seed-data";
import { readTestCredentials } from "./helpers/test-data";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.e2e") });

async function globalTeardown(_config: FullConfig) {
  if (process.env.E2E_SKIP_CLEANUP === "true" || process.env.E2E_CLEANUP_SEED !== "true") {
    return;
  }

  try {
    const creds = readTestCredentials();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !creds.tenantCompanyId) return;

    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    await cleanupE2ESeedData(admin, creds.tenantCompanyId);

    console.log("[E2E globalTeardown] Cleaned E2E seed data only");
  } catch (err) {
    console.warn("[E2E globalTeardown] Cleanup skipped:", err);
  }
}

export default globalTeardown;
