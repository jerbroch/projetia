import { Badge } from "@/components/ui/badge";

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
  scheduled: "info",
  "in-progress": "warning",
  completed: "success",
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

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const safeStatus = status ?? "unknown";
  const variant = statusVariants[safeStatus] ?? "outline";
  const label = safeStatus.replace(/-/g, " ");

  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  );
}
