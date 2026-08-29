import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LigneHeures } from "@/lib/field-hours-summary";

/**
 * Toutes les heures terrain d'une entreprise, prêtes à cumuler.
 *
 * Les noms d'employé et les titres de chantier sont ramenés en une fois pour
 * éviter une requête par ligne. La lecture passe par le client de l'utilisateur
 * — donc par RLS : la politique `field_hours_office` limite déjà le bureau à sa
 * propre entreprise, et un employé de terrain ne verrait que ses heures.
 */
export async function getFieldHoursForCompany(companyId: string): Promise<LigneHeures[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("field_hours")
    .select("employee_id, scheduled_job_id, work_date, hours")
    .eq("company_id", companyId)
    .order("work_date", { ascending: false });

  if (error) {
    console.error("[getFieldHoursForCompany]", error.message);
    return [];
  }

  const lignes = data ?? [];
  if (lignes.length === 0) return [];

  const idsEmployes = [...new Set(lignes.map((l) => String(l.employee_id)))];
  const idsChantiers = [...new Set(lignes.map((l) => String(l.scheduled_job_id)))];

  const [{ data: employes }, { data: chantiers }] = await Promise.all([
    supabase.from("employees").select("id, first_name, last_name").in("id", idsEmployes),
    supabase.from("scheduled_jobs").select("id, title, customer_name").in("id", idsChantiers),
  ]);

  const nomEmploye = new Map(
    (employes ?? []).map((e) => [
      String(e.id),
      `${String(e.first_name ?? "")} ${String(e.last_name ?? "")}`.trim() || "Employé",
    ]),
  );
  const nomChantier = new Map(
    (chantiers ?? []).map((c) => {
      const titre = String(c.title ?? "").trim();
      const client = String(c.customer_name ?? "").trim();
      return [String(c.id), [titre, client].filter(Boolean).join(" — ") || "Chantier"];
    }),
  );

  return lignes.map((l) => ({
    employeeId: String(l.employee_id),
    employeeName: nomEmploye.get(String(l.employee_id)) ?? "Employé retiré",
    scheduledJobId: String(l.scheduled_job_id),
    jobLabel: nomChantier.get(String(l.scheduled_job_id)) ?? "Chantier supprimé",
    workDate: String(l.work_date),
    hours: Number(l.hours),
  }));
}
