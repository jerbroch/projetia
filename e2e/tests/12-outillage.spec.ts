import { addDays, format } from "date-fns";
import { test, expect, tenantAuth } from "../fixtures/base";
import { ensureDashboardAccess } from "../helpers/auth";
import { E2E_SEED_MARKER } from "../helpers/seed-data";
import { readTestCredentials } from "../helpers/test-data";

const MARKER = "E2E Outillage";

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function daysFromToday(offset: number): string {
  return format(addDays(new Date(), offset), "yyyy-MM-dd");
}

function toolRow(page: import("@playwright/test").Page, internalNumber: string) {
  return page.locator(`tr[data-testid="tool-row-${internalNumber}"]`);
}

function toolCard(page: import("@playwright/test").Page, internalNumber: string) {
  return page.locator(`div[data-testid="tool-row-${internalNumber}"]`);
}

async function createTool(
  page: import("@playwright/test").Page,
  input: { name: string; internalNumber: string; baseStatus?: string },
  layout: "table" | "card" = "table",
) {
  await page.getByRole("button", { name: "Ajouter un outil" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom *").fill(input.name);
  await dialog.getByLabel("Numéro interne").fill(input.internalNumber);
  if (input.baseStatus === "in_repair") {
    await dialog.getByText("Statut initial").locator("..").getByRole("combobox").click();
    await page.getByRole("option", { name: "En réparation" }).click();
  }
  if (input.baseStatus === "out_of_service") {
    await dialog.getByText("Statut initial").locator("..").getByRole("combobox").click();
    await page.getByRole("option", { name: "Hors service" }).click();
  }
  await dialog.getByRole("button", { name: "Ajouter" }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });
  const row = layout === "card" ? toolCard(page, input.internalNumber) : toolRow(page, input.internalNumber);
  await expect(row).toBeVisible({ timeout: 15000 });
}

async function closeOpenDialogs(page: import("@playwright/test").Page) {
  for (let i = 0; i < 3; i++) {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

async function openToolDetail(page: import("@playwright/test").Page, internalNumber: string) {
  const row = toolRow(page, internalNumber);
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  return detail;
}

async function selectEmployeeInDialog(page: import("@playwright/test").Page, employeeName: string) {
  const dialog = page.getByRole("dialog").last();
  await dialog.getByRole("combobox").click();
  const firstName = employeeName.split(" ")[0] ?? employeeName;
  await page.getByRole("option", { name: new RegExp(firstName, "i") }).first().click();
}

async function submitAssign(
  page: import("@playwright/test").Page,
  employeeName: string,
  options: { durationDays?: string; startDate?: string } = {},
) {
  const assignDialog = page.getByRole("dialog").last();
  await selectEmployeeInDialog(page, employeeName);
  if (options.startDate) {
    await assignDialog.getByLabel("Date de début").fill(options.startDate);
  }
  await assignDialog.getByLabel("Durée (jours)").fill(options.durationDays ?? "5");
  await assignDialog.getByRole("button", { name: "Assigner" }).click();
  await expect(page.getByRole("dialog").getByText("Assignation actuelle")).toBeVisible({
    timeout: 15000,
  });
  await closeOpenDialogs(page);
}

async function submitReserve(
  page: import("@playwright/test").Page,
  employeeName: string,
  startDate: string,
  durationDays = "3",
) {
  const reserveDialog = page.getByRole("dialog").last();
  await selectEmployeeInDialog(page, employeeName);
  await reserveDialog.getByLabel("Date de début").fill(startDate);
  await reserveDialog.getByLabel("Durée (jours)").fill(durationDays);
  await reserveDialog.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByRole("dialog").getByText("Réservations futures")).toBeVisible({
    timeout: 15000,
  });
  await closeOpenDialogs(page);
}

async function submitReturn(page: import("@playwright/test").Page) {
  const returnDialog = page.getByRole("dialog").last();
  await returnDialog.getByRole("button", { name: "Enregistrer le retour" }).click();
  await closeOpenDialogs(page);
}

async function openToolDetailOnCard(page: import("@playwright/test").Page, internalNumber: string) {
  const card = toolCard(page, internalNumber);
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  return detail;
}

test.describe("12. Outillage", () => {
  test.use({ storageState: tenantAuth, pageName: "Outillage" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/outillage");
    await ensureDashboardAccess(page);
    if (!page.url().includes("/outillage")) await page.goto("/outillage");
    await expect(page.getByRole("heading", { name: /Outillage/i, level: 2 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("A — créer un outil disponible", async ({ page }) => {
    const internalNumber = `E2E-A-${Date.now()}`;
    await createTool(page, {
      name: `${MARKER} Perceuse A`,
      internalNumber,
    });
    const row = toolRow(page, internalNumber);
    await expect(row.getByText("Disponible")).toBeVisible();
    await page.getByTestId("outillage-count-all").click();
    await expect(row).toBeVisible();
  });

  test("B — assignation immédiate met à jour statut et compteurs", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-B-${Date.now()}`;

    await createTool(page, {
      name: `${MARKER} Scie B`,
      internalNumber,
    });

    const availableBefore = Number(
      await page.getByTestId("outillage-count-available").getByRole("paragraph").last().textContent(),
    );
    const inUseBefore = Number(
      await page.getByTestId("outillage-count-in_use").getByRole("paragraph").last().textContent(),
    );

    const detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await expect(page.getByRole("dialog").last().getByText("Assigner à un employé")).toBeVisible();
    await submitAssign(page, employeeName, { durationDays: "5" });

    await page.getByTestId("outillage-count-all").click();
    const row = toolRow(page, internalNumber);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("En utilisation")).toBeVisible();
    await expect(row.getByRole("cell", { name: new RegExp(employeeName, "i") })).toBeVisible();

    const availableAfter = Number(
      await page.getByTestId("outillage-count-available").getByRole("paragraph").last().textContent(),
    );
    const inUseAfter = Number(
      await page.getByTestId("outillage-count-in_use").getByRole("paragraph").last().textContent(),
    );
    expect(inUseAfter).toBeGreaterThanOrEqual(inUseBefore + 1);
    expect(availableAfter).toBeLessThanOrEqual(availableBefore);
  });

  test("C — chevauchement refusé", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-C-${Date.now()}`;

    await createTool(page, {
      name: `${MARKER} Détecteur C`,
      internalNumber,
    });

    let detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await submitAssign(page, employeeName, { durationDays: "5" });

    detail = await openToolDetail(page, internalNumber);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Assigner" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await page.getByTestId("outillage-count-all").click();
    await expect(toolRow(page, internalNumber)).toBeVisible();
  });

  test("D — réservation future garde l'outil disponible aujourd'hui", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-D-${Date.now()}`;
    const futureStart = daysFromToday(7);

    await createTool(page, {
      name: `${MARKER} Niveau D`,
      internalNumber,
    });

    const detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Réserver" }).click();
    await expect(page.getByRole("dialog").last().getByText("Réserver pour un employé")).toBeVisible();
    await submitReserve(page, employeeName, futureStart, "3");

    await page.getByTestId("outillage-count-all").click();
    const row = toolRow(page, internalNumber);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("Disponible")).toBeVisible();

    await row.click();
    const detailAfter = page.getByRole("dialog");
    await expect(detailAfter.getByText("Réservations futures")).toBeVisible();
    await expect(
      detailAfter.locator("li").filter({ hasText: new RegExp(employeeName.split(" ")[0] ?? "", "i") }),
    ).toBeVisible();

    await closeOpenDialogs(page);
    await page.getByTestId("outillage-count-reserved").click();
    await expect(toolRow(page, internalNumber)).toBeVisible();
  });

  test("E — retour remet l'outil disponible", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-E-${Date.now()}`;

    await createTool(page, {
      name: `${MARKER} Pince E`,
      internalNumber,
    });

    let detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await submitAssign(page, employeeName, { durationDays: "3" });

    await page.getByTestId("outillage-count-all").click();
    await expect(toolRow(page, internalNumber).getByText("En utilisation")).toBeVisible();

    detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Retour" }).click();
    await submitReturn(page);

    await page.getByTestId("outillage-count-all").click();
    await expect(toolRow(page, internalNumber)).toBeVisible();
    await expect(toolRow(page, internalNumber).getByText("Disponible")).toBeVisible();
  });

  test("F — assignation en retard et filtre En retard", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-F-${Date.now()}`;

    await createTool(page, {
      name: `${MARKER} Perceuse F`,
      internalNumber,
    });

    const detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await submitAssign(page, employeeName, {
      startDate: daysFromToday(-10),
      durationDays: "5",
    });

    await page.getByTestId("outillage-count-overdue").click();
    const row = toolRow(page, internalNumber);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText("En retard")).toBeVisible();
  });

  test("G — outil en réparation non assignable", async ({ page }) => {
    const internalNumber = `E2E-G-${Date.now()}`;
    await createTool(page, {
      name: `${MARKER} Hilti G`,
      internalNumber,
      baseStatus: "in_repair",
    });

    const detail = await openToolDetail(page, internalNumber);
    await expect(detail.getByText("En réparation")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Assigner" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Réserver" })).toHaveCount(0);

    await closeOpenDialogs(page);
    await page.getByTestId("outillage-count-in_repair").click();
    await expect(toolRow(page, internalNumber)).toBeVisible();
  });

  test("H — hors service non assignable", async ({ page }) => {
    const internalNumber = `E2E-H-${Date.now()}`;
    await createTool(page, {
      name: `${MARKER} Échelle H`,
      internalNumber,
      baseStatus: "out_of_service",
    });

    const detail = await openToolDetail(page, internalNumber);
    await expect(detail.getByText("Hors service")).toBeVisible();
    await expect(detail.getByRole("button", { name: "Assigner" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: "Réserver" })).toHaveCount(0);

    await closeOpenDialogs(page);
    await page.getByTestId("outillage-count-all").click();
    await expect(toolRow(page, internalNumber)).toBeVisible();
  });

  test("I — fiche employé affiche l'outil assigné", async ({ page }) => {
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-I-${Date.now()}`;
    const toolName = `${MARKER} Caméra I`;

    await createTool(page, { name: toolName, internalNumber });

    const detail = await openToolDetail(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await submitAssign(page, employeeName, { durationDays: "4" });

    await page.goto("/employees");
    await ensureDashboardAccess(page);
    await page.reload();
    await page
      .getByRole("row", { name: new RegExp(employeeName, "i") })
      .getByRole("button", { name: "Profil" })
      .click();
    const profile = page.getByRole("dialog");
    await expect(profile.getByText("En cours")).toBeVisible({ timeout: 15000 });
    await expect(profile.getByText(toolName)).toBeVisible({ timeout: 15000 });
  });

  test("J — cartes mobile assignation et retour", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const creds = readTestCredentials();
    const employeeName = creds.seed?.employeeName ?? `${E2E_SEED_MARKER} Employé`;
    const internalNumber = `E2E-J-${Date.now()}`;

    await page.goto("/outillage");
    await createTool(
      page,
      {
        name: `${MARKER} Mobile J`,
        internalNumber,
      },
      "card",
    );

    const card = toolCard(page, internalNumber);
    let detail = await openToolDetailOnCard(page, internalNumber);
    await detail.getByRole("button", { name: "Assigner" }).click();
    await submitAssign(page, employeeName, { durationDays: "2" });

    await page.getByTestId("outillage-count-all").click();
    await expect(card.getByText("En utilisation")).toBeVisible();

    detail = await openToolDetailOnCard(page, internalNumber);
    await detail.getByRole("button", { name: "Retour" }).click();
    await submitReturn(page);

    await expect(card.getByText("Disponible")).toBeVisible();
  });
});
