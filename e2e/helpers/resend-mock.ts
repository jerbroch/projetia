import type { Page } from "@playwright/test";

let resendCallCount = 0;

export function getResendCallCount(): number {
  return resendCallCount;
}

export function resetResendCallCount(): void {
  resendCallCount = 0;
}

/** Intercept Resend API — emails never leave the test environment. */
export async function mockResendApi(page: Page): Promise<void> {
  await page.route("https://api.resend.com/**", async (route) => {
    resendCallCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: `e2e-mock-${resendCallCount}` }),
    });
  });
}
