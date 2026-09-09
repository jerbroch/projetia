/**
 * L'en-tête `Server-Timing`, lisible nativement par les navigateurs.
 *
 * MODULE SÉPARÉ, SANS AUCUNE DÉPENDANCE À NODE. Le middleware tourne sur le
 * runtime Edge, où `node:async_hooks` n'existe pas : y importer le registre de
 * mesure ferait tomber toutes les pages authentifiées. Une ligne d'import
 * suffit à casser un site, et ça ne se voit pas au typecheck.
 */
export function enTeteServerTiming(phases: Record<string, number>): string {
  return Object.entries(phases)
    .map(([nom, ms]) => `${nom};dur=${Math.round(ms)}`)
    .join(", ");
}
