"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { updateCompanySettings } from "@/lib/data/tenant-data";
import { requireTenantContext } from "@/lib/session";
import {
  COMPANY_LOGOS_BUCKET,
  getCompanyLogoPublicUrl,
  getCompanyLogoStoragePath,
  validateCompanyLogoFile,
} from "@/lib/storage/company-logo";

export type UploadCompanyLogoResult =
  | { success: true; logoUrl: string }
  | { success: false; error: string };

export async function uploadCompanyLogoAction(formData: FormData): Promise<UploadCompanyLogoResult> {
  const ctx = await requireTenantContext();
  if (ctx.isDemo) {
    return { success: false, error: "Les paramètres du compte démo ne peuvent pas être modifiés." };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase n'est pas configuré." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "Clé service Supabase manquante (SUPABASE_SERVICE_ROLE_KEY)." };
  }
  if (ctx.membershipRole !== "owner" && ctx.membershipRole !== "admin") {
    return { success: false, error: "Accès refusé." };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Veuillez sélectionner un fichier image." };
  }

  const validationError = validateCompanyLogoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const admin = createAdminClient();
  const storagePath = getCompanyLogoStoragePath(ctx.company.id, file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(COMPANY_LOGOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("[uploadCompanyLogoAction]", uploadError);
    return {
      success: false,
      error: `Impossible de téléverser le logo. (${uploadError.message})`,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return { success: false, error: "Configuration Supabase manquante." };
  }

  const logoUrl = getCompanyLogoPublicUrl(supabaseUrl, storagePath);
  const { error: updateError } = await updateCompanySettings(ctx.company.id, {
    logo_url: logoUrl,
  });

  if (updateError) {
    console.error("[uploadCompanyLogoAction] update", updateError.message);
    return { success: false, error: "Logo téléversé, mais impossible de mettre à jour le profil." };
  }

  revalidatePath("/settings");
  return { success: true, logoUrl };
}
