/**
 * Quote email delivery — uses Resend when configured, otherwise logs the link (dev stub).
 */

import {
  buildQuoteEmailHtml,
  buildQuoteEmailSubject,
  type QuoteEmailTemplateInput,
} from "@/lib/email/quote-email-template";

export interface SendQuoteEmailInput extends QuoteEmailTemplateInput {
  to: string;
}

export interface SendQuoteEmailResult {
  sent: boolean;
  provider: "resend" | "console";
  error?: string;
}

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<SendQuoteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "ConstructionIOS <onboarding@resend.dev>";

  const subject = buildQuoteEmailSubject(input);
  const html = buildQuoteEmailHtml(input);

  if (!apiKey) {
    console.info("[sendQuoteEmail] RESEND_API_KEY not set — quote link:", input.publicUrl);
    return { sent: true, provider: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[sendQuoteEmail] Resend error:", body);
      return { sent: false, provider: "resend", error: "Échec de l'envoi du courriel." };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    console.error("[sendQuoteEmail]", err);
    return { sent: false, provider: "resend", error: "Échec de l'envoi du courriel." };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
