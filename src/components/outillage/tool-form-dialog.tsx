"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createToolAction, updateToolAction } from "@/lib/actions/tools";
import { TOOL_CATEGORIES, TOOL_CONDITION_LABELS } from "@/lib/tool-utils";
import type { Tool, ToolBaseStatus, ToolCondition } from "@/types";
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
const textareaClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface ToolFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  tool?: Tool;
  isDemo?: boolean;
  onSave: (tool: Tool) => void;
}

export function ToolFormDialog({
  open,
  onOpenChange,
  mode,
  tool,
  isDemo,
  onSave,
}: ToolFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Perceuse");
  const [customCategory, setCustomCategory] = useState("");
  const [condition, setCondition] = useState<ToolCondition>("good");
  const [baseStatus, setBaseStatus] = useState<ToolBaseStatus>("available");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (tool && mode === "edit") {
      const preset = TOOL_CATEGORIES.includes(tool.category as (typeof TOOL_CATEGORIES)[number])
        ? tool.category
        : "Autre";
      setCategory(preset);
      setCustomCategory(preset === "Autre" ? tool.category : "");
      setCondition(tool.condition);
      setBaseStatus(tool.baseStatus);
    } else {
      setCategory("Perceuse");
      setCustomCategory("");
      setCondition("good");
      setBaseStatus("available");
    }
  }, [open, tool, mode]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);
    if (category === "Autre") formData.set("customCategory", customCategory);
    formData.set("condition", condition);
    formData.set("baseStatus", baseStatus);

    startTransition(async () => {
      if (isDemo) {
        const demoTool: Tool = {
          id: tool?.id ?? `tool-${Date.now()}`,
          companyId: tool?.companyId ?? "",
          name: String(formData.get("name") ?? ""),
          category: category === "Autre" ? customCategory : category,
          brand: String(formData.get("brand") ?? ""),
          model: String(formData.get("model") ?? ""),
          serialNumber: String(formData.get("serialNumber") ?? ""),
          internalNumber: String(formData.get("internalNumber") ?? ""),
          description: String(formData.get("description") ?? ""),
          condition,
          baseStatus,
          createdAt: tool?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onSave(demoTool);
        onOpenChange(false);
        return;
      }

      const result =
        mode === "edit" && tool
          ? await updateToolAction(tool.id, formData)
          : await createToolAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSave(result.tool);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Ajouter un outil" : "Modifier l'outil"}</DialogTitle>
          <DialogDescription>
            Inventaire partagé de l&apos;entreprise — numéro interne, catégorie et état.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" name="name" required defaultValue={tool?.name} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {category === "Autre" && (
              <div className="space-y-2">
                <Label htmlFor="customCategory">Catégorie personnalisée</Label>
                <Input
                  id="customCategory"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand">Marque</Label>
              <Input id="brand" name="brand" defaultValue={tool?.brand} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modèle</Label>
              <Input id="model" name="model" defaultValue={tool?.model} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Numéro de série</Label>
              <Input id="serialNumber" name="serialNumber" defaultValue={tool?.serialNumber} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalNumber">Numéro interne</Label>
              <Input id="internalNumber" name="internalNumber" defaultValue={tool?.internalNumber} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={tool?.description}
              rows={2}
              className={textareaClassName}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as ToolCondition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TOOL_CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut initial</Label>
              <Select value={baseStatus} onValueChange={(v) => setBaseStatus(v as ToolBaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="in_repair">En réparation</SelectItem>
                  <SelectItem value="out_of_service">Hors service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Ajouter" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
