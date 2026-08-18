"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { sendToolSmsAction } from "@/lib/actions/tools";
import { buildOverdueSmsTemplate } from "@/lib/tool-utils";
import type { Company, ToolWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
const textareaClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
import { formatDate } from "@/lib/utils";

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: ToolWithDetails;
  company: Company;
  isDemo?: boolean;
  onSent: (tool: ToolWithDetails) => void;
}

export function SendSmsDialog({
  open,
  onOpenChange,
  tool,
  company,
  isDemo,
  onSent,
}: SendSmsDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const phone = tool?.currentAssignment?.employeePhone ?? "";
  const hasPhone = Boolean(phone.trim());
  const employeeName = tool?.currentAssignment?.employeeName ?? "";
  const firstName = employeeName.split(" ")[0] ?? employeeName;

  useEffect(() => {
    if (!open || !tool?.currentAssignment) return;
    setError("");
    setMessage(
      buildOverdueSmsTemplate({
        employeeFirstName: firstName,
        toolName: tool.name,
        internalNumber: tool.internalNumber || "N/A",
        expectedReturnDate: formatDate(tool.currentAssignment.expectedReturnDate),
        companyName: company.name,
      }),
    );
  }, [open, tool, company.name, firstName]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tool || !hasPhone) return;

    const formData = new FormData(e.currentTarget);
    formData.set("message", message);

    startTransition(async () => {
      if (isDemo) {
        if (tool) onSent(tool);
        onOpenChange(false);
        return;
      }

      const result = await sendToolSmsAction(tool.id, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSent(result.tool);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Envoyer un SMS
          </DialogTitle>
          <DialogDescription>
            Rappel manuel pour {employeeName || "l'employé"} — {tool?.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Téléphone</p>
            <p className={hasPhone ? "text-muted-foreground" : "text-destructive"}>
              {hasPhone ? phone : "Aucun numéro de téléphone"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              rows={5}
              disabled={!hasPhone}
              required
              className={textareaClassName}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !hasPhone}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
