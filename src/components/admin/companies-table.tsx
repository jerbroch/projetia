import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PlatformCompanySummary } from "@/types/platform";
import { accessTypeLabel } from "@/lib/access-control";
import { formatDate } from "@/lib/utils";

interface CompaniesTableProps {
  companies: PlatformCompanySummary[];
}

export function CompaniesTable({ companies }: CompaniesTableProps) {
  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune entreprise.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entreprise</TableHead>
          <TableHead>Propriétaire</TableHead>
          <TableHead>Type d&apos;accès</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Utilisateurs</TableHead>
          <TableHead>Inscription</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell>
              <Link
                href={`/admin/companies/${company.id}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {company.name}
              </Link>
            </TableCell>
            <TableCell>
              <div className="text-sm">{company.ownerName ?? "—"}</div>
              {company.ownerEmail && (
                <div className="text-xs text-muted-foreground">{company.ownerEmail}</div>
              )}
            </TableCell>
            <TableCell>{accessTypeLabel(company.accessType)}</TableCell>
            <TableCell>{company.planName ?? company.pendingPlan ?? "—"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={company.subscriptionStatus} />
                {company.isBeta && (
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800">
                    Bêta
                  </span>
                )}
                {company.isTestUser && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Test
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>{company.userCount}</TableCell>
            <TableCell>{formatDate(company.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
