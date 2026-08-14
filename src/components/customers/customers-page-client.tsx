"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MapPin, Phone, Plus } from "lucide-react";
import { deleteCustomerAction } from "@/lib/actions/customers";
import { CustomerDetailPanel } from "@/components/customers/customer-detail-panel";
import { CustomerForm } from "@/components/customers/customer-form";
import { CustomersSearchBar } from "@/components/customers/customers-search-bar";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { filterCustomersBySearch } from "@/lib/customer-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { Company, Customer, User } from "@/types";

interface CustomersPageClientProps {
  initialCustomers: Customer[];
  company: Company;
  user: User;
  isDemo?: boolean;
}

export function CustomersPageClient({
  initialCustomers,
  company,
  user,
  isDemo,
}: CustomersPageClientProps) {
  const router = useRouter();
  const [customerList, setCustomerList] = useState<Customer[]>(initialCustomers);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [profileCustomer, setProfileCustomer] = useState<Customer | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const filteredCustomers = useMemo(
    () => filterCustomersBySearch(customerList, searchQuery, selectedCustomerId),
    [customerList, searchQuery, selectedCustomerId]
  );

  function openCreateForm() {
    setFormMode("create");
    setEditingCustomer(undefined);
    setFormOpen(true);
  }

  function openEditForm(customer: Customer) {
    setFormMode("edit");
    setEditingCustomer(customer);
    setProfileOpen(false);
    setFormOpen(true);
  }

  function openProfile(customer: Customer) {
    setProfileCustomer(customer);
    setProfileOpen(true);
  }

  function handleSave(customer: Customer) {
    setCustomerList((prev) => {
      const exists = prev.some((entry) => entry.id === customer.id);
      if (exists) return prev.map((entry) => (entry.id === customer.id ? customer : entry));
      return [customer, ...prev];
    });
    setActionError("");
    router.refresh();
  }

  async function handleDelete(customerId: string) {
    if (isDemo) {
      setCustomerList((prev) => prev.filter((entry) => entry.id !== customerId));
      return;
    }

    const result = await deleteCustomerAction(customerId);
    if (!result.success) {
      throw new Error(result.error);
    }

    setCustomerList((prev) => prev.filter((entry) => entry.id !== customerId));
    if (selectedCustomerId === customerId) {
      setSelectedCustomerId(null);
      setSearchQuery("");
    }
    router.refresh();
  }

  function clearSearchFilter() {
    setSearchQuery("");
    setSelectedCustomerId(null);
  }

  return (
    <DashboardLayout
      title="Clients"
      description="Gérez vos relations clients"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Clients"
        description="Consultez et gérez tous vos clients"
        action={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un client
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{actionError}</div>
      )}

      {customerList.length > 0 && (
        <CustomersSearchBar
          customers={customerList}
          searchQuery={searchQuery}
          selectedCustomerId={selectedCustomerId}
          onSearchQueryChange={setSearchQuery}
          onSelectCustomer={setSelectedCustomerId}
          onClearFilter={clearSearchFilter}
        />
      )}

      {customerList.length === 0 ? (
        <EmptyState
          title="Aucun client"
          description="Ajoutez votre premier client pour commencer à créer des soumissions et factures."
        />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          description="Aucun client ne correspond à votre recherche."
        />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => openProfile(customer)}
                data-testid={`customer-card-${customer.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{customer.company}</p>
                    </div>
                    <StatusBadge status={customer.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.email || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {customer.address || "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {customer.totalProjects} projets · Depuis {formatDate(customer.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Projets</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Depuis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer"
                      onClick={() => openProfile(customer)}
                      data-testid={`customer-row-${customer.id}`}
                    >
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.company}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">{customer.email || "—"}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{customer.address || "—"}</TableCell>
                      <TableCell>{customer.totalProjects}</TableCell>
                      <TableCell>
                        <StatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell>{formatDate(customer.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <CustomerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        customer={editingCustomer}
        companyId={company.id}
        isDemo={isDemo}
        onSave={handleSave}
      />

      <CustomerDetailPanel
        open={profileOpen}
        onOpenChange={setProfileOpen}
        customer={profileCustomer}
        onEdit={openEditForm}
        onDelete={handleDelete}
      />
    </DashboardLayout>
  );
}
