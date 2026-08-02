export type UserRole = "admin" | "manager" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface Customer {
  id: string;
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

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  amount: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  validUntil: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  quoteId?: string;
  amount: number;
  paidAmount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  createdAt: string;
}

export type EmployeeStatus = "active" | "inactive" | "vacation" | "sick";

export interface Employee {
  id: string;
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

export interface ScheduleEvent {
  id: string;
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
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  type: "job" | "inspection" | "meeting" | "maintenance";
}

export interface Payment {
  id: string;
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
