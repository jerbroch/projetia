export interface QuoteEmailTemplateInput {
  companyName: string;
  companyLogoUrl?: string | null;
  primaryColor?: string | null;
  customerName?: string | null;
  quoteNumber: string;
  quoteTitle: string;
  publicUrl: string;
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

function isValidHexColor(color: string | null | undefined): color is string {
  return Boolean(color && /^#[0-9A-Fa-f]{6}$/.test(color));
}

function companyBrandingZone(companyName: string, logoUrl?: string | null): string {
  const safeName = escapeHtml(companyName);
  const initials = escapeHtml(companyName.slice(0, 2).toUpperCase());

  const logoContent = logoUrl
    ? `
      <img
        src="${escapeHtml(logoUrl)}"
        alt="Logo ${safeName}"
        width="200"
        style="display:block;margin:0 auto;max-width:240px;width:200px;height:auto;max-height:120px;object-fit:contain;"
      />
    `.trim()
    : `
      <div style="width:120px;height:120px;margin:0 auto;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:center;line-height:120px;font-size:28px;font-weight:700;color:#6b7280;">
        ${initials}
      </div>
    `.trim();

  return `
    <tr>
      <td align="center" style="padding:32px 24px 24px 24px;background-color:#fafafa;border-bottom:1px solid #e5e7eb;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              ${logoContent}
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">
                ${safeName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `.trim();
}

function platformFooter(): string {
  return `
    <tr>
      <td align="center" style="padding:16px 24px 24px 24px;border-top:1px solid #e5e7eb;background-color:#fafafa;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#d1d5db;">
          Propulsé par ${PLATFORM_NAME}
        </p>
      </td>
    </tr>
  `.trim();
}

export function buildQuoteEmailHtml(input: QuoteEmailTemplateInput): string {
  const accent = isValidHexColor(input.primaryColor) ? input.primaryColor : DEFAULT_ACCENT;
  const safeCompany = escapeHtml(input.companyName);
  const safeTitle = escapeHtml(input.quoteTitle);
  const safeNumber = escapeHtml(input.quoteNumber);
  const safeUrl = escapeHtml(input.publicUrl);
  const safeCustomer = input.customerName ? escapeHtml(input.customerName) : null;

  const detailsRows = [
    safeCustomer
      ? `<tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">Client</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;font-weight:600;text-align:right;">${safeCustomer}</td></tr>`
      : "",
    `<tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">Numéro</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;font-weight:600;text-align:right;">${safeNumber}</td></tr>`,
    `<tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7280;">Projet</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;font-weight:600;text-align:right;">${safeTitle}</td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Soumission ${safeNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          ${companyBrandingZone(input.companyName, input.companyLogoUrl)}
          <tr>
            <td style="padding:0 24px 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:24px;">
                    <h1 style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#111827;">
                      Nouvelle soumission disponible
                    </h1>
                    <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4b5563;">
                      <strong>${safeCompany}</strong> vous a envoyé une soumission. Consultez les détails et répondez en ligne — aucun compte requis.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
                      ${detailsRows}
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px auto;">
                      <tr>
                        <td align="center" bgcolor="${accent}" style="border-radius:8px;background-color:${accent};">
                          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            Voir la soumission
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">
                      Ce lien est sécurisé et personnel. Ne le partagez pas.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${platformFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildQuoteEmailSubject(input: Pick<QuoteEmailTemplateInput, "quoteNumber" | "companyName">): string {
  return `Soumission ${input.quoteNumber} — ${input.companyName}`;
}
