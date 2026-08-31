-- =============================================================================
-- Un employé archivé libère son courriel.
--
-- L'index posé en 031 comptait TOUS les employés, archivés compris. Une fiche
-- créée par erreur puis archivée continuait donc de retenir l'adresse, et il
-- devenait impossible de refaire la fiche correctement — sans même savoir
-- pourquoi, puisque le porteur n'apparaît plus dans les listes.
--
-- L'unicité ne porte plus que sur les employés COURANTS. La donnée de
-- l'archivé n'est pas effacée : son adresse reste sur sa fiche, comme trace.
--
-- Conséquence à connaître, traitée dans restoreEmployeeAction : réactiver un
-- archivé dont l'adresse a été reprise entre-temps rentrerait à nouveau dans
-- l'index. L'application vide alors son courriel et le dit, plutôt que de
-- laisser la base refuser la réactivation avec une erreur illisible.
--
-- Idempotent.
-- =============================================================================

DROP INDEX IF EXISTS employees_company_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS employees_company_email_unique
  ON employees (company_id, lower(email))
  WHERE email IS NOT NULL
    AND email <> ''
    AND archived_at IS NULL;
