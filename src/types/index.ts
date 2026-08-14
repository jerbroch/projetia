export type ProfileRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "estimator"
  | "employee"
  | "accountant";

export type UserRole = ProfileRole | "manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  isDemo?: boolean;
  emailVerified?: boolean;
}

export interface InteracSettings {
  enabled: boolean;
  email?: string | null;
  recipientName?: string | null;
  securityQuestion?: string | null;
  securityAnswer?: string | null;
  instructions?: string | null;
}

export interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  gstRate?: number;
  qstRate?: number;
  defaultMaterialMargin?: number;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  accessType?: string;
  promoCode?: string | null;
  promoCodeUsedAt?: string | null;
  isBeta?: boolean;
  requiresAccessChoice?: boolean;
  accessGrantedAt?: string | null;
  subscriptionStartedAt?: string | null;
  subscriptionEndsAt?: string | null;
  pendingPlan?: string | null;
  interac?: InteracSettings;
  isDemo?: boolean;
}

export interface Profile {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: ProfileRole;
  status: "active" | "invited" | "inactive";
}

export interface TenantContext {
  user: User;
  profile: Profile | null;
  company: Company;
  membershipRole: ProfileRole;
  isDemo: boolean;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  billingAddress?: string;
  company: string;
  status: "active" | "inactive" | "lead";
  totalProjects: number;
  createdAt: string;
}

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "deposit_pending"
  | "deposit_paid";

export type DepositStatus = "not_required" | "pending" | "paid";

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  title: string;
  description: string;
  amount: number;
  status: QuoteStatus;
  validUntil: string;
  createdAt: string;
  publicToken?: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  depositRequired: boolean;
  depositPercentage?: number;
  depositAmount?: number;
  depositStatus: DepositStatus;
  terms?: string;
  lineItems: QuoteLineItem[];
  /** Set when this quote has been scheduled on the calendar */
  scheduledJobId?: string;
}

export interface InvoiceLineItem {
  lineType: "labor" | "material";
  description: string;
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  marginPct: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  quoteId?: string;
  quoteNumber?: string;
  scheduledJobId?: string;
  jobNumber?: string;
  clientPoNumber?: string;
  amount: number;
  paidAmount: number;
  subtotal?: number;
  depositApplied?: number;
  materialSubtotal?: number;
  laborSubtotal?: number;
  gstAmount?: number;
  qstAmount?: number;
  lineItems?: InvoiceLineItem[];
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  createdAt: string;
  workDescription?: string;
  sentAt?: string;
  sentTo?: string;
  sentBy?: string;
}

export type LaborRateType = "regular" | "overtime" | "double_time";

export interface LaborRateTemplate {
  id: string;
  companyId: string;
  name: string;
  workerCount: number;
  costPerHr: number;
  billRate: number;
  marginPct?: number;
  rateType: LaborRateType;
  sortOrder: number;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface MaterialCategory {
  id: string;
  companyId?: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface CompanyCatalogPrice {
  id: string;
  companyId: string;
  catalogItemId: string;
  referencePrice?: number;
  customPrice?: number;
  priceSource?: string;
  manuallyOverridden: boolean;
}

export interface MaterialCatalogItem {
  id: string;
  companyId?: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description?: string;
  diameter?: string;
  fittingType?: string;
  unit: string;
  isCustom: boolean;
  /** @deprecated use effectivePrice */
  unitCost?: number;
  referencePrice?: number;
  customPrice?: number;
  effectivePrice?: number;
  sellPrice?: number;
  marginPct?: number;
  supplierId?: string;
  supplierName?: string;
  sku?: string;
}

export interface JobBillingLine {
  id: string;
  billingSheetId: string;
  lineType: "labor" | "material";
  description: string;
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  marginPct?: number;
  lineTotal: number;
  laborTemplateId?: string;
  catalogItemId?: string;
  supplierId?: string;
  isDivers?: boolean;
  sortOrder: number;
}

export interface JobBillingSheet {
  id: string;
  companyId: string;
  scheduledJobId: string;
  status: "draft" | "invoiced";
  materialCostSubtotal?: number;
  materialSubtotal: number;
  materialMarginPct?: number;
  laborSubtotal: number;
  subtotal: number;
  gstAmount: number;
  qstAmount: number;
  total: number;
  invoiceId?: string;
  lines: JobBillingLine[];
}

export type EmployeeStatus = "active" | "inactive" | "vacation" | "sick";

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  trade: string;
  mobilePhone: string;
  email: string;
  truckNumber: string;
  status: EmployeeStatus;
  profilePhoto?: string;
  notes?: string;
  department: string;
  hireDate: string;
  hourlyRate: number;
}

export type JobNumberType = "contract" | "service_call";
export type JobOrigin = "quote" | "direct";

export interface ScheduleEvent {
  id: string;
  companyId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  billingAddress?: string;
  jobSiteAddress?: string;
  employeeIds: string[];
  employeeNames: string[];
  location: string;
  internalNotes?: string;
  status:
    | "scheduled"
    | "en-route"
    | "in-progress"
    | "completed"
    | "pending-review"
    | "ready-to-invoice"
    | "invoice-sent"
    | "paid"
    | "cancelled";
  type: "job" | "inspection" | "meeting" | "maintenance";
  quoteId?: string;
  /** CON-YYYY-NNNN for jobs from accepted quotes */
  jobNumber?: string;
  jobNumberType?: JobNumberType;
  jobOrigin?: JobOrigin;
  /** Optional client purchase order number */
  clientPoNumber?: string;
  /** Plumber field report — travaux effectués */
  workDescription?: string;
  closureNotes?: string;
  submittedForReviewAt?: string;
  workCompletedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvedByName?: string;
  sentAt?: string;
  sentTo?: string;
  sentBy?: string;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: "card" | "ach" | "check" | "cash";
  status: "pending" | "completed" | "failed" | "refunded";
  stripePaymentId?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  pendingInvoices: number;
  activeProjects: number;
  totalCustomers: number;
  upcomingJobs: number;
  employeesOnSite: number;
}

export interface QuoteRequest {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  projectDescription?: string;
  address?: string;
  status: "new" | "reviewed" | "quoted" | "declined";
  createdAt: string;
}
