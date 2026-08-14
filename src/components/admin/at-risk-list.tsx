import Link from "next/link";
import { AT_RISK_REASON_LABELS } from "@/lib/platform/labels";
import type { AtRiskCompany } from "@/types/platform";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";

interface AtRiskListProps {
  companies: AtRiskCompany[];
}

export function AtRiskList({ companies }: AtRiskListProps) {
  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune entreprise à risque selon les règles actuelles.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {companies.map((company) => (
        <div key={company.companyId} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/admin/companies/${company.companyId}`}
              className="font-medium hover:text-primary hover:underline"
            >
              {company.companyName}
            </Link>
            <StatusBadge status={company.subscriptionStatus} />
          </div>
          <ul className="mt-2 space-y-1">
            {company.reasons.map((reason) => (
              <li key={reason} className="text-sm text-muted-foreground">
                • {AT_RISK_REASON_LABELS[reason]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Dernière connexion :{" "}
            {company.lastLogin ? formatDate(company.lastLogin) : "Jamais"}
            {company.trialEndsAt && ` · Essai se termine : ${formatDate(company.trialEndsAt)}`}
          </p>
        </div>
      ))}
    </div>
  );
}
