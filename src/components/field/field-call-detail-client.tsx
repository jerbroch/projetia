"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import {
  completeFieldWorkAction,
  getFieldCompletionPreviewAction,
  saveFieldHourAction,
  saveFieldMaterialAction,
  updateFieldJobStatusAction,
  updateFieldNotesAction,
} from "@/lib/actions/field";
import {
  canCompleteFieldWork,
  canEditFieldNotes,
  canEnterFieldHours,
  canEnterFieldMaterials,
  canUpdateFieldStatus,
  isFieldJobEditable,
} from "@/lib/field-permissions";
import { formatFieldJobDate, formatFieldJobTime } from "@/lib/field-schedule-utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { PiecesJointesSection } from "@/components/shared/pieces-jointes-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { FieldHour, FieldMaterial, ScheduleEvent, ToolListItem } from "@/types";

interface FieldCallDetailClientProps {
  job: ScheduleEvent;
  hours: FieldHour[];
  materials: FieldMaterial[];
  tools: ToolListItem[];
  employeeId: string;
}

export function FieldCallDetailClient({
  job: initialJob,
  hours: initialHours,
  materials: initialMaterials,
  tools,
  employeeId,
}: FieldCallDetailClientProps) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [hours, setHours] = useState(initialHours);
  const [materials, setMaterials] = useState(initialMaterials);
  const [fieldNotes, setFieldNotes] = useState(job.fieldNotes ?? "");
  const [error, setError] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{
    hoursCount: number;
    materialsCount: number;
    toolsCount: number;
    hasFieldNotes: boolean;
    missingHours: boolean;
  } | null>(null);
  // Un état d'attente PAR ACTION. Un seul `isPending` partagé désactivait les
  // cinq formulaires de la carte dès qu'une action tournait — et, si l'une
  // d'elles levait une exception, les gelait tous définitivement.
  const [statusPending, startStatus] = useTransition();
  const [hourPending, startHour] = useTransition();
  const [materialPending, startMaterial] = useTransition();
  const [notesPending, startNotes] = useTransition();

  const editable = isFieldJobEditable(job.status);
  const address = job.jobSiteAddress || job.location || "—";
  const estimatedHours = job.quoteEstimationSnapshot?.estimatedHours;

  function handleStatus(status: ScheduleEvent["status"]) {
    startStatus(async () => {
      setError("");
      const result = await updateFieldJobStatusAction(job.id, status);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.event) setJob(result.event);
      router.refresh();
    });
  }

  async function openCompleteDialog() {
    setError("");
    const preview = await getFieldCompletionPreviewAction(job.id);
    if (!preview.success) {
      setError(preview.error);
      return;
    }
    setCompletionSummary(preview.data ?? null);
    setCompleteOpen(true);
  }

  function confirmComplete() {
    startStatus(async () => {
      setError("");
      const result = await completeFieldWorkAction(job.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.event) setJob(result.event);
      setCompleteOpen(false);
      router.refresh();
    });
  }

  function submitHour(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Le formulaire est capturé MAINTENANT : React remet `e.currentTarget` à
    // null dès que le gestionnaire rend la main, donc bien avant la fin de
    // l'await ci-dessous. L'y lire levait un TypeError qui interrompait la
    // transition — `router.refresh()` n'était jamais atteint et tous les
    // boutons de la carte restaient désactivés.
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("jobId", job.id);
    startHour(async () => {
      const result = await saveFieldHourAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) setHours((prev) => [result.data!, ...prev]);
      form.reset();
      router.refresh();
    });
  }

  function submitMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("jobId", job.id);
    formData.set("isCustom", "true");
    startMaterial(async () => {
      const result = await saveFieldMaterialAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) setMaterials((prev) => [result.data!, ...prev]);
      form.reset();
      router.refresh();
    });
  }

  function saveNotes() {
    startNotes(async () => {
      const result = await updateFieldNotesAction(job.id, fieldNotes);
      if (!result.success) setError(result.error);
      else if (result.event) setJob(result.event);
    });
  }

  return (
    <div className="space-y-4">
      <Link href="/terrain" className="inline-flex items-center text-sm text-muted-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Retour
      </Link>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatFieldJobDate(job.start)} · {formatFieldJobTime(job.start, job.end)}
        </p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{job.customerName ?? "—"}</p>
          <p>{address}</p>
          {job.customerPhone && (
            <Button variant="outline" className="w-full" asChild>
              <a href={`tel:${job.customerPhone}`}>
                <Phone className="mr-2 h-4 w-4" />
                {job.customerPhone}
              </a>
            </Button>
          )}
          {job.description && <p className="text-muted-foreground">{job.description}</p>}
          {job.workDescription && (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-medium">Travaux effectués</p>
              <p className="mt-1">{job.workDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {editable && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Statut du call</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {canUpdateFieldStatus("employee", job, employeeId, "en-route") && job.status === "scheduled" && (
              <Button size="lg" className="h-12" disabled={statusPending} onClick={() => handleStatus("en-route")}>
                Je suis en route
              </Button>
            )}
            {canUpdateFieldStatus("employee", job, employeeId, "in-progress") &&
              (job.status === "scheduled" || job.status === "en-route") && (
                <Button size="lg" className="h-12" disabled={statusPending} onClick={() => handleStatus("in-progress")}>
                  Commencer les travaux
                </Button>
              )}
            {canCompleteFieldWork("employee", job, employeeId) && (
              <Button
                size="lg"
                variant="secondary"
                className="h-12"
                disabled={statusPending}
                onClick={openCompleteDialog}
              >
                Travaux terminés
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notes terrain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={fieldNotes}
            onChange={(e) => setFieldNotes(e.target.value)}
            disabled={!canEditFieldNotes("employee", job, employeeId)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="Notes pour ce call..."
          />
          {canEditFieldNotes("employee", job, employeeId) && (
            <Button variant="outline" disabled={notesPending} onClick={saveNotes}>
              Enregistrer les notes
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <PiecesJointesSection scheduledJobId={job.id} compact />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mes heures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {estimatedHours != null && (
            <p className="text-sm text-muted-foreground">
              Heures estimées (soumission) : <strong>{estimatedHours} h</strong>
            </p>
          )}
          {hours.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune heure réelle saisie.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hours.map((hour) => (
                <li key={hour.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {hour.workDate} · {hour.hours} h
                  </p>
                  {hour.notes && <p className="text-muted-foreground">{hour.notes}</p>}
                </li>
              ))}
            </ul>
          )}
          {canEnterFieldHours("employee", job, employeeId) && (
            <form onSubmit={submitHour} className="grid gap-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="workDate">Date</Label>
                  <Input id="workDate" name="workDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hours">Heures</Label>
                  <Input id="hours" name="hours" type="number" min="0.25" step="0.25" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startTime">Début (opt.)</Label>
                  <Input id="startTime" name="startTime" type="time" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endTime">Fin (opt.)</Label>
                  <Input id="endTime" name="endTime" type="time" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="laborType">Type (opt.)</Label>
                <Input id="laborType" name="laborType" placeholder="Compagnon, apprenti..." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hourNotes">Notes</Label>
                <Input id="hourNotes" name="notes" />
              </div>
              <Button type="submit" disabled={hourPending}>
                {hourPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ajouter les heures
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Matériaux utilisés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun matériau saisi.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {materials.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {item.name} · {item.quantity} {item.unit}
                  </p>
                  {item.notes && <p className="text-muted-foreground">{item.notes}</p>}
                </li>
              ))}
            </ul>
          )}
          {canEnterFieldMaterials("employee", job, employeeId) && (
            <form onSubmit={submitMaterial} className="grid gap-3 rounded-lg border p-3">
              <div className="space-y-1">
                <Label htmlFor="materialName">Matériau</Label>
                <Input id="materialName" name="name" required placeholder="Nom du matériau" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantity">Quantité</Label>
                  <Input id="quantity" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit">Unité</Label>
                  <Input id="unit" name="unit" defaultValue="unité" required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="materialNotes">Notes</Label>
                <Input id="materialNotes" name="notes" />
              </div>
              <Button type="submit" disabled={materialPending}>
                Ajouter le matériau
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Outillage pour ce travail</CardTitle>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun outil assigné actuellement.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tools.map((tool) => (
                <li key={tool.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {tool.name}
                    {tool.internalNumber ? ` (#${tool.internalNumber})` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Retour prévu : {tool.expectedReturnDate ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avant de terminer ce call</DialogTitle>
            <DialogDescription>Vérifiez le résumé avant de confirmer.</DialogDescription>
          </DialogHeader>
          {completionSummary && (
            <ul className="space-y-2 text-sm">
              <li>Heures saisies : {completionSummary.hoursCount}</li>
              <li>Matériaux saisis : {completionSummary.materialsCount}</li>
              <li>Outils encore assignés : {completionSummary.toolsCount}</li>
              <li>Notes terrain : {completionSummary.hasFieldNotes ? "Oui" : "Non"}</li>
              {completionSummary.missingHours && (
                <li className="rounded-md bg-amber-500/10 p-2 text-amber-800">
                  Aucune heure saisie — vous pouvez quand même terminer.
                </li>
              )}
            </ul>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Corriger
            </Button>
            <Button disabled={statusPending} onClick={confirmComplete}>
              {statusPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer travaux terminés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
