"use client";

import { useState } from "react";
import { CreditCard, DollarSign, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invoices, payments } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function PaymentsPage() {
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status !== "paid" && inv.status !== "cancelled"
  );

  const totalCollected = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  async function handlePayment() {
    if (!selectedInvoice) return;
    setProcessing(true);

    try {
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: selectedInvoice }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Payment intent created for ${formatCurrency(data.amount)}. Integrate Stripe Elements to complete checkout.`);
        setDialogOpen(false);
      } else {
        alert("Payment setup requires Stripe API keys. Add them to your .env file.");
      }
    } catch {
      alert("Payment setup requires Stripe API keys. Add them to your .env file.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <DashboardLayout title="Payments" description="Online payment processing">
      <PageHeader
        title="Payments"
        description="Process and track online payments via Stripe"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <CreditCard className="mr-2 h-4 w-4" />
                Collect Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Collect Payment</DialogTitle>
                <DialogDescription>
                  Select an invoice to process an online payment via Stripe.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {unpaidInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} – {invoice.customerName} ({formatCurrency(invoice.amount - invoice.paidAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePayment} disabled={!selectedInvoice || processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Process Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {payments.filter((p) => p.status === "completed").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {payments.filter((p) => p.status === "pending").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:hidden">
        {payments.map((payment) => (
          <Card key={payment.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{payment.invoiceNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground">{payment.customerName}</p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{formatCurrency(payment.amount)}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={payment.method} />
                <span className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.invoiceNumber}</TableCell>
                  <TableCell>{payment.customerName}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={payment.method} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{formatDate(payment.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
