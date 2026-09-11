"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import {
  importCatalogPricesCsvAction,
  loadBillingSettingsAction,
  saveLaborRateTemplateAction,
  updateDefaultMaterialMarginAction,
} from "@/lib/actions/billing";
import {
  getDefaultDemoLaborTemplates,
  getDemoLaborTemplates,
  formatLaborBillRate,
} from "@/lib/demo/billing";
import { DEFAULT_MATERIAL_MARGIN } from "@/lib/billing-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChampDecimal } from "@/components/ui/champ-decimal";
import { decimalDepuisTexte } from "@/lib/nombre-decimal";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeRolesTable } from "@/components/settings/employee-roles-table";
import { LaborTemplatesTable } from "@/components/settings/labor-templates-table";
import type { Company, LaborRateTemplate } from "@/types";

interface BillingSettingsFormProps {
  company: Company;
  isDemo?: boolean;
}

const RATE_TYPE_LABELS = {
  regular: "Régulier",
  overtime: "Temps et demi",
  double_time: "Temps double",
};

export function BillingSettingsForm({ company, isDemo }: BillingSettingsFormProps) {
  const [templates, setTemplates] = useState<LaborRateTemplate[]>([]);
  const [defaultMargin, setDefaultMargin] = useState(
    company.defaultMaterialMargin ?? DEFAULT_MATERIAL_MARGIN
  );
  const [marginInput, setMarginInput] = useState(String(Math.round(defaultMargin * 100)));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [rateType, setRateType] = useState("regular");
  const [csvMessage, setCsvMessage] = useState("");
  const [lignesIgnorees, setLignesIgnorees] = useState<{ compte: number; apercu: string[] } | null>(null);

  useEffect(() => {
    async function load() {
      if (isDemo) {
        setTemplates(getDemoLaborTemplates(company.id));
        setLoading(false);
        return;
      }
      const result = await loadBillingSettingsAction();
      setLoading(false);
      if (result.success && result.data) {
        setTemplates(result.data.laborTemplates);
        setDefaultMargin(result.data.defaultMargin);
        setMarginInput(String(Math.round(result.data.defaultMargin * 100)));
      }
    }
    load();
  }, [company.id, isDemo]);

  function handleSaveTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const formData = new FormData(e.currentTarget);

    if (isDemo) {
      setError("Les paramètres démo ne peuvent pas être modifiés.");
      return;
    }

    startTransition(async () => {
      const result = await saveLaborRateTemplateAction(formData);
      if (!result.success) setError(result.error);
      else {
        setMessage("Modèle enregistré.");
        const reload = await loadBillingSettingsAction();
        if (reload.success && reload.data) setTemplates(reload.data.laborTemplates);
      }
    });
  }

  function handleSaveMargin() {
    // `parseFloat("37,5")` rend 37 : il s'arrête à la virgule. Une marge de
    // 37,5 % devenait 37 %.
    const pct = (decimalDepuisTexte(marginInput) ?? NaN) / 100;
    if (Number.isNaN(pct) || pct < 0) {
      setError("Marge invalide.");
      return;
    }
    if (isDemo) {
      setError("Les paramètres démo ne peuvent pas être modifiés.");
      return;
    }
    startTransition(async () => {
      const result = await updateDefaultMaterialMarginAction(pct);
      if (!result.success) setError(result.error);
      else {
        setDefaultMargin(pct);
        setMessage("Marge matériel par défaut enregistrée.");
      }
    });
  }

  async function handleCatalogPricesImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || isDemo) return;
    setCsvMessage("");
    setError("");
    setLignesIgnorees(null);
    const content = await file.text();
    startTransition(async () => {
      const result = await importCatalogPricesCsvAction(content);
      if (!result.success) setError(result.error);
      else if (result.data) {
        const d = result.data;
        setCsvMessage(
          `${d.imported} prix importé(s)` +
            (d.skipped ? `, ${d.skipped} conservé(s) (prix personnalisé)` : "") +
            (d.errors.length ? ` — ${d.errors.length} erreur(s)` : "")
        );
        // LES LIGNES ÉCARTÉES SE DISENT. Un fichier de 718 lignes pouvait en
        // importer 300 et annoncer « succès » : on ne voyait le trou qu'en
        // facturant, des semaines plus tard.
        setLignesIgnorees(d.ignorees ? { compte: d.ignorees, apercu: d.apercuIgnorees } : null);
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const displayTemplates =
    templates.length > 0 ? templates : isDemo ? getDefaultDemoLaborTemplates(company.id) : [];

  return (
    <div className="space-y-6">
      <Card id="taux" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Taux de main-d&apos;œuvre</CardTitle>
          <CardDescription>
            Ce que coûte une heure de travail, et ce que vous la facturez. Modifiable
            directement dans le tableau.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LaborTemplatesTable
            templates={displayTemplates}
            disabled={isDemo}
            onChanged={() => {
              void loadBillingSettingsAction().then((r) => {
                if (r.success && r.data) setTemplates(r.data.laborTemplates);
              });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rôles de vos employés</CardTitle>
          <CardDescription>
            Le niveau de chacun dans votre entreprise, et le salaire que vous
            lui versez. Sert à pré-remplir les fiches employés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeRolesTable disabled={isDemo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marge matériel par défaut</CardTitle>
          <CardDescription>
            Marge globale appliquée au sous-total matériel en fin de feuille de facturation. Actuellement{" "}
            {Math.round(defaultMargin * 100)}%
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-1">
            <Label htmlFor="defaultMargin">Marge (%)</Label>
            <ChampDecimal
              id="defaultMargin"
              value={marginInput}
              onValeurChange={setMarginInput}
              disabled={isDemo}
            />
          </div>
          <Button onClick={handleSaveMargin} disabled={isDemo || isPending}>
            Enregistrer la marge
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import prix catalogue (CSV)</CardTitle>
          <CardDescription>
            Colonnes : sku, name, diameter, reference_price, source_url (optionnel). Les prix custom ne sont
            jamais écrasés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            id="catalogPricesImport"
            disabled={isDemo}
            onChange={handleCatalogPricesImport}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isDemo || isPending}
            onClick={() => document.getElementById("catalogPricesImport")?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer prix de référence
          </Button>
          <p className="text-xs text-muted-foreground">
            Exemple : ,Coude 90° cuivre,3/4&quot;,12.50,https://example.com/coude
          </p>
          {csvMessage && <p className="text-sm text-green-700">{csvMessage}</p>}

          {lignesIgnorees && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">
                {lignesIgnorees.compte} ligne{lignesIgnorees.compte > 1 ? "s" : ""} n&apos;
                {lignesIgnorees.compte > 1 ? "ont" : "a"} pas pu être lue
                {lignesIgnorees.compte > 1 ? "s" : ""}.
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {lignesIgnorees.apercu.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {lignesIgnorees.compte > lignesIgnorees.apercu.length && (
                <p className="mt-1 text-xs">
                  … et {lignesIgnorees.compte - lignesIgnorees.apercu.length} autre
                  {lignesIgnorees.compte - lignesIgnorees.apercu.length > 1 ? "s" : ""}.
                </p>
              )}
              <p className="mt-2 text-xs">
                Corrigez ces lignes et réimportez le fichier&nbsp;: les prix déjà en place ne
                seront pas dupliqués.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {message && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    </div>
  );
}
