import type { FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import "./load-env";
import { cleanupE2ESeedData } from "./helpers/seed-data";
import { readTestCredentials } from "./helpers/test-data";
import { purgeE2ETenants } from "./helpers/purge-e2e-tenants";



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

    // Les données d'amorçage ne sont qu'une partie du dépôt laissé par une
    // exécution : les entreprises et les comptes créés par globalSetup
    // survivaient, et la base enflait d'une quinzaine d'entreprises par suite.
    const purge = await purgeE2ETenants(admin);

    console.log(
      `[E2E globalTeardown] Données d'amorçage nettoyées, ` +
        `${purge.entreprises} entreprise(s) et ${purge.comptes} compte(s) e2e supprimés`,
    );
  } catch (err) {
    console.warn("[E2E globalTeardown] Cleanup skipped:", err);
  }
}

export default globalTeardown;
