export type AdminAlertType =
  | "new_company"
  | "new_subscription"
  | "trial_started"
  | "trial_ending"
  | "subscription_cancelled"
  | "failed_payment"
  | "new_feedback"
  | "inactive_company";

export type AdminActivityEventType =
  | "company_created"
  | "subscription_activated"
  | "plan_changed"
  | "payment_received"
  | "payment_failed"
  | "subscription_cancelled"
  | "feedback_sent"
  | "feedback_treated"
  | "alert_created"
  | "test_user_created"
  | "test_user_deleted";

export type ImprovementStatus =
  | "to_analyze"
  | "planned"
  | "in_development"
  | "completed"
  | "rejected";

export type FeedbackStatus = "new" | "reviewed" | "linked" | "treated";

export interface AdminAlert {
  id: string;
  alertType: AdminAlertType;
  companyId: string | null;
  companyName?: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface AdminActivityEntry {
  id: string;
  eventType: AdminActivityEventType;
  companyId: string | null;
  companyName?: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformFeedback {
  id: string;
  companyId: string;
  companyName?: string;
  userId: string | null;
  title: string;
  description: string;
  status: FeedbackStatus;
  createdAt: string;
  treatedAt: string | null;
}

export interface PlatformImprovement {
  id: string;
  title: string;
  description: string | null;
  status: ImprovementStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
  linkedFeedbackIds: string[];
  interestedCompanies: { id: string; name: string }[];
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planName: string | null;
  planAmountCents: number;
  currency: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface PlatformCompanySummary {
  id: string;
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  subscriptionStatus: string;
  planName: string | null;
  accessType: string | null;
  isBeta: boolean;
  promoCode: string | null;
  promoCodeUsedAt: string | null;
  accessGrantedAt: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  pendingPlan: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  userCount: number;
  isTestUser?: boolean;
}

export interface PlatformTestUser {
  userId: string;
  email: string;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
  createdByEmail: string | null;
}

export interface CompanyUsageStats {
  companyId: string;
  lastLogin: string | null;
  activeUsers: number;
  clientsCount: number;
  callsCount: number;
  quotesCreated: number;
  quotesSent: number;
  invoicesCount: number;
  activity7d: number;
  activity30d: number;
}

export type AtRiskReason =
  | "no_login_14d"
  | "no_activity_30d"
  | "failed_payment"
  | "overdue_subscription"
  | "trial_ending_no_conversion";

export interface AtRiskCompany {
  companyId: string;
  companyName: string;
  subscriptionStatus: string;
  reasons: AtRiskReason[];
  lastLogin: string | null;
  trialEndsAt: string | null;
}

export interface SaasMetrics {
  available: boolean;
  mrr: number;
  arr: number;
  arpu: number;
  newMrr: number;
  lostMrr: number;
  churnRate: number;
  newSubscriptions: number;
  cancellations: number;
  trialConversions: number;
  payingCompanies: number;
  currency: string;
}

export interface AdminDashboardSummary {
  unreadAlerts: number;
  payingCompanies: number;
  atRiskCount: number;
  newFeedbackCount: number;
  failedPaymentsCount: number;
  metrics: SaasMetrics;
}
