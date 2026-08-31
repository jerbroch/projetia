-- =============================================================================
-- Tracer l'origine d'une ligne de facturation.
--
-- Les heures et matériaux saisis sur le terrain dormaient dans field_hours et
-- field_materials : la facturation ne les lisait jamais, et l'employeur
-- retapait un taux et un nombre de travailleurs à la main.
--
-- Pour déverser le terrain dans la feuille sans détruire le travail de
-- correction, il faut savoir trois choses de chaque ligne :
--   • d'où elle vient        → source_kind
--   • quelles saisies elle représente → source_ids
--   • si elle a été retouchée à la main → manually_edited
--
-- source_ids sert aussi à répondre à « des heures ont-elles été saisies APRÈS
-- la création de la feuille ? » : ce qui est dans field_hours sans être dans
-- aucun source_ids est nouveau.
--
-- Idempotent.
-- =============================================================================

ALTER TABLE job_billing_lines
  ADD COLUMN IF NOT EXISTS source_kind TEXT
    CHECK (source_kind IS NULL OR source_kind IN ('field_hours', 'field_material'));

ALTER TABLE job_billing_lines
  ADD COLUMN IF NOT EXISTS source_ids UUID[] NOT NULL DEFAULT '{}';

-- Passe à vrai dès qu'on retouche une ligne importée. Un réimport doit alors
-- demander avant d'écraser : c'est du travail humain, pas une valeur calculée.
ALTER TABLE job_billing_lines
  ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_job_billing_lines_source
  ON job_billing_lines (billing_sheet_id, source_kind)
  WHERE source_kind IS NOT NULL;
