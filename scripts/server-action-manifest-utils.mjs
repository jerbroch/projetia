/**
 * Shared helpers for validating Next.js Server Action manifest consistency.
 */
import fs from "node:fs";
import path from "node:path";

export const AUTH_ACTIONS = [
  "loginAction",
  "registerAction",
  "demoLoginAction",
  "forgotPasswordAction",
  "resetPasswordAction",
  "resendVerificationAction",
  "applyPromoCodeAction",
  "selectSubscriptionPlanAction",
];

export const SCHEDULE_ACTIONS = [
  "updateScheduleJobStatusAction",
  "getBillingSummaryForJobAction",
  "approveJobForBillingAction",
  "saveScheduleJobAction",
  "cancelScheduleJobAction",
  "deleteScheduleJobAction",
  "submitJobForReviewAction",
  "loadBillingSheetAction",
];

export function walkJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, files);
    else if (/\.js$/.test(entry.name)) files.push(full);
  }
  return files;
}

export function extractClientReferences(source) {
  const refs = [];
  const hashRe = /createServerReference\)\("([a-f0-9]{42})"/g;
  for (const match of source.matchAll(hashRe)) {
    const tail = source.slice(match.index, match.index + 220);
    const nameMatch = tail.match(/"([a-zA-Z][a-zA-Z0-9]+Action)"/);
    refs.push({ hash: match[1], name: nameMatch?.[1] ?? "unknown" });
  }
  return refs;
}

/**
 * @returns {{ ok: true, serverHashes: Set<string>, clientRefs: Array, manifest: object } | { ok: false, missing: Array, serverHashes: Set<string>, clientRefs: Array, manifest: object | null }}
 */
export function validateServerActionManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, ".next/server/server-reference-manifest.json");
  const staticRoot = path.join(projectRoot, ".next/static");

  if (!fs.existsSync(manifestPath)) {
    return { ok: true, reason: "no-manifest", serverHashes: new Set(), clientRefs: [], manifest: null };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const serverHashes = new Set(Object.keys(manifest.node ?? {}));
  const clientRefs = [];

  for (const file of walkJsFiles(staticRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const ref of extractClientReferences(source)) {
      clientRefs.push({ ...ref, file: path.relative(projectRoot, file) });
    }
  }

  const missing = clientRefs.filter((ref) => !serverHashes.has(ref.hash));
  if (missing.length > 0) {
    return { ok: false, missing, serverHashes, clientRefs, manifest };
  }

  return { ok: true, serverHashes, clientRefs, manifest };
}

export function manifestActionsByName(manifest, actionNames) {
  return Object.entries(manifest?.node ?? {})
    .filter(([, info]) => actionNames.includes(info.exportedName ?? ""))
    .map(([hash, info]) => ({
      hash,
      name: info.exportedName,
      file: info.filename,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
