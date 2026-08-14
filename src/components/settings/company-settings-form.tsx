"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCompanySettingsAction } from "@/lib/actions/auth";
import { uploadCompanyLogoAction } from "@/lib/actions/company-logo";
import type { Company } from "@/types";

interface CompanySettingsFormProps {
  company: Company;
}

export function CompanySettingsForm({ company }: CompanySettingsFormProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? "");
  const [logoMessage, setLogoMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateCompanySettingsAction(formData);
      setLoading(false);
      if (!result.success) {
        setError(result.error);
      } else {
        setMessage("Paramètres enregistrés.");
      }
    });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setLogoMessage("");
    setLogoError("");

    const formData = new FormData();
    formData.set("logo", file);

    const result = await uploadCompanyLogoAction(formData);
    setLogoUploading(false);

    if (!result.success) {
      setLogoError(result.error);
    } else {
      setLogoUrl(result.logoUrl);
      setLogoMessage("Logo mis à jour.");
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres de l&apos;entreprise</CardTitle>
        <CardDescription>Gérez les informations et taxes de votre entreprise</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <Label>Logo de l&apos;entreprise</Label>
            <p className="text-sm text-muted-foreground">
              Affiché dans vos soumissions et les courriels envoyés à vos clients.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`Logo ${company.name}`}
                  className="h-16 w-16 rounded-md border object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  id="logoFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={company.isDemo || logoUploading}
                  onChange={handleLogoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={company.isDemo || logoUploading}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {logoUrl ? "Changer le logo" : "Téléverser un logo"}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou GIF — max. 2 Mo</p>
              </div>
            </div>
            {logoMessage && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{logoMessage}</div>
            )}
            {logoError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{logoError}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nom affiché</Label>
            <Input id="name" name="name" defaultValue={company.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Raison sociale</Label>
            <Input id="legalName" name="legalName" defaultValue={company.legalName ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" defaultValue={company.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Courriel</Label>
              <Input id="email" name="email" type="email" defaultValue={company.email ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" defaultValue={company.address ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" name="city" defaultValue={company.city ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Input id="province" name="province" defaultValue={company.province ?? "QC"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Code postal</Label>
              <Input id="postalCode" name="postalCode" defaultValue={company.postalCode ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Couleur principale</Label>
            <Input id="primaryColor" name="primaryColor" defaultValue={company.primaryColor ?? "#2563eb"} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gstRate">TPS (décimal)</Label>
              <Input id="gstRate" name="gstRate" type="number" step="0.001" defaultValue={company.gstRate ?? 0.05} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qstRate">TVQ (décimal)</Label>
              <Input id="qstRate" name="qstRate" type="number" step="0.00001" defaultValue={company.qstRate ?? 0.09975} />
            </div>
          </div>
          <Button type="submit" disabled={loading || isPending || company.isDemo}>
            {(loading || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          {company.isDemo && (
            <p className="text-sm text-muted-foreground">
              Les paramètres du compte de démonstration ne peuvent pas être modifiés.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
