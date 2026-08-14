import { format } from "date-fns";
import { generateId } from "@/lib/id";
import { normalizeSearchText } from "@/lib/quote-search";
import type { Customer } from "@/types";

export interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  status: Customer["status"];
}

export function getDefaultCustomerFormValues(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    address: customer?.address ?? "",
    company: customer?.company ?? "",
    status: customer?.status ?? "active",
  };
}

export function filterCustomersBySearch(
  customers: Customer[],
  query: string,
  selectedCustomerId?: string | null
): Customer[] {
  if (selectedCustomerId) {
    return customers.filter((customer) => customer.id === selectedCustomerId);
  }
  if (!query.trim()) return customers;

  const normalizedQuery = normalizeSearchText(query);
  return customers.filter((customer) => {
    const searchable = [
      customer.name,
      customer.address,
      customer.billingAddress ?? "",
      customer.company,
      customer.email,
      customer.phone,
    ].join(" ");
    return normalizeSearchText(searchable).includes(normalizedQuery);
  });
}

export function buildCustomerFromForm(
  form: CustomerFormValues,
  companyId: string,
  existingId?: string
): Customer {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    id: existingId ?? generateId("cust"),
    companyId,
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    company: form.company.trim() || form.name.trim(),
    status: form.status,
    totalProjects: 0,
    createdAt: today,
  };
}
