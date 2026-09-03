import { createAdminClient } from "@/lib/supabase/admin";
import { estUneImage } from "@/lib/pieces-jointes";
import { fabriquerVignettes, type PhotoSource, type VignetteCourriel } from "@/lib/email/vignettes-chantier";
import type { PieceLiee } from "@/lib/email/expediteur";

const COMPARTIMENT = "pieces-jointes";

/**
 * Durée de vie des liens « voir en grand ».
 *
 * Trente jours, soit l'échéance d'une facture : le client doit pouvoir rouvrir
 * son courriel et cliquer une photo pendant tout le temps où il peut encore
 * payer. Au-delà, le lien expire — le compartiment est privé, et une photo de
 * chantier montre l'intérieur de la maison de quelqu'un.
 */
const DUREE_LIEN_SECONDES = 30 * 24 * 60 * 60;

export interface PhotosDeFacture {
  /** Ce que le gabarit insère dans le HTML. */
  pourLeGabarit: Array<{ contentId: string; alt: string; urlPleineTaille: string | null }>;
  /** Ce que Resend attache au courriel. */
  pieces: PieceLiee[];
  poidsTotal: number;
}

const VIDE: PhotosDeFacture = { pourLeGabarit: [], pieces: [], poidsTotal: 0 };

function versPieces(vignettes: VignetteCourriel[]): PhotosDeFacture {
  return {
    pourLeGabarit: vignettes.map((v) => ({
      contentId: v.contentId,
      alt: v.alt,
      urlPleineTaille: v.urlPleineTaille,
    })),
    pieces: vignettes.map((v) => ({
      filename: v.filename,
      content: v.contenuBase64,
      content_id: v.contentId,
      content_type: "image/jpeg",
    })),
    poidsTotal: vignettes.reduce((somme, v) => somme + v.octets, 0),
  };
}

/**
 * Rassemble les photos d'un call et les prépare pour le courriel de facture.
 *
 * UNE PHOTO QUI NE SE TÉLÉCHARGE PAS N'EMPÊCHE PAS LA FACTURE DE PARTIR. Tout
 * échec ici rend une liste vide ou plus courte : le client reçoit sa facture
 * sans photos plutôt que de ne rien recevoir du tout. Une facture qui ne part
 * pas coûte infiniment plus cher qu'une facture sans images.
 */
export async function photosDuCallPourFacture(
  companyId: string,
  scheduledJobId: string | null | undefined,
): Promise<PhotosDeFacture> {
  if (!scheduledJobId) return VIDE;

  const admin = createAdminClient();
  if (!admin) return VIDE;

  try {
    const { data: rangees } = await admin
      .from("job_attachments")
      .select("id, file_name, mime_type, storage_path, taken_at")
      .eq("company_id", companyId)
      .eq("scheduled_job_id", scheduledJobId)
      .order("created_at", { ascending: true });

    const photos: PhotoSource[] = [];
    for (const r of rangees ?? []) {
      const mimeType = String(r.mime_type);
      if (!estUneImage(mimeType)) continue;

      const chemin = String(r.storage_path);
      const { data: blob, error } = await admin.storage.from(COMPARTIMENT).download(chemin);
      if (error || !blob) continue;

      const { data: signe } = await admin.storage
        .from(COMPARTIMENT)
        .createSignedUrl(chemin, DUREE_LIEN_SECONDES);

      photos.push({
        id: String(r.id),
        fileName: String(r.file_name),
        mimeType,
        donnees: Buffer.from(await blob.arrayBuffer()),
        priseLe: r.taken_at ? String(r.taken_at) : null,
        urlPleineTaille: signe?.signedUrl ?? null,
      });
    }

    if (!photos.length) return VIDE;
    return versPieces(await fabriquerVignettes(photos));
  } catch {
    return VIDE;
  }
}
