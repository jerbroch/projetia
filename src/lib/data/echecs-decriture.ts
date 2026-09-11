/**
 * LES ÉCHECS D'ÉCRITURE, CONSULTABLES.
 *
 * Certaines écritures sont volontairement non bloquantes : le versionnage
 * d'une soumission ne doit pas faire échouer sa sauvegarde, et l'écriture
 * comptable d'un dépôt ne doit pas défaire une acceptation déjà enregistrée.
 *
 * Mais un échec journalisé dans les logs du serveur n'est jamais lu. Chacun
 * s'inscrit donc dans `write_failures`, qui se consulte — et qui a déjà servi
 * dès le premier essai du versionnage contre la vraie base.
 */

export type DomaineDEcriture = "versioning" | "deposit";

interface ClientEcriture {
  from(table: string): {
    insert(valeurs: Record<string, unknown>): PromiseLike<{ error: unknown }>;
  };
}

export interface EchecDEcriture {
  companyId: string;
  quoteId?: string | null;
  domain: DomaineDEcriture;
  /** Ce qu'on tentait : 'create', 'update', 'duplicate', 'record_payment'… */
  operation: string;
  erreur: string;
}

/**
 * N'échoue jamais. Si même la trace ne s'écrit pas, on ne fait rien de plus :
 * l'opération principale, elle, a réussi et c'est ce qui compte. Casser une
 * sauvegarde réussie pour un défaut de journalisation serait absurde.
 */
export async function noterEchecDEcriture(
  db: ClientEcriture,
  e: EchecDEcriture,
): Promise<void> {
  try {
    await db.from("write_failures").insert({
      company_id: e.companyId,
      quote_id: e.quoteId ?? null,
      domain: e.domain,
      operation: e.operation,
      error: e.erreur.slice(0, 2000),
    });
  } catch {
    // Volontairement muet.
  }
}
