-- 015_job_closure_billing_workflow.sql — PARTIE 1 sur 2
-- Ajoute les nouvelles valeurs à schedule_status.
--
-- IMPORTANT (PostgreSQL 55P04) :
-- Les nouvelles valeurs ENUM doivent être COMMITées avant d'être utilisées
-- (index partiels, UPDATE, etc.). Exécutez CE fichier seul, attendez Success,
-- puis exécutez 016_job_closure_billing_workflow.sql
--
-- Idempotent — IF NOT EXISTS sur chaque valeur.

ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'en-route';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'pending-review';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'ready-to-invoice';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'invoice-sent';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'paid';
