"use client";

import { useState } from "react";
import { CreditCard, DollarSign, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Company, Invoice, Payment, User } from "@/types";

interface PaymentsPageClientProps {
  payments: Payment[];
  invoices: Invoice[];
  company: Company;
  user: User;
  isDemo?: boolean;
}

export function PaymentsPageClient({
  payments,
  invoices,
  company,
  user,
  isDemo,
}: PaymentsPageClientProps) {
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
        alert(`Intent de paiement créé pour ${formatCurrency(data.amount)}.`);
        setDialogOpen(false);
      } else {
        alert("La configuration Stripe est requise dans votre fichier .env.");
      }
    } catch {
      alert("La configuration Stripe est requise dans votre fichier .env.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <DashboardLayout
      title="Paiements"
      description="Traitement des paiements en ligne"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Paiements"
        description="Traitez et suivez les paiements en ligne via Stripe"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={unpaidInvoices.length === 0}>
                <CreditCard className="mr-2 h-4 w-4" />
                Encaisser un paiement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Encaisser un paiement</DialogTitle>
                <DialogDescription>
                  Sélectionnez une facture pour traiter un paiement en ligne.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une facture" />
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
                  Annuler
                </Button>
                <Button onClick={handlePayment} disabled={!selectedInvoice || processing}>
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Traiter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {payments.length === 0 ? (
        <EmptyState
          title="Aucun paiement"
          description="Les paiements encaissés apparaîtront ici."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total encaissé</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalCollected)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Complétés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {payments.filter((p) => p.status === "completed").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {payments.filter((p) => p.status === "pending").length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Statut</TableHead>
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
        </>
      )}
    </DashboardLayout>
  );
}
