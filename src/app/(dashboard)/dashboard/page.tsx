import {
  Calendar,
  DollarSign,
  FileText,
  HardHat,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { dashboardStats, invoices, scheduleEvents } from "@/lib/mock-data";

export default function DashboardPage() {
  const upcomingEvents = scheduleEvents
    .filter((e) => e.status === "scheduled")
    .slice(0, 4);

  const recentInvoices = invoices.slice(0, 4);

  return (
    <DashboardLayout title="Dashboard" description="Overview of your construction business">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(dashboardStats.totalRevenue)}
            icon={DollarSign}
            trend={{ value: 12.5, label: "from last month" }}
          />
          <StatCard
            title="Active Projects"
            value={dashboardStats.activeProjects}
            icon={HardHat}
          />
          <StatCard
            title="Customers"
            value={dashboardStats.totalCustomers}
            icon={Users}
            trend={{ value: 8, label: "new this month" }}
          />
          <StatCard
            title="Pending Invoices"
            value={dashboardStats.pendingInvoices}
            icon={FileText}
          />
          <StatCard
            title="Upcoming Jobs"
            value={dashboardStats.upcomingJobs}
            icon={Calendar}
          />
          <StatCard
            title="On Site Today"
            value={dashboardStats.employeesOnSite}
            icon={TrendingUp}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Schedule</CardTitle>
              <CardDescription>Jobs and appointments this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.location}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.start)} · {event.employeeNames.join(", ")}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Latest billing activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(invoice.amount)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
