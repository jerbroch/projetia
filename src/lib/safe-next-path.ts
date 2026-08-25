/**
 * Validation d'une destination de redirection interne (`?next=`).
 *
 * Sans validation, `?next=https://exemple.com` transformerait la page de
 * connexion en redirection ouverte — un attaquant enverrait un lien vers votre
 * domaine qui rebondit vers le sien après authentification.
 */

/** Chemins qui reboucleraient sur l'authentification. */
const REJECTED_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;

  const path = value.trim();
  if (!path.startsWith("/")) return null;

  // "//exemple.com" est une URL relative au protocole : elle sort du site.
  if (path.startsWith("//")) return null;

  // Certains navigateurs normalisent "\" en "/" — "/\exemple.com" sortirait aussi.
  if (path.includes("\\")) return null;

  const pathname = path.split(/[?#]/)[0];
  if (REJECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return path;
}
