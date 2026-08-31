"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createEmployeeAction, updateEmployeeAction } from "@/lib/actions/employees";
import { getEmployeeAppAccessStatusLabel } from "@/lib/employee-access-utils";
import {
  buildEmployeeFromForm,
  getDefaultEmployeeFormValues,
  type EmployeeFormValues,
} from "@/lib/employee-utils";
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
import type { Employee, ProfileRole } from "@/types";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  companyId: string;
  isDemo?: boolean;
  employee?: Employee;
  membershipRole: ProfileRole;
  onSave: (employee: Employee) => void;
}

function toFormData(form: EmployeeFormValues): FormData {
  const formData = new FormData();
  formData.set("firstName", form.firstName);
  formData.set("lastName", form.lastName);
  formData.set("trade", form.trade);
  formData.set("email", form.email);
  formData.set("mobilePhone", form.mobilePhone);
  formData.set("truckNumber", form.truckNumber);
  formData.set("status", form.status);
  formData.set("profilePhoto", form.profilePhoto);
  formData.set("notes", form.notes);
  formData.set("department", form.department);
  formData.set("hireDate", form.hireDate);
  formData.set("hourlyRate", form.hourlyRate);
  formData.set("grantAppAccess", form.grantAppAccess ? "true" : "false");
  return formData;
}

export function EmployeeForm({
  open,
  onOpenChange,
  mode,
  companyId,
  isDemo,
  employee,
  membershipRole,
  onSave,
}: EmployeeFormProps) {
  const canManageAccess = membershipRole === "owner" || membershipRole === "admin";
  const [form, setForm] = useState<EmployeeFormValues>(() => getDefaultEmployeeFormValues(employee));
  const [error, setError] = useState("");
  // Vrai quand le refus vient d'un courriel déjà pris : on propose alors de le
  // transférer, plutôt que d'obliger à vider l'autre fiche puis revenir.
  const [transfertPossible, setTransfertPossible] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(getDefaultEmployeeFormValues(employee));
      setError("");
        setTransfertPossible(false);
    }
  }, [open, employee]);

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function envoyer(avecTransfert: boolean) {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Le prénom et le nom sont requis.");
      return;
    }
    if (!form.trade.trim()) {
      setError("Le métier est requis.");
      return;
    }

    startTransition(async () => {
      if (isDemo) {
        onSave(buildEmployeeFromForm(form, mode === "edit" ? employee?.id : undefined, companyId));
        onOpenChange(false);
        return;
      }

      const formData = toFormData(form);
      if (avecTransfert) formData.set("transfertCourriel", "true");
      const result =
        mode === "edit" && employee
          ? await updateEmployeeAction(employee.id, formData)
          : await createEmployeeAction(formData);

      if (!result.success) {
        setError(result.error);
        // Le refus nomme le porteur : c'est ce qui rend le transfert offrable.
        setTransfertPossible(/déjà utilisé par/.test(result.error));
        return;
      }

      onSave(result.employee);
      onOpenChange(false);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTransfertPossible(false);
    envoyer(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Ajouter un employé" : "Modifier l'employé"}</DialogTitle>
          <DialogDescription>
            Gérez le profil, le métier, les coordonnées et l&apos;assignation de camion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error}</p>
              {transfertPossible && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => envoyer(true)}
                >
                  Transférer ce courriel vers cet employé
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade">Métier</Label>
              <Input id="trade" value={form.trade} onChange={(e) => updateField("trade", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="truckNumber">Numéro de camion</Label>
              <Input id="truckNumber" value={form.truckNumber} onChange={(e) => updateField("truckNumber", e.target.value)} placeholder="C-101" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Téléphone mobile</Label>
              <Input id="mobilePhone" value={form.mobilePhone} onChange={(e) => updateField("mobilePhone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Département</Label>
              <Input id="department" value={form.department} onChange={(e) => updateField("department", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v as EmployeeFormValues["status"])}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="vacation">Vacances</SelectItem>
                  <SelectItem value="sick">Maladie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Date d&apos;embauche</Label>
              <Input id="hireDate" type="date" value={form.hireDate} onChange={(e) => updateField("hireDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Taux horaire</Label>
              <Input id="hourlyRate" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => updateField("hourlyRate", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profilePhoto">URL photo de profil (optionnel)</Label>
              <Input id="profilePhoto" value={form.profilePhoto} onChange={(e) => updateField("profilePhoto", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {canManageAccess && (
              <div className="space-y-2 sm:col-span-2 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="grantAppAccess">Donner accès à l&apos;application</Label>
                    <p className="text-xs text-muted-foreground">
                      Envoie une invitation par courriel à l&apos;employé. Votre compte administrateur ne sera jamais modifié.
                    </p>
                  </div>
                  <input
                    id="grantAppAccess"
                    type="checkbox"
                    checked={form.grantAppAccess}
                    onChange={(e) => updateField("grantAppAccess", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>
                {employee?.appAccessStatus && employee.appAccessStatus !== "none" && (
                  <p className="text-sm">
                    Accès application :{" "}
                    <strong>{getEmployeeAppAccessStatusLabel(employee.appAccessStatus)}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Ajouter l'employé" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
