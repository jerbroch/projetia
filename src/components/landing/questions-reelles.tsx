"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Hammer, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LES QUESTIONS QUE L'ENTREPRENEUR SE POSE VRAIMENT, ET CE QUE L'ÉCRAN RÉPOND.
 *
 * Chaque question porte une petite démonstration : un fragment d'interface qui
 * bouge une fois, montre la réponse, et s'arrête. C'est la différence entre
 * « nous gérons vos soumissions » et voir une pastille passer de « Envoyée » à
 * « Acceptée ».
 *
 * TOUT CE QUI EST MONTRÉ EXISTE. Les statuts sont ceux de `QuoteStatus`
 * (draft, sent, viewed, accepted, deposit_paid), l'outillage est celui de
 * `/outillage` et `/terrain/outils`, la saisie des heures est celle de
 * `/terrain`. Une démonstration qui promet un écran inexistant se paie au
 * premier essai du client — la démo du chantier porte déjà cette cicatrice en
 * commentaire.
 *
 * ELLES NE S'ANIMENT QU'UNE FOIS, À L'ARRIVÉE À L'ÉCRAN. Cinq fragments qui
 * bougent en boucle pendant qu'on lit, c'est une page qui clignote. Un
 * `IntersectionObserver` déclenche le geste au moment où la question devient
 * lisible, puis plus rien.
 *
 * `prefers-reduced-motion` montre directement l'état d'arrivée : la réponse
 * reste visible, seul le mouvement disparaît.
 */

/** Vrai dès que l'élément a été vu — et ça ne redevient jamais faux. */
function useVuUneFois<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Animations réduites : on saute directement à l'état final.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVu(true);
      return;
    }
    // Pas d'observateur disponible (navigateur ancien, test) : même chose.
    if (typeof IntersectionObserver === "undefined") {
      setVu(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVu(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, vu };
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <div className="rounded-md border bg-card p-3 shadow-sm">{children}</div>
    </div>
  );
}

/** « Où est rendue cette soumission? » — la pastille avance d'elle-même. */
function OuEstLaSoumission({ vu }: { vu: boolean }) {
  // Les trois états réels par lesquels une soumission passe avant l'acceptation.
  const etapes = ["Envoyée", "Vue", "Acceptée"] as const;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!vu) return;
    const t1 = window.setTimeout(() => setI(1), 700);
    const t2 = window.setTimeout(() => setI(2), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [vu]);

  return (
    <Cadre>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">SO-2026-0141</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-500",
            i === 2
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-primary/10 text-accent-encre",
          )}
        >
          {etapes[i]}
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {etapes.map((e, n) => (
          <div key={e} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out",
                n === 2 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: n <= i ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>
    </Cadre>
  );
}

/** « Combien d'heures n'ont pas été facturées? » — la ligne arrive du terrain. */
function LesHeuresOubliees({ vu }: { vu: boolean }) {
  return (
    <Cadre>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Compagnon — prévu</span>
          <span className="tabular-nums">24 h</span>
        </div>
        <div
          className={cn(
            "flex items-center justify-between rounded px-1.5 py-1 transition-all duration-700 ease-out",
            vu
              ? "translate-y-0 bg-emerald-500/10 opacity-100"
              : "translate-y-1 bg-transparent opacity-0",
          )}
        >
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Smartphone className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Saisi au chantier
          </span>
          <span className="tabular-nums font-semibold text-foreground">+ 3,5 h</span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5 font-semibold text-foreground">
          <span>Facturé</span>
          <span
            className={cn(
              "tabular-nums transition-colors duration-700",
              vu ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
            )}
          >
            {vu ? "27,5 h" : "24 h"}
          </span>
        </div>
      </div>
    </Cadre>
  );
}

/** « Qui travaille sur quel chantier demain? » — le chantier se pose au calendrier. */
function QuiTravailleDemain({ vu }: { vu: boolean }) {
  const lignes = [
    { nom: "Marc T.", gauche: 10, largeur: 48, delai: 0 },
    { nom: "Luc G.", gauche: 26, largeur: 40, delai: 180 },
  ];
  return (
    <Cadre>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
        jeu. 17 septembre
      </div>
      <div className="mt-2 space-y-2">
        {lignes.map((l) => (
          <div key={l.nom} className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate text-[11px] text-muted-foreground">
              {l.nom}
            </span>
            <div className="relative h-6 flex-1 rounded border bg-muted/40">
              <div
                className="absolute inset-y-0.5 rounded bg-primary/85 transition-[width,opacity] duration-700 ease-out"
                style={{
                  left: `${l.gauche}%`,
                  width: vu ? `${l.largeur}%` : "0%",
                  opacity: vu ? 1 : 0,
                  transitionDelay: `${l.delai}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Cadre>
  );
}

/** « Quels outils sont encore dans le camion? » — chaque outil a un porteur. */
function LesOutilsDuCamion({ vu }: { vu: boolean }) {
  const outils = [
    { nom: "Caméra d'inspection", porteur: "Marc T.", delai: 0 },
    { nom: "Sertisseuse PEX", porteur: "Luc G.", delai: 150 },
    { nom: "Détecteur de fuite", porteur: "À l'atelier", delai: 300, atelier: true },
  ];
  return (
    <Cadre>
      <ul className="space-y-1.5">
        {outils.map((o) => (
          <li
            key={o.nom}
            className={cn(
              "flex items-center justify-between gap-2 text-xs transition-all duration-500 ease-out",
              vu ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
            )}
            style={{ transitionDelay: `${o.delai}ms` }}
          >
            <span className="flex items-center gap-1.5 truncate text-foreground">
              <Hammer className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {o.nom}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                o.atelier ? "bg-muted text-muted-foreground" : "bg-primary/10 text-accent-encre",
              )}
            >
              {o.porteur}
            </span>
          </li>
        ))}
      </ul>
    </Cadre>
  );
}

/** « Est-ce que le client a payé son dépôt? » — le dépôt passe à payé. */
function LeDepotEstIlPaye({ vu }: { vu: boolean }) {
  return (
    <Cadre>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden />
          Dépôt 30 %
        </span>
        <span className="text-base font-bold tabular-nums text-foreground">2 610,05 $</span>
      </div>
      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-700 ease-out",
          vu
            ? "translate-y-0 bg-emerald-500/10 opacity-100"
            : "translate-y-1 bg-transparent opacity-0",
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
          <Check className="h-3 w-3 text-white" aria-hidden />
        </span>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Reçu par virement — 14 septembre
        </span>
      </div>
    </Cadre>
  );
}

/**
 * Les cinq questions, dans l'ordre où elles se posent : pendant le travail,
 * après le travail, puis avant le prochain.
 */
const QUESTIONS = [
  {
    q: "Combien d'heures n'ont pas été facturées ce mois-ci?",
    r: "Vos hommes saisissent leurs heures depuis leur téléphone. Elles montent dans la facture sans que personne ait à s'en souvenir.",
    Demo: LesHeuresOubliees,
  },
  {
    q: "Où est rendue cette soumission?",
    r: "Envoyée, vue, acceptée : le statut change tout seul quand le client agit.",
    Demo: OuEstLaSoumission,
  },
  {
    q: "Qui travaille sur quel chantier demain?",
    r: "Le calendrier le dit, et vos employés le voient sur leur téléphone.",
    Demo: QuiTravailleDemain,
  },
  {
    q: "Quels outils sont encore dans le camion?",
    r: "Chaque outil a un porteur. Vous savez qui l'a pris et quand il est revenu.",
    Demo: LesOutilsDuCamion,
  },
  {
    q: "Est-ce que le client a payé son dépôt?",
    r: "Le dépôt passe à « reçu » dès que le virement est enregistré, et la soumission devient acceptée.",
    Demo: LeDepotEstIlPaye,
  },
] as const;

function Carte({
  q,
  r,
  Demo,
}: {
  q: string;
  r: string;
  Demo: (props: { vu: boolean }) => React.ReactElement;
}) {
  const { ref, vu } = useVuUneFois<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className="rounded-xl border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        {/* Le trait orange reprend la signature du plan. */}
        <span className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-primary" />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-snug text-foreground">{q}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r}</p>
        </div>
      </div>
      <Demo vu={vu} />
    </li>
  );
}

export function QuestionsReelles() {
  return (
    <ul className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {QUESTIONS.map((item) => (
        <Carte key={item.q} q={item.q} r={item.r} Demo={item.Demo} />
      ))}
    </ul>
  );
}
