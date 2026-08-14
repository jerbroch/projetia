"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminUser } from "@/lib/platform/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/data/platform-data";

export type PlatformActionResult = { success: true } | { success: false; error: string };

function ok(): PlatformActionResult {
  return { success: true };
}

function err(message: string): PlatformActionResult {
  return { success: false, error: message };
}

export async function markAlertReadAction(alertId: string): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();
  const { error } = await db
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) return err(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/alerts");
  return ok();
}

export async function markAllAlertsReadAction(): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();
  const { error } = await db
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return err(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/alerts");
  return ok();
}

export async function createImprovementAction(formData: FormData): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = Number(formData.get("priority") ?? 0);

  if (!title) return err("Le titre est requis.");

  const db = createAdminClient();
  const { error } = await db.from("platform_improvements").insert({
    title,
    description: description || null,
    priority: Number.isFinite(priority) ? priority : 0,
    status: "to_analyze",
  });

  if (error) return err(error.message);
  revalidatePath("/admin/improvements");
  revalidatePath("/admin/roadmap");
  return ok();
}

export async function updateImprovementStatusAction(
  improvementId: string,
  status: string,
): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();
  const { error } = await db
    .from("platform_improvements")
    .update({ status })
    .eq("id", improvementId);
  if (error) return err(error.message);
  revalidatePath("/admin/improvements");
  revalidatePath("/admin/roadmap");
  return ok();
}

export async function linkFeedbackToImprovementAction(
  improvementId: string,
  feedbackId: string,
): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();

  const { error: linkError } = await db.from("improvement_feedback_links").upsert({
    improvement_id: improvementId,
    feedback_id: feedbackId,
  });

  if (linkError) return err(linkError.message);

  await db.from("platform_feedback").update({ status: "linked" }).eq("id", feedbackId);
  revalidatePath("/admin/improvements");
  revalidatePath("/admin/feedback");
  return ok();
}

export async function treatFeedbackAction(feedbackId: string): Promise<PlatformActionResult> {
  await requireSuperAdminUser();
  const db = createAdminClient();

  const { data: feedback } = await db
    .from("platform_feedback")
    .select("company_id, title")
    .eq("id", feedbackId)
    .maybeSingle();

  const { error } = await db
    .from("platform_feedback")
    .update({ status: "treated", treated_at: new Date().toISOString() })
    .eq("id", feedbackId);

  if (error) return err(error.message);

  if (feedback) {
    await logAdminActivity(
      "feedback_treated",
      `Commentaire traité : ${feedback.title}`,
      String(feedback.company_id),
      { feedbackId },
    );
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/admin");
  return ok();
}

export async function submitFeedbackAction(formData: FormData): Promise<PlatformActionResult> {
  const { requireTenantContext } = await import("@/lib/session");
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return err("Non disponible en mode démo.");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title || !description) return err("Titre et description requis.");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("platform_feedback").insert({
    company_id: ctx.company.id,
    user_id: ctx.user.id,
    title,
    description,
  });

  if (error) return err(error.message);
  revalidatePath("/settings");
  return ok();
}
