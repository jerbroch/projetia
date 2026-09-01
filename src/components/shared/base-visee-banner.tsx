import { baseVisee } from "@/lib/base-visee";

/**
 * Bandeau d'alerte quand le serveur local écrit dans une base non déclarée.
 *
 * Il est volontairement impossible à manquer : rouge, en haut, sur toutes les
 * pages. Le danger qu'il couvre est silencieux — rien dans l'écran ne dit
 * quelle base on modifie — et il ne se révèle qu'une fois les données
 * changées.
 *
 * Rendu côté serveur : il lit l'environnement RÉEL du processus, pas une
 * valeur figée à la compilation. Il disparaît de lui-même en production.
 */
export function BaseViseeBanner() {
  const b = baseVisee(process.env as Record<string, string | undefined>);
  if (!b.alerter) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] border-b-2 border-red-700 bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white"
    >
      {b.message}
    </div>
  );
}
