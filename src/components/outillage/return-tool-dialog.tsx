"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { returnToolAction } from "@/lib/actions/tools";
import { TOOL_CONDITION_LABELS } from "@/lib/tool-utils";
import type { ToolReturnCondition, ToolWithDetails } from "@/types";
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
import { format } from "date-fns";

interface ReturnToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: ToolWithDetails;
  isDemo?: boolean;
  onReturned: (tool: ToolWithDetails) => void;
}

export function ReturnToolDialog({
  open,
  onOpenChange,
  tool,
  isDemo,
  onReturned,
}: ReturnToolDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [returnCondition, setReturnCondition] = useState<ToolReturnCondition>("good");
  const [setInRepair, setSetInRepair] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setReturnCondition("good");
    setSetInRepair(false);
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tool?.currentAssignment) return;

    const formData = new FormData(e.currentTarget);
    formData.set("returnCondition", returnCondition);
    formData.set("setInRepair", setInRepair ? "true" : "false");

    startTransition(async () => {
      if (isDemo) {
        if (!tool) return;
        onReturned({
          ...tool,
          effectiveStatus: tool.baseStatus === "in_repair" ? "in_repair" : "available",
          currentAssignment: undefined,
          futureReservations: tool.futureReservations ?? [],
        });
        onOpenChange(false);
        return;
      }

      const result = await returnToolAction(
        tool.id,
        tool.currentAssignment!.id,
        formData,
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      onReturned(result.tool);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retour d&apos;outil</DialogTitle>
          <DialogDescription>
            Enregistrer le retour de {tool?.name ?? "l'outil"} — l&apos;historique sera conservé.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actualReturnDate">Date de retour</Label>
            <Input
              id="actualReturnDate"
              name="actualReturnDate"
              type="date"
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>État au retour</Label>
            <Select
              value={returnCondition}
              onValueChange={(v) => setReturnCondition(v as ToolReturnCondition)}
            >
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
          <div className="flex items-center gap-2">
            <input
              id="setInRepair"
              type="checkbox"
              checked={setInRepair}
              onChange={(e) => setSetInRepair(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="setInRepair" className="font-normal">
              Mettre l&apos;outil en réparation
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" rows={2} className={textareaClassName} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer le retour
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
