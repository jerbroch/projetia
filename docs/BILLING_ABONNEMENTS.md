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

### Recommandation

| | Prix | Correspondance Stripe |
|---|---|---|
| **Mensuel** | **89 $ CA / mois** | `STRIPE_PRICE_ID_MONTHLY` |
| **Annuel** | **890 $ CA / an** (2 mois offerts, −17 %) | `STRIPE_PRICE_ID_ANNUAL` |
| **Essai** | **14 jours gratuits**, sans carte bloquante | `SUBSCRIPTION_TRIAL_DAYS=14` |

**Par entreprise, utilisateurs illimités.** C'est le positionnement le plus
lisible face à Jobber : à 6 employés, ConstructionIOS coûte 89 $ CA contre
~165 $ US chez Jobber Connect, et l'entrepreneur n'a pas à arbitrer qui a un
compte.

Pourquoi 89 $ et pas moins :

- **Sous 49 $, le produit ne se croit pas.** Un entrepreneur général qui
  facture 90 $/h de main-d'œuvre juge un outil à 29 $/mois comme un gadget.
- **89 $ = moins d'une heure facturable par mois.** C'est l'argument de vente à
  mettre sur la page : le logiciel se rembourse avec une seule soumission
  envoyée plus vite.
- **Ça laisse de la marge pour descendre**, jamais l'inverse. Un prix de
  lancement bas est presque impossible à remonter chez les clients existants.

### Ce qu'il faut faire avec les codes promo (déjà en place)

Le mécanisme `promo_codes` existe déjà. Utilisez-le plutôt que de baisser le
prix affiché :

- **Bêta / fondateurs** : accès gratuit, en échange de retours d'usage.
- **Premiers clients payants** : code Stripe `−50 % pendant 6 mois`
  (`allow_promotion_codes` est activé sur le Checkout).
- **Référencement** : un mois offert par client référé.

### Quand passer à des paliers

Restez sur un plan unique tant que vous n'avez pas ~30 clients payants. Un
tarif unique convertit mieux et évite les questions. Ensuite seulement,
découpez :

- **Solo** 49 $ — 1 utilisateur, soumissions et factures
- **Équipe** 89 $ — utilisateurs illimités, horaire, feuilles de facturation
- **Entreprise** 199 $ — multi-succursale, rapports, accès API

Le code lit les prix depuis l'environnement : passer à des paliers demandera
d'ajouter des Price IDs, pas de réécrire le flux de paiement.

---

## 2. Mise en place technique

### a. Migration base de données

Exécuter `supabase/migrations/022_subscription_billing.sql` dans le SQL Editor
Supabase. Elle ajoute sur `companies` : `stripe_customer_id`,
`stripe_subscription_id`, `subscription_plan`, `subscription_price_id`,
`subscription_current_period_end`, `subscription_cancel_at_period_end`, et crée
la table `stripe_events` (idempotence des webhooks).

`subscription_status` reste l'ENUM existant. Les statuts Stripe y sont
normalisés :

| Stripe | Enregistré | Accès à l'app |
|---|---|---|
| `active` | `active` | ✅ |
| `trialing` | `trial` | ✅ |
| `past_due` | `past_due` | ✅ (délai de grâce, Stripe relance) |
| `unpaid`, `canceled`, `incomplete`, `paused` | `cancelled` | ❌ |

### b. Configuration Stripe

1. **Products → Add product** : « ConstructionIOS », deux prix récurrents en
   **CAD** — 89,00 $/mois et 890,00 $/an. Copier les deux `price_...` dans
   `STRIPE_PRICE_ID_MONTHLY` et `STRIPE_PRICE_ID_ANNUAL`.
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

Voir `.env.example`, section Stripe. Sans `STRIPE_PRICE_ID_*`, la page
`/choose-plan` enregistre le plan choisi et affiche « Paiement bientôt
disponible » — aucun faux succès n'est jamais renvoyé.

### d. Parcours

```
/choose-plan  →  selectSubscriptionPlanAction(plan)
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
