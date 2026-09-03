# Journal des dettes connues

Défauts repérés, compris, et **délibérément laissés** — avec ce qu'il faut
savoir pour les reprendre. Une dette écrite se rembourse ; une dette oubliée
se paie deux fois.

---

## 1. Le rôle `anon` ne peut lire aucune table

**Repéré le 1er septembre 2026, en éprouvant la page publique des soumissions.**

Avec la clé anonyme et aucune session, toute lecture échoue :

```
permission denied for function is_platform_super_admin
```

Une politique RLS posée par la migration 033 appelle cette fonction, et le
rôle `anon` n'a pas le droit de l'exécuter. Le refus vient de Postgres avant
même l'évaluation de la politique.

**Pourquoi rien n'est cassé aujourd'hui.** Les deux seuls chemins qui servent
un visiteur non connecté passent par la clé de service, qui contourne la RLS :
`getQuoteByPublicToken` et `getCompanyById`, tous deux appelés depuis
`loadPublicQuote`. Un utilisateur connecté lit normalement — vérifié sur
`quotes`, `customers`, `invoices`, `scheduled_jobs`, `employees` et `tools`.

**Pourquoi il faut quand même le corriger.** Le jour où quelque chose lira en
anonyme — un lien de suivi, une page de facture publique, un widget — la
lecture échouera avec un message qui ne dit rien du vrai problème. Et le
diagnostic coûtera cher parce que l'erreur ne nomme pas la table en cause.

**La correction attendue.** `GRANT EXECUTE ON FUNCTION is_platform_super_admin
TO anon;`, ou mieux : marquer la fonction `SECURITY DEFINER` et restreindre
les politiques qui l'appellent aux rôles qui en ont besoin, de sorte que `anon`
ne la traverse jamais.

**Décision de Jérôme le 1er septembre 2026 :** noter, corriger plus tard.

---

## 2. Un client qui a supprimé le courriel de sa facture ne peut plus la revoir

**Repéré le 2 septembre 2026, en délimitant les pièces jointes de chantier.**

Une facture part **en HTML dans le corps d'un courriel**, et c'est tout. Il n'y
a ni PDF joint, ni page de consultation, ni lien permanent. Le courriel est
donc l'unique exemplaire : supprimé, classé dans les indésirables ou perdu
dans un fil, la facture n'existe plus pour le client.

Les soumissions, elles, ont une page publique avec jeton — `loadPublicQuote`.
Les factures n'ont pas d'équivalent.

**Ce que ça coûte.** Un client qui rappelle pour redemander sa facture oblige
l'entrepreneur à la renvoyer à la main. Pire : un client qui ne retrouve pas
sa facture ne paie pas, et l'entrepreneur ne sait pas pourquoi. C'est le même
angle mort que la délivrabilité des courriels — on perd sans jamais l'apprendre.

**La correction attendue.** Une page publique de facture sur le modèle de celle
des soumissions : jeton dans l'URL, lecture par la clé de service, lien placé
dans le courriel. Elle porterait aussi les **pièces jointes du chantier**, ce
qui rendrait les photos visibles par le client — écarté volontairement au
moment de construire les pièces jointes, faute de page où les montrer.

**Attention en la construisant :** elle butera sur la [dette n° 1](#1-le-rôle-anon-ne-peut-lire-aucune-table)
si elle lit avec la clé anonyme. Passer par la clé de service, ou régler la
dette n° 1 d'abord.

**Décision de Jérôme le 2 septembre 2026 :** noter, construire plus tard.

---

## 3. La suite e2e tourne contre le serveur de développement

**Mesuré deux fois le 2 septembre 2026, sur deux passages complets.**

Sur un passage complet (~26 minutes), environ **trois épreuves échouent au
hasard** sur des délais de navigation de 30 s — `page.goto` ou `waitForURL`.
**Ce ne sont jamais les mêmes :**

| Passage | Épreuves tombées | Nature |
|---|---|---|
| 1er (28 min) | `13-field-employee` × 3 | `waitForURL` / heading, 30 s dépassées |
| 2e (25,8 min) | `08-super-admin`, `10-navigation` × 2 | `page.goto`, 30 s dépassées |

Les mêmes fichiers repassent verts relancés seuls, en petit lot
(13 + 14 + 15 en 1,1 min) ou précédés des deux plus longs
(11 + 12 + 13, 18 épreuves, 9 min).

**La cause.** Le `webServer` de `playwright.config.ts` lance `npm run dev`, qui
**compile chaque route à la première visite**. Sur une longue série, la
première compilation d'une route lourde dépasse le délai de navigation — et ce
n'est jamais la même route, puisque ça dépend de l'ordre et de la charge.

**Ce que ça coûte.** Ce n'est pas qu'une perte de temps : c'est un échec qui
ressemble à un vrai défaut. On cherche dans le code applicatif ce qui n'y est
pas. La CI le masque avec son unique réessai (`retries: 1`), donc le problème
ne se voit qu'en local — là où il coûte le plus cher.

**La correction attendue.** Faire pointer `webServer` vers un vrai build :
`npm run build && npm run start` au lieu de `npm run dev`. Plus de compilation
à la demande, donc plus de délai qui saute, et une suite nettement plus rapide.
Le coût est une étape de build supplémentaire dans `e2e.yml`.

**Attention :** ne pas toucher à la barrière de production de
`e2e/global-setup.ts` en le faisant. Elle vise la base de données, pas le mode
de démarrage — les deux sont indépendants.

**Décision de Jérôme le 2 septembre 2026 :** noter, corriger plus tard.

---

## 4. Le calendrier affiche un jour et en filtre un autre, hors du Québec

**Trouvé le 2 septembre 2026, en cherchant pourquoi six épreuves tombaient
sur la CI à 22 h 55.**

Le calendrier place les travaux avec `SCHEDULE_TIMEZONE`
(`America/Montreal`) — `getEventDayKey` et `calendarDayKey` convertissent
toutes deux dans ce fuseau. Mais le jour **affiché en titre** vient d'un
`new Date()` lu dans le fuseau du navigateur.

Pour un entrepreneur québécois, les deux coïncident toujours. Sur un
navigateur réglé sur UTC, ils divergent **entre 20 h et minuit, heure du
Québec** :

| | Valeur |
|---|---|
| Heure réelle | 2 sept. 22 h 55 (Montréal) = 3 sept. 02 h 55 (UTC) |
| Titre affiché | jeudi **3** septembre |
| Jour réellement filtré | **2** septembre |
| Travaux visibles | aucun |

**Pourquoi rien n'est cassé pour les clients.** Ils sont tous au Québec, et
leur navigateur aussi. Les deux calculs donnent la même date, toujours.

**Ce que ça a coûté.** Six épreuves tombées d'un coup, toutes sur
`[data-event-id]` introuvable, avec un symptôme qui ressemble exactement à
une régression du code livré. Vérifié en relançant la même épreuve sur
`main`, sans aucune modification : elle tombe pareil. Le harnais tourne
maintenant avec `TZ=America/Montreal`, ce qui règle la CI sans toucher au
produit.

**La correction attendue.** Dériver la date courante du calendrier dans
`SCHEDULE_TIMEZONE` plutôt que dans le fuseau du navigateur, de sorte que le
titre et le filtre disent toujours la même chose. Le jour où un utilisateur
consultera son horaire depuis un autre fuseau — en voyage, ou un fournisseur
hors province — il verra un calendrier vide sans comprendre pourquoi.

**Décision de Jérôme le 2 septembre 2026 :** noter, corriger plus tard.
