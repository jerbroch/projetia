"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { deactivateEmployeeAction } from "@/lib/actions/employees";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeProfilePanel } from "@/components/employees/employee-profile-panel";
import { getEmployeeFullName, getEmployeeInitials } from "@/lib/employee-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Company, Employee, User } from "@/types";

interface EmployeesPageClientProps {
  initialEmployees: Employee[];
  company: Company;
  user: User;
  isDemo?: boolean;
}

export function EmployeesPageClient({
  initialEmployees,
  company,
  user,
  isDemo,
}: EmployeesPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [employeeList, setEmployeeList] = useState<Employee[]>(initialEmployees);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [profileEmployee, setProfileEmployee] = useState<Employee | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const activeCount = employeeList.filter((e) => e.status === "active").length;

  function openCreateForm() {
    setFormMode("create");
    setEditingEmployee(undefined);
    setFormOpen(true);
  }

  function openEditForm(employee: Employee) {
    setFormMode("edit");
    setEditingEmployee(employee);
    setFormOpen(true);
  }

  function openProfile(employee: Employee) {
    setProfileEmployee(employee);
    setProfileOpen(true);
  }

  function handleSave(employee: Employee) {
    setEmployeeList((prev) => {
      const exists = prev.some((e) => e.id === employee.id);
      if (exists) return prev.map((e) => (e.id === employee.id ? employee : e));
      return [employee, ...prev];
    });
    setActionError("");
    router.refresh();
  }

  function handleDeactivate(employeeId: string) {
    startTransition(async () => {
      if (isDemo) {
        setEmployeeList((prev) =>
          prev.map((e) => (e.id === employeeId ? { ...e, status: "inactive" as const } : e))
        );
        setProfileOpen(false);
        return;
      }

      const result = await deactivateEmployeeAction(employeeId);
      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setEmployeeList((prev) =>
        prev.map((e) => (e.id === employeeId ? result.employee : e))
      );
      setProfileOpen(false);
      router.refresh();
    });
  }

  return (
    <DashboardLayout
      title="Employés"
      description="Gestion de l'équipe"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Employés"
        description="Gérez votre équipe, métiers et camions"
        action={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un employé
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{actionError}</div>
      )}

      {employeeList.length === 0 ? (
        <EmptyState
          title="Aucun employé"
          description="Ajoutez votre premier employé pour planifier des travaux."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{employeeList.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Actifs</CardTitle>
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vacances</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {employeeList.filter((e) => e.status === "vacation").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Maladie / Inactifs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {employeeList.filter((e) => e.status === "sick" || e.status === "inactive").length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Métier</TableHead>
                    <TableHead>Camion</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Taux</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Embauche</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeList.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {employee.profilePhoto ? (
                              <AvatarImage src={employee.profilePhoto} alt={getEmployeeFullName(employee)} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getEmployeeInitials(employee)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{getEmployeeFullName(employee)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{employee.trade}</TableCell>
                      <TableCell>{employee.truckNumber || "—"}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">{employee.email}</p>
                          <p className="text-xs text-muted-foreground">{employee.mobilePhone}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(employee.hourlyRate)}/h</TableCell>
                      <TableCell><StatusBadge status={employee.status} /></TableCell>
                      <TableCell>{formatDate(employee.hireDate)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openProfile(employee)}>Profil</Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditForm(employee)}>Modifier</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        companyId={company.id}
        isDemo={isDemo}
        employee={editingEmployee}
        onSave={handleSave}
      />

      <EmployeeProfilePanel
        open={profileOpen}
        onOpenChange={setProfileOpen}
        employee={profileEmployee}
        onEdit={openEditForm}
        onDeactivate={handleDeactivate}
      />
    </DashboardLayout>
  );
}
