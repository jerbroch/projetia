"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apercuImportTerrainAction,
  importerTerrainAction,
  type ApercuImport,
} from "@/lib/actions/billing-field-import";

/**
 * Bandeau de tête de la feuille : prévu, réel, écart — et ce qui n'y est pas.
 *
 * Il répond à trois questions qu'on se pose devant une facture de chantier :
 * combien on avait estimé, combien a réellement été travaillé, et si des
 * heures sont arrivées APRÈS coup. Sans la dernière, on facture un chantier en
 * oubliant le gars qui a saisi en retard.
 */
export function FieldImportBanner({ jobId, onImported }: { jobId: string; onImported: () => void }) {
  const [apercu, setApercu] = useState<ApercuImport | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, startTransition] = useTransition();

  const rafraichir = () => {
    void apercuImportTerrainAction(jobId).then((r) => {
      if (r.success) setApercu(r.data);
    });
  };
  useEffect(rafraichir, [jobId]);

  if (!apercu) return null;
  const { resume, aEcraser, heuresEnRetard, sansPrix } = apercu;
  const rienDuTerrain = resume.reel === 0 && apercu.lignesTravail === 0 && apercu.lignesMateriaux === 0;
  if (rienDuTerrain) return null;

  function importer(ecraser: boolean) {
    setConfirmation(false);
    startTransition(async () => {
      await importerTerrainAction({ jobId, ecraserModifiees: ecraser });
      rafraichir();
      onImported();
    });
  }

  /** « 27,5 h » et non « 27.5 h » : le reste de l'application est en fr-CA. */
  const heures = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 2 });

  /**
   * Un écart POSITIF est une bonne nouvelle, pas une alerte.
   *
   * Il s'affichait en rouge, comme un dépassement de budget. Mais ces heures-là
   * ont été notées au chantier, donc elles se facturent : ce sont précisément
   * celles qu'un entrepreneur ne facturait pas avant, faute de les avoir
   * écrites. Un écart négatif est neutre — le chantier a pris moins de temps
   * que prévu, il n'y a rien à signaler.
   */
  const ecartClasse =
    resume.ecart > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <span>
            Prévu <strong>{heures(resume.prevu)} h</strong>
          </span>
          <span>
            Réel <strong>{heures(resume.reel)} h</strong>
          </span>
          <span className={ecartClasse}>
            Écart{" "}
            <strong>
              {resume.ecart > 0 ? "+" : ""}
              {heures(resume.ecart)} h
            </strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={enCours}
          onClick={() => (aEcraser.length ? setConfirmation(true) : importer(false))}
        >
          <Download className="mr-2 h-4 w-4" />
          Réimporter le terrain
        </Button>
      </div>

      {resume.nonImportees > 0 && (
        <p className="mt-2 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{resume.nonImportees} h</strong> saisies après la création de cette feuille ne sont
            pas facturées{heuresEnRetard > 1 ? ` (${heuresEnRetard} saisies)` : ""}. Réimportez pour
            les inclure.
          </span>
        </p>
      )}

      {sansPrix.length > 0 && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Sans prix : {sansPrix.join(", ")} — à compléter avant d&apos;envoyer.
        </p>
      )}

      {confirmation && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {/*
            Le pluriel était fabriqué en collant « ont » à « sera », ce qui
            donnait « seraont ». Une phrase construite morceau par morceau finit
            toujours par produire ce genre de chose : on écrit les deux formes
            en toutes lettres.
          */}
          <p className="font-medium text-destructive">
            {aEcraser.length > 1
              ? `${aEcraser.length} lignes que vous avez corrigées seront remplacées :`
              : "Une ligne que vous avez corrigée sera remplacée :"}
          </p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {aEcraser.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmation(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="outline" disabled={enCours} onClick={() => importer(false)}>
              Importer sans y toucher
            </Button>
            <Button size="sm" variant="destructive" disabled={enCours} onClick={() => importer(true)}>
              Remplacer quand même
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
