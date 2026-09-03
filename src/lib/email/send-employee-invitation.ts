import {
  buildEmployeeInvitationHtml,
  buildEmployeeInvitationSubject,
  type EmployeeInvitationEmailInput,
} from "@/lib/email/employee-invitation-template";
import { corpsResend } from "@/lib/email/expediteur";

export interface SendEmployeeInvitationInput extends EmployeeInvitationEmailInput {
  to: string;
  /** Adresse à laquelle le client doit répondre — celle de l'entreprise. */
  replyTo?: string;
}

export interface SendEmployeeInvitationResult {
  sent: boolean;
  provider: "resend" | "console";
  error?: string;
}

/**
 * Envoie le lien d'invitation par Resend.
 *
 * Sans clé, on journalise le lien plutôt que d'échouer : c'est ce qui permet
 * aux tests e2e et au développement hors ligne de suivre le parcours sans
 * boîte de réception.
 */
export async function sendEmployeeInvitationEmail(
  input: SendEmployeeInvitationInput,
): Promise<SendEmployeeInvitationResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info("[invitation employé] RESEND_API_KEY absente — lien pour", input.to, ":", input.actionLink);
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
        corpsResend({
          to: input.to,
          subject: buildEmployeeInvitationSubject(input),
          html: buildEmployeeInvitationHtml(input),
          replyTo: input.replyTo,
        }),
      ),
    });

    if (!res.ok) {
      console.error("[invitation employé] Resend:", await res.text());
      return { sent: false, provider: "resend", error: "Échec de l'envoi de l'invitation." };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    console.error("[invitation employé]", err);
    return { sent: false, provider: "resend", error: "Échec de l'envoi de l'invitation." };
  }
}
