import { corpsResend } from "@/lib/email/expediteur";
import { coordonneesDuSoutien } from "@/lib/coordonnees";
import { corpsAvis, sujetAvis, type AvisAbonnement } from "@/lib/email/avis-abonnement";

/**
 * Envoie l'avis à l'exploitant. NE LÈVE JAMAIS.
 *
 * Un webhook qui échoue est redélivré par Stripe, en boucle. Faire échouer le
 * traitement d'un abonnement parce qu'un courriel n'est pas parti serait
 * punir la mauvaise partie : l'abonnement, lui, est bien enregistré.
 *
 * L'événement reste écrit dans `admin_activity_log` quoi qu'il arrive — le
 * courriel double le journal, il ne le remplace pas.
 */
export async function envoyerAvisAbonnement(avis: AvisAbonnement): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const destinataire = coordonneesDuSoutien().email;

  if (!apiKey) {
    console.info("[avisAbonnement] RESEND_API_KEY absente —", sujetAvis(avis));
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        corpsResend({ to: destinataire, subject: sujetAvis(avis), html: corpsAvis(avis) }),
      ),
    });
    if (!res.ok) {
      console.error("[avisAbonnement] Resend:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[avisAbonnement]", e);
    return false;
  }
}
