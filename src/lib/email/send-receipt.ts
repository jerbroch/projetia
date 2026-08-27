import {
  buildReceiptEmailHtml,
  buildReceiptEmailSubject,
  type ReceiptEmailTemplateInput,
} from "@/lib/email/invoice-email-template";

export interface SendReceiptEmailInput extends ReceiptEmailTemplateInput {
  to: string;
  subject?: string;
}

export interface SendReceiptEmailResult {
  sent: boolean;
  provider: "resend" | "console";
  error?: string;
}

/**
 * Envoie le reçu au client après l'enregistrement d'un paiement.
 *
 * Sans clé Resend, l'envoi est journalisé et considéré comme réussi : un
 * environnement de développement ne doit pas faire échouer l'enregistrement
 * d'un paiement. L'appelant traite de toute façon l'échec comme non bloquant —
 * le paiement est déjà en base quand on arrive ici.
 */
export async function sendReceiptEmail(
  input: SendReceiptEmailInput,
): Promise<SendReceiptEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "ConstructionIOS <onboarding@resend.dev>";

  const subject = input.subject ?? buildReceiptEmailSubject(input);
  const html = buildReceiptEmailHtml(input);

  if (!apiKey) {
    console.info("[sendReceiptEmail] RESEND_API_KEY absente — reçu destiné à :", input.to);
    return { sent: true, provider: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [input.to], subject, html }),
    });

    if (!res.ok) {
      console.error("[sendReceiptEmail] Erreur Resend :", await res.text());
      return { sent: false, provider: "resend", error: "Échec de l'envoi du reçu." };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    console.error("[sendReceiptEmail]", err);
    return { sent: false, provider: "resend", error: "Échec de l'envoi du reçu." };
  }
}
