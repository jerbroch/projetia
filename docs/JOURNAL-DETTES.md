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
