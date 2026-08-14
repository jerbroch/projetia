"use client";

import { useState } from "react";
import { Loader2, Mail, MapPin, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { Customer } from "@/types";

interface CustomerDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => Promise<void>;
}

export function CustomerDetailPanel({
  open,
  onOpenChange,
  customer,
  onEdit,
  onDelete,
}: CustomerDetailPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!customer) return null;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(customer!.id);
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Impossible de supprimer le client.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="customer-detail-panel">
          <DialogHeader>
            <DialogTitle>{customer.name}</DialogTitle>
            <DialogDescription>Détails et actions pour ce client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{customer.company}</p>
              <StatusBadge status={customer.status} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {customer.email || "—"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                {customer.phone || "—"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {customer.address || "—"}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {customer.totalProjects} projets · Depuis {formatDate(customer.createdAt)}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteError("");
                setConfirmOpen(true);
              }}
            >
              Supprimer
            </Button>
            <Button type="button" onClick={() => onEdit(customer)}>
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce client ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Les soumissions liées empêchent la suppression.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
