"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { searchQuoteMaterialsAction } from "@/lib/actions/quotes";
import {
  calculateCostEstimationSummary,
  createCustomLaborLine,
  createDefaultFeeLine,
  createDefaultLaborLine,
  createDefaultMaterialLine,
  FEE_TYPE_LABELS,
  hasCostEstimationLines,
  isCustomLaborLine,
  LABOR_CATEGORY_LABELS,
  normalizeCostEstimation,
  recalculateCostEstimation,
  resolveDefaultLaborRate,
  resolveDefaultWorkerCount,
  type QuoteCostSummary,
} from "@/lib/quote-cost-utils";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Company,
  LaborRateTemplate,
  MaterialCatalogItem,
  QuoteCostEstimation,
  QuoteFeeLine,
  QuoteLaborCategory,
  QuoteLaborLine,
  QuoteMaterialLine,
} from "@/types";

interface CostEstimationSectionProps {
  company: Company;
  laborTemplates: LaborRateTemplate[];
  estimation: QuoteCostEstimation;
  amount: string;
  manualPriceOverride: boolean;
  onEstimationChange: (estimation: QuoteCostEstimation) => void;
  onAmountChange: (amount: string) => void;
  onManualPriceOverrideChange: (value: boolean) => void;
}

function CollapsibleBlock({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-md border"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-4 py-3">{children}</div>
    </details>
  );
}

function MaterialSearchField({
  onSelect,
}: {
  onSelect: (item: MaterialCatalogItem, costPrice: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaterialCatalogItem[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const items = await searchQuoteMaterialsAction(query.trim());
        setResults(items);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher dans le catalogue..."
      />
      {isPending && <p className="text-xs text-muted-foreground">Recherche...</p>}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
              onClick={() => {
                onSelect(item, item.effectivePrice ?? item.referencePrice ?? 0);
                setQuery("");
                setResults([]);
              }}
            >
              <span>
                {item.name}
                {item.diameter ? ` (${item.diameter})` : ""}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatCurrency(item.effectivePrice ?? item.referencePrice ?? 0)}
              </span>
            </button>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onSelect(
            {
              id: "",
              categoryId: "",
              name: "",
              unit: "unité",
              isCustom: true,
            },
            0
          )
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        Matériau personnalisé
      </Button>
    </div>
  );
}

export function CostEstimationSection({
  company,
  laborTemplates,
  estimation,
  amount,
  manualPriceOverride,
  onEstimationChange,
  onAmountChange,
  onManualPriceOverrideChange,
}: CostEstimationSectionProps) {
  const defaultMargin = company.defaultMaterialMargin ?? 0.4;
  const normalized = useMemo(
    () => recalculateCostEstimation(normalizeCostEstimation(estimation)),
    [estimation]
  );
  const summary: QuoteCostSummary = useMemo(
    () =>
      calculateCostEstimationSummary(
        normalized,
        company,
        manualPriceOverride ? Number(amount) || undefined : undefined
      ),
    [normalized, company, amount, manualPriceOverride]
  );

  useEffect(() => {
    if (!hasCostEstimationLines(normalized)) return;
    if (manualPriceOverride) return;
    const next = String(summary.calculatedSubtotal);
    if (next !== amount) onAmountChange(next);
  }, [summary.calculatedSubtotal, manualPriceOverride, normalized, amount, onAmountChange]);

  function updateEstimation(next: QuoteCostEstimation) {
    onEstimationChange(recalculateCostEstimation(next));
  }

  function updateLaborLine(index: number, patch: Partial<QuoteLaborLine>) {
    const labor = [...normalized.labor];
    const current = labor[index];
    if (!current) return;
    const category = patch.category ?? current.category;
    labor[index] = {
      ...current,
      ...patch,
      hourlyRate:
        patch.hourlyRate ??
        (patch.category ? resolveDefaultLaborRate(category, laborTemplates) : current.hourlyRate),
      workerCount:
        patch.workerCount ??
        (patch.category ? resolveDefaultWorkerCount(category) : current.workerCount),
    };
    updateEstimation({ ...normalized, labor });
  }

  function updateMaterialLine(index: number, patch: Partial<QuoteMaterialLine>) {
    const materials = [...normalized.materials];
    const current = materials[index];
    if (!current) return;
    materials[index] = { ...current, ...patch };
    updateEstimation({ ...normalized, materials });
  }

  function updateFeeLine(index: number, patch: Partial<QuoteFeeLine>) {
    const fees = [...normalized.fees];
    const current = fees[index];
    if (!current) return;
    fees[index] = { ...current, ...patch };
    updateEstimation({ ...normalized, fees });
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Estimation des coûts</h3>
        <p className="text-xs text-muted-foreground">
          Calcul interne — les marges et coûts ne sont pas visibles sur la soumission client.
        </p>
      </div>

      <CollapsibleBlock title="Main-d'œuvre">
        {normalized.labor.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-2">Type</th>
                  <th className="p-2 text-right">Heures</th>
                  <th className="p-2 text-right">Travailleurs</th>
                  <th className="p-2 text-right">Taux ($/h)</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {normalized.labor.map((line, index) => (
                  <tr key={line.id} className="border-b last:border-b-0">
                    <td className="p-2 align-top">
                      {isCustomLaborLine(line) ? (
                        <Input
                          value={line.employeeCategory ?? ""}
                          onChange={(e) =>
                            updateLaborLine(index, { employeeCategory: e.target.value })
                          }
                          placeholder="Ex: Technicien spécialisé"
                          className="min-w-[160px]"
                        />
                      ) : (
                        <Select
                            value={line.category}
                            onValueChange={(value) =>
                              updateLaborLine(index, { category: value as QuoteLaborCategory })
                            }
                          >
                            <SelectTrigger className="min-w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.keys(LABOR_CATEGORY_LABELS) as QuoteLaborCategory[]
                              )
                                .filter((key) => key !== "autre")
                                .map((key) => (
                                  <SelectItem key={key} value={key}>
                                    {LABOR_CATEGORY_LABELS[key]}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                      )}
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min="0"
                        step="0.25"
                        className="ml-auto w-20 text-right"
                        value={line.hours}
                        onChange={(e) =>
                          updateLaborLine(index, { hours: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        className="ml-auto w-16 text-right"
                        value={line.workerCount}
                        onChange={(e) =>
                          updateLaborLine(index, { workerCount: Number(e.target.value) || 1 })
                        }
                      />
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ml-auto w-24 text-right"
                        value={line.hourlyRate}
                        onChange={(e) =>
                          updateLaborLine(index, { hourlyRate: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="p-2 align-top text-right font-medium">
                      {formatCurrency(line.total)}
                    </td>
                    <td className="p-2 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateEstimation({
                            ...normalized,
                            labor: normalized.labor.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateEstimation({
                ...normalized,
                labor: [...normalized.labor, createDefaultLaborLine(laborTemplates)],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter du temps
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateEstimation({
                ...normalized,
                labor: [...normalized.labor, createCustomLaborLine(laborTemplates)],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Main-d&apos;œuvre personnalisée
          </Button>
        </div>
      </CollapsibleBlock>

      <CollapsibleBlock title="Matériaux">
        <MaterialSearchField
          onSelect={(item, costPrice) => {
            const line = createDefaultMaterialLine(defaultMargin);
            updateEstimation({
              ...normalized,
              materials: [
                ...normalized.materials,
                {
                  ...line,
                  catalogItemId: item.id || undefined,
                  name: item.name || "Matériau personnalisé",
                  description: item.description,
                  unit: item.unit || "unité",
                  costPrice,
                  isCustom: !item.id,
                },
              ],
            });
          }}
        />
        {normalized.materials.map((line, index) => (
          <div key={line.id} className="space-y-2 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nom</Label>
                <Input
                  value={line.name}
                  onChange={(e) => updateMaterialLine(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={line.description ?? ""}
                  onChange={(e) => updateMaterialLine(index, { description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Qté</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) =>
                    updateMaterialLine(index, { quantity: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Unité</Label>
                <Input
                  value={line.unit}
                  onChange={(e) => updateMaterialLine(index, { unit: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Prix coûtant ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.costPrice}
                  onChange={(e) =>
                    updateMaterialLine(index, { costPrice: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Marge (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={Math.round(line.marginPct * 100)}
                  onChange={(e) =>
                    updateMaterialLine(index, {
                      marginPct: (Number(e.target.value) || 0) / 100,
                    })
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <p className="text-sm">
                  Prix vente: {formatCurrency(line.salePrice)} · Total:{" "}
                  <span className="font-medium">{formatCurrency(line.total)}</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateEstimation({
                      ...normalized,
                      materials: normalized.materials.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CollapsibleBlock>

      <CollapsibleBlock title="Frais">
        {normalized.fees.map((line, index) => (
          <div key={line.id} className="space-y-2 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={line.feeType}
                  onValueChange={(value) =>
                    updateFeeLine(index, { feeType: value as QuoteFeeLine["feeType"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FEE_TYPE_LABELS) as QuoteFeeLine["feeType"][]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {FEE_TYPE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={line.description}
                  onChange={(e) => updateFeeLine(index, { description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Qté</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={line.quantity}
                  onChange={(e) =>
                    updateFeeLine(index, { quantity: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Prix ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.price}
                  onChange={(e) => updateFeeLine(index, { price: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Marge (%) — optionnel</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={Math.round((line.marginPct ?? 0) * 100)}
                  onChange={(e) =>
                    updateFeeLine(index, { marginPct: (Number(e.target.value) || 0) / 100 })
                  }
                />
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm font-medium">Total: {formatCurrency(line.total)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateEstimation({
                      ...normalized,
                      fees: normalized.fees.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updateEstimation({
              ...normalized,
              fees: [...normalized.fees, createDefaultFeeLine()],
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter un frais
        </Button>
      </CollapsibleBlock>

      <CollapsibleBlock title="Résumé" defaultOpen>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Main-d&apos;œuvre</span>
            <span>{formatCurrency(summary.laborSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Matériaux</span>
            <span>{formatCurrency(summary.materialsSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frais</span>
            <span>{formatCurrency(summary.feesSubtotal)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Sous-total calculé</span>
            <span>{formatCurrency(summary.calculatedSubtotal)}</span>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={manualPriceOverride}
                onChange={(e) => onManualPriceOverrideChange(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Ajuster le prix proposé au client</span>
            </label>
            {manualPriceOverride && (
              <div className="space-y-1">
                <Label htmlFor="proposedAmount">Prix proposé ($)</Label>
                <Input
                  id="proposedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                />
              </div>
            )}
            {manualPriceOverride && summary.adjustment !== 0 && (
              <p className="text-xs text-muted-foreground">
                Ajustement: {formatCurrency(summary.adjustment)}
              </p>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TPS</span>
            <span>{formatCurrency(summary.gst)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVQ</span>
            <span>{formatCurrency(summary.qst)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(summary.totalWithTaxes)}</span>
          </div>
        </div>

        {hasCostEstimationLines(normalized) && (
          <div className="mt-4 space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Affichage client (optionnel)
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={normalized.showLaborOnClient ?? false}
                onChange={(e) =>
                  updateEstimation({ ...normalized, showLaborOnClient: e.target.checked })
                }
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Afficher les lignes de main-d&apos;œuvre</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={normalized.showMaterialsOnClient ?? false}
                onChange={(e) =>
                  updateEstimation({ ...normalized, showMaterialsOnClient: e.target.checked })
                }
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Afficher les lignes de matériaux</span>
            </label>
          </div>
        )}
      </CollapsibleBlock>
    </div>
  );
}
