#!/usr/bin/env node
/**
 * Quick sanity check that Tailwind CSS is emitted in the production build output.
 * Run after `next build` as part of `npm run verify`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cssDir = join(process.cwd(), ".next/static/css");

if (!existsSync(cssDir)) {
  console.error("❌ No .next/static/css directory — run `npm run build` first.");
  process.exit(1);
}

const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith(".css"));

if (cssFiles.length === 0) {
  console.error("❌ No CSS files found in .next/static/css.");
  process.exit(1);
}

const combined = cssFiles
  .map((f) => readFileSync(join(cssDir, f), "utf8"))
  .join("\n");

const markers = [
  "bg-background",
  "text-foreground",
  "rounded-lg",
  "border-border",
  "bg-slate-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-600",
  "bg-violet-600",
];
const missing = markers.filter((m) => !combined.includes(m));

if (missing.length > 0) {
  console.error(`❌ Built CSS missing Tailwind utilities: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`✓ Tailwind CSS verified (${cssFiles.length} file(s), ${combined.length} bytes)`);
