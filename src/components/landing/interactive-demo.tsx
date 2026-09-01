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
 * L'argument de vente tient en une phrase : les heures saisies au chantier
 * remontent seules dans la facture. La version précédente racontait
 * « client → soumission → planification → facturation → paiement », ce que
 * fait n'importe quel logiciel de gestion, et ne le disait nulle part.
 *
 * Les montants sont ceux d'une réfection de plomberie résidentielle à Lévis,
 * validés par un entrepreneur. Taxes du Québec : TPS 5 %, TVQ 9,975 %.
 */

/** Montant en dollars canadiens, écrit à la québécoise. */
function argent(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

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
        "flex items-baseline justify-between",
        fort ? "border-t pt-1.5 text-sm font-bold text-foreground" : "text-xs text-muted-foreground"
      )}
    >
      <span>{libelle}</span>
      <span className={cn("tabular-nums", fort && "text-base")}>{montant}</span>
    </div>
  );
}

function SoumissionMockup() {
  const lignes = [
    { d: "Plombier — taux régulier", q: "24 h", p: 95, t: 2280 },
    { d: "Apprenti", q: "24 h", p: 62, t: 1488 },
    { d: "Chauffe-eau 60 gal Giant", q: "1", p: 1245, t: 1245 },
    { d: "Tuyauterie PEX et raccords", q: "1", p: 685, t: 685 },
    { d: "Robinetterie Moen", q: "2", p: 389, t: 778 },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">SO-2026-0141</span>
        <span className="text-[11px] text-muted-foreground">
          Marie Gagnon — 118, rue Saint-Joseph, Lévis
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Description</th>
              <th className="px-2 py-1.5 text-right font-medium">Qté</th>
              <th className="px-2 py-1.5 text-right font-medium">Prix</th>
              <th className="px-2 py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((l) => (
              <tr key={l.d}>
                <td className="truncate px-2 py-1.5 text-foreground">{l.d}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{l.q}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {argent(l.p)}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">
                  {argent(l.t)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="max-w-[48%] text-[11px] leading-snug text-muted-foreground">
          Dépôt de 30 % à l&apos;acceptation&nbsp;:{" "}
          <span className="font-semibold text-foreground">{argent(2233.73)}</span>
        </p>
        <div className="w-44 space-y-1">
          <LigneTotal libelle="Sous-total" montant={argent(6476)} />
          <LigneTotal libelle="TPS 5 %" montant={argent(323.8)} />
          <LigneTotal libelle="TVQ 9,975 %" montant={argent(645.98)} />
          <LigneTotal libelle="Total" montant={argent(7445.78)} fort />
        </div>
      </div>
    </div>
  );
}

function CalendrierMockup() {
  // Deux hommes sur le même call, à des heures différentes : c'est le point.
  const lignes = [
    { nom: "Marc Tremblay", metier: "Plombier", debut: "7 h 00", fin: "15 h 30", gauche: 8, largeur: 46 },
    { nom: "Luc Gagnon", metier: "Apprenti", debut: "9 h 00", fin: "17 h 00", gauche: 22, largeur: 44 },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">Mercredi 16 septembre</span>
        <span className="text-[11px] text-muted-foreground">Réfection plomberie — Gagnon</span>
      </div>
      <div className="flex gap-1 pl-[104px] text-[10px] text-muted-foreground">
        {["6 h", "9 h", "12 h", "15 h", "18 h"].map((h) => (
          <span key={h} className="flex-1">
            {h}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {lignes.map((l) => (
          <div key={l.nom} className="flex items-center gap-2">
            <div className="w-24 shrink-0">
              <p className="truncate text-[11px] font-medium text-foreground">{l.nom}</p>
              <p className="truncate text-[10px] text-muted-foreground">{l.metier}</p>
            </div>
            <div className="relative h-9 flex-1 rounded-md border bg-muted/30">
              <div
                className="absolute inset-y-0.5 flex items-center rounded bg-primary/85 px-2 text-[10px] font-medium text-primary-foreground"
                style={{ left: `${l.gauche}%`, width: `${l.largeur}%` }}
              >
                {l.debut} – {l.fin}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        Caméra d&apos;inspection RIDGID (OUT-014) sortie au nom de Marc
      </p>
    </div>
  );
}

function TerrainMockup() {
  // Trois gestes, pas un de plus. Un entrepreneur qui trouve ça compliqué ne
  // croira jamais que ses hommes s'en serviront.
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <div className="w-[168px] shrink-0 rounded-[1.4rem] border-4 border-foreground/80 bg-background p-2.5 shadow-lg">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-foreground/30" />
        <p className="text-[10px] font-semibold text-foreground">Réfection plomberie</p>
        <p className="text-[9px] text-muted-foreground">Gagnon — Lévis</p>
        <div className="my-2 rounded-lg bg-primary/10 py-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-primary">8 h 30</p>
          <p className="text-[9px] text-muted-foreground">démarré à 7 h 02</p>
        </div>
        <div className="rounded-lg bg-primary py-2 text-center text-[11px] font-semibold text-primary-foreground">
          Arrêter
        </div>
        <div className="mt-1.5 rounded-lg border py-1.5 text-center text-[10px] text-foreground">
          + Matériau
        </div>
      </div>
      <ol className="space-y-2.5">
        {[
          "Il ouvre son téléphone",
          "Il part le chronomètre",
          "C'est tout.",
        ].map((t, i) => (
          <li key={t} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span
              className={cn(
                "text-sm text-foreground",
                i === 2 && "font-semibold"
              )}
            >
              {t}
            </span>
          </li>
        ))}
        <li className="pt-1 text-[11px] leading-snug text-muted-foreground">
          Le coude ½ po ajouté sur place — 38 $ — entre aussi dans la facture.
        </li>
      </ol>
    </div>
  );
}

function FactureMockup() {
  const lignes = [
    { d: "Plombier", prevu: "24 h", reel: "27,5 h", ecart: "+3,5 h" },
    { d: "Apprenti", prevu: "24 h", reel: "26 h", ecart: "+2 h" },
    { d: "Matériaux", prevu: argent(2708), reel: argent(2746), ecart: "+38,00 $" },
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-foreground">FA-2026-0288</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          remplie depuis le terrain
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Soumissionné</th>
              <th className="px-2 py-1.5 text-right font-medium">Prévu</th>
              <th className="px-2 py-1.5 text-right font-medium">Réel</th>
              <th className="px-2 py-1.5 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lignes.map((l) => (
              <tr key={l.d}>
                <td className="px-2 py-1.5 text-foreground">{l.d}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {l.prevu}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">
                  {l.reel}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {l.ecart}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="max-w-[52%] text-[11px] font-medium leading-snug text-emerald-700 dark:text-emerald-400">
          568,56 $ que vous auriez oubliés de facturer.
        </p>
        <div className="w-44 space-y-1">
          <LigneTotal libelle="Sous-total" montant={argent(6970.5)} />
          <LigneTotal libelle="TPS 5 %" montant={argent(348.53)} />
          <LigneTotal libelle="TVQ 9,975 %" montant={argent(695.31)} />
          <LigneTotal libelle="Total" montant={argent(8014.34)} fort />
        </div>
      </div>
    </div>
  );
}

function PaiementMockup() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="w-full max-w-xs rounded-xl border bg-background p-4 shadow-sm">
        <p className="text-[11px] text-muted-foreground">Facture FA-2026-0288</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">Marie Gagnon</p>
        <div className="my-3 space-y-1">
          <LigneTotal libelle="Total de la facture" montant={argent(8014.34)} />
          <LigneTotal libelle="Dépôt déjà reçu" montant={`− ${argent(2233.73)}`} />
          <LigneTotal libelle="Solde à payer" montant={argent(5780.61)} fort />
        </div>
        <div className="rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
          Payer par Interac
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
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
      "Marie veut refaire deux salles de bain. Vous chiffrez 48 heures et 2 708 $ de matériel : 7 445,78 $, dépôt de 30 % à l'acceptation.",
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
      "Marc part le chronomètre en arrivant. Il fera 8 h 30 au lieu de 8 h — et cette demi-heure-là est maintenant notée.",
    icon: Smartphone,
    Mockup: TerrainMockup,
  },
  {
    title: "La facture",
    description: "Elle se monte toute seule à partir des heures réellement faites.",
    caption:
      "48 heures prévues, 53,5 heures faites. Les 5,5 heures de plus sont facturées parce qu'elles ont été notées sur le chantier : 568,56 $ que vous auriez perdus.",
    icon: Receipt,
    Mockup: FactureMockup,
  },
  {
    title: "Le paiement",
    description: "Interac ou carte, déposé dans votre compte.",
    caption:
      "Marie règle le solde de 5 780,56 $ par Interac. Le dossier se ferme, et vous n'avez rien retapé depuis la soumission.",
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
