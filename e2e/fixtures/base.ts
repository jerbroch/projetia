import { test as base, expect } from "@playwright/test";
import path from "path";
import { AuditCollector } from "../helpers/audit";
import { mockResendApi } from "../helpers/resend-mock";

export const test = base.extend<{ audit: AuditCollector; pageName: string }>({
  pageName: ["unknown", { option: true }],
  audit: async ({ page, pageName }, use, testInfo) => {
    const collector = new AuditCollector();
    collector.attach(page, pageName);
    await mockResendApi(page);
    await use(collector);
    collector.flushTechnicalFindings(pageName, testInfo.title);
    collector.save();
  },
});

export { expect };

export const tenantAuth = path.resolve(__dirname, "../.auth/tenant.json");

export async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow, "Page should not have horizontal overflow").toBe(false);
}

export async function assertPageLoadsWithout500(page: import("@playwright/test").Page, url: string) {
  const responses: { status: number; url: string }[] = [];
  page.on("response", (r) => {
    if (r.url().includes(url) || r.url().includes("localhost:3000")) {
      responses.push({ status: r.status(), url: r.url() });
    }
  });
  const response = await page.goto(url);
  expect(response?.status(), `Page ${url} should not return 5xx`).toBeLessThan(500);
  const serverErrors = responses.filter((r) => r.status >= 500);
  expect(serverErrors, `No 500 errors loading ${url}`).toHaveLength(0);
}
