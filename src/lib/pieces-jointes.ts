/**
 * Règles des pièces jointes, partagées entre le navigateur et le serveur.
 *
 * Module pur : aucun accès réseau, aucun DOM. Le navigateur s'en sert pour
 * refuser tôt et dire pourquoi ; le serveur s'en sert parce qu'un refus côté
 * navigateur se contourne.
 */

export const TAILLE_MAX_OCTETS = 15 * 1024 * 1024;

/**
 * Plafond appliqué à une PHOTO avant compression.
 *
 * Une photo d'iPhone sort à 2 ou 3 Mo, et une compressée à 200 Ko : la refuser
 * sur son poids d'origine reviendrait à refuser une photo que le téléphone
 * allait réduire de 97 %. Le plafond de 15 Mo s'applique donc au fichier
 * RÉELLEMENT téléversé, après compression.
 *
 * Mais on ne dessine pas n'importe quoi dans un canvas : un fichier de 80 Mo
 * ferait tomber l'onglet sur un vieux téléphone. Cinquante mégaoctets laissent
 * passer toutes les photos d'appareil, et arrêtent le reste avant le canvas.
 */
export const TAILLE_MAX_AVANT_COMPRESSION = 50 * 1024 * 1024;
export const MAX_PAR_CALL = 20;
export const COTE_LONG_PHOTO = 1600;

/**
 * Types acceptés.
 *
 * HEIC et HEIF sont indispensables : c'est le format par défaut de tous les
 * iPhone. La compression les convertit normalement en WebP, mais si le
 * navigateur refuse de les décoder — Chrome ne sait pas — le fichier doit
 * quand même pouvoir entrer. Mieux vaut un HEIC de 2 Mo stocké qu'une photo
 * perdue sur un chantier.
 *
 * SVG est EXCLU volontairement : c'est du XML qui peut contenir du
 * JavaScript, et un SVG piégé exécute du code sur notre domaine. Les archives
 * aussi, parce qu'on ne sait pas ce qu'elles contiennent.
 */
export const TYPES_ACCEPTES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const LIBELLES: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

export function estUneImage(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Poids lisible : « 4,2 Mo » et non « 4404019 octets ». */
export function poidsLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/**
 * Ce qui empêche d'accepter ce fichier, ou `null`.
 *
 * Le refus NOMME le fichier et donne le chiffre : « plan.pdf pèse 22,4 Mo »
 * se corrige, « fichier trop volumineux » oblige à deviner lequel.
 */
export function refusDePieceJointe(
  fichier: { name: string; type: string; size: number },
  dejaPresentes: number,
  /**
   * Vrai quand le fichier n'est pas encore passé par la compression. Une photo
   * bénéficie alors du plafond large : c'est son poids d'arrivée qui compte,
   * pas celui de départ. Un document, lui, ne se compresse pas — son plafond
   * est le même dans les deux cas.
   */
  avantCompression = false,
): string | null {
  if (dejaPresentes >= MAX_PAR_CALL) {
    return `Ce call a déjà ${MAX_PAR_CALL} pièces jointes, le maximum. Retirez-en une avant d'en ajouter.`;
  }

  if (!(TYPES_ACCEPTES as readonly string[]).includes(fichier.type)) {
    const vus = [...new Set(Object.values(LIBELLES))].join(", ");
    return `« ${fichier.name} » n'est pas d'un type accepté. Photos et documents seulement : ${vus}.`;
  }

  const plafond =
    avantCompression && estUneImage(fichier.type) ? TAILLE_MAX_AVANT_COMPRESSION : TAILLE_MAX_OCTETS;

  if (fichier.size > plafond) {
    return `« ${fichier.name} » pèse ${poidsLisible(fichier.size)}. Le maximum est de ${poidsLisible(plafond)}.`;
  }

  if (fichier.size === 0) {
    return `« ${fichier.name} » est vide.`;
  }

  return null;
}

/** Extension à donner au fichier stocké, d'après son type. */
export function extensionPour(mime: string): string {
  const table: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return table[mime] ?? "bin";
}

/**
 * Message expliquant qu'un employé ne peut pas retirer une pièce.
 *
 * La RLS ne refuse pas bruyamment : sans politique de suppression, elle ne
 * touche simplement AUCUNE rangée. Sans ce message, l'employé cliquerait et
 * croirait à un bogue.
 */
/**
 * Message quand la même photo est déposée deux fois sur le même call.
 *
 * Il PRÉVIENT, il ne gronde pas : taper deux fois sur « Prendre une photo »
 * avec des gants mouillés n'est pas une faute. Et il dit ce qui a été gardé,
 * pour qu'on ne cherche pas ce qui manque.
 */
export function messageDoublon(nomFichier: string): string {
  return `« ${nomFichier} » est déjà sur ce call. La première est conservée, rien n'a été perdu.`;
}

export const REFUS_SUPPRESSION_EMPLOYE =
  "Seul votre employeur peut retirer une pièce jointe. C'est ce qui rend les photos valables comme preuve du travail accompli.";
