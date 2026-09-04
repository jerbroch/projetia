"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import {
  addCustomLaborLineAction,
  addDiversLineAction,
  addLaborLineAction,
  addMaterialLineAction,
  generateInvoiceFromBillingAction,
  loadBillingSheetAction,
  removeBillingLineAction,
  searchMaterialsAction,
  updateBillingLineAction,
  updateCatalogCustomPriceAction,
  updateSheetMaterialMarginAction,
} from "@/lib/actions/billing";
import {
  calculateBillingTotals,
  canViewBillingPrices,
  DEFAULT_MATERIAL_MARGIN,
} from "@/lib/billing-utils";
import { messageLignesAZero } from "@/lib/lignes-a-zero";
import {
  createDemoBillingLine,
  createDemoBillingSheet,
  formatEffectivePrice,
  formatLaborBillRate,
  getDefaultDemoLaborTemplates,
  getDemoBillingSheet,
  getDemoLaborTemplates,
  searchDemoMaterialCatalog,
  upsertDemoBillingSheet,
} from "@/lib/demo/billing";
import { getJobDisplayNumber } from "@/lib/job-utils";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldImportBanner } from "@/components/billing/field-import-banner";
import { PiecesJointesSection } from "@/components/shared/pieces-jointes-section";
import { changerGabaritLigneAction } from "@/lib/actions/billing-field-import";
import { formatCurrency } from "@/lib/utils";
import type {
  Company,
  JobBillingLine,
  JobBillingSheet,
  LaborRateTemplate,
  MaterialCatalogItem,
  ProfileRole,
  ScheduleEvent,
} from "@/types";

interface JobBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent;
  company: Company;
  membershipRole: ProfileRole;
  isDemo?: boolean;
  onInvoiceGenerated?: (invoiceNumber: string) => void;
  /** Field worker mode — no invoice generation */
  fieldMode?: boolean;
  /** Manager review mode — billing edits only */
  reviewMode?: boolean;
  /** Archives mode — allow editing invoiced sheets and sync to invoice */
  archiveMode?: boolean;
  onBillingUpdated?: () => void;
}

export function JobBillingDialog({
  open,
  onOpenChange,
  event,
  company,
  membershipRole,
  isDemo,
  onInvoiceGenerated,
  fieldMode,
  reviewMode,
  archiveMode,
  onBillingUpdated,
}: JobBillingDialogProps) {
  const showPrices = canViewBillingPrices(membershipRole);

  const [sheet, setSheet] = useState<JobBillingSheet | null>(null);
  const [laborTemplates, setLaborTemplates] = useState<LaborRateTemplate[]>([]);
  const [defaultMargin, setDefaultMargin] = useState(DEFAULT_MATERIAL_MARGIN);
  const [quoteNumber, setQuoteNumber] = useState<string | undefined>();
  const [depositApplied, setDepositApplied] = useState(0);
  const [sheetMarginInput, setSheetMarginInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [laborHours, setLaborHours] = useState("1");

  const [customLaborOpen, setCustomLaborOpen] = useState(false);
  const [customLaborDesc, setCustomLaborDesc] = useState("");
  const [customLaborHours, setCustomLaborHours] = useState("1");
  const [customLaborWorkers, setCustomLaborWorkers] = useState("1");
  const [customLaborRate, setCustomLaborRate] = useState("");

  const [materialQuery, setMaterialQuery] = useState("");
  const [materialResults, setMaterialResults] = useState<MaterialCatalogItem[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialCatalogItem | null>(null);
  const [materialQty, setMaterialQty] = useState("1");
  const [materialPriceInput, setMaterialPriceInput] = useState("");
  const [searching, setSearching] = useState(false);

  const [diversOpen, setDiversOpen] = useState(false);
  const [diversDesc, setDiversDesc] = useState("");
  const [diversQty, setDiversQty] = useState("1");
  const [diversPrice, setDiversPrice] = useState("");
  const [diversAddToCatalog, setDiversAddToCatalog] = useState(false);

  const loadSheet = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError("");

    if (isDemo) {
      const templates = getDemoLaborTemplates(company.id);
      setLaborTemplates(templates.length ? templates : getDefaultDemoLaborTemplates(company.id));
      const margin = company.defaultMaterialMargin ?? DEFAULT_MATERIAL_MARGIN;
      setDefaultMargin(margin);
      setSheetMarginInput(String(Math.round(margin * 100)));
      let demoSheet = getDemoBillingSheet(event.id);
      if (!demoSheet) demoSheet = createDemoBillingSheet(company.id, event.id);
      setSheet(demoSheet);
      setLoading(false);
      return;
    }

    const result = await loadBillingSheetAction(event.id);
    setLoading(false);
    if (!result.success) {
      setError("error" in result ? result.error : "Erreur de chargement");
      return;
    }
    if (!result.data) {
      setError("Erreur de chargement");
      return;
    }
    setSheet(result.data.sheet);
    setLaborTemplates(result.data.laborTemplates);
    setDefaultMargin(result.data.defaultMargin);
    setQuoteNumber(result.data.quoteNumber);
    setDepositApplied(result.data.depositApplied ?? 0);
    const marginPct = result.data.sheet.materialMarginPct ?? result.data.defaultMargin;
    setSheetMarginInput(String(Math.round(marginPct * 100)));
    if (reviewMode) onBillingUpdated?.();
  }, [open, isDemo, company.id, company.defaultMaterialMargin, event.id, reviewMode, onBillingUpdated]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  useEffect(() => {
    if (materialQuery.trim().length < 3) {
      setMaterialResults([]);
      return;
    }
    if (isDemo) {
      setMaterialResults(searchDemoMaterialCatalog(materialQuery));
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await searchMaterialsAction({ query: materialQuery });
      setSearching(false);
      if (result.success && result.data) setMaterialResults(result.data.items);
    }, 300);
    return () => clearTimeout(timer);
  }, [materialQuery, isDemo]);

  useEffect(() => {
    if (selectedMaterial) {
      const price = selectedMaterial.effectivePrice ?? selectedMaterial.unitCost;
      setMaterialPriceInput(price != null && price > 0 ? String(price) : "");
    }
  }, [selectedMaterial]);

  function recalcDemoSheet(lines: JobBillingLine[], marginPct?: number): JobBillingSheet {
    const margin = marginPct ?? (sheet?.materialMarginPct ?? defaultMargin);
    const inputs = lines.map((l) => ({
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unitCost: l.unitCost,
      unitSellPrice: l.unitSellPrice,
      marginPct: l.marginPct,
    }));
    const totals = calculateBillingTotals(inputs, company, margin);
    return {
      ...createDemoBillingSheet(company.id, event.id),
      ...sheet,
      lines,
      materialCostSubtotal: totals.materialCostSubtotal,
      materialSubtotal: totals.materialSubtotal,
      materialMarginPct: margin,
      laborSubtotal: totals.laborSubtotal,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      qstAmount: totals.qst,
      total: totals.total,
    } as JobBillingSheet;
  }

  function handleAddLabor() {
    const hours = parseFloat(laborHours);
    if (!selectedTemplate || !hours || hours <= 0) {
      setError("Sélectionnez un modèle et des heures valides.");
      return;
    }
    setError("");

    const template = laborTemplates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    if (isDemo) {
      const line = createDemoBillingLine({
        billingSheetId: sheet?.id ?? "",
        lineType: "labor",
        description: `${template.name} (${template.workerCount} compagnon${template.workerCount > 1 ? "s" : ""} × ${hours} h)`,
        quantity: hours,
        unitCost: template.costPerHr,
        unitSellPrice: template.billRate,
        marginPct: template.marginPct,
        lineTotal: hours * template.billRate,
        laborTemplateId: template.id,
        sortOrder: sheet?.lines.length ?? 0,
      });
      const updated = recalcDemoSheet([...(sheet?.lines ?? []), line]);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      return;
    }

    startTransition(async () => {
      const result = await addLaborLineAction({
        jobId: event.id,
        templateId: selectedTemplate,
        hours,
      });
      if (!result.success) setError(result.error);
      else if (result.data) setSheet(result.data);
    });
  }

  function handleAddCustomLabor() {
    const hours = parseFloat(customLaborHours);
    const workerCount = parseInt(customLaborWorkers, 10);
    const hourlyRate = showPrices ? parseFloat(customLaborRate) : 0;
    if (!customLaborDesc.trim() || !hours || hours <= 0) {
      setError("Description et heures valides requises.");
      return;
    }
    if (showPrices && (!hourlyRate || hourlyRate <= 0)) {
      setError("Taux horaire requis.");
      return;
    }
    setError("");

    const effectiveRate = hourlyRate * Math.max(1, workerCount || 1);

    if (isDemo) {
      const line = createDemoBillingLine({
        billingSheetId: sheet?.id ?? "",
        lineType: "labor",
        description: `${customLaborDesc.trim()} (${Math.max(1, workerCount || 1)} travailleur${(workerCount || 1) > 1 ? "s" : ""} × ${hours} h)`,
        quantity: hours,
        unitCost: 0,
        unitSellPrice: effectiveRate,
        marginPct: 0,
        lineTotal: hours * effectiveRate,
        sortOrder: sheet?.lines.length ?? 0,
      });
      const updated = recalcDemoSheet([...(sheet?.lines ?? []), line]);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      setCustomLaborOpen(false);
      setCustomLaborDesc("");
      setCustomLaborHours("1");
      setCustomLaborWorkers("1");
      setCustomLaborRate("");
      return;
    }

    startTransition(async () => {
      const result = await addCustomLaborLineAction({
        jobId: event.id,
        description: customLaborDesc.trim(),
        hours,
        workerCount: Math.max(1, workerCount || 1),
        hourlyRate,
      });
      if (!result.success) setError(result.error);
      else if (result.data) {
        setSheet(result.data);
        setCustomLaborOpen(false);
        setCustomLaborDesc("");
        setCustomLaborHours("1");
        setCustomLaborWorkers("1");
        setCustomLaborRate("");
      }
    });
  }

  function handleAddMaterial() {
    const qty = parseFloat(materialQty);
    if (!selectedMaterial || !qty || qty <= 0) {
      setError("Sélectionnez un matériel et une quantité valide.");
      return;
    }
    setError("");

    const unitPrice = showPrices && materialPriceInput
      ? parseFloat(materialPriceInput)
      : selectedMaterial.effectivePrice ?? selectedMaterial.unitCost ?? 0;

    if (isDemo) {
      const line = createDemoBillingLine({
        billingSheetId: sheet?.id ?? "",
        lineType: "material",
        description: selectedMaterial.name,
        quantity: qty,
        unitCost: unitPrice,
        unitSellPrice: unitPrice,
        lineTotal: qty * unitPrice,
        catalogItemId: selectedMaterial.id,
        sortOrder: sheet?.lines.length ?? 0,
      });
      const updated = recalcDemoSheet([...(sheet?.lines ?? []), line]);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      setSelectedMaterial(null);
      setMaterialQuery("");
      return;
    }

    startTransition(async () => {
      if (showPrices && materialPriceInput && selectedMaterial) {
        const priceResult = await updateCatalogCustomPriceAction({
          catalogItemId: selectedMaterial.id,
          customPrice: parseFloat(materialPriceInput),
        });
        if (!priceResult.success) {
          setError(priceResult.error);
          return;
        }
      }
      const result = await addMaterialLineAction({
        jobId: event.id,
        catalogItemId: selectedMaterial.id,
        quantity: qty,
        unitPrice: unitPrice > 0 ? unitPrice : undefined,
      });
      if (!result.success) setError(result.error);
      else if (result.data) {
        setSheet(result.data);
        setSelectedMaterial(null);
        setMaterialQuery("");
      }
    });
  }

  function handleAddDivers() {
    const qty = parseFloat(diversQty);
    if (!diversDesc.trim() || !qty || qty <= 0) {
      setError("Description et quantité requises pour Divers.");
      return;
    }
    const unitPrice = showPrices ? parseFloat(diversPrice) : 0;
    if (showPrices && (!unitPrice || unitPrice <= 0)) {
      setError("Prix unitaire requis.");
      return;
    }
    setError("");

    if (isDemo) {
      const line = createDemoBillingLine({
        billingSheetId: sheet?.id ?? "",
        lineType: "material",
        description: diversDesc.trim(),
        quantity: qty,
        unitCost: unitPrice,
        unitSellPrice: unitPrice,
        lineTotal: qty * unitPrice,
        isDivers: true,
        sortOrder: sheet?.lines.length ?? 0,
      });
      const updated = recalcDemoSheet([...(sheet?.lines ?? []), line]);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      setDiversOpen(false);
      setDiversDesc("");
      setDiversQty("1");
      setDiversPrice("");
      setDiversAddToCatalog(false);
      return;
    }

    startTransition(async () => {
      const result = await addDiversLineAction({
        jobId: event.id,
        description: diversDesc.trim(),
        quantity: qty,
        unitPrice,
        addToCatalog: diversAddToCatalog,
      });
      if (!result.success) setError(result.error);
      else if (result.data) {
        setSheet(result.data);
        setDiversOpen(false);
        setDiversDesc("");
        setDiversQty("1");
        setDiversPrice("");
        setDiversAddToCatalog(false);
      }
    });
  }

  function handleRemoveLine(lineId: string) {
    if (isDemo) {
      const updated = recalcDemoSheet((sheet?.lines ?? []).filter((l) => l.id !== lineId));
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      return;
    }
    startTransition(async () => {
      const result = await removeBillingLineAction({ jobId: event.id, lineId });
      if (!result.success) setError(result.error);
      else if (result.data) setSheet(result.data);
    });
  }

  function handleUpdateLinePrice(lineId: string, unitPrice: number) {
    if (isDemo) {
      const lines = (sheet?.lines ?? []).map((l) =>
        l.id === lineId
          ? { ...l, unitCost: unitPrice, unitSellPrice: unitPrice, lineTotal: l.quantity * unitPrice }
          : l
      );
      const updated = recalcDemoSheet(lines);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      return;
    }
    startTransition(async () => {
      const result = await updateBillingLineAction({ jobId: event.id, lineId, unitPrice });
      if (!result.success) setError(result.error);
      else if (result.data) setSheet(result.data);
    });
  }

  function handleSaveSheetMargin() {
    const pct = parseFloat(sheetMarginInput) / 100;
    if (Number.isNaN(pct) || pct < 0) {
      setError("Marge invalide.");
      return;
    }
    if (isDemo) {
      const updated = recalcDemoSheet(sheet?.lines ?? [], pct);
      setSheet(updated);
      upsertDemoBillingSheet(updated);
      setDefaultMargin(pct);
      return;
    }
    startTransition(async () => {
      const result = await updateSheetMaterialMarginAction({ jobId: event.id, marginPct: pct });
      if (!result.success) setError(result.error);
      else if (result.data) setSheet(result.data);
    });
  }

  /**
   * Confirmation en attente avant d'émettre avec des lignes à 0 $.
   *
   * Un zéro est parfois voulu — matériel fourni par le client, reprise sous
   * garantie, extra offert — donc on ne bloque pas. Mais un zéro oublié part
   * chez le client : douze paquets de bardeau facturés zéro dollar. On nomme
   * ce qui part à zéro, et on laisse trancher.
   */
  const [zeroAConfirmer, setZeroAConfirmer] = useState<string | null>(null);

  function handleGenerateInvoice() {
    if (isDemo) {
      setMessage("Facture FA-DEMO-001 créée (mode démo).");
      onInvoiceGenerated?.("FA-DEMO-001");
      return;
    }
    const alerte = messageLignesAZero(
      (sheet?.lines ?? []).map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitSellPrice: l.unitSellPrice,
        lineTotal: l.lineTotal,
      })),
      sheet?.total ?? 0,
    );
    if (alerte && !zeroAConfirmer) {
      setZeroAConfirmer(alerte);
      return;
    }
    setZeroAConfirmer(null);
    emettre();
  }

  function emettre() {
    // Refermer la confirmation AVANT d'émettre : la laisser ouverte donnerait
    // à croire que rien n'a été fait, et invite à cliquer une seconde fois.
    setZeroAConfirmer(null);
    startTransition(async () => {
      const result = await generateInvoiceFromBillingAction(event.id);
      if (!result.success) setError(result.error);
      else if (result.data) {
        setMessage(`Facture ${result.data.invoiceNumber} créée.`);
        onInvoiceGenerated?.(result.data.invoiceNumber);
        await loadSheet();
      }
    });
  }

  const jobDate = format(parseISO(event.start), "d MMMM yyyy", { locale: fr });
  const laborLines = sheet?.lines.filter((l) => l.lineType === "labor") ?? [];
  const materialLines = sheet?.lines.filter((l) => l.lineType === "material") ?? [];
  const isInvoiced = sheet?.status === "invoiced";
  const isLocked = isInvoiced && !archiveMode;

  // Le terrain dit COMBIEN d'heures ; la facturation dit À QUEL TAUX. Changer
  // le gabarit d'une ligne est donc une décision de bureau, prise en facturant.
  function appliquerGabarit(lineId: string, templateId: string) {
    startTransition(async () => {
      const r = await changerGabaritLigneAction({ jobId: event.id, lineId, templateId });
      if (!r.success) { setError(r.error); return; }
      await loadSheet();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isPending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturation — {getJobDisplayNumber(event)}
          </DialogTitle>
          <DialogDescription>
            {event.customerName ?? "—"} · {event.jobSiteAddress ?? event.location ?? "—"}
          </DialogDescription>
        </DialogHeader>
        {event?.id && (
          <FieldImportBanner jobId={event.id} onImported={() => void loadSheet()} />
        )}

        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-medium">{event.customerName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Adresse</p>
            <p className="font-medium">{event.jobSiteAddress ?? event.location ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">P.O. client</p>
            <p className="font-medium">{event.clientPoNumber ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Soumission</p>
            <p className="font-medium">{quoteNumber ?? (event.quoteId ? "Liée" : "—")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date · Employés</p>
            <p className="font-medium">
              {jobDate}
              {event.employeeNames.length > 0 && ` · ${event.employeeNames.join(", ")}`}
            </p>
          </div>
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {message && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{message}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Tabs defaultValue="labor">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="labor">Main-d&apos;œuvre</TabsTrigger>
                <TabsTrigger value="material">Matériel</TabsTrigger>
                <TabsTrigger value="pieces">Pièces jointes</TabsTrigger>
              </TabsList>

              <TabsContent value="labor" className="space-y-4">
                {!isLocked && (
                  <>
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                      <div className="min-w-[200px] flex-1 space-y-1">
                        <Label>Modèle</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un modèle" />
                          </SelectTrigger>
                          <SelectContent>
                            {laborTemplates.map((t: LaborRateTemplate) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                                {showPrices && ` — ${formatLaborBillRate(t.billRate)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24 space-y-1">
                        <Label>Heures</Label>
                        <Input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={laborHours}
                          onChange={(e) => setLaborHours(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleAddLabor} disabled={isPending}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>

                    {!customLaborOpen ? (
                      <Button variant="outline" size="sm" onClick={() => setCustomLaborOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Main-d&apos;œuvre personnalisée
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-md border border-dashed p-3">
                        <p className="text-sm font-medium">Main-d&apos;œuvre personnalisée</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                            <Label>Description</Label>
                            <Input
                              value={customLaborDesc}
                              onChange={(e) => setCustomLaborDesc(e.target.value)}
                              placeholder="Ex: Technicien spécialisé, Équipe de nuit"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Heures</Label>
                            <Input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={customLaborHours}
                              onChange={(e) => setCustomLaborHours(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Travailleurs</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={customLaborWorkers}
                              onChange={(e) => setCustomLaborWorkers(e.target.value)}
                            />
                          </div>
                          {showPrices && (
                            <div className="space-y-1">
                              <Label>Taux ($/h)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customLaborRate}
                                onChange={(e) => setCustomLaborRate(e.target.value)}
                                placeholder="185.00"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddCustomLabor} disabled={isPending} size="sm">
                            Ajouter
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setCustomLaborOpen(false)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <BillingLinesTable
                  lines={laborLines}
                  onRemove={handleRemoveLine}
                  onUpdatePrice={showPrices ? handleUpdateLinePrice : undefined}
                  disabled={isLocked}
                  showPrices={showPrices}
                  laborTemplates={laborTemplates}
                  onChangeTemplate={appliquerGabarit}
                />
              </TabsContent>

              <TabsContent value="material" className="space-y-4">
                {!isLocked && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="space-y-1">
                      <Label>Rechercher matériel (min. 3 car.)</Label>
                      <Input
                        value={materialQuery}
                        onChange={(e) => setMaterialQuery(e.target.value)}
                        placeholder="Ex: coude cuivre 1/2"
                      />
                    </div>
                    {searching && <p className="text-sm text-muted-foreground">Recherche…</p>}
                    {materialResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded border">
                        {materialResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                            onClick={() => setSelectedMaterial(item)}
                          >
                            <span>
                              {item.name}
                              {item.diameter && ` · ${item.diameter}`}
                            </span>
                            {showPrices && (
                              <span className="text-muted-foreground">
                                {formatEffectivePrice(item.effectivePrice ?? item.unitCost)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedMaterial && (
                      <div className="flex flex-wrap items-end gap-2">
                        <p className="text-sm">
                          Sélectionné : <strong>{selectedMaterial.name}</strong>
                          {selectedMaterial.diameter && ` · ${selectedMaterial.diameter}`}
                        </p>
                        <div className="w-24 space-y-1">
                          <Label>Qté</Label>
                          <Input
                            type="number"
                            min="1"
                            value={materialQty}
                            onChange={(e) => setMaterialQty(e.target.value)}
                          />
                        </div>
                        {showPrices && (
                          <div className="w-28 space-y-1">
                            <Label>Prix unitaire ($)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={materialPriceInput}
                              onChange={(e) => setMaterialPriceInput(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                        <Button onClick={handleAddMaterial} disabled={isPending}>
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter
                        </Button>
                      </div>
                    )}

                    <Separator />

                    {!diversOpen ? (
                      <Button variant="outline" size="sm" onClick={() => setDiversOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Divers
                      </Button>
                    ) : (
                      <div className="space-y-3 rounded-md border border-dashed p-3">
                        <p className="text-sm font-medium">+ Divers</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Description</Label>
                            <Input
                              value={diversDesc}
                              onChange={(e) => setDiversDesc(e.target.value)}
                              placeholder="Pièce spéciale, adaptateur, etc."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Quantité</Label>
                            <Input
                              type="number"
                              min="1"
                              value={diversQty}
                              onChange={(e) => setDiversQty(e.target.value)}
                            />
                          </div>
                          {showPrices && (
                            <div className="space-y-1">
                              <Label>Prix unitaire ($)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={diversPrice}
                                onChange={(e) => setDiversPrice(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        {showPrices && (
                          <div className="flex items-center gap-2">
                            <input
                              id="diversCatalog"
                              type="checkbox"
                              checked={diversAddToCatalog}
                              onChange={(e) => setDiversAddToCatalog(e.target.checked)}
                              className="h-4 w-4 rounded border"
                            />
                            <Label htmlFor="diversCatalog" className="text-sm font-normal">
                              Ajouter cette pièce au catalogue
                            </Label>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={handleAddDivers} disabled={isPending} size="sm">
                            Ajouter Divers
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDiversOpen(false)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <BillingLinesTable
                  lines={materialLines}
                  onRemove={handleRemoveLine}
                  onUpdatePrice={showPrices ? handleUpdateLinePrice : undefined}
                  disabled={isLocked}
                  showPrices={showPrices}
                  materialOnly
                  laborTemplates={laborTemplates}
                  onChangeTemplate={appliquerGabarit}
                />
              </TabsContent>

              <TabsContent value="pieces" className="space-y-4">
                <PiecesJointesSection scheduledJobId={event.id} />
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-1 text-sm">
              {showPrices && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Coût matériel</span>
                    <span>{formatCurrency(sheet?.materialCostSubtotal ?? 0)}</span>
                  </div>
                  {!isLocked && (
                    <div className="flex flex-wrap items-end gap-2 py-2">
                      <div className="w-32 space-y-1">
                        <Label htmlFor="sheetMargin">Marge matériaux (%)</Label>
                        <Input
                          id="sheetMargin"
                          type="number"
                          min="0"
                          value={sheetMarginInput}
                          onChange={(e) => setSheetMarginInput(e.target.value)}
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={handleSaveSheetMargin} disabled={isPending}>
                        Appliquer marge
                      </Button>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matériel {showPrices ? "(facturé)" : ""}</span>
                {showPrices && <span>{formatCurrency(sheet?.materialSubtotal ?? 0)}</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Main-d&apos;œuvre</span>
                {showPrices && <span>{formatCurrency(sheet?.laborSubtotal ?? 0)}</span>}
              </div>
              {showPrices && (
                <>
                  <div className="flex justify-between font-medium">
                    <span>Sous-total</span>
                    <span>{formatCurrency(sheet?.subtotal ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>TPS</span>
                    <span>{formatCurrency(sheet?.gstAmount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>TVQ</span>
                    <span>{formatCurrency(sheet?.qstAmount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total des travaux</span>
                    <span>{formatCurrency(sheet?.total ?? 0)}</span>
                  </div>
                  {depositApplied > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Dépôt déjà payé</span>
                      <span>−{formatCurrency(depositApplied)}</span>
                    </div>
                  )}
                  {depositApplied > 0 && (
                    <div className="flex justify-between text-lg font-bold text-primary">
                      <span>Solde à payer</span>
                      <span>{formatCurrency(Math.max(0, (sheet?.total ?? 0) - depositApplied))}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {!fieldMode && !reviewMode && showPrices && !isLocked && !loading && (
            <Button onClick={handleGenerateInvoice} disabled={isPending || (sheet?.lines.length ?? 0) === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Générer la facture
            </Button>
          )}
          {isInvoiced && showPrices && !fieldMode && archiveMode && (
            <p className="text-sm text-muted-foreground">
              Mode archives — les modifications sont enregistrées sur la même facture.
            </p>
          )}
          {isInvoiced && showPrices && !fieldMode && !archiveMode && (
            <p className="text-sm text-muted-foreground">Facture générée — consultez le module Factures.</p>
          )}
        </DialogFooter>
      </DialogContent>
      <Dialog open={zeroAConfirmer !== null} onOpenChange={(o) => !o && setZeroAConfirmer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Des lignes partent à 0 $</DialogTitle>
            <DialogDescription>{zeroAConfirmer}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setZeroAConfirmer(null)} disabled={isPending}>
              Corriger les prix
            </Button>
            <Button onClick={emettre} disabled={isPending}>
              Émettre quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
}

function BillingLinesTable({
  lines,
  onRemove,
  onUpdatePrice,
  disabled,
  showPrices,
  materialOnly,
  laborTemplates = [],
  onChangeTemplate,
}: {
  lines: JobBillingLine[];
  onRemove: (id: string) => void;
  onUpdatePrice?: (lineId: string, unitPrice: number) => void;
  disabled?: boolean;
  showPrices?: boolean;
  materialOnly?: boolean;
  /** Gabarits proposés sur chaque ligne de main-d'œuvre. */
  laborTemplates?: LaborRateTemplate[];
  onChangeTemplate?: (lineId: string, templateId: string) => void;
}) {
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  if (lines.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Aucune ligne</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="p-2">Description</th>
            <th className="p-2 text-right">Qté</th>
            {showPrices && materialOnly && <th className="p-2 text-right">Prix unit.</th>}
            {showPrices && !materialOnly && (
              <>
                <th className="p-2 text-right">Coût</th>
                <th className="p-2 text-right">Prix vente</th>
              </>
            )}
            {showPrices && <th className="p-2 text-right">Total</th>}
            {!disabled && <th className="p-2 w-10" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            // UNE LIGNE À CHIFFRER SE VOIT DE LOIN. Un badge discret se rate
            // quand la feuille en compte quinze ; un matériau posé et non
            // facturé est une perte sèche. La rangée entière est teintée.
            const aChiffrer = Boolean(line.signaleParEmploye) || (Boolean(line.sourceKind) && line.unitSellPrice <= 0);
            return (
            <tr key={line.id} className={aChiffrer ? "border-b bg-amber-500/10" : "border-b"}>
              <td className="p-2">
                {line.description}
                {/* Une ligne venue du terrain se distingue d'une ligne tapée à la
                    main : c'est elle qu'un réimport peut remplacer. */}
                {line.sourceKind && (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    terrain{line.manuallyEdited ? " · retouchée" : ""}
                  </span>
                )}
                {aChiffrer && (
                  <span className="ml-2 rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                    {line.signaleParEmploye ? "signalé du terrain · à chiffrer" : "prix à saisir"}
                  </span>
                )}
                {line.lineType === "labor" && laborTemplates.length > 1 && (
                  <select
                    aria-label={`Gabarit — ${line.description}`}
                    className="mt-1 block w-full rounded border bg-background px-1 py-0.5 text-xs"
                    value={line.laborTemplateId ?? ""}
                    onChange={(e) => onChangeTemplate?.(line.id, e.target.value)}
                    disabled={disabled}
                  >
                    <option value="" disabled>
                      Choisir un taux
                    </option>
                    {laborTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {formatCurrency(t.billRate)}/h
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="p-2 text-right">{line.quantity}</td>
              {showPrices && materialOnly && (
                <td className="p-2 text-right">
                  {!disabled && onUpdatePrice ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="ml-auto h-8 w-24 text-right"
                      value={editingPrice[line.id] ?? String(line.unitCost)}
                      onChange={(e) =>
                        setEditingPrice((prev) => ({ ...prev, [line.id]: e.target.value }))
                      }
                      onBlur={() => {
                        const val = parseFloat(editingPrice[line.id] ?? String(line.unitCost));
                        if (!Number.isNaN(val) && val >= 0 && val !== line.unitCost) {
                          onUpdatePrice(line.id, val);
                        }
                      }}
                    />
                  ) : (
                    formatCurrency(line.unitCost)
                  )}
                </td>
              )}
              {showPrices && !materialOnly && (
                <>
                  <td className="p-2 text-right">{formatCurrency(line.unitCost)}</td>
                  <td className="p-2 text-right">
                    {!disabled && onUpdatePrice ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ml-auto h-8 w-24 text-right"
                        value={editingPrice[line.id] ?? String(line.unitSellPrice)}
                        onChange={(e) =>
                          setEditingPrice((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                        onBlur={() => {
                          const val = parseFloat(
                            editingPrice[line.id] ?? String(line.unitSellPrice)
                          );
                          if (!Number.isNaN(val) && val >= 0 && val !== line.unitSellPrice) {
                            onUpdatePrice(line.id, val);
                          }
                        }}
                      />
                    ) : (
                      formatCurrency(line.unitSellPrice)
                    )}
                  </td>
                </>
              )}
              {showPrices && (
                <td className="p-2 text-right font-medium">{formatCurrency(line.lineTotal)}</td>
              )}
              {!disabled && (
                <td className="p-2">
                  <Button variant="ghost" size="sm" onClick={() => onRemove(line.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
