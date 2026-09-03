import type { ProfileRole, ScheduleEvent } from "@/types";
import {
  canApproveBilling,
  canSendInvoiceToClient,
  canSubmitJobStatus,
  canUseFieldQuickStatus,
  isPendingReviewJob,
  type JobWorkflowStatus,
} from "@/lib/job-workflow";

/**
 * UNE SEULE ACTION PRINCIPALE PAR ÉTAT, NOMMÉE PAR CE QU'ELLE FAIT.
 *
 * L'écran offrait jusqu'ici tous les statuts atteignables côte à côte, du même
 * poids visuel : sur un call terminé, « Transport / En route », « En travail »,
 * « À vérifier » et « Prêt à facturer ». Deux marches arrière, la même idée dite
 * deux fois, et rien qui indique laquelle prendre. L'entrepreneur devait
 * connaître la machine à états pour s'en servir.
 *
 * Ici, chaque état a UNE suite évidente. Les marches arrière existent toujours,
 * mais repliées derrière « Corriger le statut » — on les prend quand on s'est
 * trompé, pas quand on avance.
 */
export type CleAction =
  | "demarrer"
  | "terminer"
  | "approuver"
  | "generer"
  | "envoyer"
  | "payer";

export interface ActionPrincipale {
  cle: CleAction;
  libelle: string;
  /** Une ligne sous le bouton : ce qui va se passer, dit à l'avance. */
  aide: string;
}

export interface ContexteAction {
  role: ProfileRole;
  /** Vrai dès qu'une facture existe pour ce call. */
  factureExiste: boolean;
  /** Vrai quand elle est réellement partie chez le client. */
  factureEnvoyee: boolean;
}

/**
 * L'action suivante, ou `null` quand il n'y a plus rien à faire (payé, annulé)
 * ou que le rôle ne le permet pas.
 */
export function prochaineAction(
  event: Pick<ScheduleEvent, "status" | "submittedForReviewAt" | "approvedAt">,
  ctx: ContexteAction,
): ActionPrincipale | null {
  const { role, factureExiste, factureEnvoyee } = ctx;
  const terrain = canUseFieldQuickStatus(role);
  const bureau = canApproveBilling(role);
  const facturier = canSendInvoiceToClient(role);

  switch (event.status) {
    case "scheduled":
    case "en-route":
      if (!terrain) return null;
      return {
        cle: "demarrer",
        libelle: "Commencer les travaux",
        aide: "Le call passe en travail.",
      };

    case "in-progress":
      if (!terrain || !canSubmitJobStatus(event.status)) return null;
      return {
        cle: "terminer",
        libelle: "Travaux terminés",
        aide: "Décrivez les travaux et vérifiez la facturation.",
      };

    case "completed":
    case "pending-review":
      if (!bureau || !isPendingReviewJob(event)) return null;
      return {
        cle: "approuver",
        libelle: "Approuver pour facturation",
        aide: "Vous pourrez ensuite générer la facture.",
      };

    case "ready-to-invoice":
      if (!facturier) return null;
      // Une facture peut exister sans être partie : c'est le trou par lequel
      // FA-2026-007 est restée en brouillon pendant qu'on croyait l'avoir
      // envoyée. Tant qu'elle n'est pas envoyée, l'envoi reste la suite.
      if (!factureExiste) {
        return {
          cle: "generer",
          libelle: "Générer la facture",
          aide: "Crée la facture à partir de la feuille de facturation.",
        };
      }
      return {
        cle: "envoyer",
        libelle: "Envoyer la facture au client",
        aide: "Envoie le courriel et marque la facture envoyée.",
      };

    case "invoice-sent":
      // Une facture marquée envoyée à la main n'a pas de courriel derrière.
      // L'envoi reste alors offert plutôt que d'être remplacé par « Payé ».
      if (facturier && factureExiste && !factureEnvoyee) {
        return {
          cle: "envoyer",
          libelle: "Envoyer la facture au client",
          aide: "Aucun courriel n'est encore parti pour cette facture.",
        };
      }
      if (!bureau) return null;
      return {
        cle: "payer",
        libelle: "Marquer payé",
        aide: "Le call est clos et part aux archives.",
      };

    default:
      // payé, annulé : le parcours est fini.
      return null;
  }
}

/**
 * Les statuts offerts sous « Corriger le statut ».
 *
 * Ce sont les marches arrière et les reprises en main. `invoice-sent` n'y
 * figure JAMAIS : un statut « envoyée » ne doit être posé que par un envoi
 * réel. Le poser à la main revenait à pouvoir déclarer envoyée une facture que
 * personne n'a reçue — c'est exactement ce qui s'est produit.
 */
export function statutsDeCorrection(
  event: Pick<ScheduleEvent, "status">,
  role: ProfileRole,
): JobWorkflowStatus[] {
  if (event.status === "cancelled") return [];

  const corrections: JobWorkflowStatus[] = [];
  if (canUseFieldQuickStatus(role)) {
    corrections.push("en-route", "in-progress");
  }
  if (canApproveBilling(role)) {
    corrections.push("pending-review");
  }

  return corrections.filter((s) => s !== event.status);
}

/**
 * Phrase affichée quand il n'y a plus d'action : sans elle, une carte vide
 * ressemble à un écran cassé.
 */
export function riensAFaire(status: JobWorkflowStatus): string | null {
  if (status === "paid") return "Ce call est payé. Rien à faire.";
  if (status === "cancelled") return "Ce call est annulé.";
  return null;
}
