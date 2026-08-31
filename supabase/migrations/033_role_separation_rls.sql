-- =============================================================================
-- Séparer les rôles À L'INTÉRIEUR d'une entreprise.
--
-- Les politiques existantes isolaient les entreprises entre elles, mais
-- donnaient à TOUT membre — employé de terrain compris — un accès complet en
-- lecture ET EN ÉCRITURE. Mesuré avec la clé anonyme d'un employé : il a pu
-- porter son propre taux horaire à 999 $, mettre celui d'une collègue à 1 $,
-- créer un client et créer une facture. Les écritures ont abouti.
--
-- Trois régimes désormais :
--   1. Réservé au bureau, lecture comprise — la donnée commerciale.
--   2. Lecture pour tous, écriture au bureau — l'outillage et les catalogues,
--      que l'employé consulte depuis /terrain.
--   3. Inchangé — field_hours, field_materials et job_employee_shifts avaient
--      déjà des politiques par employé, correctes.
--
-- La saisie terrain n'écrit que dans field_hours et field_materials ; le
-- changement de statut d'un chantier passe par le client de service. Vérifié
-- avant d'écrire : rien de ce que fait /terrain ne dépend des tables ci-dessous.
--
-- Idempotent.
-- =============================================================================

-- ── customers : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS customers_company_isolation ON customers;
DROP POLICY IF EXISTS customers_office_read ON customers;
CREATE POLICY customers_office_read ON customers
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS customers_office_write ON customers;
CREATE POLICY customers_office_write ON customers
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── quotes : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS quotes_company_isolation ON quotes;
DROP POLICY IF EXISTS quotes_office_read ON quotes;
CREATE POLICY quotes_office_read ON quotes
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS quotes_office_write ON quotes;
CREATE POLICY quotes_office_write ON quotes
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── quote_requests : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS quote_requests_company_isolation ON quote_requests;
DROP POLICY IF EXISTS quote_requests_office_read ON quote_requests;
CREATE POLICY quote_requests_office_read ON quote_requests
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS quote_requests_office_write ON quote_requests;
CREATE POLICY quote_requests_office_write ON quote_requests
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── invoices : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS invoices_company_isolation ON invoices;
DROP POLICY IF EXISTS invoices_office_read ON invoices;
CREATE POLICY invoices_office_read ON invoices
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS invoices_office_write ON invoices;
CREATE POLICY invoices_office_write ON invoices
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── payments : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS payments_company_isolation ON payments;
DROP POLICY IF EXISTS payments_office_read ON payments;
CREATE POLICY payments_office_read ON payments
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS payments_office_write ON payments;
CREATE POLICY payments_office_write ON payments
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── job_billing_sheets : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS job_billing_sheets_company_isolation ON job_billing_sheets;
DROP POLICY IF EXISTS job_billing_sheets_office_read ON job_billing_sheets;
CREATE POLICY job_billing_sheets_office_read ON job_billing_sheets
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS job_billing_sheets_office_write ON job_billing_sheets;
CREATE POLICY job_billing_sheets_office_write ON job_billing_sheets
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── job_billing_lines : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS job_billing_lines_company_isolation ON job_billing_lines;
DROP POLICY IF EXISTS job_billing_lines_office_read ON job_billing_lines;
CREATE POLICY job_billing_lines_office_read ON job_billing_lines
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS job_billing_lines_office_write ON job_billing_lines;
CREATE POLICY job_billing_lines_office_write ON job_billing_lines
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── labor_rate_templates : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS labor_rate_templates_company_isolation ON labor_rate_templates;
DROP POLICY IF EXISTS labor_rate_templates_office_read ON labor_rate_templates;
CREATE POLICY labor_rate_templates_office_read ON labor_rate_templates
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS labor_rate_templates_office_write ON labor_rate_templates;
CREATE POLICY labor_rate_templates_office_write ON labor_rate_templates
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── company_catalog_prices : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS company_catalog_prices_company_isolation ON company_catalog_prices;
DROP POLICY IF EXISTS company_catalog_prices_office_read ON company_catalog_prices;
CREATE POLICY company_catalog_prices_office_read ON company_catalog_prices
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS company_catalog_prices_office_write ON company_catalog_prices;
CREATE POLICY company_catalog_prices_office_write ON company_catalog_prices
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── suppliers : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS suppliers_company_isolation ON suppliers;
DROP POLICY IF EXISTS suppliers_office_read ON suppliers;
CREATE POLICY suppliers_office_read ON suppliers
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS suppliers_office_write ON suppliers;
CREATE POLICY suppliers_office_write ON suppliers
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── material_supplier_prices : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS material_supplier_prices_company_isolation ON material_supplier_prices;
DROP POLICY IF EXISTS material_supplier_prices_office_read ON material_supplier_prices;
CREATE POLICY material_supplier_prices_office_read ON material_supplier_prices
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS material_supplier_prices_office_write ON material_supplier_prices;
CREATE POLICY material_supplier_prices_office_write ON material_supplier_prices
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── material_price_history : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS material_price_history_company_isolation ON material_price_history;
DROP POLICY IF EXISTS material_price_history_office_read ON material_price_history;
CREATE POLICY material_price_history_office_read ON material_price_history
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS material_price_history_office_write ON material_price_history;
CREATE POLICY material_price_history_office_write ON material_price_history
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── company_subscriptions : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS company_subscriptions_company_isolation ON company_subscriptions;
DROP POLICY IF EXISTS company_subscriptions_office_read ON company_subscriptions;
CREATE POLICY company_subscriptions_office_read ON company_subscriptions
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS company_subscriptions_office_write ON company_subscriptions;
CREATE POLICY company_subscriptions_office_write ON company_subscriptions
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── job_number_sequences : réservé au bureau, lecture comprise
DROP POLICY IF EXISTS job_number_sequences_company_isolation ON job_number_sequences;
DROP POLICY IF EXISTS job_number_sequences_office_read ON job_number_sequences;
CREATE POLICY job_number_sequences_office_read ON job_number_sequences
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS job_number_sequences_office_write ON job_number_sequences;
CREATE POLICY job_number_sequences_office_write ON job_number_sequences
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── tools : lu par le terrain, écrit par le bureau seulement
DROP POLICY IF EXISTS tools_company_isolation ON tools;
DROP POLICY IF EXISTS tools_read ON tools;
CREATE POLICY tools_read ON tools
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT auth_user_company_ids()));
DROP POLICY IF EXISTS tools_office_write ON tools;
CREATE POLICY tools_office_write ON tools
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── tool_assignments : lu par le terrain, écrit par le bureau seulement
DROP POLICY IF EXISTS tool_assignments_company_isolation ON tool_assignments;
DROP POLICY IF EXISTS tool_assignments_read ON tool_assignments;
CREATE POLICY tool_assignments_read ON tool_assignments
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT auth_user_company_ids()));
DROP POLICY IF EXISTS tool_assignments_office_write ON tool_assignments;
CREATE POLICY tool_assignments_office_write ON tool_assignments
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── tool_sms_reminders : lu par le terrain, écrit par le bureau seulement
DROP POLICY IF EXISTS tool_sms_reminders_company_isolation ON tool_sms_reminders;
DROP POLICY IF EXISTS tool_sms_reminders_read ON tool_sms_reminders;
CREATE POLICY tool_sms_reminders_read ON tool_sms_reminders
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT auth_user_company_ids()));
DROP POLICY IF EXISTS tool_sms_reminders_office_write ON tool_sms_reminders;
CREATE POLICY tool_sms_reminders_office_write ON tool_sms_reminders
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── material_catalog_items : lu par le terrain, écrit par le bureau seulement
DROP POLICY IF EXISTS material_catalog_items_company_isolation ON material_catalog_items;
DROP POLICY IF EXISTS material_catalog_items_read ON material_catalog_items;
CREATE POLICY material_catalog_items_read ON material_catalog_items
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT auth_user_company_ids()));
DROP POLICY IF EXISTS material_catalog_items_office_write ON material_catalog_items;
CREATE POLICY material_catalog_items_office_write ON material_catalog_items
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── material_categories : lu par le terrain, écrit par le bureau seulement
DROP POLICY IF EXISTS material_categories_company_isolation ON material_categories;
DROP POLICY IF EXISTS material_categories_read ON material_categories;
CREATE POLICY material_categories_read ON material_categories
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id IN (SELECT auth_user_company_ids()));
DROP POLICY IF EXISTS material_categories_office_write ON material_categories;
CREATE POLICY material_categories_office_write ON material_categories
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── employees : le bureau voit tout, l'employé ne voit que SA fiche
--
-- La lecture ouverte exposait le TAUX HORAIRE de tous les collègues. Le
-- terrain n'a jamais besoin de cette table : les noms affichés sur un chantier
-- viennent de scheduled_jobs.employee_names.
DROP POLICY IF EXISTS employees_company_isolation ON employees;
DROP POLICY IF EXISTS employees_office_read ON employees;
CREATE POLICY employees_office_read ON employees
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS employees_self_read ON employees;
CREATE POLICY employees_self_read ON employees
  FOR SELECT TO authenticated
  USING (id = auth_user_employee_id());
DROP POLICY IF EXISTS employees_office_write ON employees;
CREATE POLICY employees_office_write ON employees
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- ── scheduled_jobs : la lecture par employé assigné existe déjà ; on retire
--    seulement le droit d'ÉCRIRE, qui permettait de s'assigner le chantier
--    d'un autre.
DROP POLICY IF EXISTS scheduled_jobs_company_isolation ON scheduled_jobs;
DROP POLICY IF EXISTS scheduled_jobs_office_write ON scheduled_jobs;
CREATE POLICY scheduled_jobs_office_write ON scheduled_jobs
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
DROP POLICY IF EXISTS scheduled_jobs_office_read ON scheduled_jobs;
CREATE POLICY scheduled_jobs_office_read ON scheduled_jobs
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );
