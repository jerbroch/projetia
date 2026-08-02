"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { employees as initialEmployees } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Employee } from "@/types";

export default function EmployeesPage() {
  const [employeeList, setEmployeeList] = useState<Employee[]>(initialEmployees);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();
  const [profileEmployee, setProfileEmployee] = useState<Employee | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);

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
      return [...prev, employee];
    });
  }

  function handleDeactivate(employeeId: string) {
    setEmployeeList((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, status: "inactive" as const } : e))
    );
    setProfileOpen(false);
  }

  return (
    <DashboardLayout title="Employees" description="Team and workforce management">
      <PageHeader
        title="Employees"
        description="Manage your construction team, trades, and truck assignments"
        action={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{employeeList.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vacation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {employeeList.filter((e) => e.status === "vacation").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sick / Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {employeeList.filter((e) => e.status === "sick" || e.status === "inactive").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:hidden">
        {employeeList.map((employee) => (
          <Card key={employee.id}>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar>
                {employee.profilePhoto ? <AvatarImage src={employee.profilePhoto} alt={getEmployeeFullName(employee)} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary">{getEmployeeInitials(employee)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-base">{getEmployeeFullName(employee)}</CardTitle>
                <p className="text-sm text-muted-foreground">{employee.trade}</p>
              </div>
              <StatusBadge status={employee.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{employee.mobilePhone} · {employee.email}</p>
              <p>Truck {employee.truckNumber} · {formatCurrency(employee.hourlyRate)}/hr</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openProfile(employee)}>Profile</Button>
                <Button size="sm" variant="outline" onClick={() => openEditForm(employee)}>Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden xl:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeList.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {employee.profilePhoto ? <AvatarImage src={employee.profilePhoto} alt={getEmployeeFullName(employee)} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{getEmployeeInitials(employee)}</AvatarFallback>
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
                  <TableCell>{formatCurrency(employee.hourlyRate)}/hr</TableCell>
                  <TableCell><StatusBadge status={employee.status} /></TableCell>
                  <TableCell>{formatDate(employee.hireDate)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openProfile(employee)}>Profile</Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditForm(employee)}>Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
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
