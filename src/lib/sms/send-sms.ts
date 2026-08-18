/**
 * SMS delivery — uses Twilio when configured, otherwise logs to console (dev stub).
 */

import { normalizePhoneForSms } from "@/lib/sms/phone-normalize";

export interface SendSmsInput {
  to: string;
  message: string;
}

export interface SendSmsResult {
  sent: boolean;
  provider: "twilio" | "console";
  providerId?: string;
  normalizedPhone?: string;
  error?: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const normalized = normalizePhoneForSms(input.to);
  if (!normalized) {
    return {
      sent: false,
      provider: "console",
      error: "Numéro de téléphone invalide pour l'envoi SMS.",
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.info("[sendSms] Twilio not configured — message to:", normalized);
    console.info("[sendSms] Body:", input.message);
    return { sent: true, provider: "console", normalizedPhone: normalized };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({
      To: normalized,
      From: fromNumber,
      Body: input.message,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );

    const data = (await res.json()) as { sid?: string; message?: string };

    if (!res.ok) {
      console.error("[sendSms] Twilio error:", data);
      return {
        sent: false,
        provider: "twilio",
        normalizedPhone: normalized,
        error: data.message ?? "Échec de l'envoi du SMS.",
      };
    }

    return {
      sent: true,
      provider: "twilio",
      providerId: data.sid,
      normalizedPhone: normalized,
    };
  } catch (err) {
    console.error("[sendSms]", err);
    return {
      sent: false,
      provider: "twilio",
      normalizedPhone: normalized,
      error: "Échec de l'envoi du SMS.",
    };
  }
}
