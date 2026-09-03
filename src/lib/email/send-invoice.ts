import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  type InvoiceEmailTemplateInput,
} from "@/lib/email/invoice-email-template";
import { corpsResend } from "@/lib/email/expediteur";

export interface SendInvoiceEmailInput extends InvoiceEmailTemplateInput {
  to: string;
  subject?: string;
  /** Adresse à laquelle le client doit répondre — celle de l'entreprise. */
  replyTo?: string;
}

export interface SendInvoiceEmailResult {
  sent: boolean;
  provider: "resend" | "console";
  error?: string;
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  const subject = input.subject ?? buildInvoiceEmailSubject(input);
  const html = buildInvoiceEmailHtml(input);

  if (!apiKey) {
    console.info("[sendInvoiceEmail] RESEND_API_KEY not set — invoice email to:", input.to);
    return { sent: true, provider: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        corpsResend({ to: input.to, subject, html, replyTo: input.replyTo }),
      ),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[sendInvoiceEmail] Resend error:", body);
      return { sent: false, provider: "resend", error: "Échec de l'envoi du courriel." };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    console.error("[sendInvoiceEmail]", err);
    return { sent: false, provider: "resend", error: "Échec de l'envoi du courriel." };
  }
}
