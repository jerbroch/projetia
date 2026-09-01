-- Un numéro interne ne peut désigner qu'un seul outil dans une entreprise.
--
-- Le numéro interne est ce qui est gravé ou collé sur l'outil : c'est par lui
-- qu'on le retrouve au magasin. Deux outils qui le partagent rendent
-- l'inventaire inutilisable — on ne sait plus lequel est sorti, ni chez qui.
--
-- La garde applicative (outilAvecLeMemeNumero) refuse déjà le doublon EN
-- NOMMANT l'outil fautif, ce qu'un index ne saurait faire. Cet index est le
-- filet : il tient face à un import, un script, ou deux enregistrements
-- simultanés que la vérification applicative ne verrait pas se croiser.
--
-- Index PARTIEL, comme pour les courriels d'employés (migration 032) : le
-- numéro est facultatif, et plusieurs outils sans numéro doivent coexister.
-- Sur lower(), parce que « out-001 » gravé à la main et « OUT-001 » tapé au
-- bureau désignent le même outil sur le plancher.

-- Dédoublonnage préalable : sans lui la création de l'index échoue et la
-- migration entière est annulée. On suffixe les doublons les PLUS RÉCENTS,
-- en gardant le premier enregistré, et on laisse une trace visible à l'écran
-- plutôt que d'effacer une information que seul le propriétaire peut trancher.
WITH doublons AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY company_id, lower(btrim(internal_number))
           ORDER BY created_at, id
         ) AS rang
  FROM tools
  WHERE internal_number IS NOT NULL
    AND btrim(internal_number) <> ''
)
UPDATE tools t
SET internal_number = t.internal_number || ' (doublon ' || d.rang || ')'
FROM doublons d
WHERE t.id = d.id AND d.rang > 1;

CREATE UNIQUE INDEX IF NOT EXISTS tools_internal_number_unique_per_company
  ON tools (company_id, lower(btrim(internal_number)))
  WHERE internal_number IS NOT NULL AND btrim(internal_number) <> '';
