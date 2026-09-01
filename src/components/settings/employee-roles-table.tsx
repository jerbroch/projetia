"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  enregistrerRoleAction,
  listerRolesAction,
  supprimerRoleAction,
} from "@/lib/actions/employee-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeRole } from "@/types";

/**
 * Les rôles de l'entreprise, modifiables sur place.
 *
 * Trois lignes génériques arrivent à l'inscription, sans taux. Un couvreur les
 * renomme « Couvreur » et « Aide-couvreur », un excavateur « Opérateur » et
 * « Journalier ». Nous ne savons pas nommer leurs métiers ni ce qu'ils paient :
 * la structure est à eux.
 *
 * LE TAUX EST LE SALAIRE VERSÉ, jamais un prix de vente. Celui-là vit dans les
 * gabarits de main-d'œuvre, juste au-dessus dans la même page.
 */
interface Ligne {
  name: string;
  taux: string;
  isActive: boolean;
}

const versLigne = (r: EmployeeRole): Ligne => ({
  name: r.name,
  taux: r.defaultHourlyRate == null ? "" : String(r.defaultHourlyRate),
  isActive: r.isActive,
});

export function EmployeeRolesTable({ disabled = false }: { disabled?: boolean }) {
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [edits, setEdits] = useState<Record<string, Ligne>>({});
  const [nouveau, setNouveau] = useState<Ligne | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, startTransition] = useTransition();

  const recharger = () => {
    void listerRolesAction().then((r) => setRoles(r.roles));
  };
  useEffect(recharger, []);

  const tries = useMemo(
    () => [...roles].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roles],
  );

  function modifier(id: string, champ: keyof Ligne, valeur: string | boolean) {
    const base = edits[id] ?? versLigne(tries.find((r) => r.id === id)!);
    setEdits((e) => ({ ...e, [id]: { ...base, [champ]: valeur } }));
  }

  function enregistrer(id: string | null, l: Ligne, ordre: number) {
    setErreur("");
    setMessage("");
    if (!l.name.trim()) {
      setErreur("Le nom du rôle est requis.");
      return;
    }
    startTransition(async () => {
      const r = await enregistrerRoleAction({
        id: id ?? undefined,
        name: l.name,
        // Un champ laissé vide vaut « pas encore renseigné », pas zéro : c'est
        // cette distinction qui permet d'avertir sans se tromper.
        defaultHourlyRate: l.taux.trim() === "" ? null : Number(l.taux),
        sortOrder: ordre,
        isActive: l.isActive,
      });
      if (!r.success) {
        setErreur(r.error ?? "Impossible d'enregistrer.");
        return;
      }
      if (id) setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
      else setNouveau(null);
      recharger();
    });
  }

  function supprimer(role: EmployeeRole) {
    setErreur("");
    setMessage("");
    startTransition(async () => {
      const r = await supprimerRoleAction(role.id);
      if (!r.success) {
        setErreur(r.error ?? "Impossible de supprimer.");
        return;
      }
      // Dire ce qui vient d'arriver aux fiches : personne n'est effacé, mais
      // des employés viennent de perdre leur niveau, et il faut le savoir.
      setMessage(
        r.employesTouches
          ? `« ${role.name} » supprimé. ${r.employesTouches} employé${r.employesTouches > 1 ? "s ont" : " a"} perdu ce niveau — leur salaire est inchangé.`
          : `« ${role.name} » supprimé.`,
      );
      recharger();
    });
  }

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        Le niveau de vos employés, avec vos mots. Renommez, ajoutez, retirez.
        Le taux est le <strong>salaire que vous versez</strong> — le prix
        facturé au client, lui, vit dans les taux de main-d&apos;œuvre ci-dessus.
      </p>

      {erreur && <p className="text-sm text-destructive" role="alert">{erreur}</p>}
      {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-left font-medium">Rôle</th>
              <th className="px-2 py-2 text-right font-medium">Salaire / h</th>
              <th className="px-2 py-2 text-center font-medium">Actif</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tries.map((r, i) => {
              const l = edits[r.id] ?? versLigne(r);
              const modifie = Boolean(edits[r.id]);
              return (
                <tr key={r.id} className={l.isActive ? "" : "opacity-50"}>
                  <td className="py-1.5 pr-2">
                    <Input
                      aria-label={`Nom du rôle ${r.name}`}
                      value={l.name}
                      disabled={disabled}
                      onChange={(e) => modifier(r.id, "name", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      aria-label={`Salaire horaire — ${r.name}`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="à remplir"
                      className="w-28 text-right"
                      value={l.taux}
                      disabled={disabled}
                      onChange={(e) => modifier(r.id, "taux", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Rôle actif — ${r.name}`}
                      checked={l.isActive}
                      disabled={disabled}
                      onChange={(e) => modifier(r.id, "isActive", e.target.checked)}
                    />
                  </td>
                  <td className="flex items-center gap-1 py-1.5 pl-2">
                    {modifie && (
                      <Button size="sm" disabled={enCours} onClick={() => enregistrer(r.id, l, r.sortOrder || i + 1)}>
                        {enCours && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                        Enregistrer
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Supprimer le rôle ${r.name}`}
                      disabled={disabled || enCours}
                      onClick={() => supprimer(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}

            {nouveau && (
              <tr className="bg-muted/30">
                <td className="py-1.5 pr-2">
                  <Input
                    aria-label="Nom du nouveau rôle"
                    autoFocus
                    placeholder="Contremaître, Opérateur, Journalier…"
                    value={nouveau.name}
                    onChange={(e) => setNouveau({ ...nouveau, name: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Input
                    aria-label="Salaire horaire du nouveau rôle"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="à remplir"
                    className="w-28 text-right"
                    value={nouveau.taux}
                    onChange={(e) => setNouveau({ ...nouveau, taux: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">—</td>
                <td className="py-1.5 pl-2">
                  <Button size="sm" disabled={enCours} onClick={() => enregistrer(null, nouveau, tries.length + 1)}>
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
          onClick={() => setNouveau({ name: "", taux: "", isActive: true })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un rôle
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Supprimer un rôle n&apos;efface jamais un employé : sa fiche perd son
        niveau, son salaire reste. Décocher « Actif » le retire des listes sans
        toucher aux fiches existantes.
      </p>
    </div>
  );
}
