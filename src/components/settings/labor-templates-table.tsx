"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { saveLaborRateTemplateAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { LaborRateTemplate } from "@/types";

const TYPES = {
  regular: "Régulier",
  overtime: "Temps et demi",
  double_time: "Temps double",
} as const;

/**
 * Tableau modifiable sur place des gabarits de main-d'œuvre.
 *
 * Les gabarits étaient affichés en lecture seule, avec un formulaire d'ajout en
 * bas qui n'envoyait aucun identifiant — donc incapable de modifier quoi que ce
 * soit. Un entrepreneur ne pouvait pas ajuster ses propres taux.
 *
 * Les montants semés à l'inscription sont des EXEMPLES. C'est dit ici, et pas
 * seulement dans une migration que personne ne lit : 125 $/h chez l'un n'est
 * pas 125 $/h chez l'autre.
 *
 * La MARGE est calculée et affichée, jamais saisie : c'est elle qui dit si le
 * taux tient debout, et un entrepreneur qui voit « 12 % » corrige son prix.
 */
interface LigneEditee {
  name: string;
  workerCount: string;
  costPerHr: string;
  billRate: string;
  rateType: LaborRateTemplate["rateType"];
  isActive: boolean;
}

const versLigne = (t: LaborRateTemplate): LigneEditee => ({
  name: t.name,
  workerCount: String(t.workerCount),
  costPerHr: String(t.costPerHr),
  billRate: String(t.billRate),
  rateType: t.rateType,
  isActive: t.isActive,
});

function marge(cout: number, vente: number): string {
  if (vente <= 0) return "—";
  return `${Math.round(((vente - cout) / vente) * 100)} %`;
}

export function LaborTemplatesTable({
  templates,
  onChanged,
  disabled = false,
}: {
  templates: LaborRateTemplate[];
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [edits, setEdits] = useState<Record<string, LigneEditee>>({});
  const [nouveau, setNouveau] = useState<LigneEditee | null>(null);
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState("");

  const tries = useMemo(
    () => [...templates].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [templates],
  );

  function ligne(t: LaborRateTemplate): LigneEditee {
    return edits[t.id] ?? versLigne(t);
  }

  function modifier(id: string, champ: keyof LigneEditee, valeur: string | boolean) {
    const base = edits[id] ?? versLigne(tries.find((t) => t.id === id)!);
    setEdits((e) => ({ ...e, [id]: { ...base, [champ]: valeur } }));
  }

  function enregistrer(id: string | null, l: LigneEditee) {
    setErreur("");
    if (!l.name.trim()) {
      setErreur("Le nom du gabarit est requis.");
      return;
    }
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("name", l.name.trim());
    fd.set("workerCount", l.workerCount || "1");
    fd.set("costPerHr", l.costPerHr || "0");
    fd.set("billRate", l.billRate || "0");
    fd.set("rateType", l.rateType);
    fd.set("sortOrder", String(id ? (tries.find((t) => t.id === id)?.sortOrder ?? 0) : tries.length + 1));
    fd.set("isActive", l.isActive ? "true" : "false");

    startTransition(async () => {
      const r = await saveLaborRateTemplateAction(fd);
      if (!r.success) {
        setErreur(r.error ?? "Le taux n'a pas été enregistré, sans cause précisée.");
        return;
      }
      if (id) setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      else setNouveau(null);
      onChanged();
    });
  }

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        Ces montants sont des <strong>exemples de départ</strong>, pour que vous
        puissiez faire une soumission tout de suite. Ajustez-les à vos vrais
        taux — ceux du voisin ne sont pas les vôtres.
      </p>

      {erreur && <p className="text-sm text-destructive" role="alert">{erreur}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-left font-medium">Gabarit</th>
              <th className="px-2 py-2 text-right font-medium">Pers.</th>
              <th className="px-2 py-2 text-right font-medium">Coût / h</th>
              <th className="px-2 py-2 text-right font-medium">Vente / h</th>
              <th className="px-2 py-2 text-right font-medium">Marge</th>
              <th className="px-2 py-2 text-left font-medium">Type</th>
              <th className="px-2 py-2 text-center font-medium">Actif</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tries.map((t) => {
              const l = ligne(t);
              const modifie = Boolean(edits[t.id]);
              return (
                <tr key={t.id} className={l.isActive ? "" : "opacity-50"}>
                  <td className="py-1.5 pr-2">
                    <Input
                      aria-label={`Nom du gabarit ${t.name}`}
                      value={l.name}
                      disabled={disabled}
                      onChange={(e) => modifier(t.id, "name", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      aria-label={`Nombre de personnes — ${t.name}`}
                      type="number"
                      min="1"
                      className="w-16 text-right"
                      value={l.workerCount}
                      disabled={disabled}
                      onChange={(e) => modifier(t.id, "workerCount", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      aria-label={`Coût horaire — ${t.name}`}
                      type="number"
                      step="0.01"
                      className="w-24 text-right"
                      value={l.costPerHr}
                      disabled={disabled}
                      onChange={(e) => modifier(t.id, "costPerHr", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      aria-label={`Prix de vente horaire — ${t.name}`}
                      type="number"
                      step="0.01"
                      className="w-24 text-right"
                      value={l.billRate}
                      disabled={disabled}
                      onChange={(e) => modifier(t.id, "billRate", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {marge(Number(l.costPerHr) || 0, Number(l.billRate) || 0)}
                  </td>
                  <td className="px-1 py-1.5">
                    <Select
                      value={l.rateType}
                      disabled={disabled}
                      onValueChange={(v) => modifier(t.id, "rateType", v)}
                    >
                      <SelectTrigger aria-label={`Type — ${t.name}`} className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Gabarit actif — ${t.name}`}
                      checked={l.isActive}
                      disabled={disabled}
                      onChange={(e) => modifier(t.id, "isActive", e.target.checked)}
                    />
                  </td>
                  <td className="py-1.5 pl-2">
                    {modifie && (
                      <Button
                        size="sm"
                        disabled={enCours}
                        aria-label={`Enregistrer le taux ${t.name}`}
                        onClick={() => enregistrer(t.id, l)}
                      >
                        {enCours && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        Enregistrer ce taux
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}

            {nouveau && (
              <tr className="bg-muted/30">
                <td className="py-1.5 pr-2">
                  <Input
                    aria-label="Nom du nouveau gabarit"
                    autoFocus
                    placeholder="Soudeur"
                    value={nouveau.name}
                    onChange={(e) => setNouveau({ ...nouveau, name: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Input
                    aria-label="Nombre de personnes du nouveau gabarit"
                    type="number" min="1" className="w-16 text-right"
                    value={nouveau.workerCount}
                    onChange={(e) => setNouveau({ ...nouveau, workerCount: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Input
                    aria-label="Coût horaire du nouveau gabarit"
                    type="number" step="0.01" className="w-24 text-right"
                    value={nouveau.costPerHr}
                    onChange={(e) => setNouveau({ ...nouveau, costPerHr: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Input
                    aria-label="Prix de vente du nouveau gabarit"
                    type="number" step="0.01" className="w-24 text-right"
                    value={nouveau.billRate}
                    onChange={(e) => setNouveau({ ...nouveau, billRate: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {marge(Number(nouveau.costPerHr) || 0, Number(nouveau.billRate) || 0)}
                </td>
                <td className="px-1 py-1.5">
                  <Select
                    value={nouveau.rateType}
                    onValueChange={(v) => setNouveau({ ...nouveau, rateType: v as LigneEditee["rateType"] })}
                  >
                    <SelectTrigger aria-label="Type du nouveau gabarit" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5 text-center">—</td>
                <td className="py-1.5 pl-2">
                  <Button size="sm" disabled={enCours} onClick={() => enregistrer(null, nouveau)}>
                    Ajouter
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!disabled && !nouveau && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setNouveau({ name: "", workerCount: "1", costPerHr: "", billRate: "", rateType: "regular", isActive: true })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un gabarit
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Décocher « Actif » retire le gabarit des listes sans effacer l&apos;historique.
        Vos soumissions et factures déjà faites gardent le taux qu&apos;elles portaient :
        modifier un gabarit ne change jamais un document envoyé. Total facturé pour
        une heure de compagnon : {formatCurrency(Number(tries[0]?.billRate ?? 0))}.
      </p>
    </div>
  );
}
