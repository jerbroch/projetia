import { format } from "date-fns";
import type { Employee, EmployeeStatus } from "@/types";
import { generateId } from "@/lib/id";

export function getEmployeeFullName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`;
}

export function getEmployeeInitials(employee: Pick<Employee, "firstName" | "lastName">): string {
  const first = employee.firstName?.[0] ?? "";
  const last = employee.lastName?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function isEmployeeSchedulable(employee: Employee): boolean {
  return employee.status === "active" || employee.status === "vacation";
}

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  trade: string;
  mobilePhone: string;
  email: string;
  truckNumber: string;
  status: EmployeeStatus;
  profilePhoto: string;
  notes: string;
  department: string;
  hireDate: string;
  hourlyRate: string;
  grantAppAccess: boolean;
}

export function getDefaultEmployeeFormValues(employee?: Employee): EmployeeFormValues {
  if (employee) {
    return {
      firstName: employee.firstName,
      lastName: employee.lastName,
      trade: employee.trade,
      mobilePhone: employee.mobilePhone,
      email: employee.email,
      truckNumber: employee.truckNumber,
      status: employee.status,
      profilePhoto: employee.profilePhoto ?? "",
      notes: employee.notes ?? "",
      department: employee.department,
      hireDate: employee.hireDate,
      hourlyRate: String(employee.hourlyRate),
      grantAppAccess: employee.appAccessStatus === "active",
    };
  }

  return {
    firstName: "",
    lastName: "",
    trade: "",
    mobilePhone: "",
    email: "",
    truckNumber: "",
    status: "active",
    profilePhoto: "",
    notes: "",
    department: "Field",
    hireDate: format(new Date(), "yyyy-MM-dd"),
    hourlyRate: "35",
    grantAppAccess: false,
  };
}

export function buildEmployeeFromForm(
  form: EmployeeFormValues,
  existingId?: string,
  companyId = ""
): Employee {
  return {
    id: existingId ?? generateId("emp"),
    companyId,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    trade: form.trade.trim(),
    mobilePhone: form.mobilePhone.trim(),
    email: form.email.trim(),
    truckNumber: form.truckNumber.trim(),
    status: form.status,
    profilePhoto: form.profilePhoto.trim() || undefined,
    notes: form.notes.trim() || undefined,
    department: form.department.trim(),
    hireDate: form.hireDate,
    hourlyRate: Number(form.hourlyRate) || 0,
  };
}
