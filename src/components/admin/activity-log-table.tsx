import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTIVITY_EVENT_LABELS } from "@/lib/platform/labels";
import type { AdminActivityEntry } from "@/types/platform";
import { formatDate } from "@/lib/utils";

interface ActivityLogTableProps {
  entries: AdminActivityEntry[];
}

export function ActivityLogTable({ entries }: ActivityLogTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Entreprise</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-sm">
              {formatDate(entry.createdAt)}
            </TableCell>
            <TableCell className="text-sm">
              {ACTIVITY_EVENT_LABELS[entry.eventType]}
            </TableCell>
            <TableCell className="text-sm">{entry.companyName ?? "—"}</TableCell>
            <TableCell className="text-sm">{entry.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
