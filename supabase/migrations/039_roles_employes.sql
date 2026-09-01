-- Rôles d'employés : une structure que l'entrepreneur façonne lui-même.
--
-- PREMIÈRE VERSION JETÉE. Elle posait un enum fermé — compagnon, apprenti 1
-- à 4, chargé de projet — c'est-à-dire le vocabulaire de la CCQ, donc celui
-- d'un plombier. Un paysagiste ne parle pas comme ça, un couvreur non plus,
-- et « chargé de projet » n'est même pas un niveau d'apprentissage : il
-- n'entrait dans la grille que parce que je l'y avais forcé.
--
-- Des gabarits par métier auraient été pire : un menu interminable à
-- l'inscription, et des grilles de salaire à maintenir pour des métiers que
-- personne ici ne maîtrise.
--
-- Donc : une table par entreprise, sur le modèle de labor_rate_templates.
-- L'employeur renomme, ajoute, retire. Trois rôles génériques SANS TAUX au
-- départ, qu'il remplit en trente secondes.
--
-- LE TAUX EST NULL, PAS ZÉRO. C'est la distinction qui permet d'avertir :
-- « ce rôle n'a pas de taux » se corrige, « ce rôle est à 0 $ » ressemble à
-- une décision. Zéro reste saisissable pour un bénévole ou un stagiaire non
-- rémunéré ; NULL veut dire « pas encore rempli ».

CREATE TABLE IF NOT EXISTS employee_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Salaire VERSÉ par défaut, proposé à la création d'une fiche employé.
  -- NULL = jamais renseigné. Voir l'avertissement côté application.
  default_hourly_rate NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deux rôles du même nom dans une entreprise rendraient le menu illisible.
-- Insensible à la casse et aux espaces de bord, comme pour les numéros
-- d'outils : « Apprenti » et « apprenti » désignent la même chose au bureau.
CREATE UNIQUE INDEX IF NOT EXISTS employee_roles_nom_unique_par_entreprise
  ON employee_roles (company_id, lower(btrim(name)));

ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_roles_tenant ON employee_roles
  FOR ALL
  USING (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- SET NULL et non CASCADE : retirer un rôle ne doit jamais effacer un
-- employé. La fiche perd son niveau, elle ne disparaît pas.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES employee_roles (id) ON DELETE SET NULL;

COMMENT ON COLUMN employees.role_id IS
  'Niveau dans l''entreprise (senior, apprenti…). Distinct de `trade`, qui est le métier : couvreur, électricien, paysagiste.';

COMMENT ON COLUMN employees.hourly_rate IS
  'Salaire horaire VERSÉ à l''employé. Jamais un taux de facturation : celui-ci vit dans labor_rate_templates.bill_rate.';

-- Trois rôles génériques, SANS TAUX. Ils ne prétendent rien savoir du métier
-- de l'entrepreneur — ils lui donnent trois lignes à renommer et à remplir.
--
-- UNE SEULE FOIS PAR ENTREPRISE. `seed_company_billing_defaults` est appelée à
-- chaque chargement des paramètres de facturation, pas seulement à
-- l'inscription. Un semis ligne par ligne aurait donc RESSUSCITÉ « Employé
-- senior » chaque fois que l'entrepreneur l'aurait renommé en « Contremaître »,
-- et fait revenir « Apprenti » après chaque suppression. Vérifié : c'est
-- exactement ce que faisait la première version.
--
-- La garde porte sur l'existence de TOUTE ligne, active ou non : désactiver un
-- rôle est le geste attendu pour s'en débarrasser, et cela suffit à empêcher
-- le retour. Ne restent que les entreprises qui suppriment leurs trois rôles,
-- qui les retrouveront — un employeur sans aucun rôle n'a rien à choisir.
CREATE OR REPLACE FUNCTION _seed_employee_roles(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM employee_roles WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  INSERT INTO employee_roles (company_id, name, default_hourly_rate, sort_order) VALUES
    (p_company_id, 'Employé senior', NULL, 1),
    (p_company_id, 'Employé',        NULL, 2),
    (p_company_id, 'Apprenti',       NULL, 3);
END;
$$;

-- Les entreprises déjà inscrites reçoivent les trois lignes. Aucune écriture
-- sur ce qui existe : le WHERE NOT EXISTS protège un rôle déjà renommé.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM companies LOOP
    PERFORM _seed_employee_roles(c.id);
  END LOOP;
END;
$$;

-- Accroché au semis existant, pour qu'une nouvelle entreprise les obtienne
-- avec ses gabarits et ses fournisseurs.
CREATE OR REPLACE FUNCTION seed_company_billing_defaults(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id NOT IN (SELECT auth_user_company_ids()) THEN
    RAISE EXCEPTION 'Unauthorized company';
  END IF;

  INSERT INTO suppliers (company_id, code, name) VALUES
    (p_company_id, 'noble', 'Noble'),
    (p_company_id, 'wolseley', 'Wolseley'),
    (p_company_id, 'deschenes', 'Deschênes'),
    (p_company_id, 'master', 'Master'),
    (p_company_id, 'autre', 'Autre')
  ON CONFLICT (company_id, code) DO NOTHING;

  PERFORM _seed_labor_rate_templates(p_company_id);
  PERFORM _seed_employee_roles(p_company_id);
END;
$$;
