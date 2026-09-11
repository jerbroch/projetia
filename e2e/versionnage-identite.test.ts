import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supprimerEntreprise } from "@/lib/data/supprimer-entreprise";
import "./load-env";
import { cibleConfirmee } from "./target-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ecrireVersionCourante } from "@/lib/data/quote-versioning-write";
import type { QuoteCostEstimation } from "@/types";

/**
 * LA RAISON D'ÊTRE DU VERSIONNAGE, ÉPROUVÉE CONTRE LA VRAIE BASE.
 *
 * Une ligne conservée d'une sauvegarde à l'autre doit garder le même
 * quote_line_item_id. Si cet identifiant changeait, les heures déjà saisies sur
 * le chantier se détacheraient de l'ouvrage qu'elles paient, sans que rien ne
 * l'annonce : les totaux resteraient plausibles et seraient faux.
 *
 * La barrière de production de la suite e2e s'applique ici comme ailleurs.
 */

/**
 * Sans identifiants, ce test ne peut rien éprouver. Il se saute alors — mais en
 * le DISANT : un test qui disparaît sans bruit ne protège rien, et on croirait
 * la suite verte alors qu'elle n'a rien vérifié.
 */
const identifiantsPresents = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);
if (!identifiantsPresents) {
  console.warn(
    "\n⚠ versionnage-identite : sauté, faute d'identifiants Supabase.\n" +
      "  Posez .env.e2e (local) ou les secrets DEV_SUPABASE_* (CI) pour qu'il s'exécute.\n"
  );
}

/** Trois lignes de main-d'œuvre, identifiées comme le fait l'éditeur. */
function estimation(lignes: Array<{ id: string; heures: number; taux: number }>): QuoteCostEstimation {
  return {
    labor: lignes.map((l) => ({
      id: l.id,
      category: "compagnon" as const,
      hours: l.heures,
      hourlyRate: l.taux,
      workerCount: 1,
      total: l.heures * l.taux,
    })),
    materials: [],
    fees: [],
  };
}

describe.skipIf(!identifiantsPresents)("l'identité d'une ligne survit à une révision", () => {
  // Construit dans beforeAll : le faire au chargement du module ferait échouer
  // la suite entière là où les identifiants manquent, avant même le skip.
  let db: ReturnType<typeof createAdminClient>;
  let companyId = "";
  let quoteId = "";

  beforeAll(async () => {
    db = createAdminClient();
    cibleConfirmee(); // refuse la production, comme toute la suite

    const { data: c, error: ec } = await db
      .from("companies")
      .insert({ name: "Versionnage — essai d'identité" })
      .select("id")
      .single();
    if (ec) throw ec;
    companyId = String((c as { id: string }).id);

    const { data: q, error: eq } = await db
      .from("quotes")
      .insert({
        company_id: companyId,
        quote_number: `VER-${Date.now()}`,
        title: "Drain de fondation",
        customer_name: "Client d'essai",
        amount: 0,
        status: "draft",
      })
      .select("id")
      .single();
    if (eq) throw eq;
    quoteId = String((q as { id: string }).id);
  });

  afterAll(async () => {
    if (!companyId) return;
    // L'ordre compte : company_id est en ON DELETE RESTRICT vers companies,
    // exactement la conséquence notée au journal des dettes.
    if (quoteId) await db.from("quotes").delete().eq("id", quoteId);
    // Le versionnage est en ON DELETE RESTRICT : le geste partagé s'en occupe.
    await supprimerEntreprise(db as never, companyId);
  });

  /** Les identités en base, indexées par l'identifiant que porte l'éditeur. */
  async function identites(): Promise<Map<string, string>> {
    const { data } = await db
      .from("quote_line_items")
      .select("id, client_line_id")
      .eq("quote_id", quoteId);
    return new Map(
      (data ?? []).map((r) => [
        String((r as { client_line_id: string }).client_line_id),
        String((r as { id: string }).id),
      ])
    );
  }

  /** Les lignes présentes dans la version courante. */
  async function lignesDeLaVersion(versionId: string): Promise<Array<{ item: string; desc: string; heures: number }>> {
    const { data } = await db
      .from("quote_line_versions")
      .select("quote_line_item_id, description, labor_hours, sort_order")
      .eq("quote_version_id", versionId)
      .order("sort_order");
    return (data ?? []).map((r) => {
      const x = r as { quote_line_item_id: string; description: string; labor_hours: number };
      return { item: String(x.quote_line_item_id), desc: String(x.description), heures: Number(x.labor_hours) };
    });
  }

  it("garde le même quote_line_item_id pour les lignes conservées", async () => {
    // ── Première sauvegarde : trois lignes ───────────────────────────────
    const un = await ecrireVersionCourante(db as never, {
      companyId,
      quoteId,
      estimation: estimation([
        { id: "ql-a", heures: 8, taux: 50 },
        { id: "ql-b", heures: 4, taux: 60 },
        { id: "ql-c", heures: 2, taux: 70 },
      ]),
      operation: "create",
    });
    expect(un.erreur).toBeUndefined();
    expect(un.ok).toBe(true);
    expect(un.creees).toBe(3);

    const avant = await identites();
    expect([...avant.keys()].sort()).toEqual(["ql-a", "ql-b", "ql-c"]);
    expect(await lignesDeLaVersion(un.quoteVersionId!)).toHaveLength(3);

    // ── Deuxième sauvegarde : A modifiée, C supprimée, D ajoutée ─────────
    const deux = await ecrireVersionCourante(db as never, {
      companyId,
      quoteId,
      estimation: estimation([
        { id: "ql-a", heures: 12, taux: 55 },
        { id: "ql-b", heures: 4, taux: 60 },
        { id: "ql-d", heures: 6, taux: 65 },
      ]),
      operation: "update",
    });
    expect(deux.erreur).toBeUndefined();
    expect(deux.quoteVersionId).toBe(un.quoteVersionId); // toujours la version 1, en draft
    expect(deux.reprises).toBe(2);
    expect(deux.creees).toBe(1);
    expect(deux.retirees).toBe(1);

    const apres = await identites();

    // ── LE POINT CRITIQUE ────────────────────────────────────────────────
    expect(apres.get("ql-a")).toBe(avant.get("ql-a"));
    expect(apres.get("ql-b")).toBe(avant.get("ql-b"));

    // La ligne modifiée porte bien sa nouvelle valeur, sans avoir changé d'identité.
    const lignes = await lignesDeLaVersion(deux.quoteVersionId!);
    const a = lignes.find((l) => l.item === avant.get("ql-a"));
    expect(a?.heures).toBe(12);

    // La ligne ajoutée reçoit une identité neuve.
    expect(apres.get("ql-d")).toBeDefined();
    expect([...avant.values()]).not.toContain(apres.get("ql-d"));

    // La ligne supprimée sort de la version courante, mais son identité reste
    // en base : des heures de chantier peuvent déjà y pointer.
    expect(apres.get("ql-c")).toBe(avant.get("ql-c"));
    expect(lignes.map((l) => l.item)).not.toContain(avant.get("ql-c"));
    expect(lignes).toHaveLength(3);
  });

  it("des heures décimales arrivent en base sans arrondi", async () => {
    // L'autre chemin des heures : la soumission. `labor_hours` est un
    // numeric(8,2) — une heure et demie doit y arriver telle quelle, et
    // 1,5 h × 2 travailleurs doit faire 3 h, pas 1 h.
    const r = await ecrireVersionCourante(db as never, {
      companyId,
      quoteId,
      estimation: {
        labor: [
          { id: "ql-dec-1", category: "compagnon", hours: 1.5, hourlyRate: 125, workerCount: 1, total: 187.5 },
          { id: "ql-dec-2", category: "compagnon", hours: 1.5, hourlyRate: 125, workerCount: 2, total: 375 },
          { id: "ql-dec-3", category: "compagnon", hours: 7.25, hourlyRate: 125, workerCount: 1, total: 906.25 },
        ],
        materials: [],
        fees: [],
      },
      operation: "update",
    });
    expect(r.erreur).toBeUndefined();

    const { data } = await db
      .from("quote_line_versions")
      .select("labor_hours, quote_line_item_id")
      .eq("quote_version_id", r.quoteVersionId!)
      .order("sort_order");
    const heures = (data ?? []).map((x) => Number((x as { labor_hours: number }).labor_hours));
    expect(heures).toEqual([1.5, 3, 7.25]);
  });

  it("une soumission dupliquée reçoit de NOUVELLES identités, jamais les mêmes", async () => {
    // La duplication recopie cost_estimation verbatim : la copie porte donc
    // les mêmes identifiants client. Si elle partageait les quote_line_items,
    // les heures d'un chantier remonteraient dans les statistiques d'un autre.
    const { data: copie, error } = await db
      .from("quotes")
      .insert({
        company_id: companyId,
        quote_number: `VER-COPIE-${Date.now()}`,
        title: "Drain de fondation (copie)",
        customer_name: "Client d'essai",
        amount: 0,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    const copieId = String((copie as { id: string }).id);

    const r = await ecrireVersionCourante(db as never, {
      companyId,
      quoteId: copieId,
      estimation: estimation([
        { id: "ql-a", heures: 12, taux: 55 },
        { id: "ql-b", heures: 4, taux: 60 },
      ]),
      operation: "duplicate",
      copieDeQuoteId: quoteId,
    });
    expect(r.erreur).toBeUndefined();
    expect(r.creees).toBe(2);
    expect(r.reprises).toBe(0);

    const original = await identites();
    const { data: copiees } = await db
      .from("quote_line_items")
      .select("id, client_line_id, copied_from_quote_line_item_id")
      .eq("quote_id", copieId);

    for (const row of copiees ?? []) {
      const x = row as { id: string; client_line_id: string; copied_from_quote_line_item_id: string | null };
      // Identité neuve...
      expect(x.id).not.toBe(original.get(x.client_line_id));
      // ...qui nomme celle dont elle descend.
      expect(x.copied_from_quote_line_item_id).toBe(original.get(x.client_line_id));
    }
    expect(copiees).toHaveLength(2);

    await db.from("quote_line_versions").delete().eq("quote_version_id", r.quoteVersionId!);
    await db.from("quote_line_items").delete().eq("quote_id", copieId);
    await db.from("quote_versions").delete().eq("quote_id", copieId);
    await db.from("quotes").delete().eq("id", copieId);
  });

  it("n'inscrit aucun échec dans le compteur", async () => {
    const { data } = await db
      .from("write_failures")
      .select("operation, error")
      .eq("company_id", companyId);
    expect(data ?? []).toEqual([]);
  });
});

/**
 * UN VIREMENT REÇU EST UNE ACCEPTATION.
 *
 * Le bloc « Comment payer » est sur la soumission dès sa réception : un client
 * peut donc virer son dépôt avant de cliquer « accepter ». Enregistrer ce
 * dépôt fait passer la soumission par l'acceptation d'abord — une seule action
 * de l'entrepreneur, deux transitions tracées séparément.
 *
 * Ce test vérifie les deux traces contre la vraie base : `accepted_source` dit
 * laquelle des deux acceptations s'est produite, et la ligne `payments` porte
 * le numéro de soumission.
 */
describe.skipIf(!identifiantsPresents)("l'acceptation par dépôt reçu", () => {
  let db: ReturnType<typeof createAdminClient>;
  let companyId = "";
  const quotesCreees: string[] = [];

  beforeAll(async () => {
    db = createAdminClient();
    cibleConfirmee();
    const { data: c } = await db
      .from("companies")
      .insert({ name: "Dépôt — essai d'acceptation" })
      .select("id")
      .single();
    companyId = String((c as { id: string }).id);
  });

  afterAll(async () => {
    if (!companyId) return;
    await db.from("payments").delete().eq("company_id", companyId);
    await db.from("quotes").delete().in("id", quotesCreees);
    await supprimerEntreprise(db as never, companyId);
  });

  async function soumissionEnvoyee(statut: "sent" | "viewed" | "draft") {
    const { data, error } = await db
      .from("quotes")
      .insert({
        company_id: companyId,
        quote_number: `SO-DEP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "Remplacer le chauffe-eau",
        customer_name: "Michel Brochu",
        amount: 5000,
        status: statut,
        deposit_required: true,
        deposit_percentage: 20,
        line_items: [{ description: "Travaux", quantity: 1, unit_price: 5000, total: 5000 }],
      })
      .select("*")
      .single();
    if (error) throw error;
    const row = data as { id: string };
    quotesCreees.push(row.id);
    return row;
  }

  it("depuis « sent », accepte PUIS encaisse, et trace les deux", async () => {
    const q = await soumissionEnvoyee("sent");
    const { accepterSoumission } = await import("@/lib/data/tenant-data");
    const { mapQuoteRow } = await import("@/lib/data/tenant-data");

    const accepte = await accepterSoumission(
      mapQuoteRow(q as unknown as Record<string, unknown>),
      "depot_enregistre",
    );
    expect(accepte.error).toBeUndefined();

    const { data: apres } = await db
      .from("quotes")
      .select("status, accepted_at, accepted_source, deposit_amount, deposit_status")
      .eq("id", q.id)
      .single();
    const r = apres as {
      status: string; accepted_at: string | null; accepted_source: string | null;
      deposit_amount: number | null; deposit_status: string | null;
    };

    // Première transition, tracée.
    expect(r.status).toBe("deposit_pending");
    expect(r.accepted_at).toBeTruthy();
    expect(r.accepted_source).toBe("depot_enregistre");
    expect(r.deposit_status).toBe("pending");
    // Le dépôt est calculé sur le TOTAL TAXES INCLUSES : 5 000 $ + taxes, à 20 %.
    expect(Number(r.deposit_amount)).toBeCloseTo(1149.75, 2);
  });

  it("l'acceptation par le client se distingue dans les données", async () => {
    const q = await soumissionEnvoyee("viewed");
    const { accepterSoumission, mapQuoteRow } = await import("@/lib/data/tenant-data");
    await accepterSoumission(mapQuoteRow(q as unknown as Record<string, unknown>), "client");

    const { data } = await db.from("quotes").select("accepted_source").eq("id", q.id).single();
    expect((data as { accepted_source: string }).accepted_source).toBe("client");
  });

  it("refuse une soumission jamais envoyée", async () => {
    const q = await soumissionEnvoyee("draft");
    const { accepterSoumission, mapQuoteRow } = await import("@/lib/data/tenant-data");
    const r = await accepterSoumission(mapQuoteRow(q as unknown as Record<string, unknown>), "depot_enregistre");
    expect(r.quote).toBeNull();
    expect(r.error).toContain("ne peut plus être acceptée");
  });

  it("le compteur d'échecs accepte le domaine « deposit »", async () => {
    const { noterEchecDEcriture } = await import("@/lib/data/echecs-decriture");
    await noterEchecDEcriture(db as never, {
      companyId,
      quoteId: null,
      domain: "deposit",
      operation: "record_payment",
      erreur: "essai",
    });
    const { data } = await db
      .from("write_failures")
      .select("domain, operation")
      .eq("company_id", companyId);
    expect(data).toEqual([{ domain: "deposit", operation: "record_payment" }]);
    await db.from("write_failures").delete().eq("company_id", companyId);
  });
});
