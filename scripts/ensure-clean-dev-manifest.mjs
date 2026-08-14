#!/usr/bin/env node
/**
 * Before `next dev`: detect stale Server Action manifests and remove .next.
 * Prevents UnrecognizedActionError from mixed build/dev artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateServerActionManifest } from "./server-action-manifest-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(projectRoot, ".next");
const cacheDir = path.join(projectRoot, "node_modules/.cache");

const result = validateServerActionManifest(projectRoot);

if (result.ok) {
  if (result.reason !== "no-manifest") {
    console.log(
      `✓ Server Actions manifest OK (${result.serverHashes.size} actions, ${result.clientRefs.length} client refs)`,
    );
  }
  process.exit(0);
}

console.warn("\n⚠ Stale Server Action manifest — client bundles reference missing actions:\n");
for (const ref of result.missing) {
  console.warn(`   ${ref.hash.slice(0, 12)}…  ${ref.name}`);
  console.warn(`      chunk: ${ref.file}\n`);
}
console.warn("   Removing .next and node_modules/.cache (run caused by mixed build + dev).\n");

fs.rmSync(nextDir, { recursive: true, force: true });
fs.rmSync(cacheDir, { recursive: true, force: true });

console.log("✓ Cleared stale build cache — next dev will rebuild fresh.\n");
