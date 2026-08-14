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

export function buildInteracEmailBlock(input: {
  email?: string | null;
  recipientName?: string | null;
  securityQuestion?: string | null;
  securityAnswer?: string | null;
  instructions?: string | null;
}): string | null {
  if (!input.email) return null;

  const parts = [
    `<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#111827;">Paiement par virement Interac</p>`,
    `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;"><strong>Destinataire :</strong> ${escapeHtml(input.recipientName ?? input.email)}</p>`,
    `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;"><strong>Courriel :</strong> ${escapeHtml(input.email)}</p>`,
  ];

  if (input.securityQuestion) {
    parts.push(
      `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;"><strong>Question de sécurité :</strong> ${escapeHtml(input.securityQuestion)}</p>`
    );
  }
  if (input.securityAnswer) {
    parts.push(
      `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;"><strong>Réponse :</strong> ${escapeHtml(input.securityAnswer)}</p>`
    );
  }
  if (input.instructions) {
    parts.push(
      `<p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(input.instructions)}</p>`
    );
  }

  return `<div style="margin-top:20px;padding:16px;background-color:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">${parts.join("")}</div>`;
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
