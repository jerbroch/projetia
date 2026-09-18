"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Wrench,
} from "lucide-react";
import {
  prendreOutilAction,
  rafraichirOutilsTerrainAction,
  retournerOutilAction,
} from "@/lib/actions/field-tools";
import {
  DUREE_EMPRUNT_PAR_DEFAUT_JOURS,
  retourProposeParDefaut,
  type EtatDuRetour,
} from "@/lib/outils-terrain";
import { etatDeLOutil } from "@/lib/detenteur-outil";
import { EtatDetenteur } from "@/components/outillage/etat-detenteur";
import { useInventaireVivant } from "@/lib/hooks/use-inventaire-vivant";
import { dateCourte, libelleRetour } from "@/lib/terrain-aujourdhui";
import { cn } from "@/lib/utils";
import type { ToolAssignment, ToolListItem } from "@/types";

/**
 * MES OUTILS — voir ce qu'on a, rendre ce qu'on doit, prendre ce qu'il faut.
 *
 * L'écran ne faisait que LISTER ce que le bureau avait assigné. Un homme qui
 * passait au dépôt prendre une scie devait appeler quelqu'un pour qu'il le
 * saisisse ; personne n'appelait, et l'inventaire ne correspondait jamais au
 * contenu des camions.
 *
 * TOUT ÉCHANGE PASSE PAR LE SERVEUR, QUI RENVOIE LA LISTE À JOUR. On ne
 * recalcule rien localement après une prise : deviner l'état d'un inventaire
 * partagé, c'est afficher une vérité qui n'est déjà plus vraie chez le voisin.
 */

type Onglet = "possession" | "inventaire";

interface Chantier {
  id: string;
  titre: string;
  client: string | null;
}

interface FieldToolsPageClientProps {
  outilsInitiaux: ToolListItem[];
  employeId: string;
  historique: Array<ToolAssignment & { toolName: string; internalNumber: string }>;
  chantiers: Chantier[];
}

export function FieldToolsPageClient({
  outilsInitiaux,
  employeId,
  historique,
  chantiers,
}: FieldToolsPageClientProps) {
  const [outils, setOutils] = useState(outilsInitiaux);
  const [onglet, setOnglet] = useState<Onglet>("possession");
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [aPrendre, setAPrendre] = useState<ToolListItem | null>(null);
  const [aRendre, setARendre] = useState<ToolListItem | null>(null);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();

  // Le serveur reste la source : une modification faite au bureau doit
  // apparaître ici sans qu'on ait à recharger la page à la main.
  useEffect(() => setOutils(outilsInitiaux), [outilsInitiaux]);

  /*
   * MÊME RELECTURE QUE CHEZ L'EMPLOYEUR, MÊME CROCHET.
   *
   * Un téléphone reste des heures dans une poche, et un collègue peut prendre
   * entre-temps la scie qu'on vient de repérer. L'écran redemande donc
   * périodiquement, et immédiatement au retour à l'écran ou du réseau.
   */
  useInventaireVivant(async () => {
    const r = await rafraichirOutilsTerrainAction();
    if (r.success) setOutils(r.outils);
  });

  const mesOutils = useMemo(
    () => outils.filter((o) => o.currentEmployeeId === employeId),
    [outils, employeId],
  );

  /*
   * TOUT L'INVENTAIRE, PAS SEULEMENT CE QU'ON PEUT PRENDRE.
   *
   * L'onglet ne montrait que les outils libres : une perceuse sortie par un
   * collègue disparaissait purement et simplement de l'écran. On ne savait
   * donc pas si elle n'existait pas, si elle était cassée, ou si quelqu'un
   * l'avait — et il fallait appeler le bureau pour la question la plus
   * fréquente du dépôt.
   *
   * L'ordre suit l'utilité : ce qu'on peut emporter d'abord, ce qui est chez
   * un collègue ensuite, ce qui est immobilisé à la fin.
   */
  const autresOutils = useMemo(() => {
    const rang = (o: ToolListItem) => {
      const e = etatDeLOutil(o, employeId);
      if (e.genre === "disponible") return 0;
      if (e.genre === "detenu") return 1;
      return 2;
    };
    return outils
      .filter((o) => o.currentEmployeeId !== employeId)
      .sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, "fr"));
  }, [outils, employeId]);

  const filtrer = (liste: ToolListItem[]) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return liste;
    return liste.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.internalNumber ?? "").toLowerCase().includes(q) ||
        (o.category ?? "").toLowerCase().includes(q),
    );
  };

  const aRetournerAujourdhui = mesOutils.filter(
    (o) => !!o.expectedReturnDate && o.expectedReturnDate <= new Date().toISOString().slice(0, 10),
  );

  function envoyer(fd: FormData, action: typeof prendreOutilAction, messageSucces: string) {
    setErreur(null);
    setSucces(null);
    demarrer(async () => {
      try {
        const r = await action(fd);
        if (!r.success) {
          setErreur(r.error);
          return;
        }
        setOutils(r.outils);
        setSucces(messageSucces);
        setAPrendre(null);
        setARendre(null);
      } catch {
        /*
          ÉCHEC RÉSEAU : ON NE DIT PAS « ENREGISTRÉ ».
          Un homme qui croit avoir rendu sa perceuse ne la rapportera pas une
          seconde fois. Le geste reste donc explicitement à refaire.
        */
        setErreur("Rien n'a été enregistré — réseau indisponible. L'action reste à faire.");
      }
    });
  }

  const listeAffichee = filtrer(onglet === "possession" ? mesOutils : autresOutils);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[26px] font-bold leading-tight text-foreground">Mes outils</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Le même inventaire que le bureau
        </p>
      </header>

      {/* ───────── Deux chiffres ───────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-petrole">
              <Briefcase className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="text-2xl font-bold tabular-nums leading-none">{mesOutils.length}</span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">en ma possession</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                aRetournerAujourdhui.length > 0
                  ? "bg-primary/15 text-accent-encre"
                  : "bg-secondary text-petrole",
              )}
            >
              <RotateCcw className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span
              className={cn(
                "text-2xl font-bold tabular-nums leading-none",
                aRetournerAujourdhui.length > 0 && "text-accent-encre",
              )}
            >
              {aRetournerAujourdhui.length}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">à retourner</p>
        </div>
      </div>

      {/* ───────── Rechercher ───────── */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un outil"
          aria-label="Rechercher un outil par nom ou numéro"
          className="min-h-[48px] w-full rounded-xl border border-border bg-card pl-10 pr-3 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
        />
      </div>

      {/* ───────── Deux onglets ───────── */}
      <div role="tablist" aria-label="Outils" className="flex gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["possession", `En ma possession (${mesOutils.length})`],
            ["inventaire", `Inventaire (${autresOutils.length})`],
          ] as const
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => setOnglet(cle)}
            className={cn(
              "min-h-[44px] flex-1 rounded-lg px-2 text-[13px] font-semibold leading-tight",
              "transition-colors duration-normal motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-1",
              onglet === cle
                ? "bg-petrole text-petrole-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {libelle}
          </button>
        ))}
      </div>

      {erreur && (
        <p
          role="alert"
          data-testid="outils-erreur"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.07] p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{erreur}</span>
        </p>
      )}
      {succes && (
        <p
          role="status"
          data-testid="outils-succes"
          className="flex items-start gap-2 rounded-xl border border-succes/30 bg-succes/[0.07] p-3 text-sm text-succes"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{succes}</span>
        </p>
      )}

      {/* ───────── La liste ───────── */}
      {listeAffichee.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Wrench className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-3 text-[17px] font-semibold text-foreground">
            {recherche
              ? "Aucun outil ne correspond"
              : onglet === "possession"
                ? "Aucun outil en votre possession"
                : "Aucun autre outil à l'inventaire"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {recherche
              ? "Essayez un autre nom ou numéro."
              : onglet === "possession"
                ? "Prenez un outil au dépôt pour le voir apparaître ici."
                : "Votre entreprise n'a pas encore d'autre outil enregistré."}
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {listeAffichee.map((outil) => (
            <li key={outil.id}>
              <CarteOutil
                outil={outil}
                mien={outil.currentEmployeeId === employeId}
                employeId={employeId}
                enCours={enCours}
                onRendre={() => setARendre(outil)}
                onPrendre={() => setAPrendre(outil)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ───────── Prendre un outil ───────── */}
      <button
        type="button"
        data-testid="ouvrir-prise"
        onClick={() => {
          setOnglet("inventaire");
          setAPrendre(null);
          setErreur(null);
          document.getElementById("liste-disponibles")?.scrollIntoView({ behavior: "smooth" });
        }}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-normal hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <Plus className="h-5 w-5" aria-hidden />
        Prendre un outil
      </button>
      <span id="liste-disponibles" className="sr-only" />

      <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-succes" aria-hidden />
        Inventaire partagé avec le bureau
      </p>

      {/* ───────── L'historique, discret ───────── */}
      <div>
        <button
          type="button"
          onClick={() => setHistoriqueOuvert((v) => !v)}
          aria-expanded={historiqueOuvert}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2"
        >
          <History className="h-4 w-4" aria-hidden />
          {historiqueOuvert ? "Masquer mon historique" : "Mon historique"}
        </button>

        {historiqueOuvert && (
          <ul className="mt-2 space-y-2" data-testid="historique-outils">
            {historique.length === 0 ? (
              <li className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                Aucun mouvement enregistré.
              </li>
            ) : (
              historique.map((h) => (
                <li
                  key={h.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <p className="font-medium text-foreground">{h.toolName}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {dateCourte(h.startDate)}
                    {h.actualReturnDate ? ` → ${dateCourte(h.actualReturnDate)}` : " → en cours"}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {aPrendre && (
        <DialoguePrise
          outil={aPrendre}
          chantiers={chantiers}
          enCours={enCours}
          onFermer={() => setAPrendre(null)}
          onConfirmer={(fd) => envoyer(fd, prendreOutilAction, `${aPrendre.name} est à vous.`)}
        />
      )}
      {aRendre && (
        <DialogueRetour
          outil={aRendre}
          enCours={enCours}
          onFermer={() => setARendre(null)}
          onConfirmer={(fd) =>
            envoyer(fd, retournerOutilAction, `${aRendre.name} est rendu. Merci.`)
          }
        />
      )}
    </div>
  );
}

/* ───────────────────────────── La carte d'un outil ───────────────────────── */

function CarteOutil({
  outil,
  mien,
  employeId,
  enCours,
  onRendre,
  onPrendre,
}: {
  outil: ToolListItem;
  mien: boolean;
  employeId: string;
  enCours: boolean;
  onRendre: () => void;
  onPrendre: () => void;
}) {
  const etat = etatDeLOutil(outil, employeId);
  /*
   * LE BOUTON N'EXISTE QUE S'IL FAIT QUELQUE CHOSE.
   *
   * Un outil chez un collègue s'affiche avec son nom, sans « Prendre » ni
   * « Rapporter » : on ne rend pas un outil à la place de quelqu'un, et
   * proposer un bouton qui refuserait ensuite serait une promesse en l'air.
   */
  const prenable = etat.genre === "disponible";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/*
          PAS DE PHOTO : le modèle de données n'en porte aucune. Afficher un
          cadre vide ferait croire à une image qui n'a pas chargé. Une icône
          assumée vaut mieux qu'un trou.
        */}
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-petrole">
          <Wrench className="h-6 w-6" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-foreground">{outil.name}</h3>
          {outil.internalNumber && (
            <p className="text-[13px] tabular-nums text-muted-foreground">
              #{outil.internalNumber}
            </p>
          )}
          <div className="mt-1.5">
            <EtatDetenteur outil={outil} employeId={employeId} />
          </div>
          {mien && (
            <p
              className={cn(
                "mt-1.5 text-[13px]",
                (outil.daysOverdue ?? 0) > 0
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {libelleRetour(outil)}
            </p>
          )}
        </div>
      </div>

      {(mien || prenable) && (
        <button
          type="button"
          data-testid={mien ? `rendre-${outil.id}` : `prendre-${outil.id}`}
          disabled={enCours}
          onClick={mien ? onRendre : onPrendre}
          className={cn(
            "mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold",
            "transition-colors duration-normal disabled:opacity-60 motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole focus-visible:ring-offset-2",
            mien
              ? "border border-petrole/25 text-petrole hover:bg-petrole/[0.06]"
              : "bg-petrole text-petrole-foreground hover:bg-petrole-doux",
          )}
        >
          {mien ? "Rapporter l'outil" : "Prendre cet outil"}
        </button>
      )}
    </article>
  );
}

/* ──────────────────────────── Prendre un outil ───────────────────────────── */

function DialoguePrise({
  outil,
  chantiers,
  enCours,
  onFermer,
  onConfirmer,
}: {
  outil: ToolListItem;
  chantiers: Chantier[];
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: (fd: FormData) => void;
}) {
  const [retour, setRetour] = useState(retourProposeParDefaut());

  return (
    <FeuilleModale titre={`Prendre ${outil.name}`} onFermer={onFermer}>
      <form
        action={(fd) => {
          fd.set("toolId", outil.id);
          onConfirmer(fd);
        }}
        className="space-y-4"
      >
        <p className="rounded-lg bg-secondary px-3 py-2 text-[13px] text-muted-foreground">
          {outil.internalNumber ? `#${outil.internalNumber} · ` : ""}
          {outil.category}
        </p>

        <div>
          <label htmlFor="expectedReturnDate" className="mb-1 block text-sm font-medium">
            Retour prévu
          </label>
          <input
            id="expectedReturnDate"
            name="expectedReturnDate"
            type="date"
            required
            value={retour}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setRetour(e.target.value)}
            className="min-h-[48px] w-full rounded-lg border border-border bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
          />
          <p className="mt-1 text-[12px] text-muted-foreground">
            {DUREE_EMPRUNT_PAR_DEFAUT_JOURS} jours par défaut, comme au bureau.
          </p>
        </div>

        {chantiers.length > 0 && (
          <div>
            <label htmlFor="scheduledJobId" className="mb-1 block text-sm font-medium">
              Chantier <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <select
              id="scheduledJobId"
              name="scheduledJobId"
              defaultValue=""
              className="min-h-[48px] w-full rounded-lg border border-border bg-card px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
            >
              <option value="">Aucun</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titre}
                  {c.client ? ` — ${c.client}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="notes-prise" className="mb-1 block text-sm font-medium">
            Note <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <textarea
            id="notes-prise"
            name="notes"
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
          />
        </div>

        <BoutonsDeFeuille enCours={enCours} libelle="Confirmer la prise" onFermer={onFermer} />
      </form>
    </FeuilleModale>
  );
}

/* ──────────────────────────── Retourner un outil ─────────────────────────── */

const ETATS: Array<{ valeur: EtatDuRetour; libelle: string }> = [
  { valeur: "good", libelle: "Bon état" },
  { valeur: "damaged", libelle: "Abîmé" },
  { valeur: "needs_repair", libelle: "À réparer" },
  { valeur: "missing_part", libelle: "Pièce manquante" },
];

function DialogueRetour({
  outil,
  enCours,
  onFermer,
  onConfirmer,
}: {
  outil: ToolListItem;
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: (fd: FormData) => void;
}) {
  const [etat, setEtat] = useState<EtatDuRetour>("good");
  const probleme = etat !== "good";

  return (
    <FeuilleModale titre={`Retourner ${outil.name}`} onFermer={onFermer}>
      <form
        action={(fd) => {
          fd.set("toolId", outil.id);
          fd.set("etat", etat);
          onConfirmer(fd);
        }}
        className="space-y-4"
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">État de l&apos;outil</legend>
          <div className="grid grid-cols-2 gap-2">
            {ETATS.map((e) => (
              <button
                key={e.valeur}
                type="button"
                aria-pressed={etat === e.valeur}
                onClick={() => setEtat(e.valeur)}
                className={cn(
                  "min-h-[48px] rounded-lg border px-2 text-[14px] font-medium",
                  "transition-colors duration-normal motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole",
                  etat === e.valeur
                    ? "border-petrole bg-petrole text-petrole-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {e.libelle}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="notes-retour" className="mb-1 block text-sm font-medium">
            {probleme ? "Décrivez le problème" : "Note (facultatif)"}
          </label>
          <textarea
            id="notes-retour"
            name="notes"
            rows={3}
            maxLength={500}
            required={probleme}
            placeholder={probleme ? "Ex. : mandrin coincé, ne serre plus" : ""}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
          />
          {probleme && (
            <p className="mt-1 flex items-start gap-1.5 text-[12px] text-accent-encre">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              L&apos;outil passera en réparation et le bureau verra votre signalement.
            </p>
          )}
        </div>

        <BoutonsDeFeuille enCours={enCours} libelle="Confirmer le retour" onFermer={onFermer} />
      </form>
    </FeuilleModale>
  );
}

/* ─────────────────────────── Le châssis des feuilles ─────────────────────── */

/**
 * UNE FEUILLE QUI MONTE DU BAS, pas une fenêtre au milieu.
 *
 * Sur un téléphone, le clavier occupe la moitié basse de l'écran. Une boîte
 * centrée se retrouve poussée sous le clavier dès qu'on touche un champ ;
 * une feuille ancrée en bas reste accessible au pouce et défile avec son
 * contenu.
 */
function FeuilleModale({
  titre,
  onFermer,
  children,
}: {
  titre: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function surEchap(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", surEchap);
    // Le fond ne défile plus sous la feuille.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surEchap);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="absolute inset-0 bg-petrole/50 backdrop-blur-[2px]"
      />
      <div className="relative mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-flottant motion-safe:animate-in motion-safe:slide-in-from-bottom">
        <h2 className="mb-3 text-[17px] font-semibold text-foreground">{titre}</h2>
        {children}
      </div>
    </div>
  );
}

function BoutonsDeFeuille({
  enCours,
  libelle,
  onFermer,
}: {
  enCours: boolean;
  libelle: string;
  onFermer: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onFermer}
        disabled={enCours}
        className="min-h-[48px] flex-1 rounded-lg border border-border px-4 text-[15px] font-semibold text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
      >
        Annuler
      </button>
      {/*
        DÉSACTIVÉ PENDANT L'ENVOI : un double appui avec des gants créerait
        deux mouvements. La base refuserait le second, mais l'homme verrait
        une erreur pour un geste qu'il croyait unique.
      */}
      <button
        type="submit"
        data-testid="confirmer-feuille"
        disabled={enCours}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petrole"
      >
        {enCours && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {libelle}
      </button>
    </div>
  );
}
