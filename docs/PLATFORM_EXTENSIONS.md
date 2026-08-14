# Extensions plateforme Construction iOS

Document d'architecture — **aucune implémentation** pour l'instant. Points d'extension prévus pour le Super Admin et la facturation SaaS.

## Coupons et promotions

- **Table suggérée:** `platform_coupons` (code, discount_type, amount, valid_until, max_redemptions)
- **Liaison:** `company_coupon_redemptions`
- **Extension Stripe:** `stripe.coupons.create` + `subscription.discounts`
- **Hook admin:** action `applyCouponToCompany(companyId, couponCode)` avec journal dans `admin_activity_log`

## Essais (trials)

- Colonnes existantes: `companies.trial_ends_at`, `subscription_status = trial`
- **Extension:** webhook Stripe `customer.subscription.trial_will_end` → alerte `trial_ending`
- **Conversion:** webhook `customer.subscription.updated` (trialing → active) → métrique `trialConversions`

## Changements de plan

- **Table existante:** `company_subscriptions`
- **Extension:** historique immuable dans `company_subscription_events` (from_plan, to_plan, proration_amount)
- **Admin UI:** bouton « Changer le plan » sur `/admin/companies/[id]` (Phase 2)

## Factures d'abonnement SaaS

- **Table suggérée:** `platform_invoices` (stripe_invoice_id, company_id, amount, status, pdf_url)
- **Sync:** webhook `invoice.paid` / `invoice.payment_failed`
- **Admin:** liste dans `/admin/revenue` onglet Factures

## Remboursements et crédits

- **Tables suggérées:** `platform_refunds`, `platform_credits`
- **Stripe:** `refunds.create`, Customer Balance
- **Audit:** chaque opération → `admin_activity_log`

## Taxes

- **Extension Stripe Tax** ou table `company_tax_settings` (TPS/TVQ par province)
- **Calcul:** appliqué sur `company_subscriptions.plan_amount_cents` à la facturation

## Notifications courriel admin

- **Table suggérée:** `admin_notification_preferences` (user_id, alert_types[])
- **Envoi:** Resend (clé existante `RESEND_API_KEY`) via job serveur
- **Événements:** failed_payment, trial_ending, new_feedback

## Export CSV

- **Endpoint:** `/api/admin/export?type=companies|subscriptions|activity`
- **Guard:** `requireSuperAdminUser()` + rate limit
- **Données:** requêtes admin client, pas de données inventées

## Comptabilité

- **Intégration future:** QuickBooks / Xero via OAuth
- **Table pont:** `accounting_sync_log`
- **MRR reconnaissance:** export mensuel CSV compatible comptable

## Mode support « Voir comme cette entreprise »

**Statut:** architecture DB prête (`support_mode_sessions`), **désactivé** dans l'app.

### Activation future (checklist sécurité)

1. `requireSuperAdminUser()` avant toute session
2. Créer entrée `support_mode_sessions` (read_only=true par défaut)
3. Cookie httpOnly signé `support_mode_session_id` — **pas** de service_role côté client
4. Bannière persistante « Mode support — [Entreprise] — Lecture seule »
5. RLS: policy temporaire via `SET LOCAL` ou vue sécurisée — **jamais** désactiver RLS globalement
6. Journal audit début/fin dans `admin_activity_log`
7. Bouton « Quitter le mode support » invalide cookie + `ended_at`
8. Timeout automatique (ex. 2 h)

### Fichiers à créer

- `src/lib/platform/support-mode.ts`
- `src/lib/actions/platform/support-mode.ts`
- `src/components/admin/support-mode-banner.tsx`
- Middleware: détecter cookie support mode, injecter contexte tenant cible

## Webhooks Stripe recommandés

| Événement | Action |
|-----------|--------|
| `customer.subscription.created` | Upsert `company_subscriptions`, alerte `new_subscription` |
| `customer.subscription.updated` | Mise à jour statut/plan, log `plan_changed` |
| `customer.subscription.deleted` | alerte `subscription_cancelled` |
| `invoice.payment_failed` | alerte `failed_payment` |
| `invoice.paid` | log `payment_received` |

**Route suggérée:** `/api/webhooks/stripe-platform` (distinct de `/api/payments/*` existant pour les paiements clients finaux)
