import fs from "fs";
import path from "path";
import type { E2ESeedData } from "./seed-data";

export interface E2ETestCredentials {
  runId: string;
  tenantEmail: string;
  tenantPassword: string;
  tenantCompanyId?: string;
  superAdminEmail?: string;
  superAdminPassword?: string;
  registrationEmail?: string;
  seed?: E2ESeedData;
}

const CREDENTIALS_FILE = path.resolve(__dirname, "../.test-credentials.json");

export function readTestCredentials(): E2ETestCredentials {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error("E2E credentials not found — globalSetup may have failed");
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
}

export function writeTestCredentials(data: E2ETestCredentials): void {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
}
