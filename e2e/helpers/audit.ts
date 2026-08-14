import type { Page, Response } from "@playwright/test";
import fs from "fs";
import path from "path";

export type BugSeverity = "CRITIQUE" | "IMPORTANT" | "MINEUR";

export interface AuditFinding {
  severity: BugSeverity;
  page: string;
  action: string;
  expected: string;
  actual: string;
  technicalError?: string;
  likelyFile?: string;
  testName?: string;
}

const AUDIT_FILE = path.resolve(__dirname, "../report/audit-findings.json");

export class AuditCollector {
  private findings: AuditFinding[] = [];
  private consoleErrors: string[] = [];
  private pageErrors: string[] = [];
  private failedResponses: { url: string; status: number; body?: string }[] = [];

  attach(page: Page, pageName: string) {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (this.isIgnorableConsoleError(text)) return;
        this.consoleErrors.push(`[${pageName}] ${text}`);
      }
    });

    page.on("pageerror", (err) => {
      this.pageErrors.push(`[${pageName}] ${err.message}`);
    });

    page.on("response", async (response: Response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && this.isAppRoute(url)) {
        if (status === 404) return;
        let body: string | undefined;
        try {
          body = (await response.text()).slice(0, 500);
        } catch {
          /* ignore */
        }
        this.failedResponses.push({ url, status, body });
      }
    });
  }

  private isIgnorableConsoleError(text: string): boolean {
    const ignore = [
      "Download the React DevTools",
      "Hydration failed",
      "Text content did not match",
      "favicon.ico",
      "Failed to load resource",
    ];
    return ignore.some((p) => text.includes(p));
  }

  private isAppRoute(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }

  addFinding(finding: AuditFinding) {
    this.findings.push(finding);
  }

  flushTechnicalFindings(pageName: string, testName: string) {
    for (const err of this.consoleErrors) {
      const isHydration = err.includes("Hydration") || err.includes("did not match");
      this.findings.push({
        severity: isHydration ? "MINEUR" : "IMPORTANT",
        page: pageName,
        action: "Console error during test",
        expected: "No console errors",
        actual: err.slice(0, 300),
        technicalError: err,
        testName,
      });
    }

    for (const err of this.pageErrors) {
      this.findings.push({
        severity: "IMPORTANT",
        page: pageName,
        action: "Uncaught page exception",
        expected: "No JS exceptions",
        actual: err.slice(0, 300),
        technicalError: err,
        testName,
      });
    }

    for (const resp of this.failedResponses) {
      const severity: BugSeverity =
        resp.status >= 500 ? "IMPORTANT" : resp.status === 403 ? "CRITIQUE" : "IMPORTANT";
      this.findings.push({
        severity,
        page: pageName,
        action: `HTTP ${resp.status} response`,
        expected: "Successful response (2xx)",
        actual: `${resp.status} — ${resp.url}`,
        technicalError: resp.body,
        testName,
      });
    }

    this.consoleErrors = [];
    this.pageErrors = [];
    this.failedResponses = [];
  }

  save() {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let existing: AuditFinding[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf-8"));
      } catch {
        existing = [];
      }
    }

    fs.writeFileSync(AUDIT_FILE, JSON.stringify([...existing, ...this.findings], null, 2));
  }
}

export function resetAuditFile() {
  const dir = path.dirname(AUDIT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(AUDIT_FILE, "[]");
}

export function readAuditFindings(): AuditFinding[] {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AUDIT_FILE, "utf-8"));
  } catch {
    return [];
  }
}
