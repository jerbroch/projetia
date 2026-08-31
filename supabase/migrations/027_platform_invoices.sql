-- Trace locale des factures d'abonnement — le revenu de la plateforme.
--
-- Rien n'enregistrait ce que Stripe nous facture. `stripe_events` ne garde du
-- payload que le type et l'horodatage ; `company_subscriptions` porte l'état
-- courant, pas l'historique. Tout le passé financier ne vivait donc que chez
-- Stripe, et nulle part ailleurs.
--
-- Stripe reste la source de vérité, notamment pour le CALCUL des taxes : il
-- connaît les taux, leurs dates d'effet et les règles de lieu de fourniture.
-- Cette table en est un MIROIR — elle sert l'affichage, l'agrégation et la
-- conservation, jamais le calcul.

CREATE TABLE IF NOT EXISTS platform_invoices (
  -- L'id Stripe comme clé primaire : une redélivrance de webhook devient une
  -- réécriture du même enregistrement, sans doublon possible.
  id TEXT PRIMARY KEY,

  -- ON DELETE SET NULL, jamais CASCADE : supprimer une entreprise ne doit pas
  -- effacer le revenu qu'elle a produit. Une facture payée reste due au fisc
  -- même si le client a disparu.
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,

  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Numéro lisible attribué par Stripe (« JDIZZDVQ-0003 »).
  number TEXT,
  status TEXT NOT NULL,
  billing_reason TEXT,
  currency TEXT NOT NULL DEFAULT 'cad',

  -- Montants en CENTS, en entiers : aucune arithmétique de virgule flottante
  -- sur de l'argent. Signés, car les notes de crédit et les prorations
  -- négatives produisent de vraies factures à montant négatif.
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  amount_due_cents BIGINT NOT NULL DEFAULT 0,

  -- Ventilation des taxes, résolue depuis `tax_type` des objets tax_rate de
  -- Stripe. Zéro tant que l'inscription n'est pas faite : Stripe marque alors
  -- `taxability_reason: not_collecting`, et c'est une information exacte, pas
  -- une absence de donnée.
  gst_cents BIGINT NOT NULL DEFAULT 0,
  qst_cents BIGINT NOT NULL DEFAULT 0,
  other_tax_cents BIGINT NOT NULL DEFAULT 0,

  -- Le détail brut renvoyé par Stripe, conservé tel quel. La ventilation
  -- ci-dessus sert les requêtes ; ceci sert les vérifications et rattrape les
  -- cas qu'on n'a pas anticipés (nouvelle juridiction, taxe inconnue).
  tax_breakdown JSONB,

  -- Période de facturation couverte, et non la date d'émission.
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- `issued_at` vient de Stripe ; `paid_at` est nul tant que rien n'est
  -- encaissé ; `recorded_at` dit quand NOUS l'avons vue — un écart entre les
  -- deux derniers révèle un webhook perdu puis rattrapé.
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT
);

-- Les relevés trimestriels s'agrègent par date d'encaissement, pas d'émission.
CREATE INDEX IF NOT EXISTS idx_platform_invoices_paid_at
  ON platform_invoices (paid_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_company
  ON platform_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_status
  ON platform_invoices (status);

-- Aucune politique de lecture pour les locataires : ce sont les revenus de la
-- plateforme, pas les leurs. RLS active sans politique = personne n'y accède
-- via la clé anon ; seuls le rôle de service et le super admin y touchent.
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;

-- Même formulation que les autres tables de la migration 017.
CREATE POLICY platform_invoices_super_admin_select ON platform_invoices
  FOR SELECT USING (is_platform_super_admin());
