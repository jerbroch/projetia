import { AsyncLocalStorage } from "node:async_hooks";

/**
 * COMPTER ET CHRONOMÉTRER LES APPELS À SUPABASE, PAR REQUÊTE.
 *
 * Mesurer depuis un poste de développement ne dit rien du site : un
 * aller-retour vers Supabase coûte 83 ms depuis un salon à Montréal et une
 * poignée de millisecondes depuis un serveur Vercel. Les deux mesures sont
 * vraies, et une seule décrit le produit.
 *
 * Ce registre vit le temps d'une requête HTTP. Il ne retient aucune donnée —
 * seulement le nom des tables, un compte et des durées.
 */
export interface AppelMesure {
  cible: string;
  ms: number;
}

export interface RegistreRequete {
  appels: AppelMesure[];
  debut: number;
}

const registre = new AsyncLocalStorage<RegistreRequete>();

/** Ouvre un registre pour la durée de `travail`. */
export function avecMesure<T>(travail: () => Promise<T>): Promise<T> {
  return registre.run({ appels: [], debut: Date.now() }, travail);
}

/** Note un appel. Sans registre ouvert, ne fait rien — coût nul en temps normal. */
export function noterAppel(cible: string, ms: number): void {
  registre.getStore()?.appels.push({ cible, ms });
}

/** Vrai quand quelqu'un écoute. Évite de chronométrer pour rien. */
export function mesureActive(): boolean {
  return registre.getStore() !== undefined;
}

export interface Resume {
  total: number;
  msTotal: number;
  msLePlusLong: number;
  parCible: Array<{ cible: string; appels: number; ms: number }>;
}

/**
 * Ce qu'on a vu. `msTotal` est la somme des attentes, pas le temps écoulé :
 * des appels lancés de front coûtent moins cher au mur que leur somme. Les
 * deux chiffres ensemble disent s'il faut réduire le nombre d'appels ou les
 * mettre en parallèle.
 */
export function resume(): Resume | null {
  const r = registre.getStore();
  if (!r) return null;

  const par = new Map<string, { appels: number; ms: number }>();
  for (const a of r.appels) {
    const e = par.get(a.cible) ?? { appels: 0, ms: 0 };
    e.appels += 1;
    e.ms += a.ms;
    par.set(a.cible, e);
  }

  return {
    total: r.appels.length,
    msTotal: Math.round(r.appels.reduce((s, a) => s + a.ms, 0)),
    msLePlusLong: r.appels.length ? Math.round(Math.max(...r.appels.map((a) => a.ms))) : 0,
    parCible: [...par.entries()]
      .map(([cible, e]) => ({ cible, appels: e.appels, ms: Math.round(e.ms) }))
      .sort((a, b) => b.ms - a.ms),
  };
}

// Réexporté depuis un module sans dépendance à Node : le middleware tourne sur
// le runtime Edge et ne peut pas charger `node:async_hooks`.
export { enTeteServerTiming } from "@/lib/server-timing";
