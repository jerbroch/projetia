import { Plus } from "lucide-react";
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
import { quotes } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function QuotesPage() {
  return (
    <DashboardLayout title="Quotes" description="Create and manage project estimates">
      <PageHeader
        title="Quotes"
        description="Track estimates and proposals for your projects"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        }
      />

      <div className="grid gap-4 md:hidden">
        {quotes.map((quote) => (
          <Card key={quote.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{quote.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{quote.quoteNumber}</p>
                </div>
                <StatusBadge status={quote.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{quote.customerName}</p>
              <p className="font-semibold">{formatCurrency(quote.amount)}</p>
              <p className="text-xs text-muted-foreground">
                Valid until {formatDate(quote.validUntil)}
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
                <TableHead>Quote #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p>{quote.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{quote.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>{quote.customerName}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(quote.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={quote.status} />
                  </TableCell>
                  <TableCell>{formatDate(quote.validUntil)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
