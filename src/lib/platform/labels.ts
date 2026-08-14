import type {
  AdminActivityEventType,
  AdminAlertType,
  AtRiskReason,
  ImprovementStatus,
} from "@/types/platform";

export const ALERT_TYPE_LABELS: Record<AdminAlertType, string> = {
  new_company: "Nouvelle entreprise",
  new_subscription: "Nouvel abonnement",
  trial_started: "Essai démarré",
  trial_ending: "Essai se termine",
  subscription_cancelled: "Abonnement annulé",
  failed_payment: "Paiement échoué",
  new_feedback: "Nouveau commentaire",
  inactive_company: "Entreprise inactive",
};

export const ACTIVITY_EVENT_LABELS: Record<AdminActivityEventType, string> = {
  company_created: "Entreprise créée",
  subscription_activated: "Abonnement activé",
  plan_changed: "Changement de plan",
  payment_received: "Paiement reçu",
  payment_failed: "Paiement échoué",
  subscription_cancelled: "Abonnement annulé",
  feedback_sent: "Commentaire envoyé",
  feedback_treated: "Commentaire traité",
  alert_created: "Alerte créée",
  test_user_created: "Compte test créé",
  test_user_deleted: "Compte test supprimé",
};

export const IMPROVEMENT_STATUS_LABELS: Record<ImprovementStatus, string> = {
  to_analyze: "À analyser",
  planned: "Planifié",
  in_development: "En développement",
  completed: "Terminé",
  rejected: "Refusé",
};

export const AT_RISK_REASON_LABELS: Record<AtRiskReason, string> = {
  no_login_14d: "Aucune connexion depuis 14 jours",
  no_activity_30d: "Aucune activité depuis 30 jours",
  failed_payment: "Paiement échoué récent",
  overdue_subscription: "Abonnement en retard",
  trial_ending_no_conversion: "Essai se termine sans conversion",
};

export const ROADMAP_COLUMNS: ImprovementStatus[] = [
  "to_analyze",
  "planned",
  "in_development",
  "completed",
];
