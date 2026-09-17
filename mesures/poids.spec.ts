import { test } from "@playwright/test";
import { readFileSync } from "fs";

/** Ce que pèse la réponse de navigation, et la part des lignes de soumission. */
const CREDS = JSON.parse(readFileSync("mesures/compte.json", "utf-8"));

test("poids des réponses", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Courriel").fill(CREDS.courriel);
  await page.getByLabel("Mot de passe", { exact: true }).fill(CREDS.motDePasse);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }
  catch { await page.waitForURL(/\/dashboard/, { timeout: 60000 }); }

  for (const [nom, route] of [["clients", "/customers"], ["soumissions", "/quotes"]] as const) {
    let octets = 0;
    let corps = "";
    const onRep = async (r: import("@playwright/test").Response) => {
      if (new URL(r.url()).pathname !== route) return;
      try {
        const t = await r.text();
        if (t.length > octets) { octets = t.length; corps = t; }
      } catch { /* réponse déjà consommée */ }
    };
    page.on("response", onRep);
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    page.off("response", onRep);

    // Part des lignes de soumission dans la charge.
    const occurrences = (corps.match(/unitPrice/g) ?? []).length;
    console.log(
      `POIDS >>> ${nom.padEnd(12)} ${String(Math.round(octets / 1024)).padStart(4)} Ko · ` +
        `${occurrences} lignes de soumission sérialisées`,
    );
  }
});
