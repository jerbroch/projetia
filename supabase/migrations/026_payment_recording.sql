-- Enregistrement des paiements reçus des clients.
--
-- La table `payments` existe depuis la migration 001 et n'a jamais reçu une
-- seule ligne : aucune action ne permettait d'enregistrer un paiement. Elle
-- avait été pensée pour Stripe (`method` par défaut à 'card', colonne
-- `stripe_payment_id`) alors que le seul mode qui fonctionne aujourd'hui est
-- le virement Interac, saisi à la main par l'entrepreneur.

-- 1. Interac manquait à l'énumération — c'est le mode de paiement principal
--    au Québec, et celui que nos factures annoncent déjà.
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'interac';

-- 2. Un mode « autre » pour les cas non anticipés — mandat-poste, troc,
--    compensation sur un autre chantier. Sans lui, l'entrepreneur devrait
--    mentir sur le mode ou ne rien enregistrer.
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'other';

-- 3. « ach » est le terme états-unien du virement automatisé ; l'équivalent
--    canadien s'appelle un virement bancaire. La table étant vide, le
--    renommage ne touche aucune donnée existante.
ALTER TYPE payment_method RENAME VALUE 'ach' TO 'transfer';

-- 4. Le mode par défaut visait la carte, qui n'encaisse rien aujourd'hui.
ALTER TABLE payments ALTER COLUMN method SET DEFAULT 'interac';

-- 5. Date de RÉCEPTION du paiement, distincte de `created_at` qui est la date
--    de saisie. Un entrepreneur constate le mercredi un virement reçu le
--    lundi : c'est la date de réception qui compte pour sa comptabilité.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS received_at DATE NOT NULL DEFAULT CURRENT_DATE;

-- 6. Référence du paiement : numéro de chèque, numéro de confirmation
--    Interac. Indispensable au rapprochement bancaire, puisque aucun
--    rapprochement automatique n'existe avec ces modes.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;

-- 7. Note libre — « acompte convenu au téléphone », « solde après retenue ».
ALTER TABLE payments ADD COLUMN IF NOT EXISTS note TEXT;

-- 8. Qui a saisi le paiement. Piste d'audit : l'enregistrement d'un paiement
--    modifie l'état d'une facture sans trace ailleurs.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles (id) ON DELETE SET NULL;

-- 9. Un paiement enregistré est un encaissement réel : jamais zéro ni négatif.
--    Le dépassement du solde est refusé par l'action, avec un message qui
--    nomme le solde — une contrainte en base ne pourrait pas l'expliquer.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- 10. Index de lecture : la fiche d'une facture liste ses paiements, et la page
--    Paiements les trie par date de réception.
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_at
  ON payments (company_id, received_at DESC);

-- L'isolation par entreprise reste celle de la migration 001 :
--   payments_company_isolation — FOR ALL USING (company_id IN auth_user_company_ids())
-- Aucune politique publique n'est ajoutée : l'enregistrement d'un paiement
-- passe uniquement par une action serveur authentifiée.
