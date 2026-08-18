import { Badge } from "@/components/ui/badge";
import { TOOL_STATUS_LABELS } from "@/lib/tool-utils";
import type { ToolEffectiveStatus } from "@/types";

const statusVariants: Record<
  ToolEffectiveStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"
> = {
  available: "success",
  reserved: "info",
  in_use: "default",
  overdue: "destructive",
  in_repair: "warning",
  out_of_service: "secondary",
};

interface ToolStatusBadgeProps {
  status: ToolEffectiveStatus;
}

export function ToolStatusBadge({ status }: ToolStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status] ?? "outline"}>
      {TOOL_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
