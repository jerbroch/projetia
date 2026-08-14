-- 016a_add_workflow_statuses.sql — ÉTAPE 1 sur 2
-- Ajoute UNIQUEMENT les valeurs manquantes à schedule_status.
--
-- Ne modifie aucune table, aucune donnée, aucun index.
-- Exécutez ce fichier seul → attendez Success → puis 016b_billing_workflow.sql
--
-- Valeurs d'origine (001) : scheduled, in-progress, completed, cancelled
-- Valeurs workflow (code TypeScript) : en-route, pending-review, ready-to-invoice,
--   invoice-sent, paid
-- Note : "invoiced" est billing_sheet_status (008), pas schedule_status.

ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'en-route';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'pending-review';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'ready-to-invoice';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'invoice-sent';
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'paid';
