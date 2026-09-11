/**
 * SUPPRIMER UNE ENTREPRISE, VERSIONNAGE COMPRIS.
 *
 * `quote_versions.company_id`, `quote_line_items.company_id` et
 * `quote_line_versions.company_id` sont en ON DELETE RESTRICT (migration 045) :
 * une soumission envoyée est une pièce, et supprimer une entreprise ne doit pas
 * l'effacer sans que personne ne l'ait demandé.
 *
 * Ici, on le demande explicitement. Sans ce passage, tout `delete` sur
 * `companies` échoue dès que l'entreprise a sauvegardé une soumission :
 *
 *   update or delete on table "companies" violates foreign key constraint
 *   "quote_versions_company_id_fkey" on table "quote_versions"
 *
 * Un seul endroit plutôt que sept : il y a sept chemins qui suppriment une
 * entreprise, et en oublier un rend la panne invisible jusqu'au jour où ce
 * chemin-là sert.
 */

/** Le minimum qu'on attend d'un client Supabase pour faire ce travail. */
interface ClientSuppression {
  from(table: string): {
    delete(): {
      in(colonne: string, valeurs: string[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface ResultatSuppression {
  ok: boolean;
  erreur?: string;
}

/** L'ordre suit les dépendances : états de ligne, identités, versions. */
const TABLES_DU_VERSIONNAGE = [
  "quote_line_versions",
  "quote_line_items",
  "quote_versions",
  "write_failures",
] as const;

export async function supprimerEntreprises(
  db: ClientSuppression,
  companyIds: string[]
): Promise<ResultatSuppression> {
  if (!companyIds.length) return { ok: true };

  for (const table of TABLES_DU_VERSIONNAGE) {
    const { error } = await db.from(table).delete().in("company_id", companyIds);
    if (error) {
      return { ok: false, erreur: `suppression de ${table} impossible : ${error.message}` };
    }
  }

  const { error } = await db.from("companies").delete().in("id", companyIds);
  if (error) {
    return { ok: false, erreur: `suppression des entreprises impossible : ${error.message}` };
  }
  return { ok: true };
}

/** Le cas courant : une seule entreprise. */
export function supprimerEntreprise(
  db: ClientSuppression,
  companyId: string
): Promise<ResultatSuppression> {
  return supprimerEntreprises(db, [companyId]);
}
