"use client";

import Link from "next/link";
import { CreditCard, DollarSign } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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
import type { Company, Payment, User } from "@/types";

interface PaymentsPageClientProps {
  payments: Payment[];
  company: Company;
  user: User;
  isDemo?: boolean;
}

export function PaymentsPageClient({
  payments,
  company,
  user,
  isDemo,
}: PaymentsPageClientProps) {

  const totalCollected = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

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
        description="Suivi des paiements reçus de vos clients"
        action={
          <Button asChild variant="outline">
            <Link href="/settings">
              <CreditCard className="mr-2 h-4 w-4" />
              Coordonnées Interac
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        {company.interac?.enabled && company.interac.email ? (
          <p>
            Vos factures affichent vos coordonnées Interac (
            <span className="font-medium">{company.interac.email}</span>). Quand un
            virement vous parvient, marquez la facture payée depuis la page{" "}
            <Link href="/invoices" className="font-medium underline">
              Factures
            </Link>
            .
          </p>
        ) : (
          <p>
            Le virement Interac n&apos;est pas encore configuré. Renseignez vos
            coordonnées dans les{" "}
            <Link href="/settings" className="font-medium underline">
              Paramètres
            </Link>{" "}
            pour qu&apos;elles apparaissent sur vos factures.
          </p>
        )}
      </div>

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
