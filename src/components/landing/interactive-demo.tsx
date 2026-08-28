"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Pause,
  Play,
  Receipt,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_DURATION_MS = 6500;
const TICK_MS = 40;

function ClientsMockup() {
  const clients = [
    { name: "Marie Tremblay", project: "Rénovation cuisine", status: "Actif" },
    { name: "J. Bouchard Inc.", project: "Extension garage", status: "Actif" },
    { name: "Alain Roy", project: "Toiture", status: "En attente" },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Clients</span>
        <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          + Nouveau client
        </span>
      </div>
      <div className="h-8 rounded-md border bg-muted/40" />
      <div className="flex flex-1 flex-col gap-2">
        {clients.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {c.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.project}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                c.status === "Actif"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteMockup() {
  const lines = [
    { label: "Démolition existante", amount: "450 $" },
    { label: "Matériaux et fournitures", amount: "2 100 $" },
    { label: "Main-d'œuvre (3 jours)", amount: "1 800 $" },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Soumission #1042</p>
          <p className="text-xs text-muted-foreground">Marie Tremblay — Rénovation cuisine</p>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
          Envoyée
        </span>
      </div>
      <div className="flex-1 rounded-lg border bg-background p-3">
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium text-foreground">{l.amount}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-2">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-sm font-semibold text-foreground">4 350 $</span>
        </div>
      </div>
      <div className="rounded-md bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
        Acceptée en ligne par le client
      </div>
    </div>
  );
}

function ScheduleMockup() {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
  const blocks: Record<string, { label: string; color: string }[]> = {
    Lun: [{ label: "Éq. A · Tremblay", color: "bg-primary/15 text-primary" }],
    Mar: [{ label: "Éq. A · Tremblay", color: "bg-primary/15 text-primary" }],
    Mer: [{ label: "Éq. B · Bouchard", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }],
    Jeu: [{ label: "Éq. B · Bouchard", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }],
    Ven: [{ label: "Éq. A · Roy", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }],
  };
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Planification — cette semaine</p>
      <div className="grid flex-1 grid-cols-5 gap-2">
        {days.map((d) => (
          <div key={d} className="flex flex-col gap-2 rounded-lg border bg-background p-2">
            <span className="text-center text-[10px] font-medium text-muted-foreground">{d}</span>
            {blocks[d].map((b) => (
              <div
                key={b.label}
                className={cn("rounded-md px-1.5 py-2 text-center text-[10px] font-medium", b.color)}
              >
                {b.label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceMockup() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Facture #2201</p>
          <p className="text-xs text-muted-foreground">Généré depuis la soumission #1042</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          Payée
        </span>
      </div>
      <div className="flex-1 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Travaux réalisés</span>
          <span className="font-medium text-foreground">4 350 $</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Dépôt reçu</span>
          <span className="font-medium text-foreground">- 1 000 $</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-2">
          <span className="text-sm font-semibold text-foreground">Solde dû</span>
          <span className="text-sm font-semibold text-foreground">3 350 $</span>
        </div>
      </div>
      <div className="rounded-md bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary">
        Envoyée automatiquement au client
      </div>
    </div>
  );
}

function PaymentMockup() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">Paiement reçu — 3 350 $</p>
        <p className="text-xs text-muted-foreground">Par carte de crédit · Interac disponible</p>
      </div>
      <div className="flex w-full max-w-[220px] items-center gap-2 rounded-md border bg-background px-3 py-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-emerald-500" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">100 %</span>
      </div>
    </div>
  );
}

const chapters = [
  {
    title: "Clients",
    description: "Centralisez vos contacts, projets et historique client.",
    caption: "Marie vous appelle pour rénover sa cuisine. Sa fiche client est créée en 10 secondes.",
    icon: Users,
    Mockup: ClientsMockup,
  },
  {
    title: "Soumissions",
    description: "Créez et envoyez des soumissions professionnelles en quelques clics.",
    caption: "Vous lui envoyez une soumission détaillée. Marie l'accepte et la signe en ligne, sans papier.",
    icon: FileText,
    Mockup: QuoteMockup,
  },
  {
    title: "Planification",
    description: "Organisez les équipes et les chantiers dans un calendrier partagé.",
    caption: "Vous assignez une équipe et bloquez les dates. Tout le monde voit le chantier au même endroit.",
    icon: Calendar,
    Mockup: ScheduleMockup,
  },
  {
    title: "Facturation",
    description: "Générez vos factures à partir des travaux réalisés.",
    caption: "Les travaux sont terminés : la facture se génère automatiquement à partir de la soumission.",
    icon: Receipt,
    Mockup: InvoiceMockup,
  },
  {
    title: "Paiement",
    description: "Encaissez en ligne par carte ou Interac selon vos préférences.",
    caption: "Marie paie en ligne par carte ou Interac. L'argent est déposé et le dossier est fermé.",
    icon: CreditCard,
    Mockup: PaymentMockup,
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
