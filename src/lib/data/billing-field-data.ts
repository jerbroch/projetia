import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { formatPersonName } from "@/lib/company-display-name";
import type { HeureTerrain, MateriauTerrain } from "@/lib/billing-field-import";

/**
 * Saisies terrain d'un chantier, prêtes à devenir des lignes de facturation.
 *
 * Lecture par le client de service : la feuille se construit côté serveur pour
 * le bureau, et les politiques par employé de field_hours n'ont pas à s'y
 * appliquer.
 */
export async function getSaisiesTerrain(
  companyId: string,
  jobId: string,
): Promise<{ heures: HeureTerrain[]; materiaux: MateriauTerrain[] }> {
  if (!isSupabaseConfigured()) return { heures: [], materiaux: [] };
  const admin = createAdminClient();

  const [{ data: h }, { data: m }] = await Promise.all([
    admin
      .from("field_hours")
      .select("id, employee_id, hours, labor_type")
      .eq("company_id", companyId)
      .eq("scheduled_job_id", jobId),
    admin
      .from("field_materials")
      .select("id, name, quantity, unit, catalog_item_id")
      .eq("company_id", companyId)
      .eq("scheduled_job_id", jobId),
  ]);

  const ids = [...new Set((h ?? []).map((x) => String(x.employee_id)))];
  const noms = new Map<string, string>();
  if (ids.length) {
    const { data: emps } = await admin
      .from("employees")
      .select("id, first_name, last_name")
      .in("id", ids);
    for (const e of emps ?? []) {
      noms.set(
        String(e.id),
        [e.first_name, e.last_name].filter(Boolean).map((n) => formatPersonName(String(n))).join(" ").trim() ||
          "Employé",
      );
    }
  }

  return {
    heures: (h ?? []).map((x) => ({
      id: String(x.id),
      employeeId: String(x.employee_id),
      employeeName: noms.get(String(x.employee_id)) ?? "Employé",
      hours: Number(x.hours),
      laborType: x.labor_type ? String(x.labor_type) : null,
    })),
    materiaux: (m ?? []).map((x) => ({
      id: String(x.id),
      name: String(x.name),
      quantity: Number(x.quantity),
      unit: String(x.unit ?? "unité"),
      catalogItemId: x.catalog_item_id ? String(x.catalog_item_id) : null,
    })),
  };
}

/**
 * Prix de vente des articles de catalogue cités par les saisies.
 *
 * Le prix personnalisé de l'entreprise l'emporte sur le prix de référence :
 * c'est celui que l'employeur a décidé.
 */
export async function getPrixCatalogue(
  companyId: string,
  catalogItemIds: string[],
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured() || catalogItemIds.length === 0) return {};
  const admin = createAdminClient();
  const { data } = await admin
    .from("company_catalog_prices")
    .select("catalog_item_id, reference_price, custom_price")
    .eq("company_id", companyId)
    .in("catalog_item_id", catalogItemIds);

  const prix: Record<string, number> = {};
  for (const r of data ?? []) {
    const v = r.custom_price ?? r.reference_price;
    if (v != null) prix[String(r.catalog_item_id)] = Number(v);
  }
  return prix;
}
