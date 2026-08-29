-- =============================================================================
-- Archiver un employé qui a quitté l'entreprise.
--
-- Colonne séparée plutôt qu'une valeur d'employee_status, parce que les deux
-- notions sont ORTHOGONALES : quelqu'un peut être en congé (« vacation ») puis
-- partir. Ajouter « archived » à l'enum effacerait l'information du congé au
-- moment de l'archivage, et la rendrait irrécupérable à son retour.
--
-- Nullable : désarchiver, c'est remettre NULL. La date de départ reste lisible
-- tant qu'elle est utile, et le retour au printemps ne coûte rien.
--
-- Les heures et le travail passés ne bougent pas : ils se joignent par
-- employee_id, et cette clé ne change jamais. Quatre clés étrangères pointent
-- d'ailleurs vers employees en ON DELETE RESTRICT — la base refuse déjà une
-- suppression, ce qui confirme qu'archiver est la seule bonne réponse.
--
-- Idempotent.
-- =============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Les listes courantes filtrent archived_at IS NULL par entreprise.
CREATE INDEX IF NOT EXISTS idx_employees_company_archived
  ON employees (company_id, archived_at);
