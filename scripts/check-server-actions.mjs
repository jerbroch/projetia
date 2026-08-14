#!/usr/bin/env node
/**
 * Verify client Server Action references match the server manifest.
 * Catches stale .next artifacts before they cause UnrecognizedActionError at runtime.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_ACTIONS,
  SCHEDULE_ACTIONS,
  manifestActionsByName,
  validateServerActionManifest,
} from "./server-action-manifest-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, ".next/server/server-reference-manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("❌ Missing server-reference-manifest.json — run `npm run build` first.");
  process.exit(1);
}

const result = validateServerActionManifest(projectRoot);

if (!result.ok) {
  console.error("\n❌ Client bundle references Server Actions missing from server manifest:\n");
  for (const ref of result.missing) {
    console.error(`   ${ref.hash}  ${ref.name}`);
    console.error(`      chunk: ${ref.file}\n`);
  }
  console.error("   Run: npm run dev:clean");
  process.exit(1);
}

let devRunning = false;
try {
  const out = execSync("lsof -ti :3000 2>/dev/null", { encoding: "utf8" }).trim();
  devRunning = Boolean(out);
} catch {
  devRunning = false;
}

if (devRunning) {
  console.warn("\n⚠ Dev server detected on port 3000 while validating build artifacts.");
  console.warn("  Stop it (npm run kill-ports) before `next dev` to avoid stale action IDs.\n");
}

console.log("✓ Server Actions manifest OK");
console.log(`  ${result.serverHashes.size} server actions, ${result.clientRefs.length} client references`);

const authManifest = manifestActionsByName(result.manifest, AUTH_ACTIONS);
if (authManifest.length > 0) {
  console.log("  Auth chain:");
  for (const action of authManifest) {
    console.log(`    ${action.name} → ${action.hash.slice(0, 12)}… (${action.file})`);
  }
}

const scheduleManifest = manifestActionsByName(result.manifest, SCHEDULE_ACTIONS);
if (scheduleManifest.length > 0) {
  console.log("  Schedule chain:");
  for (const action of scheduleManifest) {
    console.log(`    ${action.name} → ${action.hash.slice(0, 12)}… (${action.file})`);
  }
}
