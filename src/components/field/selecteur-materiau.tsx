"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { chargerListesTerrainAction } from "@/lib/actions/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { FieldCatalogItem } from "@/types";

/**
 * L'employé CHOISIT dans le catalogue de son employeur ; il n'invente rien.
 *
 * Il tapait le nom au clavier, avec des gants, sur un chantier : « chofe-o »,
 * « chauffe eau 60 », « CE 60gal » — trois lignes pour le même article, que
 * l'employeur devait démêler à la facturation.
 *
 * Le prix affiché est le PRIX DE VENTE, marge comprise, pour qu'il puisse
 * répondre au client sur place. Le coût n'existe pas de ce côté-ci : il n'est
 * pas dans la vue que lit cet écran.
 */
export function SelecteurMateriau({
  onChoisi,
  onAbsent,
}: {
  onChoisi: (item: FieldCatalogItem) => void;
  onAbsent: () => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<FieldCatalogItem[]>([]);
  const [chargement, setChargement] = useState(false);
  const dernier = useRef(0);

  useEffect(() => {
    // On attend que le doigt s'arrête : une requête par lettre saturerait un
    // réseau de chantier et ferait clignoter la liste.
    const jeton = ++dernier.current;
    const minuterie = setTimeout(() => {
      setChargement(true);
      void chargerListesTerrainAction(recherche).then((r) => {
        if (jeton !== dernier.current) return; // une frappe plus récente a gagné
        setResultats(r.materiaux);
        setChargement(false);
      });
    }, 250);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  const message = useMemo(() => {
    if (chargement) return "Recherche…";
    if (!resultats.length && recherche.trim()) return null;
    if (!resultats.length) return "Aucun matériau au catalogue.";
    return null;
  }, [chargement, resultats.length, recherche]);

  return (
    <div className="space-y-2">
      <Label htmlFor="rechercheMateriau">Chercher dans le catalogue</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="rechercheMateriau"
          className="h-12 pl-9 text-base"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chauffe-eau, valve, cuivre…"
          autoComplete="off"
        />
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {resultats.length > 0 && (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {resultats.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoisi(item)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left active:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.unit}</span>
                </span>
                {/*
                  Un prix absent se dit, il ne s'affiche pas comme « 0,00 $ » :
                  un zéro ferait annoncer au client que c'est gratuit.
                */}
                {item.sellPrice != null ? (
                  <span className="shrink-0 rounded-md bg-green-500/10 px-2 py-1 text-sm font-medium tabular-nums text-green-700 dark:text-green-400">
                    {formatCurrency(item.sellPrice)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">prix à venir</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {recherche.trim() && !chargement && (
        <Button type="button" variant="outline" className="h-12 w-full" onClick={onAbsent}>
          Ce matériau n&apos;est pas dans la liste
        </Button>
      )}
    </div>
  );
}
