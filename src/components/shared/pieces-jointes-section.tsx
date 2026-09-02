"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { compresserSiPhoto } from "@/lib/compression-navigateur";
import {
  listerPiecesJointesAction,
  retirerPieceJointeAction,
  televerserPieceJointeAction,
  type PieceJointe,
} from "@/lib/actions/pieces-jointes";
import {
  estUneImage,
  MAX_PAR_CALL,
  poidsLisible,
  refusDePieceJointe,
  TYPES_ACCEPTES,
} from "@/lib/pieces-jointes";
import { Button } from "@/components/ui/button";

/**
 * Section « Pièces jointes », partagée par le terrain et le bureau.
 *
 * Les photos sont compressées DANS LE NAVIGATEUR avant l'envoi : un téléphone
 * sur un chantier a du réseau médiocre, et envoyer 4 Mo pour les réduire
 * ensuite fait échouer le téléversement.
 *
 * Deux boutons plutôt qu'un : sur iOS, la caméra directe ne prend qu'une photo
 * à la fois, alors que la galerie en accepte plusieurs. Un gars sur un toit
 * veut la caméra en un geste ; celui qui a photographié avant d'ouvrir
 * l'application veut sa galerie.
 */
export function PiecesJointesSection({
  scheduledJobId,
  invoiceId,
  compact = false,
}: {
  scheduledJobId?: string;
  invoiceId?: string;
  compact?: boolean;
}) {
  const [pieces, setPieces] = useState<PieceJointe[]>([]);
  const [peutRetirer, setPeutRetirer] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  const recharger = useCallback(() => {
    void listerPiecesJointesAction({ scheduledJobId, invoiceId }).then((r) => {
      setPieces(r.pieces);
      setPeutRetirer(r.peutRetirer);
      setChargement(false);
      if (r.error) setErreur(r.error);
    });
  }, [scheduledJobId, invoiceId]);

  useEffect(recharger, [recharger]);

  async function ajouter(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    setErreur(null);

    let compte = pieces.length;
    for (const brut of Array.from(fichiers)) {
      // Le poids d'une photo se juge APRÈS compression : une photo d'iPhone de
      // 5,8 Mo en fait 162 Ko une fois réduite. La refuser sur son poids
      // d'arrivée reviendrait à refuser une photo parfaitement acceptable.
      const refus = refusDePieceJointe(brut, compte, true);
      if (refus) {
        setErreur(refus);
        break;
      }

      setEnCours(brut.name);
      const { fichier, priseLe, compressee } = await compresserSiPhoto(brut);

      // La compression a pu échouer — HEIC sur Chrome, mémoire insuffisante.
      // Le fichier d'origine part alors tel quel, et il faut le revalider :
      // il peut dépasser le plafond que la version compressée respectait.
      const refusApres = refusDePieceJointe(fichier, compte);
      if (refusApres) {
        setErreur(
          compressee ? refusApres : `${refusApres} La compression n'a pas fonctionné sur ce fichier.`,
        );
        break;
      }

      const fd = new FormData();
      fd.set("fichier", fichier);
      if (scheduledJobId) fd.set("scheduledJobId", scheduledJobId);
      if (invoiceId) fd.set("invoiceId", invoiceId);
      if (priseLe) fd.set("priseLe", priseLe);

      const r = await televerserPieceJointeAction(fd);
      if (!r.success) {
        setErreur(r.error ?? "Le téléversement a échoué.");
        break;
      }
      compte += 1;
    }

    setEnCours(null);
    if (camera.current) camera.current.value = "";
    if (galerie.current) galerie.current.value = "";
    recharger();
  }

  function retirer(piece: PieceJointe) {
    setErreur(null);
    setEnCours(piece.fileName);
    void retirerPieceJointeAction(piece.id).then((r) => {
      setEnCours(null);
      if (!r.success) setErreur(r.error ?? "Impossible de retirer la pièce jointe.");
      else recharger();
    });
  }

  const accepte = TYPES_ACCEPTES.join(",");
  const plein = pieces.length >= MAX_PAR_CALL;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>
          <Paperclip className="mr-1.5 inline h-4 w-4" />
          Pièces jointes
          {pieces.length > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {pieces.length} sur {MAX_PAR_CALL}
            </span>
          )}
        </h3>
      </div>

      {erreur && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {erreur}
        </p>
      )}

      {chargement ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : pieces.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune pièce jointe. Photos du chantier, plans, documents.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pieces.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border p-2">
              {estUneImage(p.mimeType) && p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.fileName}
                  className="h-14 w-14 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted">
                  {estUneImage(p.mimeType) ? (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  )}
                </span>
              )}

              <div className="min-w-0 flex-1">
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {p.fileName}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium">{p.fileName}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {poidsLisible(p.sizeBytes)}
                  {p.uploadedByName ? ` · ${p.uploadedByName}` : ""}
                </span>
              </div>

              {peutRetirer && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Retirer ${p.fileName}`}
                  disabled={enCours !== null}
                  onClick={() => retirer(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {enCours && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {enCours}…
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/*
          capture="environment" ouvre la caméra arrière sur un téléphone. Ce
          n'est qu'une préférence : iOS et Android offrent quand même la
          photothèque, ce qui est très bien.
        */}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Prendre une photo"
          onChange={(e) => void ajouter(e.target.files)}
        />
        <input
          ref={galerie}
          type="file"
          accept={accepte}
          multiple
          className="sr-only"
          aria-label="Choisir des fichiers"
          onChange={(e) => void ajouter(e.target.files)}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={plein || enCours !== null}
          onClick={() => camera.current?.click()}
        >
          <Camera className="mr-2 h-4 w-4" />
          Prendre une photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={plein || enCours !== null}
          onClick={() => galerie.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Ajouter un fichier
        </Button>
      </div>

      {plein && (
        <p className="text-xs text-muted-foreground">
          Ce call a atteint {MAX_PAR_CALL} pièces jointes. Retirez-en une pour en ajouter.
        </p>
      )}
      {!peutRetirer && pieces.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Seul votre employeur peut retirer une pièce jointe.
        </p>
      )}
    </div>
  );
}
