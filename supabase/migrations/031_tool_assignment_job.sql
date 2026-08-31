-- =============================================================================
-- Rattacher une assignation d'outil au call pour lequel elle a été faite.
--
-- L'assignation reste liée à l'EMPLOYÉ : c'est lui qui a l'outil dans son
-- camion, et c'est lui qui le rapporte. Le call n'est qu'une information de
-- plus — savoir POUR QUEL CHANTIER l'outil est sorti.
--
-- Nullable, parce qu'on assigne aussi un outil sans chantier précis : un
-- marteau confié à un gars pour la saison n'appartient à aucun call.
--
-- ON DELETE SET NULL, et surtout pas CASCADE : si le chantier est annulé,
-- l'outil est toujours physiquement chez le gars. Supprimer l'assignation
-- ferait disparaître un outil sorti du parc, qui apparaîtrait libre au
-- magasin alors qu'il est sur la route.
--
-- Idempotent.
-- =============================================================================

ALTER TABLE tool_assignments
  ADD COLUMN IF NOT EXISTS scheduled_job_id UUID
  REFERENCES scheduled_jobs (id) ON DELETE SET NULL;

-- Pour lister les outils d'un call sans balayer toute la table.
CREATE INDEX IF NOT EXISTS idx_tool_assignments_job
  ON tool_assignments (scheduled_job_id)
  WHERE scheduled_job_id IS NOT NULL;
