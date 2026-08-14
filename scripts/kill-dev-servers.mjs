#!/usr/bin/env node
/**
 * Stop Next.js dev servers for this project and free common dev ports.
 * Prevents stale Server Action manifests from multiple concurrent dev instances.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORTS = [3000, 3001, 3002, 3003];
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selfPid = process.pid;

function run(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Process may already be gone.
  }
}

function killPids(pids) {
  for (const pid of [...new Set(pids)]) {
    if (Number.isFinite(pid) && pid > 1 && pid !== selfPid) {
      run(`kill -9 ${pid} 2>/dev/null`);
    }
  }
}

function killPort(port) {
  try {
    const out = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: "utf8" }).trim();
    if (!out) return;
    killPids(out.split(/\s+/).map(Number));
  } catch {
    // Port already free.
  }
}

function killProjectNextProcesses() {
  const nextMarkers = ["next dev", "next-server", "next start", "next/dist/bin/next"];

  try {
    const out = execSync("ps -ax -o pid=,command=", { encoding: "utf8" });
    const pids = out
      .split("\n")
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        const isProjectNext =
          trimmed.includes(projectRoot) &&
          nextMarkers.some((marker) => trimmed.includes(marker));
        if (!isProjectNext) return [];
        const pid = Number(trimmed.split(/\s+/)[0]);
        return Number.isFinite(pid) ? [pid] : [];
      });

    killPids(pids);
  } catch {
    // ps unavailable or no matches.
  }
}

for (const port of PORTS) {
  killPort(port);
}

killProjectNextProcesses();

// Second pass after processes exit.
for (const port of PORTS) {
  killPort(port);
}

killProjectNextProcesses();

console.log("✓ Dev ports cleared (3000–3003)");
