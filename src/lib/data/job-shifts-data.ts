import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { JobShift } from "@/lib/job-shifts";

function mapShiftRow(row: Record<string, unknown>): JobShift {
  return {
    id: String(row.id),
    scheduledJobId: String(row.scheduled_job_id),
    employeeId: String(row.employee_id),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
  };
}

/**
 * Plages d'un lot de calls, en une seule requête.
 *
 * Le calendrier affiche des dizaines de blocs : une requête par call
 * multiplierait les allers-retours pour une table minuscule.
 */
export async function getShiftsForJobs(jobIds: string[]): Promise<JobShift[]> {
  if (!isSupabaseConfigured() || jobIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_employee_shifts")
    .select("id, scheduled_job_id, employee_id, start_at, end_at")
    .in("scheduled_job_id", jobIds);

  if (error) {
    // La table peut ne pas exister encore : on retombe sur les plages du call,
    // ce qui est exactement le comportement d'avant.
    console.error("[getShiftsForJobs]", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapShiftRow(r as Record<string, unknown>));
}

/** Toutes les plages d'une entreprise, pour les cumuls de /heures. */
export async function getShiftsForCompany(companyId: string): Promise<JobShift[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_employee_shifts")
    .select("id, scheduled_job_id, employee_id, start_at, end_at")
    .eq("company_id", companyId);

  if (error) {
    console.error("[getShiftsForCompany]", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapShiftRow(r as Record<string, unknown>));
}

/**
 * Décale toutes les plages d'un call, quand celui-ci est déplacé.
 *
 * Effacer au moindre déplacement serait punitif : on retracerait tout pour un
 * call repoussé d'une heure. En décalant, un gars à 8 h et un autre à 13 h
 * restent à cinq heures d'écart, ce qui était l'intention.
 *
 * Un échec ici ne fait pas échouer le déplacement du call : les plages
 * retomberaient simplement hors des heures du chantier, ce qu'on journalise.
 */
export async function decalerPlagesDuCall(
  companyId: string,
  jobId: string,
  decalageMs: number,
): Promise<void> {
  if (!isSupabaseConfigured() || decalageMs === 0) return;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("job_employee_shifts")
    .select("id, start_at, end_at")
    .eq("company_id", companyId)
    .eq("scheduled_job_id", jobId);

  if (error || !data?.length) return;

  for (const ligne of data) {
    const debut = new Date(Date.parse(String(ligne.start_at)) + decalageMs).toISOString();
    const fin = new Date(Date.parse(String(ligne.end_at)) + decalageMs).toISOString();
    const { error: majError } = await admin
      .from("job_employee_shifts")
      .update({ start_at: debut, end_at: fin })
      .eq("id", ligne.id);
    if (majError) console.error("[decalerPlagesDuCall]", majError.message);
  }
}
