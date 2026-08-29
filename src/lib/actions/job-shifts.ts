"use server";

import { revalidatePath } from "next/cache";
import { refusDePlage } from "@/lib/job-shifts";
import { requireTenantContext } from "@/lib/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export interface JobShiftResult {
  success: boolean;
  error?: string;
}

async function chargerCall(companyId: string, jobId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduled_jobs")
    .select("id, start_at, end_at, employee_ids")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

/**
 * Pose ou remplace la plage d'un employé sur un call.
 *
 * Une seule plage par personne et par call — c'est le rectangle qu'on trace —
 * d'où l'upsert sur la contrainte unique plutôt qu'un insert qui échouerait au
 * second tracé.
 */
export async function saveJobShiftAction(
  jobId: string,
  employeeId: string,
  startAt: string,
  endAt: string,
): Promise<JobShiftResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const call = await chargerCall(ctx.company.id, jobId);
  if (!call) return { success: false, error: "Call introuvable." };

  const assignes = (call.employee_ids ?? []) as string[];
  if (!assignes.includes(employeeId)) {
    // Tracer une plage pour quelqu'un qui n'est pas sur le call produirait une
    // ligne invisible partout : le calendrier ne dessine que les assignés.
    return { success: false, error: "Cet employé n'est pas assigné à ce call." };
  }

  const refus = refusDePlage(startAt, endAt, String(call.start_at), String(call.end_at));
  if (refus) return { success: false, error: refus };

  const admin = createAdminClient();
  const { error } = await admin.from("job_employee_shifts").upsert(
    {
      company_id: ctx.company.id,
      scheduled_job_id: jobId,
      employee_id: employeeId,
      start_at: startAt,
      end_at: endAt,
      created_by_user_id: ctx.user.id,
    },
    { onConflict: "scheduled_job_id,employee_id" },
  );

  if (error) {
    console.error("[saveJobShiftAction]", error.message);
    return { success: false, error: "Impossible d'enregistrer la plage." };
  }

  revalidatePath("/schedule");
  revalidatePath("/heures");
  revalidatePath("/terrain");
  return { success: true };
}

/**
 * Retire la plage d'un employé : il revient aux heures du call.
 *
 * C'est le seul moyen de revenir en arrière — une plage effacée ne laisse pas
 * un employé sans horaire, elle le remet sur celui du chantier.
 */
export async function deleteJobShiftAction(
  jobId: string,
  employeeId: string,
): Promise<JobShiftResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Non disponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("job_employee_shifts")
    .delete()
    .eq("company_id", ctx.company.id)
    .eq("scheduled_job_id", jobId)
    .eq("employee_id", employeeId);

  if (error) {
    console.error("[deleteJobShiftAction]", error.message);
    return { success: false, error: "Impossible de retirer la plage." };
  }

  revalidatePath("/schedule");
  revalidatePath("/heures");
  revalidatePath("/terrain");
  return { success: true };
}
