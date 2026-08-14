import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { resetSeedJobForJourney, ensureE2ESeedData, type E2ESeedData } from "./seed-data";
import { readTestCredentials, writeTestCredentials } from "./test-data";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

export async function resetSeedJobIfNeeded(): Promise<E2ESeedData | null> {
  const creds = readTestCredentials();
  if (!creds.tenantCompanyId) return creds.seed ?? null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return creds.seed ?? null;

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const seed = await ensureE2ESeedData(admin, creds.tenantCompanyId, creds.seed ?? null);

  if (
    seed.scheduledJobId !== creds.seed?.scheduledJobId ||
    seed.customerId !== creds.seed?.customerId
  ) {
    writeTestCredentials({ ...creds, seed });
  }

  if (seed.scheduledJobId) {
    await resetSeedJobForJourney(admin, creds.tenantCompanyId, seed.scheduledJobId);
  }

  return seed;
}

/** Click a quick-status button only when enabled (skips current status). */
export async function clickQuickStatusIfEnabled(
  page: import("@playwright/test").Page,
  label: string | RegExp
): Promise<boolean> {
  const btn = page.getByRole("button", { name: label });
  if (!(await btn.isVisible({ timeout: 5000 }).catch(() => false))) return false;
  if (await btn.isDisabled()) return false;
  await btn.click();
  await page.waitForTimeout(800);
  return true;
}
