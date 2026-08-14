-- 016b_billing_workflow.sql — ÉTAPE 2 sur 2
-- Colonnes, index et paramètres Interac (workflow fermeture → facturation).
--
-- PRÉREQUIS : 016a_add_workflow_statuses.sql exécuté avec succès.
-- Idempotent — sans DROP TABLE, TRUNCATE ni DELETE.

-- =============================================================================
-- 1. scheduled_jobs — champs de clôture et approbation
-- =============================================================================
ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_description TEXT,
  ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to TEXT;

-- Index partiels (nécessitent que 016a soit commité)
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_pending_review
  ON scheduled_jobs (company_id, submitted_for_review_at DESC)
  WHERE status = 'pending-review';

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_ready_to_invoice
  ON scheduled_jobs (company_id, approved_at DESC)
  WHERE status = 'ready-to-invoice';

-- =============================================================================
-- 2. Paramètres Interac (companies)
-- =============================================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS interac_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interac_email TEXT,
  ADD COLUMN IF NOT EXISTS interac_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS interac_security_question TEXT,
  ADD COLUMN IF NOT EXISTS interac_security_answer TEXT,
  ADD COLUMN IF NOT EXISTS interac_instructions TEXT;

-- =============================================================================
-- 3. invoices — suivi d'envoi
-- =============================================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to TEXT,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_description TEXT;
