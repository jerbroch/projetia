# Abonnement SaaS — Stripe Checkout

Ce document couvre deux choses : **la mise en place technique** du paiement
d'abonnement, et **la tarification recommandée** au lancement.

---

## 1. Tarification recommandée

### Le marché (prix publics, 2026)

| Produit | Prix mensuel | Modèle | Note |
|---|---|---|---|
| Jobber Core | 39 $ US (~55 $ CA) | par utilisateur | 1 seul utilisateur |
| Jobber Connect | 119 $ US (~165 $ CA) | 5 utilisateurs | le vrai plan « équipe » |
| Housecall Pro Basic | 79 $ US (~110 $ CA) | par utilisateur | 59 $ US si annuel |
| Contractor Foreman | 49 $ US et + | par entreprise | anglais seulement |
| BillDr (Québec) | à partir de 180 $ CA | par entreprise | français, ciblé rénovation |
| Buildertrend | 299 $ US et + | par entreprise | + 400 à 1 500 $ d'implantation |
| Maestro (ERP) | 15 000 à 50 000 $/an | licence | grandes entreprises |

Trois constats :

1. **Tout est en dollars US** sauf BillDr et Maestro. Un prix affiché en CAD,
   taxes québécoises calculées, est déjà un argument de vente.
2. **La facturation par utilisateur est le vrai coût caché.** Un entrepreneur
   avec 6 employés sur Jobber paie le plan Connect, pas le plan à 39 $.
3. **Le trou dans le marché est entre 60 $ et 180 $ CA** pour un produit
   français, complet, sans frais d'implantation.

### Tarification retenue

Quatre paliers, tous en **CAD**, **projets et chantiers illimités partout**.
Le palier détermine le nombre d'utilisateurs, rien d'autre.

| Palier | Mensuel | Annuel | Utilisateurs |
|---|---|---|---|
| Solo | 39,99 $ | 399,90 $ | 1 |
| **Entreprise** | **89,99 $** | **899,90 $** | **5** |
| Entrepreneur | 149,99 $ | 1 499,90 $ | 15 |
| Croissance | 249,99 $ | 2 499,90 $ | illimité |

**L'annuel facture 10 mois pour 12 mois d'accès** — 2 mois offerts, soit −16,7 %.

Positionnement face au marché : Entreprise à 89,99 $ CA couvre 5 utilisateurs,
là où Jobber Connect en couvre 5 pour ~165 $ CA et BillDr démarre à 180 $ CA.
Solo à 39,99 $ reste au-dessus de la ligne « trop bon marché pour être
crédible » tout en étant sous Jobber Core (~55 $ CA) — qui, lui, ne donne
qu'un seul utilisateur également.

### Où vivent ces valeurs

**`src/lib/billing/tiers.ts` est la source unique.** Montants, limites
d'utilisateurs, fonctionnalités affichées et noms des variables d'environnement
portant les Price IDs y sont réunis. Aucun prix n'est écrit en dur ailleurs.

⚠️ Les montants du fichier servent **à l'affichage seulement**. C'est le Stripe
Price ID qui détermine ce qui est réellement facturé. Si les deux divergent, la
page annonce un prix et le client en paie un autre.

**C'est `npm run verify:prices` qui garantit l'alignement.** Le script interroge
les 8 Price IDs chez Stripe et compare montant, devise, cycle, état actif et
mode (test/live) à ce fichier. Il sort en erreur au moindre écart, et il est
inclus dans `npm run verify`.

```bash
npm run verify:prices             # ignore proprement si Stripe n'est pas configuré
npm run verify:prices -- --strict # exige la configuration (CI, pré-déploiement)
```

Sans `STRIPE_SECRET_KEY`, le script avertit et sort en succès — il ne bloque pas
un `npm run verify` local. En CI et avant toute mise en ligne d'un tarif,
lancez-le avec `--strict` et les vraies clés : c'est le seul moment où l'écart
entre la page et la facture peut être attrapé avant le client.

Le script détecte notamment le mélange **test / live** : un Price ID Live avec
une clé Test échoue avec un message explicite, au lieu du `No such price`
énigmatique renvoyé par Stripe au moment du Checkout.

### Quand passer à des paliers

Pour ajouter ou retirer un palier : une entrée dans `SUBSCRIPTION_TIERS`, deux
Price IDs Stripe, deux variables d'environnement. Ni la page de tarification, ni
le Checkout, ni le webhook ne sont à toucher — tous itèrent sur la config.

---

## 2. Mise en place technique

### a. Migration base de données

Exécuter `supabase/migrations/022_subscription_billing.sql` **puis**
`023_subscription_tiers.sql` dans le SQL Editor Supabase.

022 ajoute sur `companies` : `stripe_customer_id`,
`stripe_subscription_id`, `subscription_plan`, `subscription_price_id`,
`subscription_current_period_end`, `subscription_cancel_at_period_end`, et crée
la table `stripe_events` (idempotence des webhooks). 023 ajoute
`subscription_tier`.

Deux colonnes distinctes portent l'abonnement : `subscription_plan` contient le
**cycle** (`monthly` | `annual`), `subscription_tier` contient le **palier**
(`solo` | `entreprise` | `entrepreneur` | `croissance`). `access_type` reflète
le cycle, pour rester compatible avec la logique d'accès déjà en place.

`subscription_status` reste l'ENUM existant. Les statuts Stripe y sont
normalisés :

| Stripe | Enregistré | Accès à l'app |
|---|---|---|
| `active` | `active` | ✅ |
| `trialing` | `trial` | ✅ |
| `past_due` | `past_due` | ✅ (délai de grâce, Stripe relance) |
| `unpaid`, `canceled`, `incomplete`, `paused` | `cancelled` | ❌ |

### b. Configuration Stripe

1. **Products** : un produit par palier, chacun avec **deux prix récurrents en
   CAD** (mensuel et annuel), selon le tableau de tarification ci-dessus.
   Copier les 8 `price_...` dans les variables listées par `tiers.ts`
   (`STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_ANNUAL`, etc.).
2. **Settings → Tax** : activer Stripe Tax et enregistrer les immatriculations
   TPS/TVQ. Le Checkout est créé avec `automatic_tax: { enabled: true }`.
3. **Settings → Billing → Customer portal** : activer l'annulation, le
   changement de plan et l'historique des factures.
4. **Developers → Webhooks → Add endpoint** :
   `https://constructionios.com/api/stripe/webhook`, évènements
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed`. Copier le
   `whsec_...` dans `STRIPE_WEBHOOK_SECRET`.

### c. Variables d'environnement

Voir `.env.example`, section Stripe. Sans les `STRIPE_PRICE_*` d'un palier, la
page `/choose-plan` enregistre le choix et affiche « Paiement bientôt
disponible » pour ce palier — aucun faux succès n'est jamais renvoyé.

Les paiements et le portail passent par des **Server Actions**, pas par des
routes `/api/`. Seul le webhook est une route, parce que Stripe doit pouvoir
l'appeler de l'extérieur.

### d. Parcours

```
/choose-plan  →  selectSubscriptionPlanAction(tier, cycle)
              →  Stripe Checkout (hébergé, fr-CA, taxes auto)
              →  /choose-plan?checkout=success&session_id=cs_...
              →  confirmCheckoutSessionAction : lit l'abonnement chez Stripe,
                 applique l'accès sans attendre le webhook
              →  /dashboard
```

Le webhook reste la source de vérité pour la suite : renouvellements, échecs de
paiement, annulations depuis le portail.

`Paramètres → Mon abonnement` affiche le plan, le statut et la date de
renouvellement, et ouvre le portail Stripe (carte, factures, annulation).

### e. Test en local

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copier le whsec_... affiché dans .env.local, puis :
npm run dev
```

Carte de test : `4242 4242 4242 4242`, date future, CVC au choix.

### f. Sécurité

- Le webhook rejette toute requête sans signature Stripe valide (400) et
  répond 503 si `STRIPE_WEBHOOK_SECRET` est absent — jamais 200 par défaut.
- Les évènements déjà traités sont ignorés via `stripe_events` (Stripe
  redélivre en cas d'erreur).
- `confirmCheckoutSessionAction` vérifie que `client_reference_id` correspond
  à l'entreprise connectée : un identifiant de session deviné ne donne pas
  l'accès.
- Le portail client et le Checkout ne sont ouverts que pour le Stripe Customer
  rattaché à l'entreprise de l'utilisateur connecté.
