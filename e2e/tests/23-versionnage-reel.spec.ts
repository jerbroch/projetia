import { test, expect } from "../fixtures/base";
import { readTestCredentials } from "../helpers/test-data";
import { connexionLocataire, ensureDashboardAccess, loginWithCredentials } from "../helpers/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readFileSync } from "node:fs";
import path from "path";

/**
 * UNE SOUMISSION RÉELLE, SAUVEGARDÉE PAR LE VRAI FORMULAIRE.
 *
 * Les tests d'intégration appellent `ecrireVersionCourante` directement. Celui-ci
 * passe par où passe l'entrepreneur : le navigateur, le formulaire, le bouton
 * « Enregistrer », l'action serveur, la RLS de son propre compte. C'est le seul
 * moyen de savoir si le versionnage tient dans le chemin réel et pas seulement
 * dans un appel de fonction.
 *
 * Deux soumissions :
 *   - une copie fidèle de SO-2026-002, prise en production (1 main-d'œuvre,
 *     1 matériau venu du catalogue) ;
 *   - une soumission riche, construite ici, parce que la production n'en a
 *     aucune qui dépasse deux lignes.
 */

const REEL = path.resolve(__dirname, "../fixtures/so-2026-002.json");
const CATALOGUE = path.resolve(__dirname, "../fixtures/catalogue-chauffe-eau.json");

const marque = `VER-${Date.now()}`;
const TITRE_REEL = `${marque} Changer chauffe eau`;
const TITRE_RICHE = `${marque} Rénovation complète`;

/** Une estimation riche : les trois familles, du catalogue et du sur-mesure. */
function estimationRiche(articles: Array<{ id: string; name: string; unit: string }>) {
  const t = Date.now();
  return {
    labor: [
      { id: `ql-${t}-a`, category: "compagnon", hours: 16, hourly_rate: 125, worker_count: 2, total: 4000 },
      { id: `ql-${t}-b`, category: "apprenti", hours: 16, hourly_rate: 65, worker_count: 1, total: 1040 },
      { id: `ql-${t}-c`, category: "equipe", hours: 8, hourly_rate: 190, worker_count: 1, total: 1520 },
      { id: `ql-${t}-d`, category: "autre", employee_category: "Soudeur certifié",
        hours: 6, hourly_rate: 145, worker_count: 1, total: 870 },
    ],
    materials: articles.slice(0, 5).map((a, i) => ({
      id: `qm-${t}-${i}`,
      name: a.name,
      unit: a.unit,
      quantity: i + 2,
      cost_price: 40 + i * 15,
      margin_pct: 0.4,
      sale_price: (40 + i * 15) * 1.4,
      total: (i + 2) * (40 + i * 15) * 1.4,
      is_custom: false,
      catalog_item_id: a.id,
    })).concat([{
      id: `qm-${t}-libre`,
      name: "Pièce fabriquée sur mesure",
      unit: "unité",
      quantity: 1,
      cost_price: 300,
      margin_pct: 0.4,
      sale_price: 420,
      total: 420,
      is_custom: true,
      catalog_item_id: null,
    } as never]),
    fees: [
      { id: `qf-${t}-1`, fee_type: "transport", description: "Déplacement Saguenay", quantity: 2, price: 85, total: 170 },
      { id: `qf-${t}-2`, fee_type: "permis", description: "Permis municipal", quantity: 1, price: 240, total: 240 },
      { id: `qf-${t}-3`, fee_type: "location", description: "Location nacelle", quantity: 3, price: 195, total: 585 },
    ],
    show_labor_on_client: false,
    show_materials_on_client: false,
    manual_price_override: false,
  };
}

test.describe("23. Versionnage sur une soumission réelle", () => {
  // PAS de storageState. La suite complète dure près de cinquante minutes, et
  // ce spec tourne à la fin : l'état de session écrit par `auth.setup` au
  // début n'est plus valable, et la page de connexion s'affiche à la place de
  // /quotes. On se connecte au moment où on en a besoin.
  test.use({ pageName: "Versionnage" });

  let companyId = "";

  test.beforeAll(async () => {
    const db = createAdminClient();
    companyId = readTestCredentials().tenantCompanyId!;
    expect(companyId, "l'entreprise de test doit exister").toBeTruthy();

    // 1. L'article de catalogue référencé par la vraie soumission n'existe pas
    //    sur le dev. On l'apporte avec sa catégorie, sinon la clé étrangère de
    //    quote_line_versions.catalog_item_id refuserait la ligne.
    const { article, categorie } = JSON.parse(readFileSync(CATALOGUE, "utf-8"));
    if (categorie) {
      // Le slug est unique parmi les catégories globales : une catégorie du
      // même nom peut déjà exister sous un autre identifiant. On reprend
      // celle qui est en place plutôt que d'en imposer une deuxième.
      const { data: dejaLa } = await db
        .from("material_categories")
        .select("id")
        .eq("slug", categorie.slug)
        .maybeSingle();
      if (dejaLa) {
        article.category_id = String((dejaLa as { id: string }).id);
      } else {
        const { error } = await db.from("material_categories").insert(categorie);
        expect(error, "la catégorie doit être posée").toBeNull();
      }
    }
    // Le catalogue du dev contient déjà le même article, sous un autre
    // identifiant : sa clé naturelle est (catégorie, nom, diamètre, raccord).
    // On REMAPPE la référence de la soumission plutôt que d'imposer un doublon
    // — c'est le même article, avec l'identifiant d'ici.
    const { data: articleDejaLa } = await db
      .from("material_catalog_items")
      .select("id")
      .eq("category_id", article.category_id)
      .eq("name", article.name)
      .maybeSingle();

    let catalogItemId: string;
    if (articleDejaLa) {
      catalogItemId = String((articleDejaLa as { id: string }).id);
    } else {
      // `search_text` est GENERATED ALWAYS : la fournir fait échouer l'insertion.
      const { search_text: _calculee, ...articleInserable } = article;
      const { data, error } = await db
        .from("material_catalog_items")
        .insert(articleInserable)
        .select("id")
        .single();
      // Un amorçage qui échoue sans qu'on regarde l'erreur ferait porter le
      // blâme au versionnage — c'est ce qui s'est produit au premier passage.
      expect(error, "l'article du catalogue doit être posé").toBeNull();
      catalogItemId = String((data as { id: string }).id);
    }

    // 2. La copie fidèle de la soumission de production.
    const reel = JSON.parse(readFileSync(REEL, "utf-8"));
    for (const m of reel.cost_estimation.materials ?? []) {
      if (m.catalog_item_id) m.catalog_item_id = catalogItemId;
    }
    const { error: eReel } = await db.from("quotes").insert({
      company_id: companyId,
      quote_number: `${marque}-REEL`,
      title: TITRE_REEL,
      description: reel.description,
      customer_name: "Client repris de production",
      amount: reel.amount,
      status: "draft",
      line_items: reel.line_items,
      cost_estimation: reel.cost_estimation,
    });
    expect(eReel, "la copie de la soumission réelle doit être posée").toBeNull();

    // 3. La soumission riche, avec de vrais articles du catalogue du dev.
    const { data: articles } = await db
      .from("material_catalog_items")
      .select("id, name, unit")
      .limit(5);
    const { error: eRiche } = await db.from("quotes").insert({
      company_id: companyId,
      quote_number: `${marque}-RICHE`,
      title: TITRE_RICHE,
      description: "Toutes les familles de lignes à la fois",
      customer_name: "Client d'essai",
      amount: 0,
      status: "draft",
      line_items: [],
      cost_estimation: estimationRiche((articles ?? []) as Array<{ id: string; name: string; unit: string }>),
    });
    expect(eRiche, "la soumission riche doit être posée").toBeNull();
  });

  test.afterAll(async () => {
    // Le reste de la suite purge ce qu'il crée ; celui-ci aussi. L'ordre suit
    // les clés étrangères : company_id est en ON DELETE RESTRICT vers companies.
    const db = createAdminClient();
    const { data: qs } = await db
      .from("quotes")
      .select("id")
      .eq("company_id", companyId)
      .like("quote_number", `${marque}%`);
    const ids = (qs ?? []).map((q) => String((q as { id: string }).id));
    if (!ids.length) return;

    const { data: vs } = await db.from("quote_versions").select("id").in("quote_id", ids);
    const versionIds = (vs ?? []).map((v) => String((v as { id: string }).id));
    if (versionIds.length) {
      await db.from("quote_line_versions").delete().in("quote_version_id", versionIds);
    }
    await db.from("quote_line_items").delete().in("quote_id", ids);
    await db.from("quote_versions").delete().in("quote_id", ids);
    await db.from("quotes").delete().in("id", ids);
    await db.from("versioning_write_failures").delete().eq("company_id", companyId);
  });

  /** Ouvre la soumission par son titre et clique Enregistrer. Rien d'autre. */
  async function sauvegarderParLeFormulaire(page: import("@playwright/test").Page, titre: string) {
    await connexionLocataire(page);
    await page.goto("/quotes");
    await ensureDashboardAccess(page);

    const ligne = page.getByRole("row").filter({ hasText: titre });
    await expect(ligne).toBeVisible({ timeout: 20000 });
    await ligne.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Modifier" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    // On ne touche à RIEN : on sauvegarde telle quelle. Le versionnage doit
    // s'alimenter sans que l'entrepreneur ait rien changé.
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 30000 });
  }

  test("la soumission reprise de production s'enregistre et se versionne", async ({ page }) => {
    await sauvegarderParLeFormulaire(page, TITRE_REEL);
  });

  test("la soumission riche s'enregistre et se versionne", async ({ page }) => {
    await sauvegarderParLeFormulaire(page, TITRE_RICHE);
  });

  test("aucun échec n'est inscrit au compteur", async () => {
    const db = createAdminClient();
    const { data } = await db
      .from("versioning_write_failures")
      .select("operation, error, quote_id")
      .eq("company_id", companyId);
    expect(data ?? []).toEqual([]);
  });
});
