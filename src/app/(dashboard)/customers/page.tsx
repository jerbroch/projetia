import { Plus, Mail, Phone, MapPin } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { customers } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function CustomersPage() {
  return (
    <DashboardLayout title="Customers" description="Manage your client relationships">
      <PageHeader
        title="Customers"
        description="View and manage all your construction clients"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      {/* Mobile card view */}
      <div className="grid gap-4 md:hidden">
        {customers.map((customer) => (
          <Card key={customer.id}>
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
                {customer.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {customer.address}
              </div>
              <p className="text-xs text-muted-foreground">
                {customer.totalProjects} projects · Since {formatDate(customer.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table view */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.company}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm">{customer.email}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </TableCell>
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
    </DashboardLayout>
  );
}
