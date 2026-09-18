import { Clock, User } from "lucide-react";
import {
  depuisDeLEtat,
  detailDeLEtat,
  etatDeLOutil,
  titreDeLEtat,
  type EtatDeLOutil,
} from "@/lib/detenteur-outil";
import { cn } from "@/lib/utils";
import type { ToolListItem } from "@/types";

/**
 * QUI DÉTIENT CET OUTIL — le même bloc dans les deux interfaces.
 *
 * L'employeur lisait le nom dans une colonne sans étiquette, et l'employé ne
 * voyait tout simplement pas les outils sortis par ses collègues : ils
 * disparaissaient de sa liste. Chacun devait ouvrir une fiche, ou appeler.
 *
 * UN SEUL COMPOSANT POUR LES DEUX ÉCRANS. Deux rendus séparés auraient fini
 * par diverger — et deux personnes lisant deux phrases différentes sur la
 * même perceuse, c'est un appel téléphonique de plus, pas un de moins.
 */

const TEINTE: Record<EtatDeLOutil["genre"], string> = {
  disponible: "bg-succes/12 text-succes",
  "a-moi": "bg-petrole/10 text-petrole dark:bg-petrole-foreground/15 dark:text-petrole-foreground",
  detenu: "bg-danger/12 text-danger",
  indisponible: "bg-attente/15 text-attente",
};

interface EtatDetenteurProps {
  outil: ToolListItem;
  /** L'employé qui regarde. Absent côté employeur : il n'y a pas de « à moi ». */
  employeId?: string;
  /** Sur une ligne de tableau large, la pastille se suffit à elle-même. */
  compact?: boolean;
  className?: string;
}

export function EtatDetenteur({ outil, employeId, compact = false, className }: EtatDetenteurProps) {
  const etat = etatDeLOutil(outil, employeId);
  const detail = detailDeLEtat(etat);
  const retard = (etat.genre === "detenu" || etat.genre === "a-moi") && etat.enRetard;
  const depuis = depuisDeLEtat(etat);

  return (
    <div className={cn("min-w-0", className)}>
      <span
        data-testid={`etat-outil-${outil.id}`}
        data-genre={etat.genre}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
          TEINTE[etat.genre],
          retard && "bg-danger/12 text-danger",
        )}
      >
        {/*
          La pastille colorée sert de second signal : sur un chantier au
          soleil, la couleur seule ne passe pas, et le texte seul se survole
          sans le voir.
        */}
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            etat.genre === "disponible" && "bg-succes",
            etat.genre === "a-moi" && "bg-petrole dark:bg-petrole-foreground",
            etat.genre === "detenu" && "bg-danger",
            etat.genre === "indisponible" && "bg-attente",
          )}
        />
        {titreDeLEtat(etat)}
      </span>

      {!compact && detail && (
        <p
          data-testid={`detenteur-${outil.id}`}
          className="mt-1 flex items-start gap-1.5 text-[13px] font-medium text-foreground"
        >
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 break-words">{detail}</span>
        </p>
      )}

      {!compact && depuis && (
        <p className="mt-0.5 flex items-start gap-1.5 text-[12px] text-muted-foreground">
          <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0">{depuis}</span>
        </p>
      )}
    </div>
  );
}

/**
 * La version d'une seule ligne, pour une cellule de tableau étroite.
 *
 * Le nom y est indispensable — c'est la colonne « Employé » — mais la phrase
 * complète y ferait trois lignes dans une case.
 */
export function DetenteurEnLigne({ outil, employeId }: { outil: ToolListItem; employeId?: string }) {
  const etat = etatDeLOutil(outil, employeId);
  if (etat.genre === "a-moi") return <span className="font-medium">Vous</span>;
  if (etat.genre !== "detenu") return <span className="text-muted-foreground">—</span>;
  return (
    <span data-testid={`detenteur-${outil.id}`} className="truncate font-medium">
      {etat.nom}
    </span>
  );
}
