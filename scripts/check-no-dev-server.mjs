#!/usr/bin/env node
/**
 * Exit with code 1 if a Next.js dev server appears to be running on common ports.
 * Prevents `next build` from corrupting an active dev `.next` cache.
 */
import { execSync } from "node:child_process";

const PORTS = [3000, 3001, 3002, 3003];

function portInUse(port) {
  try {
    const out = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: "utf8" }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

const busy = PORTS.filter(portInUse);

if (busy.length > 0) {
  console.error(
    `\n❌ Dev server detected on port(s): ${busy.join(", ")}.\n` +
      "   Stop it first (npm run kill-ports) or use npm run dev:clean.\n" +
      "   Running build while dev is active corrupts .next and breaks CSS/server actions.\n"
  );
  process.exit(1);
}
