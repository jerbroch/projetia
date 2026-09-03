export interface InvoiceEmailLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceEmailTemplateInput {
  companyName: string;
  companyLogoUrl?: string | null;
  primaryColor?: string | null;
  customerName?: string | null;
  invoiceNumber: string;
  jobNumber?: string | null;
  clientPoNumber?: string | null;
  workDescription?: string | null;
  lineItems: InvoiceEmailLineItem[];
  materialSubtotal?: number;
  laborSubtotal?: number;
  gstAmount?: number;
  qstAmount?: number;
  total: number;
  /** Deposit already received (from linked quote). */
  depositApplied?: number;
  /** Remaining balance after deposit and payments. */
  balanceDue?: number;
  quoteNumber?: string | null;
  dueDate?: string | null;
  customMessage?: string | null;
  interacBlock?: string | null;
  /**
   * Vignettes des photos du chantier, liées par `content_id`. Voir
   * `vignettes-chantier.ts` pour la raison du CID plutôt que du lien.
   */
  photos?: Array<{ contentId: string; alt: string; urlPleineTaille: string | null }>;
}

const PLATFORM_NAME = "Construction iOS";
const DEFAULT_ACCENT = "#2563eb";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);
}

function isValidHexColor(color: string | null | undefined): color is string {
  return Boolean(color && /^#[0-9A-Fa-f]{6}$/.test(color));
}

function companyBrandingZone(companyName: string, logoUrl?: string | null): string {
  const safeName = escapeHtml(companyName);
  const initials = escapeHtml(companyName.slice(0, 2).toUpperCase());

  const logoContent = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo ${safeName}" width="200" style="display:block;margin:0 auto;max-width:240px;width:200px;height:auto;max-height:120px;object-fit:contain;" />`
    : `<div style="width:120px;height:120px;margin:0 auto;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:center;line-height:120px;font-size:28px;font-weight:700;color:#6b7280;">${initials}</div>`;

  return `
    <tr>
      <td align="center" style="padding:32px 24px 24px 24px;background-color:#fafafa;border-bottom:1px solid #e5e7eb;">
        ${logoContent}
        <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#111827;">${safeName}</p>
      </td>
    </tr>
  `.trim();
}

function lineItemsTable(items: InvoiceEmailLineItem[]): string {
  if (items.length === 0) return "";

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">${escapeHtml(item.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;text-align:right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;text-align:right;font-weight:600;">${formatMoney(item.lineTotal)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <th align="left" style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-transform:uppercase;">Description</th>
        <th style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-transform:uppercase;">Qté</th>
        <th align="right" style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-transform:uppercase;">Prix</th>
        <th align="right" style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-transform:uppercase;">Total</th>
      </tr>
      ${rows}
    </table>
  `.trim();
}

/**
 * « COMMENT PAYER » — des étapes, pas une liste de champs.
 *
 * Le bloc énumérait destinataire, courriel, question et réponse. Il ne disait
 * NULLE PART quoi écrire dans le message du virement. Sans référence, dix
 * virements reçus le même jour sont dix devinettes : l'entrepreneur passe
 * l'après-midi à rapprocher des montants.
 *
 * Le numéro de facture est donc la pièce maîtresse, mis en évidence et prêt à
 * recopier. Il s'affiche MÊME SANS INTERAC : quel que soit le mode de paiement,
 * c'est lui qui permet le rapprochement.
 */
export function buildInteracEmailBlock(input: {
  email?: string | null;
  recipientName?: string | null;
  securityQuestion?: string | null;
  securityAnswer?: string | null;
  instructions?: string | null;
  /** Le numéro que le client doit inscrire au message du virement. */
  invoiceNumber?: string | null;
}): string | null {
  const numero = input.invoiceNumber ? escapeHtml(input.invoiceNumber) : null;
  if (!input.email && !numero) return null;

  const titre = `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#111827;">Comment payer</p>`;

  const etapes: string[] = [];

  if (input.email) {
    etapes.push(
      etape(
        1,
        "Ouvrez un virement Interac depuis votre institution bancaire.",
        null,
      ),
      etape(
        2,
        `Envoyez-le à <strong>${escapeHtml(input.email)}</strong>` +
          (input.recipientName ? ` (${escapeHtml(input.recipientName)})` : ""),
        input.securityQuestion
          ? `Question de sécurité : <strong>${escapeHtml(input.securityQuestion)}</strong>` +
              (input.securityAnswer ? `<br />Réponse : <strong>${escapeHtml(input.securityAnswer)}</strong>` : "")
          : null,
      ),
    );
  }

  if (numero) {
    // La ligne la plus importante du courriel, du point de vue de
    // l'entrepreneur : sans elle, il ne sait pas de qui vient l'argent.
    etapes.push(
      etape(
        etapes.length + 1,
        "Dans le <strong>message</strong> du virement, écrivez&nbsp;:",
        null,
        `<div style="margin:8px 0 0 0;padding:10px 14px;background:#ffffff;border:2px dashed #2563eb;border-radius:6px;text-align:center;">
           <span style="font-family:'Courier New',Courier,monospace;font-size:20px;font-weight:700;letter-spacing:1px;color:#1d4ed8;">${numero}</span>
         </div>
         <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">C'est ce qui nous permet d'associer votre paiement à cette facture.</p>`,
      ),
    );
  }

  const instructions = input.instructions
    ? `<p style="margin:12px 0 0 0;padding-top:12px;border-top:1px solid #bfdbfe;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(input.instructions)}</p>`
    : "";

  return `<div style="margin-top:20px;padding:16px;background-color:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">${titre}${etapes.join("")}${instructions}</div>`;
}

/** Une étape numérotée. En tableau : les puces CSS ne survivent pas à Outlook. */
function etape(rang: number, texte: string, precision: string | null, extra?: string): string {
  const detail = precision
    ? `<p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4b5563;">${precision}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px 0;">
    <tr>
      <td width="26" valign="top" style="padding-top:1px;">
        <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:#2563eb;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;text-align:center;">${rang}</div>
      </td>
      <td valign="top" style="padding-left:8px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">${texte}</p>
        ${detail}
        ${extra ?? ""}
      </td>
    </tr>
  </table>`;
}

export function buildInvoiceEmailSubject(
  input: Pick<InvoiceEmailTemplateInput, "invoiceNumber" | "companyName">
): string {
  return `Facture ${input.invoiceNumber} — ${input.companyName}`;
}

export function buildInvoiceEmailHtml(input: InvoiceEmailTemplateInput): string {
  const accent = isValidHexColor(input.primaryColor) ? input.primaryColor : DEFAULT_ACCENT;
  const safeNumber = escapeHtml(input.invoiceNumber);
  const safeCustomer = input.customerName ? escapeHtml(input.customerName) : "Client";
  const workDesc = input.workDescription
    ? `<div style="margin:16px 0;"><p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;">Travaux effectués</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(input.workDescription)}</p></div>`
    : "";

  const metaRows = [
    input.quoteNumber
      ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Soumission</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:14px;">${escapeHtml(input.quoteNumber)}</td></tr>`
      : "",
    input.jobNumber
      ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">No. travail</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:14px;">${escapeHtml(input.jobNumber)}</td></tr>`
      : "",
    input.clientPoNumber
      ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">P.O. client</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:14px;">${escapeHtml(input.clientPoNumber)}</td></tr>`
      : "",
    input.dueDate
      ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Échéance</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:14px;">${escapeHtml(input.dueDate)}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const depositApplied = input.depositApplied ?? 0;
  const balanceDue = input.balanceDue ?? input.total - depositApplied;

  const totalsBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
      ${input.laborSubtotal != null ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Main-d'œuvre</td><td style="padding:4px 0;text-align:right;font-size:14px;">${formatMoney(input.laborSubtotal)}</td></tr>` : ""}
      ${input.materialSubtotal != null ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Matériel</td><td style="padding:4px 0;text-align:right;font-size:14px;">${formatMoney(input.materialSubtotal)}</td></tr>` : ""}
      ${input.gstAmount != null ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">TPS</td><td style="padding:4px 0;text-align:right;font-size:14px;">${formatMoney(input.gstAmount)}</td></tr>` : ""}
      ${input.qstAmount != null ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">TVQ</td><td style="padding:4px 0;text-align:right;font-size:14px;">${formatMoney(input.qstAmount)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;font-size:16px;font-weight:700;">Total des travaux</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;">${formatMoney(input.total)}</td></tr>
      ${depositApplied > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Dépôt déjà payé</td><td style="padding:4px 0;text-align:right;font-size:14px;color:#059669;">−${formatMoney(depositApplied)}</td></tr>` : ""}
      ${depositApplied > 0 || balanceDue < input.total ? `<tr><td style="padding:8px 0;font-size:16px;font-weight:700;">Solde à payer</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;color:${accent};">${formatMoney(balanceDue)}</td></tr>` : `<tr><td style="padding:8px 0;font-size:16px;font-weight:700;">Total</td><td style="padding:8px 0;text-align:right;font-size:16px;font-weight:700;color:${accent};">${formatMoney(input.total)}</td></tr>`}
    </table>
  `;

  const messageBlock = input.customMessage
    ? `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(input.customMessage)}</p>`
    : `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">Veuillez trouver ci-joint votre facture <strong>${safeNumber}</strong>. Merci de votre confiance.</p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Facture ${safeNumber}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        ${companyBrandingZone(input.companyName, input.companyLogoUrl)}
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#111827;">Facture ${safeNumber}</h1>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">${safeCustomer}</p>
          ${messageBlock}
          <table role="presentation" width="100%">${metaRows}</table>
          ${workDesc}
          ${lineItemsTable(input.lineItems)}
          ${totalsBlock}
          ${photosEmailBlock(input.photos ?? [])}
          ${input.interacBlock ?? ""}
        </td></tr>
        <tr><td align="center" style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0;font-size:11px;color:#d1d5db;">Propulsé par ${PLATFORM_NAME}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

/**
 * La grille de photos, en tableau et non en flex : les logiciels de messagerie
 * ne connaissent pas la mise en page moderne. Deux colonnes, ce qui donne des
 * vignettes lisibles sur téléphone comme sur écran.
 *
 * Chaque vignette est un lien vers la pleine taille, et porte un texte de
 * remplacement qui la décrit. Une ligne d'introduction annonce le nombre de
 * photos : elle reste lisible même quand aucune image ne s'affiche.
 */
export function photosEmailBlock(
  photos: Array<{ contentId: string; alt: string; urlPleineTaille: string | null }>,
): string {
  if (!photos.length) return "";

  const cellules = photos.map((p) => {
    const img = `<img src="cid:${escapeHtml(p.contentId)}" alt="${escapeHtml(p.alt)}" width="252" style="display:block;width:100%;max-width:252px;height:auto;border:0;border-radius:6px;" />`;
    const contenu = p.urlPleineTaille
      ? `<a href="${escapeHtml(p.urlPleineTaille)}" style="text-decoration:none;">${img}</a>`
      : img;
    return `<td width="50%" style="padding:4px;vertical-align:top;">${contenu}</td>`;
  });

  const rangees: string[] = [];
  for (let i = 0; i < cellules.length; i += 2) {
    const paire = cellules.slice(i, i + 2);
    if (paire.length === 1) paire.push('<td width="50%" style="padding:4px;"></td>');
    rangees.push(`<tr>${paire.join("")}</tr>`);
  }

  const compte = photos.length === 1 ? "1 photo du chantier" : `${photos.length} photos du chantier`;

  return `
  <div style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
    <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#111827;">Le travail accompli</p>
    <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">${compte} — cliquez une photo pour la voir en grand.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rangees.join("")}</table>
  </div>`;
}

/** Client-facing line items — sell price only, no cost/margin */
export function toClientInvoiceLineItems(
  lineItems: Array<{
    description: string;
    quantity: number;
    unitSellPrice: number;
    lineTotal: number;
  }>
): InvoiceEmailLineItem[] {
  return lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitSellPrice,
    lineTotal: item.lineTotal,
  }));
}

export interface ReceiptEmailTemplateInput {
  companyName: string;
  companyLogoUrl?: string | null;
  primaryColor?: string | null;
  customerName?: string | null;
  invoiceNumber: string;
  /** Montant de CE paiement, pas le cumul. */
  amountReceived: number;
  /** Libellé du mode — « Virement Interac », « Chèque »… */
  methodLabel: string;
  /** Date de réception, déjà formatée pour un lecteur québécois. */
  receivedOn: string;
  /** Référence saisie par l'entrepreneur : n° de chèque, confirmation. */
  reference?: string | null;
  /** Reste à payer après ce paiement — 0 quand la facture est soldée. */
  remainingBalance: number;
  /** Coordonnées Interac, rappelées seulement s'il reste un solde. */
  interacBlock?: string | null;
}

export function buildReceiptEmailSubject(
  input: Pick<ReceiptEmailTemplateInput, "invoiceNumber" | "companyName" | "remainingBalance">,
): string {
  const etat = input.remainingBalance > 0 ? "Paiement reçu" : "Facture payée";
  return `${etat} — facture ${input.invoiceNumber} — ${input.companyName}`;
}

/**
 * Reçu envoyé au client dès qu'un paiement est enregistré.
 *
 * Il confirme ce qui a été reçu et dit surtout ce qui reste dû : sans cette
 * seconde information, un paiement partiel laisse le client croire qu'il a
 * soldé sa facture.
 */
export function buildReceiptEmailHtml(input: ReceiptEmailTemplateInput): string {
  const accent = isValidHexColor(input.primaryColor) ? input.primaryColor : DEFAULT_ACCENT;
  const safeNumber = escapeHtml(input.invoiceNumber);
  const safeCustomer = input.customerName ? escapeHtml(input.customerName) : "Client";
  const soldee = input.remainingBalance <= 0;

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">${label}</td>` +
    `<td style="padding:6px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">${value}</td></tr>`;

  const details = [
    detailRow("Montant reçu", `<strong>${formatMoney(input.amountReceived)}</strong>`),
    detailRow("Mode de paiement", escapeHtml(input.methodLabel)),
    detailRow("Reçu le", escapeHtml(input.receivedOn)),
    input.reference ? detailRow("Référence", escapeHtml(input.reference)) : "",
  ].join("");

  const soldeBlock = soldee
    ? `<div style="margin:20px 0;padding:16px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;">
         <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#065f46;">Facture payée en totalité</p>
         <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#047857;">Merci de votre confiance.</p>
       </div>`
    : `<div style="margin:20px 0;padding:16px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;">
         <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#92400e;">Solde restant à payer</p>
         <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${accent};">${formatMoney(input.remainingBalance)}</p>
       </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Reçu — facture ${safeNumber}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        ${companyBrandingZone(input.companyName, input.companyLogoUrl)}
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#111827;">${soldee ? "Paiement reçu — merci" : "Paiement reçu"}</h1>
          <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">${safeCustomer} — facture ${safeNumber}</p>
          <table role="presentation" width="100%">${details}</table>
          ${soldeBlock}
          ${soldee ? "" : (input.interacBlock ?? "")}
        </td></tr>
        <tr><td align="center" style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#fafafa;">
          <p style="margin:0;font-size:11px;color:#d1d5db;">Propulsé par ${PLATFORM_NAME}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}
