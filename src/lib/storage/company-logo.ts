const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const COMPANY_LOGOS_BUCKET = "company-logos";

export function validateCompanyLogoFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Format non supporté. Utilisez JPG, PNG, WebP ou GIF.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Le logo ne doit pas dépasser 2 Mo.";
  }
  return null;
}

export function getCompanyLogoStoragePath(companyId: string, mimeType: string): string {
  const ext = EXT_BY_MIME[mimeType] ?? "png";
  return `${companyId}/logo.${ext}`;
}

export function getCompanyLogoPublicUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${COMPANY_LOGOS_BUCKET}/${storagePath}`;
}
