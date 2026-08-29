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
  employeeId?: string | null;
}

export interface TenantContext {
  user: User;
  profile: Profile | null;
  company: Company;
  membershipRole: ProfileRole;
  employeeId: string | null;
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

export type QuoteLaborCategory = "compagnon" | "apprenti" | "equipe" | "autre";

export type QuoteFeeType =
  | "transport"
  | "location"
  | "sous_traitance"
  | "permis"
  | "livraison"
  | "divers"
  | "autre";

export interface QuoteLaborLine {
  id: string;
  category: QuoteLaborCategory;
  employeeCategory?: string;
  hours: number;
  hourlyRate: number;
  workerCount: number;
  total: number;
}

export interface QuoteMaterialLine {
  id: string;
  catalogItemId?: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  costPrice: number;
  marginPct: number;
  salePrice: number;
  total: number;
  isCustom?: boolean;
}

export interface QuoteFeeLine {
  id: string;
  feeType: QuoteFeeType;
  description: string;
  quantity: number;
  price: number;
  marginPct?: number;
  total: number;
}

/** Future-ready schema for estimated vs actual profitability tracking. */
export interface QuoteProfitabilitySnapshot {
  estimatedHours?: number;
  actualHours?: number | null;
  estimatedMaterialsCost?: number;
  actualMaterialsCost?: number | null;
  soldPrice?: number;
  actualCost?: number | null;
  profit?: number | null;
}

export interface QuoteCostEstimation {
  labor: QuoteLaborLine[];
  materials: QuoteMaterialLine[];
  fees: QuoteFeeLine[];
  showLaborOnClient?: boolean;
  showMaterialsOnClient?: boolean;
  manualPriceOverride?: boolean;
  profitability?: QuoteProfitabilitySnapshot;
}

export interface QuoteEstimationSnapshot {
  quoteId: string;
  quoteNumber: string;
  costEstimation?: QuoteCostEstimation;
  calculatedCost?: number;
  proposedAmount?: number;
  budget?: number;
  estimatedHours?: number;
  capturedAt: string;
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
  costEstimation?: QuoteCostEstimation;
  calculatedCost?: number;
  proposedAmount?: number;
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
  /**
   * Date de départ de l'entreprise. null = employé courant.
   *
   * Axe distinct de `status` : quelqu'un peut être en congé puis partir, et
   * l'archivage ne doit pas effacer l'information du congé.
   */
  archivedAt?: string | null;
  profilePhoto?: string;
  notes?: string;
  department: string;
  hireDate: string;
  hourlyRate: number;
  userId?: string | null;
  appAccessEnabled?: boolean;
  appAccessStatus?: "active" | "invited" | "pending" | "inactive" | "none";
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
  /** Notes saisies sur le terrain (visible employé) */
  fieldNotes?: string;
  fieldReadyForReview?: boolean;
  closureNotes?: string;
  submittedForReviewAt?: string;
  workCompletedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvedByName?: string;
  sentAt?: string;
  sentTo?: string;
  sentBy?: string;
  quoteEstimationSnapshot?: QuoteEstimationSnapshot;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  /** Voir PAYMENT_METHODS dans lib/billing/payment-recording. */
  method: "interac" | "check" | "cash" | "transfer" | "other" | "card";
  status: "pending" | "completed" | "failed" | "refunded";
  stripePaymentId?: string;
  /** Date de RÉCEPTION de l'argent (AAAA-MM-JJ), distincte de createdAt. */
  receivedAt?: string;
  /** N° de chèque, confirmation Interac — sert au rapprochement bancaire. */
  reference?: string;
  note?: string;
  /** Date de SAISIE dans l'application. */
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

export type ToolBaseStatus = "available" | "in_repair" | "out_of_service";
export type ToolEffectiveStatus =
  | "available"
  | "reserved"
  | "in_use"
  | "overdue"
  | "in_repair"
  | "out_of_service";
export type ToolCondition = "good" | "damaged" | "needs_repair" | "missing_part" | "other";
export type ToolAssignmentStatus = "active" | "reserved" | "returned";
export type ToolReturnCondition = "good" | "damaged" | "needs_repair" | "missing_part" | "other";
export type ToolSmsStatus = "sent" | "failed" | "pending";

export interface Tool {
  id: string;
  companyId: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  internalNumber: string;
  description: string;
  condition: ToolCondition;
  baseStatus: ToolBaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ToolAssignment {
  id: string;
  toolId: string;
  employeeId: string;
  companyId: string;
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: ToolAssignmentStatus;
  notes?: string;
  returnCondition?: ToolReturnCondition;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;
}

export interface ToolSmsReminder {
  id: string;
  companyId: string;
  toolId: string;
  employeeId: string;
  phone: string;
  message: string;
  sentAt: string;
  sentByUserId: string;
  sentByUserName?: string;
  status: ToolSmsStatus;
  providerId?: string;
  provider: "twilio" | "console";
}

export interface ToolListItem extends Tool {
  effectiveStatus: ToolEffectiveStatus;
  currentEmployeeId?: string;
  currentEmployeeName?: string;
  checkoutDate?: string;
  expectedReturnDate?: string;
  daysOverdue?: number;
  hasFutureReservation?: boolean;
  nextReservationStart?: string;
  nextReservationExpectedReturn?: string;
  nextReservationEmployeeId?: string;
  lastSmsReminder?: ToolSmsReminder;
}

export interface ToolWithDetails extends Tool {
  effectiveStatus: ToolEffectiveStatus;
  currentAssignment?: ToolAssignment & { employeeName: string; employeePhone: string };
  futureReservations: Array<ToolAssignment & { employeeName: string; employeePhone: string }>;
  assignmentHistory: Array<ToolAssignment & { employeeName: string; employeePhone: string }>;
  lastSmsReminder?: ToolSmsReminder;
}

export interface EmployeeToolSummary {
  current: Array<ToolListItem & { expectedReturnDate: string }>;
  reservations: Array<ToolListItem & { startDate: string; expectedReturnDate: string }>;
  history: Array<ToolAssignment & { toolName: string; internalNumber: string }>;
}

/** Real hours entered by field employees (separate from quote estimation). */
export interface FieldHour {
  id: string;
  companyId: string;
  scheduledJobId: string;
  employeeId: string;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  hours: number;
  laborType?: string | null;
  notes?: string | null;
  timerStartedAt?: string | null;
  timerStoppedAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
}

/** Real materials used on site (no financial columns). */
export interface FieldMaterial {
  id: string;
  companyId: string;
  scheduledJobId: string;
  employeeId: string;
  catalogItemId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  notes?: string | null;
  isCustom: boolean;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface FieldCatalogItem {
  id: string;
  name: string;
  unit: string;
  category?: string | null;
}

/** Plage horaire d'un employé sur un call. Voir `src/lib/job-shifts.ts`. */
export interface JobEmployeeShift {
  id: string;
  companyId: string;
  scheduledJobId: string;
  employeeId: string;
  startAt: string;
  endAt: string;
}
