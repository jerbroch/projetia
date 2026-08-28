# Journal Stripe — abonnements

Historique des décisions, des bogues et de la configuration de compte pour
l'abonnement SaaS. Couvre la mise en place du 24 au 27 août 2026.

Ce document existe surtout pour une raison : **une partie de l'intégration ne
vit pas dans le dépôt.** Les prix, les codes de taxe et la configuration du
portail client sont des données de compte Stripe. Quelqu'un qui relit le code
seul ne peut pas savoir qu'elles existent, ni pourquoi le code est écrit ainsi.

---

## 1. Les décisions

### Quatre paliers, prix par entreprise

| Palier | Mensuel | Annuel | Produit Stripe |
|---|---|---|---|
| Solo | 39,99 $ | 399,90 $ | `prod_V8fnmLwlJqYzCt` |
| Entreprise | 89,99 $ | 899,90 $ | `plan_entreprise` |
| Entrepreneur | 149,99 $ | 1 499,90 $ | `plan_entrepreneur` |
| Croissance | 249,99 $ | 2 499,90 $ | `plan_croissance` |

Montants en CAD, définis dans `src/lib/billing/tiers.ts`. L'annuel vaut dix
mensualités — deux mois offerts.

Le prix est **par entreprise, pas par utilisateur**. C'est le choix structurant
face à Jobber et Housecall Pro, dont la facturation par siège fait exploser la
note d'un entrepreneur avec six employés. Voir `BILLING_ABONNEMENTS.md` pour
l'analyse de marché.

Essai de 14 jours (`SUBSCRIPTION_TRIAL_DAYS`), posé sur l'abonnement Stripe via
`subscription_data.trial_period_days`. L'entreprise est donc en statut
`trialing` chez Stripe et `trial` en base pendant cette période.

### Le portail plutôt que Checkout pour changer de palier

**Un abonnement Stripe vivant se modifie, il ne se rachète pas.** Ouvrir un
nouveau Checkout pour un client qui a déjà un abonnement actif en créerait un
**second** sur le même client — double facturation, sans que rien ne l'empêche
côté Stripe.

`selectSubscriptionPlanAction` (`src/lib/actions/subscription-access.ts`)
aiguille donc selon l'état :

- **Pas d'abonnement, ou abonnement annulé** → Checkout, c'est un achat.
- **Abonnement vivant** → portail client Stripe, c'est une modification.

### La garde anti-double-abonnement

`hasModifiableSubscription()` (`src/lib/billing/subscription-status.ts`) décide.
Elle exige **deux** conditions :

1. un `stripe_subscription_id` non nul ;
2. un statut normalisé dans `{active, trial, past_due}`.

`past_due` en fait partie volontairement : Stripe relance encore, l'abonnement
existe toujours, un Checkout en créerait un second. Un abonnement `cancelled`,
lui, se rachète normalement.

**Cette garde vit côté serveur, pas dans l'interface.** L'interface désactive
bien le palier courant, mais un server action reste appelable directement : la
protection doit tenir même si l'interface est contournée.

### Le portail s'ouvre sur l'écran de confirmation

Envoyer l'utilisateur à l'accueil du portail l'obligeait à re-sélectionner le
palier qu'il venait de choisir. `createBillingPortalSession` accepte donc une
cible (`PortalUpdateTarget`) et construit un `flow_data` de type
`subscription_update_confirm`.

Deux conséquences moins évidentes :

- **L'id de l'item d'abonnement est requis** et n'est pas persisté en base : il
  est relu chez Stripe au moment de créer la session. Sans lui, on retombe sur
  le portail générique plutôt que d'échouer.
- **La cible vient du client** puisque l'action y est exposée.
  `validatePortalTarget` vérifie donc côté serveur que l'abonnement appartient
  bien à l'entreprise et que le prix correspond à un palier connu. Une cible
  déjà sur le palier courant retombe aussi sur le portail générique, Stripe
  rejetant un flux « sans changement à confirmer ».

---

## 2. Les bogues trouvés

### « No such price » au checkout

Les price IDs de `.env.local` étaient déjà les bons. **C'est le serveur de
développement qui gardait les anciens en mémoire** : Next.js lit `.env.local`
au démarrage seulement. Un redémarrage a suffi.

À retenir : après toute modification de `.env.local`, redémarrer le serveur.

### Code de taxe manquant

Managed Payments est activé par défaut sur le compte et **exige un `tax_code`
sur chaque produit**. Les quatre n'en avaient aucun, donc Stripe refusait de
créer la session Checkout.

### Managed Payments contre la version d'API

Une fois les codes de taxe posés, Managed Payments exigeait l'API
`2025-03-31.basil` ou plus récente, alors que le SDK épinglait
`2025-02-24.acacia`. Le Checkout échouait toujours.

Réglé en passant `managed_payments: { enabled: false }` sur la session.
**Ce choix reste valable après la montée du SDK** : l'application calcule ses
taxes via `automatic_tax`, et basculer sur Managed Payments changerait le
parcours de paiement sans que rien ne le demande.

### Le portail n'offrait aucun changement de palier

`subscription_update` était désactivé sur la configuration du portail, qui
n'affichait donc que l'annulation. Voir §4 pour la configuration posée.

### Champs Stripe déplacés entre versions d'API — le bogue coûteux

Deux champs ont changé d'emplacement entre `acacia` et `basil` :

```
subscription.current_period_end → subscription.items.data[].current_period_end
invoice.subscription            → invoice.parent.subscription_details.subscription
```

Les types du SDK décrivaient la forme `acacia`, donc lire la racine **compilait
sans erreur mais renvoyait `undefined` à l'exécution**. Conséquences :

- chaque `customer.subscription.updated` écrasait
  `subscription_current_period_end` et `subscription_ends_at` avec `null` —
  `buildCompanySubscriptionUpdate` les écrit sans garde, contrairement à
  `trial_ends_at` qui est conditionnel et a donc survécu ;
- les évènements `invoice.*` ne retrouvaient jamais leur abonnement et
  sortaient avant `syncSubscriptionById`. **`invoice.payment_failed` ne pouvait
  donc pas basculer l'entreprise en `past_due` ni journaliser l'incident** —
  le filet de sécurité sur les échecs de paiement était inerte.

**Le défaut était masqué au premier paiement par une course.**
`checkout.session.completed` appelle `syncSubscriptionById`, qui refait un
appel SDK et récupérait la forme `acacia`. Cet aller-retour est lent, si bien
que son écriture arrivait *après* celle du webhook et corrigeait le `null` par
accident. Un seul évènement sans cette course, et la date disparaissait.

### Métadonnées d'abonnement périmées

`tier` et `cycle` n'étaient posées qu'à la création, dans `subscription_data`
au Checkout. Un changement de palier par le portail modifie le prix mais pas
les métadonnées : elles restaient sur l'ancien palier.

Elles servent de repli dans `syncSubscriptionToCompany` quand le Price ID n'est
plus reconnu. **Une métadonnée périmée est pire qu'absente** : un repli absent
laisse le champ à `null`, un repli faux remplit la base avec le mauvais palier.

`syncSubscriptionToCompany` les réaligne désormais après l'écriture en base,
seulement quand le Price ID a résolu le palier — c'est la source de vérité — et
seulement en cas d'écart. Ce test d'écart sert aussi de garde-fou : l'écriture
déclenche un `customer.subscription.updated`, dont la passe suivante ne réécrit
rien, donc la boucle s'arrête après un tour.

---

## 3. Pourquoi `stripe-payload.ts` existe

`src/lib/billing/stripe-payload.ts` lit les deux emplacements possibles des
champs déplacés, l'ancien d'abord.

**La question légitime : le SDK étant désormais aligné sur `dahlia`, la version
du compte, ce module ne devrait-il pas disparaître ?**

Non. **La version d'API d'un endpoint webhook est indépendante de celle du
SDK.** Elle est figée à la création de l'endpoint et ne suit pas les montées de
version. Un endpoint créé avant la bascule continue de livrer la forme
`acacia`, quelle que soit la version du SDK. Le module protège de cet écart, et
de la prochaine relocalisation de champ.

Ses entrées sont typées `unknown` volontairement : la forme d'un payload livré
ne correspond pas forcément aux types du SDK, et un cast donnerait une fausse
garantie de correction.

**Effet de bord à connaître :** parce que ces helpers prennent `unknown`, le
compilateur ne peut plus signaler un changement de forme à cet endroit. C'est
un compromis assumé — la résilience à l'exécution contre la détection à la
compilation. Ailleurs dans le code, garder les types du SDK reste préférable.

---

## 4. La configuration Stripe — hors dépôt

**Tout ce qui suit est en mode test. Rien de cela n'existe encore en mode
Live**, et la mise en production devra le refaire.

### Codes de taxe

`tax_code = txcd_10103001` (« Software as a service (SaaS) – business use ») sur
les quatre produits. Requis par Managed Payments, et nécessaire au calcul
TPS/TVQ par Stripe Tax.

### Configuration du portail client

Configuration `bpc_1U926t061aVmyk8tuIHgT2lE` (active, par défaut) :

| Réglage | Valeur |
|---|---|
| `subscription_update.enabled` | `true` |
| `proration_behavior` | `create_prorations` |
| `default_allowed_updates` | `["price"]` |
| `trial_update_behavior` | `continue_trial` |
| `products` | 4 produits, leurs 8 prix |
| `subscription_cancel.enabled` | `true` |

`continue_trial` est un choix délibéré : le défaut `end_trial` clôt l'essai de
14 jours dès le premier changement de palier et déclenche la facturation
immédiate.

### Le piège de `products` — à lire avant d'y toucher

**`features[subscription_update][products]` n'est jamais renvoyé par l'API.**
Il ressort toujours `null`, même correctement enregistré.

Conséquences pratiques :

- On ne peut **pas** vérifier son contenu par lecture. Le seul moyen est
  fonctionnel : créer une session portail avec un `flow_data` ciblant un prix
  et voir si Stripe l'accepte. Un prix absent de la liste produit une erreur
  explicite le disant.
- Un POST qui **inclut** `products` remplace la liste entière. Un POST partiel
  a ainsi silencieusement écrasé les quatre produits par un seul, pendant la
  mise en place, sans que rien ne le signale.

Après toute modification de cette configuration, revérifier les huit prix
fonctionnellement.

Note : un changement de palier pendant l'essai ne génère **aucune proration**,
même avec `create_prorations` — rien n'a encore été facturé. Le nouveau tarif
s'applique à la fin de l'essai. Tester la proration demande un abonnement sorti
de l'essai.

---

## 5. Version du SDK

`stripe@22.6.0`, `apiVersion: "2026-08-26.dahlia"` (`src/lib/stripe.ts`).

Le compte est sur `2026-07-29.dahlia` — même majeure, donc les formes de
payload concordent entre appels sortants et webhooks.

La montée depuis `17.7.0` / `acacia` n'a produit **aucune erreur de
compilation**, les accès fautifs ayant déjà été corrigés. Une sonde temporaire
compilée contre v22 confirme ce que les anciens types masquaient :

```
TS2339: Property 'current_period_end'   does not exist on type 'Subscription'
TS2339: Property 'current_period_start' does not exist on type 'Subscription'
TS2339: Property 'subscription'         does not exist on type 'Invoice'
```

Les deux premières lignes **sont** le bogue du §2. Une version alignée l'aurait
attrapé à la compilation.

**Un point important pour la suite :** depuis la montée,
`current_period_end` est absent de la racine **y compris sur
`subscriptions.retrieve`**. C'était pourtant ce champ qui faisait fonctionner
le chemin du retour de Checkout, le seul épargné par le bogue. Sans le
correctif préalable, cette montée aurait cassé ce dernier chemin sain.

---

## 6. À faire au moment de la bascule Live

### Vider `platform_invoices` avant le premier dollar réel

La table a été remplie en production le 28 août 2026 par
`npm run invoices:backfill`, avec **six factures de MODE TEST** — celles
produites pendant la mise en place : deux paiements (39,99 $ et 149,99 $), deux
notes de crédit négatives issues des changements de palier, et deux factures à
zéro de création d'abonnement.

Ce sont des artefacts d'essai, pas des ventes. Au moment de basculer en Live :

```sql
DELETE FROM platform_invoices;
```

puis relancer `npm run invoices:backfill` avec les clés Live. L'historique de
revenus commencera alors exactement au premier dollar réel, ce qui est la
seule base saine pour une trace comptable.

Repère pour les distinguer si le nettoyage est oublié : les factures de test
portent les préfixes `JDIZZDVQ-` et `H5WEUWBE-`, et toutes ont `gst_cents` et
`qst_cents` à zéro — mais ce dernier critère cessera d'être discriminant après
l'inscription aux taxes.

### Les autres points bloquants

Voir la section « Avant de fusionner » de la pull request : inscriptions
fiscales Stripe Tax, recréation du catalogue en Live, endpoint webhook Live,
variables Vercel et migrations à appliquer.

---

## 7. Historique des commits

| Commit | Date | Objet |
|---|---|---|
| `acf2fa2` | 24 août | Paiement d'abonnement (Checkout, webhook, portail) |
| `8c10a84` | 25 août | Les 4 paliers |
| `cf7792d` | 25 août | Tarifs atteignables depuis les Paramètres (`?upgrade=1`) |
| `4611196` | 25 août | Destination préservée à travers la connexion |
| `008429a` | 25 août | Tests des 4 paliers × 2 cycles |
| `7b6265c` | 25 août | Audit des prix annoncés contre facturés |
| `345db70` | 27 août | Changement de palier via le portail |
| `a6e9f8b` | 27 août | Champs déplacés entre versions d'API |
| `31a6d01` | 27 août | Réalignement des métadonnées |
| `50bab84` | 27 août | Montée du SDK en v22 |
