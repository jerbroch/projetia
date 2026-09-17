import { test, expect } from "../fixtures/base";
import { connexionLocataire } from "../helpers/auth";
import { createE2EAdmin } from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * LE DÉDOUBLONNAGE DES LECTURES NE DOIT RIEN FIGER NI RIEN MÉLANGER.
 *
 * Les lectures par entreprise sont désormais dédoublonnées le temps d'un
 * rendu. Deux craintes légitimes en découlent, et compter les
 * `revalidatePath` ne répond ni à l'une ni à l'autre :
 *
 *  1. UNE MODIFICATION DOIT SE VOIR. Si le cache survivait à la requête, on
 *     enregistrerait un client et la liste continuerait d'afficher l'ancienne.
 *     On le vérifie par le parcours réel : créer, puis regarder.
 *
 *  2. DEUX ENTREPRISES NE DOIVENT JAMAIS SE CROISER. Le cache est lié à la
 *     requête en cours et `companyId` fait partie de sa clé ; on le vérifie
 *     tout de même de bout en bout, avec une entreprise voisine dont les
 *     données ne doivent apparaître nulle part.
 */
test.describe("38. Actualisation et isolation", () => {
  test("une création se voit immédiatement dans la liste", async ({ page }) => {
    await connexionLocataire(page);
    await page.goto("/customers");
    await page.locator("h1").first().waitFor({ state: "visible" });

    /*
     * UN NOM COURT, ET C'EST DÉLIBÉRÉ. « Client Actualisation <horodatage> »
     * dépasse la largeur de la cellule et s'y affiche tronqué : `getByText`
     * ne le retrouvait plus, et l'épreuve accusait l'application d'un défaut
     * d'actualisation qui n'existait pas.
     */
    const nom = `Actu${Date.now().toString().slice(-8)}`;
    await page.getByRole("button", { name: /Créer un client/i }).first().click();
    const dialogue = page.getByRole("dialog");
    await dialogue.waitFor();
    await dialogue.getByLabel("Nom du client").fill(nom);
    await dialogue.getByRole("button", { name: "Créer le client", exact: true }).click();

    // Le dialogue doit se fermer : tant qu'il est là, rien n'a été enregistré,
    // et chercher le client dans la liste ne dirait rien d'utile.
    await expect(dialogue, "le dialogue se ferme après l'enregistrement").toHaveCount(0, {
      timeout: 20000,
    });

    // Le client doit apparaître SANS rechargement manuel : c'est ce que
    // `revalidatePath` promet, et c'est ce qu'on vérifie.
    /*
     * On interroge le TABLEAU, pas un texte isolé. Pendant que le dialogue se
     * referme, Radix marque le reste de la page comme masqué aux outils
     * d'accessibilité : un `toBeVisible` sur une cellule échoue alors, alors
     * que la donnée est bien là. `toContainText` sur le tableau attend la
     * donnée sans dépendre de l'état transitoire du dialogue.
     */
    await expect(page.locator("table")).toContainText(nom, { timeout: 20000 });
    console.log("ACTUALISATION >>> le client créé apparaît sans rechargement");

    // Et il est encore là après un vrai rechargement : ce n'était pas qu'un
    // affichage optimiste.
    await page.reload();
    await expect(page.locator("table")).toContainText(nom, { timeout: 20000 });
    console.log("ACTUALISATION >>> et il persiste après rechargement");
  });

  test("les données d'une autre entreprise n'apparaissent jamais", async ({ page }) => {
    const admin = createE2EAdmin();
    const creds = readTestCredentials();
    const marqueur = `VOISIN-${Date.now()}`;

    // Une entreprise voisine, avec un client reconnaissable.
    const { data: voisine, error } = await admin
      .from("companies")
      .insert({ name: `E2E Voisine ${marqueur}`, email: `e2e+voisine${Date.now()}@e2e.constructionios.test` })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();

    try {
      await admin.from("customers").insert({
        company_id: voisine!.id,
        name: `Client ${marqueur}`,
        email: `e2e+cv${Date.now()}@e2e.constructionios.test`,
        status: "active",
      });

      await connexionLocataire(page);
      for (const route of ["/customers", "/dashboard", "/quotes", "/invoices"]) {
        await page.goto(route);
        await page.locator("h1").first().waitFor({ state: "visible" });
        const corps = await page.locator("main").innerText();
        expect(corps, `${route} ne doit rien montrer de l'entreprise voisine`).not.toContain(
          marqueur,
        );
      }
      console.log("ISOLATION >>> aucune trace de l'entreprise voisine sur quatre écrans");
      expect(creds.tenantCompanyId).not.toBe(voisine!.id);
    } finally {
      await admin.from("customers").delete().eq("company_id", voisine!.id);
      await admin.from("companies").delete().eq("id", voisine!.id);
    }
  });
});
