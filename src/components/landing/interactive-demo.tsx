"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CreditCard,
  FileText,
  Pause,
  Play,
  Receipt,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_DURATION_MS = 6500;
const TICK_MS = 40;

/**
 * Un seul chantier suivi du début à la fin, avec de vrais chiffres.
 *
 * L'argument de vente tient en une phrase : les heures et les matériaux saisis
 * au chantier remontent seuls dans la facture.
 *
 * LES ÉCRANS SONT COPIÉS SUR CEUX DE L'APPLICATION, pas imaginés. Une version
 * précédente montrait un chronomètre sur l'étape terrain — il n'en existe
 * aucun. Le vrai parcours est « Commencer les travaux », puis la saisie des
 * heures. Une démo qui promet autre chose que le produit est pire que pas de
 * démo : elle se paie au premier essai du client.
 *
 * LES TOTAUX SONT CALCULÉS À PARTIR DES LIGNES, jamais recopiés à la main.
 * J'ai faussé trois additions dans ce fichier en les écrivant en dur.
 */

const TPS = 0.05;
const TVQ = 0.09975;
const cents = (n: number) => Math.round(n * 100) / 100;

/** Montant en dollars canadiens, écrit à la québécoise. */
function argent(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

interface Ligne {
  d: string;
  q: number;
  unite?: string;
  p: number;
  /** Ajouté au chantier par l'employé — souligné dans la facture. */
  terrain?: boolean;
}

const somme = (lignes: readonly Ligne[]) => cents(lignes.reduce((s, l) => s + l.q * l.p, 0));

function totaux(sousTotal: number) {
  const tps = cents(sousTotal * TPS);
  const tvq = cents(sousTotal * TVQ);
  return { sousTotal, tps, tvq, total: cents(sousTotal + tps + tvq) };
}

// ── Le chantier ────────────────────────────────────────────────────────────
const MO_PREVUE: Ligne[] = [
  { d: "Compagnon", q: 24, unite: "h", p: 125 },
  { d: "Apprenti", q: 24, unite: "h", p: 85 },
];
const MATERIAUX: Ligne[] = [
  { d: "Chauffe-eau 60 gal Giant", q: 1, p: 1245 },
  { d: "Tuyau PEX ½ po — rouleau 100 pi", q: 2, p: 89.5 },
  { d: "Raccords PEX sertis", q: 24, p: 3.75 },
  { d: "Robinetterie Moen", q: 2, p: 389 },
  { d: "Drain de douche ABS", q: 2, p: 62 },
  { d: "Valve d'arrêt ¼ tour", q: 6, p: 18.5 },
];
const MO_REELLE: Ligne[] = [
  { d: "Compagnon", q: 27.5, unite: "h", p: 125 },
  { d: "Apprenti", q: 26, unite: "h", p: 85 },
];
const COUDE: Ligne = { d: "Coude ½ po", q: 4, p: 9.5, terrain: true };

const SOUMISSION = totaux(cents(somme(MO_PREVUE) + somme(MATERIAUX)));
const DEPOT = cents(SOUMISSION.total * 0.3);
const FACTURE = totaux(cents(somme(MO_REELLE) + somme([...MATERIAUX, COUDE])));
const GAIN = cents(FACTURE.total - SOUMISSION.total);
const SOLDE = cents(FACTURE.total - DEPOT);

function LigneTotal({
  libelle,
  montant,
  fort = false,
}: {
  libelle: string;
  montant: string;
  fort?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        fort ? "border-t pt-1.5 text-base font-bold text-foreground" : "text-sm text-muted-foreground"
      )}
    >
      <span>{libelle}</span>
      <span className={cn("tabular-nums", fort && "text-lg")}>{montant}</span>
    </div>
  );
}

function TableauLignes({ lignes, compact = false }: { lignes: readonly Ligne[]; compact?: boolean }) {
  return (
    <table className={cn("w-full", compact ? "text-xs" : "text-sm")}>
      <thead className="text-muted-foreground">
        <tr className="border-b">
          <th className="py-1.5 text-left font-medium">Description</th>
          <th className="px-2 py-1.5 text-right font-medium">Qté</th>
          <th className="px-2 py-1.5 text-right font-medium">Prix</th>
          <th className="py-1.5 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {lignes.map((l) => (
          <tr key={l.d} className={l.terrain ? "bg-emerald-500/10" : undefined}>
            <td className="py-1.5 pr-2 text-foreground">
              {l.d}
              {l.terrain && (
                <span className="ml-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  ajouté au chantier
                </span>
              )}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
              {l.q.toLocaleString("fr-CA")}
              {l.unite ? ` ${l.unite}` : ""}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
              {argent(l.p)}
            </td>
            <td className="py-1.5 text-right font-medium tabular-nums text-foreground">
              {argent(cents(l.q * l.p))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SoumissionMockup() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-foreground">SO-2026-0141</span>
        <span className="truncate text-xs text-muted-foreground">
          Marie Gagnon — 118, rue Saint-Joseph, Lévis
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border px-2">
        <TableauLignes lignes={[...MO_PREVUE, ...MATERIAUX]} compact />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="max-w-[46%] text-xs leading-snug text-muted-foreground">
          Dépôt de 30 %&nbsp;: <span className="font-semibold text-foreground">{argent(DEPOT)}</span>
        </p>
        <div className="w-52 space-y-0.5">
          <LigneTotal libelle="Sous-total" montant={argent(SOUMISSION.sousTotal)} />
          <LigneTotal libelle="TPS 5 %" montant={argent(SOUMISSION.tps)} />
          <LigneTotal libelle="TVQ 9,975 %" montant={argent(SOUMISSION.tvq)} />
          <LigneTotal libelle="Total" montant={argent(SOUMISSION.total)} fort />
        </div>
      </div>
    </div>
  );
}

function CalendrierMockup() {
  const lignes = [
    { nom: "Marc Tremblay", metier: "Compagnon", debut: "7 h 00", fin: "15 h 30", gauche: 8, largeur: 46 },
    { nom: "Luc Gagnon", metier: "Apprenti", debut: "9 h 00", fin: "17 h 00", gauche: 22, largeur: 44 },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-foreground">mer. 16 septembre</span>
        <span className="text-xs text-muted-foreground">Réfection plomberie — Gagnon</span>
      </div>
      <div className="flex gap-1 pl-[104px] text-[11px] text-muted-foreground">
        {["6 h", "9 h", "12 h", "15 h", "18 h"].map((h) => (
          <span key={h} className="flex-1">{h}</span>
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3">
        {lignes.map((l) => (
          <div key={l.nom} className="flex items-center gap-2">
            <div className="w-24 shrink-0">
              <p className="truncate text-xs font-medium text-foreground">{l.nom}</p>
              <p className="truncate text-[11px] text-muted-foreground">{l.metier}</p>
            </div>
            <div className="relative h-10 flex-1 rounded-md border bg-muted/30">
              <div
                className="absolute inset-y-0.5 flex items-center rounded bg-primary/85 px-2 text-[11px] font-medium text-primary-foreground"
                style={{ left: `${l.gauche}%`, width: `${l.largeur}%` }}
              >
                {l.debut} – {l.fin}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
        Chacun sa plage sur le même chantier. La caméra d&apos;inspection RIDGID
        (OUT-014) sort au nom de Marc.
      </p>
    </div>
  );
}

function TerrainMockup() {
  // Copié sur /terrain/calls/[id] : ce sont les vrais boutons, dans cet ordre.
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <div className="w-[188px] shrink-0 rounded-[1.4rem] border-4 border-foreground/80 bg-background p-2.5 shadow-lg">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-foreground/30" />
        <p className="text-[11px] font-semibold leading-tight text-foreground">
          Réfection plomberie — 2 sdb
        </p>
        <p className="text-[10px] text-muted-foreground">Marie Gagnon · Lévis</p>

        <p className="mt-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Statut du call
        </p>
        <div className="mt-1 space-y-1">
          <div className="rounded-md border py-1 text-center text-[10px] text-muted-foreground">
            Je suis en route
          </div>
          <div className="rounded-md bg-primary py-1.5 text-center text-[11px] font-semibold text-primary-foreground">
            Commencer les travaux
          </div>
          <div className="rounded-md border py-1 text-center text-[10px] text-muted-foreground">
            Travaux terminés
          </div>
        </div>

        <p className="mt-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          Mes heures
        </p>
        <div className="mt-1 flex gap-1">
          <div className="flex-1 rounded border px-1.5 py-1 text-[10px] text-foreground">8,5</div>
          <div className="rounded border px-1.5 py-1 text-[10px] text-muted-foreground">h</div>
        </div>
        <div className="mt-1 rounded-md bg-primary/10 py-1 text-center text-[10px] font-medium text-primary">
          Ajouter les heures
        </div>
        <div className="mt-1 rounded-md border py-1 text-center text-[10px] text-foreground">
          Ajouter le matériau
        </div>
      </div>

      <ol className="space-y-3">
        {[
          "Il ouvre son call",
          "Commencer les travaux",
          "Ses heures et son matériel",
        ].map((t, i) => (
          <li key={t} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="text-sm font-medium text-foreground">{t}</span>
          </li>
        ))}
        <li className="max-w-[15rem] pt-1 text-xs leading-snug text-muted-foreground">
          8,5 h au lieu des 8 prévues, et un coude ½ po pris dans le camion — les
          deux entrent dans la facture sans que personne les retape.
        </li>
      </ol>
    </div>
  );
}

function FactureMockup() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-foreground">FA-2026-0288</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          remplie depuis le terrain
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
        <span>Prévu <strong>48 h</strong></span>
        <span>Réel <strong>53,5 h</strong></span>
        <span className="text-emerald-600 dark:text-emerald-400">
          Écart <strong>+5,5 h</strong>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border px-2">
        <TableauLignes lignes={[...MO_REELLE, ...MATERIAUX, COUDE]} compact />
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="max-w-[48%] text-sm font-semibold leading-snug text-emerald-700 dark:text-emerald-400">
          {argent(GAIN)} que vous auriez oubliés de facturer.
        </p>
        <div className="w-52 space-y-0.5">
          <LigneTotal libelle="Sous-total" montant={argent(FACTURE.sousTotal)} />
          <LigneTotal libelle="TPS 5 %" montant={argent(FACTURE.tps)} />
          <LigneTotal libelle="TVQ 9,975 %" montant={argent(FACTURE.tvq)} />
          <LigneTotal libelle="Total" montant={argent(FACTURE.total)} fort />
        </div>
      </div>
    </div>
  );
}

function PaiementMockup() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-sm">
        <p className="text-xs text-muted-foreground">Facture FA-2026-0288</p>
        <p className="mt-0.5 font-semibold text-foreground">Marie Gagnon</p>
        <div className="my-4 space-y-1">
          <LigneTotal libelle="Total de la facture" montant={argent(FACTURE.total)} />
          <LigneTotal libelle="Dépôt déjà reçu" montant={`− ${argent(DEPOT)}`} />
          <LigneTotal libelle="Solde à payer" montant={argent(SOLDE)} fort />
        </div>
        <div className="rounded-lg bg-primary py-2.5 text-center font-semibold text-primary-foreground">
          Payer par Interac
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Virement Interac ou carte — déposé dans votre compte
        </p>
      </div>
    </div>
  );
}

const chapters = [
  {
    title: "La soumission",
    description: "Main-d'œuvre et matériaux, ligne par ligne, taxes du Québec incluses.",
    caption:
      "Marie veut refaire deux salles de bain. Vous chiffrez 48 heures de main-d'œuvre et six postes de matériel, taxes du Québec comprises. Dépôt de 30 % à l'acceptation.",
    icon: FileText,
    Mockup: SoumissionMockup,
  },
  {
    title: "Le calendrier",
    description: "Vos hommes assignés au chantier, chacun à ses heures.",
    caption:
      "Marc entre à 7 h, Luc à 9 h. Chacun sa plage sur le même chantier, et la caméra d'inspection part au nom de Marc.",
    icon: Calendar,
    Mockup: CalendrierMockup,
  },
  {
    title: "Le terrain",
    description: "Vos hommes saisissent leurs heures depuis leur téléphone.",
    caption:
      "Marc ouvre son call, touche « Commencer les travaux », et inscrit ses heures en partant. 8,5 h au lieu de 8 — et le coude ½ po pris dans le camion.",
    icon: Smartphone,
    Mockup: TerrainMockup,
  },
  {
    title: "La facture",
    description: "Elle se monte toute seule à partir des heures réellement faites.",
    caption:
      "48 heures prévues, 53,5 heures faites, plus le matériel ajouté au chantier. Tout se retrouve dans la facture parce que tout a été noté — vous n'avez rien retapé.",
    icon: Receipt,
    Mockup: FactureMockup,
  },
  {
    title: "Le paiement",
    description: "Interac ou carte, déposé dans votre compte.",
    caption:
      "Marie règle le solde par Interac, dépôt déduit. Le dossier se ferme, et rien n'a été ressaisi depuis la soumission.",
    icon: CreditCard,
    Mockup: PaiementMockup,
  },
] as const;

export function InteractiveDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    if (query.matches) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (TICK_MS / STEP_DURATION_MS) * 100;
        if (next >= 100) {
          setActiveStep((step) => (step + 1) % chapters.length);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [playing]);

  function goToChapter(index: number) {
    setActiveStep(index);
    setProgress(0);
  }

  const Active = chapters[activeStep];

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      aria-label="Démo interactive de Construction iOS"
    >
      <div className="grid lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs font-medium text-muted-foreground">
              Étape {activeStep + 1} sur {chapters.length} — {Active.title}
            </span>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
              aria-label={playing ? "Mettre la démo en pause" : "Lancer la démo"}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border bg-background text-foreground transition hover:bg-muted"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex gap-1.5 px-4 pt-3" role="tablist" aria-label="Étapes de la démo">
            {chapters.map((chapter, index) => (
              <div key={chapter.title} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
                  style={{
                    width:
                      index < activeStep ? "100%" : index === activeStep ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          <div key={activeStep} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div className="h-64 px-5 pt-5 sm:h-72">
              <Active.Mockup />
            </div>
            <div className="mx-5 mb-5 mt-4 flex items-start gap-2.5 rounded-lg bg-primary/5 px-3.5 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeStep + 1}
              </span>
              <p className="text-sm font-medium leading-snug text-foreground">{Active.caption}</p>
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/20 lg:col-span-2 lg:border-l lg:border-t-0">
          <ul className="divide-y" role="tablist" aria-orientation="vertical">
            {chapters.map((chapter, index) => {
              const isActive = index === activeStep;
              return (
                <li key={chapter.title}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => goToChapter(index)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3.5 text-left transition",
                      isActive ? "bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                      )}
                    >
                      <chapter.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          isActive ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {index + 1}. {chapter.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {chapter.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
