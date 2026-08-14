import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getScheduleStatusBadgeClassName,
  isScheduleStatus,
} from "@/lib/status-colors";

const statusVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  active: "success",
  inactive: "secondary",
  lead: "info",
  draft: "secondary",
  sent: "info",
  accepted: "success",
  rejected: "destructive",
  expired: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "secondary",
  pending: "warning",
  failed: "destructive",
  refunded: "secondary",
  vacation: "info",
  sick: "warning",
  "on-leave": "warning",
  card: "default",
  ach: "info",
  check: "secondary",
  cash: "outline",
  job: "default",
  inspection: "info",
  meeting: "secondary",
  maintenance: "warning",
};

const FRENCH_LABELS: Record<string, string> = {
  scheduled: "Planifié",
  "en-route": "En route",
  "in-progress": "En travail",
  completed: "Travaux terminés",
  "pending-review": "À vérifier",
  "ready-to-invoice": "Prêt à facturer",
  "invoice-sent": "Facture envoyée",
  paid: "Payé",
  cancelled: "Annulé",
  draft: "Brouillon",
  sent: "Envoyé",
  overdue: "En retard",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const safeStatus = status ?? "unknown";
  const label = FRENCH_LABELS[safeStatus] ?? safeStatus.replace(/-/g, " ");

  if (isScheduleStatus(safeStatus)) {
    return (
      <Badge className={cn("capitalize", getScheduleStatusBadgeClassName(safeStatus))}>
        {label}
      </Badge>
    );
  }

  const variant = statusVariants[safeStatus] ?? "outline";

  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  );
}
