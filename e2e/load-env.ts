/**
 * Chargement des variables d'environnement pour la suite e2e.
 *
 * UN SEUL ENDROIT, parce que l'ordre est piégeux. `dotenv` n'écrase jamais une
 * variable déjà définie : le premier fichier chargé l'emporte. Quatre fichiers
 * de la suite chargeaient `.env.local` — la production — soit en premier, soit
 * tout seuls. `.env.e2e` était donc incapable de rediriger quoi que ce soit,
 * et 151 entreprises de test se sont accumulées dans la base réelle.
 *
 * Importer ce module suffit ; il s'exécute une fois, au premier import.
 *
 *   import "../load-env";
 *
 * Priorité, du plus fort au plus faible :
 *   1. les variables déjà présentes dans l'environnement (CI)
 *   2. `.env.e2e`   — la base de développement
 *   3. `.env.local` — complète seulement ce que les deux premiers ne disent pas
 */
import dotenv from "dotenv";
import path from "path";

const racine = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(racine, ".env.e2e") });
dotenv.config({ path: path.join(racine, ".env.local") });
