"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customers";
import {
  buildCustomerFromForm,
  getDefaultCustomerFormValues,
  type CustomerFormValues,
} from "@/lib/customer-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer } from "@/types";

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  mode?: "create" | "edit";
  customer?: Customer;
  isDemo?: boolean;
  onSave: (customer: Customer) => void;
}

export function CustomerForm({
  open,
  onOpenChange,
  companyId,
  mode = "create",
  customer,
  isDemo,
  onSave,
}: CustomerFormProps) {
  const [form, setForm] = useState<CustomerFormValues>(() => getDefaultCustomerFormValues());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  useEffect(() => {
    if (open) {
      setForm(getDefaultCustomerFormValues(isEdit ? customer : undefined));
      setError("");
    }
  }, [open, isEdit, customer]);

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le nom est requis.");
      return;
    }

    startTransition(async () => {
      if (isDemo) {
        onSave(buildCustomerFromForm(form, companyId, isEdit ? customer?.id : undefined));
        onOpenChange(false);
        return;
      }

      const formData = new FormData();
      formData.set("name", form.name);
      formData.set("email", form.email);
      formData.set("phone", form.phone);
      formData.set("address", form.address);
      formData.set("company", form.company);
      formData.set("status", form.status);

      const result = isEdit
        ? await updateCustomerAction(customer!.id, formData)
        : await createCustomerAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSave(result.customer);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le client" : "Créer un client"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les informations du client."
              : "Ajoutez un client pour vos soumissions, factures et planification."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nom du client</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company">Entreprise (optionnel)</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="Nom de l'entreprise du client"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateField("status", value as CustomerFormValues["status"])}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="lead">Prospect</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer le client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
