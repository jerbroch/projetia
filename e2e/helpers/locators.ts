import type { Page } from "@playwright/test";

/** Landing nav — avoids strict-mode violations from duplicate CTAs in hero. */
export function landingNav(page: Page) {
  return page.getByRole("navigation");
}

export function landingLoginLink(page: Page) {
  return landingNav(page).getByRole("link", { name: "Se connecter" });
}

export function landingRegisterLink(page: Page) {
  return landingNav(page).getByRole("link", { name: "Créer un compte" });
}

/** Table cell lookup — card + table both render the same label on list pages. */
export function tableCell(page: Page, text: string) {
  return page.locator("table tbody").getByRole("cell", { name: text, exact: true }).first();
}

export function quoteNumberCell(page: Page, quoteNumber: string) {
  return tableCell(page, quoteNumber);
}

/** Desktop invoice table — avoids hidden mobile card duplicates. */
export function invoiceCustomerCell(page: Page, customerName: string) {
  return page.locator("table tbody").getByRole("cell", { name: customerName, exact: true });
}

/** Archived job row in desktop archives table. */
export function archiveJobRow(page: Page, marker: string) {
  return page.locator("table tbody tr").filter({ hasText: marker });
}
