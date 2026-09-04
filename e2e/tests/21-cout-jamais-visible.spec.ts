import { createClient } from "@supabase/supabase-js";
import { test, expect } from "../fixtures/base";
import {
  cleanupFieldEmployeeTestData, createE2EAdmin, setupFieldEmployeeTestData,
  type FieldEmployeeTestContext,
} from "../helpers/field-employee";
import { readTestCredentials } from "../helpers/test-data";

/**
 * L'employé annonce des prix au client ; il ne doit jamais voir la marge.
 *
 * Ces épreuves passent par une VRAIE CLÉ D'EMPLOYÉ et s'adressent directement à
 * l'API, sans passer par l'écran. C'est le seul niveau qui prouve quelque
 * chose : un écran qui n'affiche pas une donnée ne l'empêche pas de sortir.
 */
test.describe("21. Le coût ne sort jamais côté terrain", () => {
  let ctx: FieldEmployeeTestContext;
  let companyId: string;
  const NOM_GABARIT = "SONDE Compagnon";

  test.beforeAll(async () => {
    companyId = readTestCredentials().tenantCompanyId!;
    test.skip(!companyId, "Company ID manquant");
    const admin = createE2EAdmin();
    ctx = await setupFieldEmployeeTestData(admin, companyId);
    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", NOM_GABARIT);
    await admin.from("labor_rate_templates").insert({
      company_id: companyId, name: NOM_GABARIT, worker_count: 1,
      cost_per_hr: 45, bill_rate: 125, is_active: true,
    });
  });

  test.afterAll(async () => {
    if (!companyId || !ctx) return;
    const admin = createE2EAdmin();
    await admin.from("labor_rate_templates").delete().eq("company_id", companyId).eq("name", NOM_GABARIT);
    await cleanupFieldEmployeeTestData(admin, companyId, ctx);
  });

  async function sessionEmploye() {
    const c = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email: ctx.email, password: ctx.password });
    expect(error, "connexion de l'employé").toBeNull();
    return c;
  }

  test("il voit le prix de vente et jamais le coût", async () => {
    const c = await sessionEmploye();

    const { data: vue, error } = await c
      .from("field_labor_rates").select("*").eq("name", NOM_GABARIT).maybeSingle();
    expect(error, "lecture de la vue").toBeNull();
    expect(vue, "le gabarit doit être visible").not.toBeNull();
    expect(Number(vue!.bill_rate), "le prix de vente est visible").toBe(125);
    expect(Object.keys(vue!), "aucune colonne de coût").not.toContain("cost_per_hr");
    console.log("COÛT >>> vue lue :", Object.keys(vue!).join(", "));

    await c.auth.signOut();
  });

  test("il ne peut pas demander le coût, même en le nommant", async () => {
    const c = await sessionEmploye();

    // 1. Sur la vue : la colonne n'existe pas.
    const surLaVue = await c.from("field_labor_rates").select("name, cost_per_hr").limit(1);
    expect(surLaVue.error, "demander cost_per_hr sur la vue doit échouer").not.toBeNull();
    console.log("COÛT >>> sur la vue   :", surLaVue.error!.message.slice(0, 70));

    // 2. Sur la table : la RLS ne lui rend aucune rangée.
    const surLaTable = await c.from("labor_rate_templates").select("name, cost_per_hr").limit(5);
    const rendu = surLaTable.data ?? [];
    expect(rendu, "la table ne doit rendre aucune rangée").toHaveLength(0);
    console.log(`COÛT >>> sur la table : ${surLaTable.error ? surLaTable.error.message.slice(0, 50) : `${rendu.length} rangée(s)`}`);

    await c.auth.signOut();
  });

  test("les prix de matériaux sortent après marge, jamais le prix d'achat", async () => {
    const admin = createE2EAdmin();
    await admin.from("companies").update({ default_material_margin: 0.4 }).eq("id", companyId);

    // Un article avec un prix d'achat connu : c'est le seul moyen de vérifier
    // que la marge est bien APPLIQUÉE et que l'achat ne sort pas.
    const { data: categorie } = await admin
      .from("material_categories").select("id").limit(1).single();
    const { data: cat, error: erreurCat } = await admin.from("material_catalog_items").insert({
      company_id: companyId, category_id: categorie!.id,
      name: "SONDE Chauffe-eau 60 gal", unit: "unité",
    }).select("id").single();
    // Une semence qui échoue en silence ferait accuser l'application à tort.
    expect(erreurCat, "semence du matériau").toBeNull();
    await admin.from("company_catalog_prices").insert({
      company_id: companyId, catalog_item_id: cat!.id, reference_price: 1000,
    });

    const c = await sessionEmploye();
    const { data, error } = await c
      .from("field_material_prices").select("*").eq("name", "SONDE Chauffe-eau 60 gal").maybeSingle();
    expect(error, "lecture des matériaux").toBeNull();
    expect(data, "l'article doit être visible").not.toBeNull();

    const colonnes = Object.keys(data!);
    expect(colonnes, "aucun prix d'achat").not.toContain("reference_price");
    expect(colonnes, "aucun prix personnalisé").not.toContain("custom_price");
    expect(colonnes, "le prix de vente est là").toContain("sell_price");

    // 1000 $ d'achat, 40 % de marge → 1400 $. L'employé annonce 1400, jamais 1000.
    expect(Number(data!.sell_price), "prix de vente après marge").toBe(1400);
    console.log(`COÛT >>> matériaux    : achat 1000 $ caché, vente ${data!.sell_price} $ visible`);

    await c.auth.signOut();
    await admin.from("company_catalog_prices").delete().eq("catalog_item_id", cat!.id);
    await admin.from("material_catalog_items").delete().eq("id", cat!.id);
  });
});
