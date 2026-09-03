"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  extensionPour,
  messageDoublon,
  refusDePieceJointe,
  REFUS_SUPPRESSION_EMPLOYE,
} from "@/lib/pieces-jointes";
import { requireTenantContext } from "@/lib/session";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isFieldWorkerRole } from "@/lib/field-permissions";
import { createHash } from "node:crypto";

const COMPARTIMENT = "pieces-jointes";
/** Assez pour qu'un client revienne voir sa facture, pas un lien permanent. */
const DUREE_LIEN_SECONDES = 60 * 60 * 24 * 90;

export interface PieceJointe {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  takenAt: string | null;
  createdAt: string;
  uploadedByName: string | null;
  /** URL signée, valable 90 jours. */
  url: string | null;
}

/**
 * Pièces d'un call ou d'une facture.
 *
 * Une facture générée depuis un call hérite des pièces de ce call PAR
 * RÉFÉRENCE : on cherche sur les deux liens à la fois, plutôt que de recopier
 * les rangées. Dupliquer les ferait diverger dès la première suppression.
 */
export async function listerPiecesJointesAction(input: {
  scheduledJobId?: string;
  invoiceId?: string;
}): Promise<{ success: boolean; pieces: PieceJointe[]; peutRetirer: boolean; error?: string }> {
  const ctx = await requireTenantContext();
  if (!isSupabaseConfigured()) return { success: true, pieces: [], peutRetirer: false };

  const admin = createAdminClient();
  if (!admin) return { success: false, pieces: [], peutRetirer: false, error: "Supabase n'est pas configuré." };

  let requete = admin
    .from("job_attachments")
    .select("*, employees:uploaded_by_employee_id(first_name,last_name)")
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: true });

  if (input.scheduledJobId && input.invoiceId) {
    requete = requete.or(
      `scheduled_job_id.eq.${input.scheduledJobId},invoice_id.eq.${input.invoiceId}`,
    );
  } else if (input.scheduledJobId) {
    requete = requete.eq("scheduled_job_id", input.scheduledJobId);
  } else if (input.invoiceId) {
    requete = requete.eq("invoice_id", input.invoiceId);
  } else {
    return { success: true, pieces: [], peutRetirer: false };
  }

  const { data, error } = await requete;
  if (error) {
    console.error("[listerPiecesJointesAction]", error.message);
    return { success: false, pieces: [], peutRetirer: false, error: "Impossible de charger les pièces jointes." };
  }

  const terrain = isFieldWorkerRole(ctx.membershipRole);

  // Un employé de terrain ne voit que les pièces des calls où il est assigné.
  // La RLS le garantit déjà pour sa propre clé, mais cette action passe par la
  // clé de service : le filtre doit donc être posé ICI aussi.
  const visibles = terrain
    ? (data ?? []).filter((r) => r.scheduled_job_id === input.scheduledJobId)
    : (data ?? []);

  const pieces = await Promise.all(
    visibles.map(async (r) => {
      const { data: signe } = await admin.storage
        .from(COMPARTIMENT)
        .createSignedUrl(String(r.storage_path), DUREE_LIEN_SECONDES);
      const emp = r.employees as { first_name?: string; last_name?: string } | null;
      return {
        id: String(r.id),
        fileName: String(r.file_name),
        mimeType: String(r.mime_type),
        sizeBytes: Number(r.size_bytes ?? 0),
        takenAt: r.taken_at ? String(r.taken_at) : null,
        createdAt: String(r.created_at),
        uploadedByName: emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || null : null,
        url: signe?.signedUrl ?? null,
      };
    }),
  );

  return { success: true, pieces, peutRetirer: !terrain };
}

export async function televerserPieceJointeAction(
  formData: FormData,
  // `doublon` distingue « déjà là » d'un vrai échec : l'écran doit passer au
  // fichier suivant au lieu d'interrompre tout le lot.
): Promise<{ success: boolean; error?: string; doublon?: boolean }> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase n'est pas configuré." };

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Supabase n'est pas configuré." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) return { success: false, error: "Aucun fichier reçu." };

  const scheduledJobId = String(formData.get("scheduledJobId") ?? "").trim() || null;
  const invoiceId = String(formData.get("invoiceId") ?? "").trim() || null;
  if (!scheduledJobId && !invoiceId) {
    return { success: false, error: "Une pièce jointe doit être rattachée à un call ou à une facture." };
  }

  // Un employé ne dépose que sur un call où il est assigné. On le vérifie ici
  // parce que cette action passe par la clé de service, qui contourne la RLS.
  const terrain = isFieldWorkerRole(ctx.membershipRole);
  if (terrain) {
    if (!scheduledJobId) return { success: false, error: "Accès refusé." };
    const { data: job } = await admin
      .from("scheduled_jobs")
      .select("employee_ids")
      .eq("id", scheduledJobId)
      .eq("company_id", ctx.company.id)
      .maybeSingle();
    const assigne = (job?.employee_ids as string[] | null)?.includes(ctx.employeeId ?? "");
    if (!assigne) return { success: false, error: "Vous n'êtes pas assigné à ce call." };
  }

  const { count } = await admin
    .from("job_attachments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.company.id)
    .eq("scheduled_job_id", scheduledJobId);

  const refus = refusDePieceJointe(
    { name: fichier.name, type: fichier.type, size: fichier.size },
    count ?? 0,
  );
  if (refus) return { success: false, error: refus };

  const octets = Buffer.from(await fichier.arrayBuffer());

  // L'EMPREINTE SE CALCULE ICI, sur les octets réellement reçus. La calculer
  // dans le navigateur reviendrait à croire ce que le client raconte, et deux
  // téléversements simultanés se croiseraient sans se voir.
  const empreinte = createHash("sha256").update(octets).digest("hex");

  if (scheduledJobId) {
    const { data: dejaLa } = await admin
      .from("job_attachments")
      .select("id")
      .eq("company_id", ctx.company.id)
      .eq("scheduled_job_id", scheduledJobId)
      .eq("content_hash", empreinte)
      .maybeSingle();
    if (dejaLa) return { success: false, error: messageDoublon(fichier.name), doublon: true };
  }

  const chemin = `${ctx.company.id}/${scheduledJobId ?? invoiceId}/${randomUUID()}.${extensionPour(fichier.type)}`;
  const { error: erreurEnvoi } = await admin.storage
    .from(COMPARTIMENT)
    .upload(chemin, octets, {
      contentType: fichier.type,
      upsert: false,
    });

  if (erreurEnvoi) {
    console.error("[televerserPieceJointeAction]", erreurEnvoi.message);
    return { success: false, error: "Le téléversement a échoué. Réessayez." };
  }

  const priseLe = String(formData.get("priseLe") ?? "").trim() || null;
  const { error } = await admin.from("job_attachments").insert({
    company_id: ctx.company.id,
    scheduled_job_id: scheduledJobId,
    invoice_id: invoiceId,
    storage_path: chemin,
    content_hash: empreinte,
    file_name: fichier.name,
    mime_type: fichier.type,
    size_bytes: fichier.size,
    uploaded_by_employee_id: ctx.employeeId ?? null,
    uploaded_by_user_id: ctx.user.id,
    taken_at: priseLe,
  });

  if (error) {
    // La rangée n'a pas été créée : le fichier serait orphelin dans le
    // compartiment. On le retire tout de suite.
    await admin.storage.from(COMPARTIMENT).remove([chemin]);
    console.error("[televerserPieceJointeAction] insert", error.message);
    return { success: false, error: error.message.includes("20 pièces")
      ? "Ce call a déjà 20 pièces jointes, le maximum."
      : "Impossible d'enregistrer la pièce jointe." };
  }

  revalidatePath("/schedule");
  revalidatePath("/terrain");
  revalidatePath("/invoices");
  return { success: true };
}

/**
 * Retrait d'une pièce jointe — RÉSERVÉ AU BUREAU.
 *
 * Une photo qu'un employé peut faire disparaître après coup ne prouve rien.
 * La base l'empêche déjà, mais elle le fait SILENCIEUSEMENT : sans politique de
 * suppression, la RLS ne touche aucune rangée et ne lève pas d'erreur. Le refus
 * est donc dit ici, avec sa raison.
 */
export async function retirerPieceJointeAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) return { success: false, error: "Indisponible en mode démo." };
  if (isFieldWorkerRole(ctx.membershipRole)) {
    return { success: false, error: REFUS_SUPPRESSION_EMPLOYE };
  }

  const admin = createAdminClient();
  if (!admin) return { success: false, error: "Supabase n'est pas configuré." };

  const { data: piece } = await admin
    .from("job_attachments")
    .select("storage_path")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();

  if (!piece) return { success: false, error: "Pièce jointe introuvable." };

  const { error } = await admin
    .from("job_attachments")
    .delete()
    .eq("id", id)
    .eq("company_id", ctx.company.id);

  if (error) return { success: false, error: "Impossible de retirer la pièce jointe." };

  // Le fichier part avec la rangée : le garder ferait grossir le compartiment
  // avec des objets que plus rien ne désigne.
  await admin.storage.from(COMPARTIMENT).remove([String(piece.storage_path)]);

  revalidatePath("/schedule");
  revalidatePath("/terrain");
  revalidatePath("/invoices");
  return { success: true };
}
