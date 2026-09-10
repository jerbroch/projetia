-- =====================================================================
-- ConstructionOS — Migration 001 (révision 3)
-- Versionnage des soumissions + identité durable des lignes
-- + rattachement des heures et matériaux terrain
--
-- Additive uniquement. quotes.line_items et quotes.cost_estimation
-- restent intacts. Aucune colonne existante modifiée ou renommée.
--
-- Changements depuis la révision 1 :
--   - un seul trigger de machine d'état (fusion des deux précédents)
--   - immuabilité dérivée du statut, plus d'un booléen modifiable
--   - transitions de statut explicitement énumérées, sent -> draft interdit
--   - gel du contenu par liste blanche (survit à l'ajout de colonnes)
--   - deux vues de réconciliation séparées + une vue unifiée
--   - échec explicite si field_hours.hours n'existe pas
--
-- Révision 3 :
--   - trigger actif aussi sur INSERT
--   - états 'finalizing' et 'finalization_failed' (préparation de 002)
--   - colonnes de preuve : payload canonique, content_hash, artefact
--   - envoi refusé si la chaîne de preuve est incomplète
-- =====================================================================


-- ---------------------------------------------------------------------
-- HYPOTHÈSES — VÉRIFIÉES le 9 septembre 2026 sur la base de production
-- ---------------------------------------------------------------------
-- 1. quotes.id est de type uuid ......................... VÉRIFIÉ : uuid
-- 2. il existe une colonne quotes.company_id (uuid) ..... VÉRIFIÉ : uuid
-- 3. material_catalog_items.id est de type uuid ......... VÉRIFIÉ : uuid
-- 4. field_hours possède une colonne numérique `hours` .. VÉRIFIÉ : numeric
-- 5. RLS avec confinement par entreprise ................ VÉRIFIÉ : activée
--    sur quotes, field_hours, field_materials, scheduled_jobs
--
-- Aucune collision de nom : les trois tables et les trois vues créées
-- ici sont libres, de même que les deux fonctions de déclencheur.
-- gen_random_uuid() est disponible (pgcrypto et uuid-ossp installées).
-- ---------------------------------------------------------------------


begin;


-- =====================================================================
-- 0. GARDE-FOU — échec explicite plutôt que repli silencieux
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_hours'
      and column_name = 'hours'
  ) then
    raise exception
      'field_hours.hours introuvable. Corriger le nom de la colonne de durée dans cette migration avant de l''exécuter.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- LES DEUX RÈGLES DE SUPPRESSION, ET POURQUOI ELLES DIFFÈRENT
--
-- company_id -> companies : ON DELETE RESTRICT.
--   Le schéma met CASCADE partout ailleurs (31 clés sur 35). On s'en
--   écarte volontairement : une soumission envoyée est une pièce, pas une
--   donnée de travail. Supprimer une entreprise ne doit pas l'effacer sans
--   que personne ne l'ait demandé.
--   MESURÉ : avec RESTRICT comme avec NO ACTION, `delete from companies`
--   est REFUSÉ dès qu'une version existe — la cascade de quotes ne prend
--   pas les devants. RESTRICT est retenu parce qu'il dit son intention.
--   CONSÉQUENCE : les chemins qui suppriment une entreprise devront
--   d'abord effacer ses quote_versions. Aujourd'hui aucun n'est touché,
--   la table étant vide ; ce sera vrai dès que le versionnage écrira.
--   Concernés : e2e/helpers/purge-e2e-tenants.ts, e2e/global-setup.ts.
--
-- labor_rate_id -> labor_rate_templates : ON DELETE SET NULL.
--   Un taux retiré du catalogue ne doit ni bloquer sa suppression ni
--   détruire des heures déjà saisies. Le montant est de toute façon figé
--   dans la ligne, et labor_type_snapshot reste lisible. C'est déjà la
--   règle de job_billing_lines.labor_template_id, l'unique clé existante
--   vers cette table.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 1. VERSIONS DE SOUMISSION
-- L'immuabilité n'est pas un drapeau : elle découle du statut.
-- Toute version sortie de 'draft' a un contenu figé, définitivement.
-- =====================================================================

create table if not exists quote_versions (
  id                    uuid primary key default gen_random_uuid(),
  quote_id              uuid not null references quotes(id) on delete cascade,
  company_id            uuid not null references companies(id) on delete restrict,
  version_number        integer not null,

  status                text not null default 'draft'
                          check (status in ('draft','finalizing','finalization_failed',
                                            'sent','accepted','rejected','superseded')),

  -- Provenance : créée nativement, ou normalisée depuis l'ancien JSON
  migration_source      text not null default 'native'
                          check (migration_source in ('native','legacy_json')),
  legacy_snapshot       jsonb,
  normalized_at         timestamptz,

  -- Contexte de rendu figé au moment de la finalisation.
  -- Tout ce dont le document a besoin : coordonnées, taxes, conditions,
  -- pied de page, langue, arrondis. Jamais relu depuis l'état courant.
  render_context        jsonb,
  render_engine_version text,

  -- Preuve du contenu métier : reproductible.
  canonical_payload       jsonb,
  content_schema_version  text,
  canonicalization_algo   text,     -- ex. 'RFC8785'
  content_hash            text,

  -- Preuve de l'artefact envoyé : non reproductible, donc archivé.
  artifact_storage_path text,       -- chemin append-only, jamais réécrit
  artifact_mime_type    text,
  artifact_size         bigint,
  artifact_hash         text,
  artifact_created_at   timestamptz,

  created_at            timestamptz not null default now(),
  locked_at             timestamptz,
  sent_at               timestamptz,
  accepted_at           timestamptz,

  unique (quote_id, version_number)
);

create index if not exists idx_quote_versions_quote   on quote_versions(quote_id);
create index if not exists idx_quote_versions_company on quote_versions(company_id);


-- =====================================================================
-- 2. IDENTITÉ LOGIQUE D'UNE LIGNE
-- Un ouvrage à l'intérieur d'une soumission. Survit aux révisions.
-- Le terrain pointe ici, jamais vers une version.
-- L'appartenance à une soumission est définitive : un « déplacement »
-- vers une autre soumission crée une nouvelle identité, tracée.
-- =====================================================================

create table if not exists quote_line_items (
  id                          uuid primary key default gen_random_uuid(),
  quote_id                    uuid not null references quotes(id) on delete cascade,
  company_id                  uuid not null references companies(id) on delete restrict,
  copied_from_quote_line_item_id uuid references quote_line_items(id),
  created_at                  timestamptz not null default now()
);

create index if not exists idx_qli_quote   on quote_line_items(quote_id);
create index if not exists idx_qli_company on quote_line_items(company_id);


-- =====================================================================
-- 3. ÉTAT D'UNE LIGNE DANS UNE VERSION DONNÉE
-- Même ouvrage à 8 h en V1 et 10 h en V2 :
-- un seul quote_line_item_id, deux quote_line_versions.
-- =====================================================================

create table if not exists quote_line_versions (
  id                  uuid primary key default gen_random_uuid(),
  quote_line_item_id  uuid not null references quote_line_items(id) on delete cascade,
  quote_version_id    uuid not null references quote_versions(id) on delete cascade,
  company_id          uuid not null references companies(id) on delete restrict,

  sort_order          integer not null default 0,
  line_type           text,
  description         text not null,

  quantity            numeric(12,3),
  unit                text,
  unit_price          numeric(12,2),
  amount              numeric(12,2),

  labor_hours         numeric(8,2),
  labor_rate_id       uuid references labor_rate_templates(id) on delete set null,
  labor_type_snapshot text,

  catalog_item_id     uuid references material_catalog_items(id),

  -- Provenance obligatoire du chiffre
  source              text not null default 'manual'
                        check (source in ('manual','catalog','historical','ai_suggested')),

  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),

  unique (quote_version_id, quote_line_item_id)
);

create index if not exists idx_qlv_version on quote_line_versions(quote_version_id);
create index if not exists idx_qlv_item    on quote_line_versions(quote_line_item_id);
create index if not exists idx_qlv_company on quote_line_versions(company_id);


-- =====================================================================
-- 4. RATTACHEMENT DU TERRAIN
-- Colonnes nullables : l'historique existant reste valide et devient
-- explicitement « non attribué ». Aucune reconstruction rétroactive.
-- =====================================================================

alter table field_hours
  add column if not exists quote_line_item_id uuid references quote_line_items(id);

alter table field_materials
  add column if not exists quote_line_item_id uuid references quote_line_items(id);

create index if not exists idx_field_hours_line     on field_hours(quote_line_item_id);
create index if not exists idx_field_materials_line on field_materials(quote_line_item_id);

-- Identité du type de travail, en plus du texte libre déjà présent.
-- labor_type est conservé tel quel comme instantané lisible.
alter table field_hours
  add column if not exists labor_rate_id uuid references labor_rate_templates(id) on delete set null;


-- =====================================================================
-- 5. LE CHANTIER CONNAÎT LA VERSION QU'IL EXÉCUTE
-- =====================================================================

alter table scheduled_jobs
  add column if not exists quote_version_id uuid references quote_versions(id);

create index if not exists idx_scheduled_jobs_qv on scheduled_jobs(quote_version_id);


-- =====================================================================
-- 6. MACHINE D'ÉTAT — UN SEUL TRIGGER
-- Responsable à la fois des transitions permises, du gel du contenu
-- et de l'horodatage du verrouillage. Aucune dépendance à l'ordre
-- d'exécution entre triggers.
-- =====================================================================

create or replace function enforce_quote_version_state()
returns trigger
language plpgsql
as $$
declare
  content_frozen boolean;
begin
  -- Contenu figé dès l'entrée en finalisation : c'est le moment où le
  -- payload canonique est calculé, il ne peut plus bouger sous le hash.
  -- 'finalizing' n'est pas terminal : un retour à draft reste possible.

  if tg_op = 'INSERT' then
    if new.status in ('sent','accepted','rejected','superseded') then
      new.locked_at := coalesce(new.locked_at, now());
      if new.status = 'sent'     then new.sent_at     := coalesce(new.sent_at, now());     end if;
      if new.status = 'accepted' then new.accepted_at := coalesce(new.accepted_at, now()); end if;
    end if;
    return new;
  end if;

  content_frozen := old.status in
    ('finalizing','sent','accepted','rejected','superseded');

  -- Transitions autorisées. Aucun retour vers draft depuis un état envoyé :
  -- corriger une soumission envoyée se fait en créant la version suivante.
  if new.status is distinct from old.status then
    if not (
         (old.status = 'draft'               and new.status in ('finalizing','superseded'))
      or (old.status = 'finalizing'          and new.status in ('sent','draft','finalization_failed'))
      or (old.status = 'finalization_failed' and new.status in ('draft','finalizing'))
      or (old.status = 'sent'                and new.status in ('accepted','rejected','superseded'))
      or (old.status = 'accepted'            and new.status = 'superseded')
      or (old.status = 'rejected'            and new.status = 'superseded')
    ) then
      raise exception
        'Transition interdite sur la version % : % -> %', old.id, old.status, new.status;
    end if;
  end if;

  -- Gel du contenu par liste blanche. Pendant 'finalizing', le service
  -- applicatif doit pouvoir écrire les champs de preuve : ils sont donc
  -- ouverts dans cet état seulement, et figés dès le passage à 'sent'.
  if content_frozen then
    if old.status = 'finalizing' then
      if (to_jsonb(new) - 'status' - 'locked_at' - 'sent_at' - 'accepted_at'
                        - 'render_context' - 'render_engine_version'
                        - 'canonical_payload' - 'content_schema_version'
                        - 'canonicalization_algo' - 'content_hash'
                        - 'artifact_storage_path' - 'artifact_mime_type'
                        - 'artifact_size' - 'artifact_hash' - 'artifact_created_at')
         is distinct from
         (to_jsonb(old) - 'status' - 'locked_at' - 'sent_at' - 'accepted_at'
                        - 'render_context' - 'render_engine_version'
                        - 'canonical_payload' - 'content_schema_version'
                        - 'canonicalization_algo' - 'content_hash'
                        - 'artifact_storage_path' - 'artifact_mime_type'
                        - 'artifact_size' - 'artifact_hash' - 'artifact_created_at')
      then
        raise exception
          'Contenu métier figé pendant la finalisation de la version %.', old.id;
      end if;
    else
      if (to_jsonb(new) - 'status' - 'accepted_at' - 'locked_at')
         is distinct from
         (to_jsonb(old) - 'status' - 'accepted_at' - 'locked_at')
      then
        raise exception
          'Version % verrouillée (statut %). Créer une nouvelle version.', old.id, old.status;
      end if;
    end if;
  end if;

  -- Un passage à 'sent' exige que la chaîne de preuve soit complète.
  if new.status = 'sent' and old.status <> 'sent' then
    if new.content_hash is null
       or new.canonicalization_algo is null
       or new.content_schema_version is null
       or new.render_context is null then
      raise exception
        'Version % : preuve incomplète, envoi refusé.', old.id;
    end if;
    new.locked_at := coalesce(new.locked_at, now());
    new.sent_at   := coalesce(new.sent_at, now());
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quote_version_immutable on quote_versions;
drop trigger if exists trg_lock_on_send            on quote_versions;
drop trigger if exists trg_quote_version_state     on quote_versions;

create trigger trg_quote_version_state
  before insert or update on quote_versions
  for each row execute function enforce_quote_version_state();


-- Les lignes suivent le verrou de leur version.
--
-- VÉRIFIÉ : sur PostgreSQL 17.6, `new` vaut une rangée NULL dans un
-- déclencheur DELETE — elle n'est pas « unassigned ». `coalesce(new.x,
-- old.x)` retombe donc bien sur old, et `return coalesce(new, old)` rend
-- old. Éprouvé sur la base : la suppression d'une ligne passe. Écriture
-- d'origine conservée.
create or replace function enforce_quote_line_lock()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select qv.status into v_status
  from quote_versions qv
  where qv.id = coalesce(new.quote_version_id, old.quote_version_id);

  if v_status in ('finalizing','sent','accepted','rejected','superseded') then
    raise exception
      'Lignes verrouillées : la version de soumission est au statut %.', v_status;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_quote_lines_immutable on quote_line_versions;
drop trigger if exists trg_quote_lines_lock      on quote_line_versions;

create trigger trg_quote_lines_lock
  before insert or update or delete on quote_line_versions
  for each row execute function enforce_quote_line_lock();


-- =====================================================================
-- 7. RÉCONCILIATION
-- Deux agrégations indépendantes pour éviter le fan-out entre
-- field_hours et field_materials, puis une vue unifiée au-dessus.
-- Les taux d'attribution restent distincts : un chantier peut avoir
-- 100 % de ses heures affectées et 40 % de ses matériaux.
-- =====================================================================

create or replace view job_hours_reconciliation as
select
  fh.scheduled_job_id,
  sum(fh.hours)                                                   as total_hours,
  sum(fh.hours) filter (where fh.quote_line_item_id is not null)  as attributed_hours,
  sum(fh.hours) filter (where fh.quote_line_item_id is null)      as unattributed_hours,
  case when sum(fh.hours) > 0
       then round(sum(fh.hours) filter (where fh.quote_line_item_id is not null)
                  / sum(fh.hours) * 100, 1)
       else null end                                              as hours_assignment_rate
from field_hours fh
group by fh.scheduled_job_id;


create or replace view job_materials_reconciliation as
select
  fm.scheduled_job_id,
  count(*)                                                        as total_material_lines,
  count(*) filter (where fm.quote_line_item_id is not null)       as attributed_lines,
  count(*) filter (where fm.quote_line_item_id is null)           as unattributed_lines,
  case when count(*) > 0
       then round(count(*) filter (where fm.quote_line_item_id is not null)::numeric
                  / count(*) * 100, 1)
       else null end                                              as materials_assignment_rate
from field_materials fm
group by fm.scheduled_job_id;


create or replace view job_reconciliation as
select
  sj.id as scheduled_job_id,
  h.total_hours,
  h.attributed_hours,
  h.unattributed_hours,
  h.hours_assignment_rate,
  m.total_material_lines,
  m.attributed_lines,
  m.unattributed_lines,
  m.materials_assignment_rate
from scheduled_jobs sj
left join job_hours_reconciliation     h on h.scheduled_job_id = sj.id
left join job_materials_reconciliation m on m.scheduled_job_id = sj.id;


-- =====================================================================
-- 8. RLS — mêmes principes que `quotes`, appliqués au nouveau graphe
--
-- Les trois tables portent company_id en uuid NOT NULL : les politiques
-- s'appuient donc DIRECTEMENT dessus, sans remonter par jointure vers
-- quotes. C'est la convention du schéma (job_billing_lines fait de
-- même), et une jointure par ligne dans chaque politique coûterait à
-- chaque lecture.
--
-- Le découpage reprend celui de `quotes` : une politique ALL pour
-- l'écriture, une SELECT pour la lecture, une SELECT pour le super
-- administrateur.
--
-- `auth_user_company_ids()` et `auth_user_has_office_role()` sont
-- SECURITY DEFINER : la RLS ne s'applique pas à l'intérieur, elles ne
-- peuvent donc pas boucler. UNE POLITIQUE NE DOIT JAMAIS INTERROGER SA
-- PROPRE TABLE — c'est ce qui a produit la récursion infinie de
-- company_members, corrigée par la migration 043.
-- =====================================================================

alter table quote_versions      enable row level security;
alter table quote_line_items    enable row level security;
alter table quote_line_versions enable row level security;

-- ── quote_versions ───────────────────────────────────────────────────
drop policy if exists quote_versions_office_write on quote_versions;
create policy quote_versions_office_write on quote_versions
  for all to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  )
  with check (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_versions_office_read on quote_versions;
create policy quote_versions_office_read on quote_versions
  for select to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_versions_super_admin_select on quote_versions;
create policy quote_versions_super_admin_select on quote_versions
  for select
  using (is_platform_super_admin());

-- ── quote_line_items ─────────────────────────────────────────────────
drop policy if exists quote_line_items_office_write on quote_line_items;
create policy quote_line_items_office_write on quote_line_items
  for all to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  )
  with check (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_line_items_office_read on quote_line_items;
create policy quote_line_items_office_read on quote_line_items
  for select to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_line_items_super_admin_select on quote_line_items;
create policy quote_line_items_super_admin_select on quote_line_items
  for select
  using (is_platform_super_admin());

-- ── quote_line_versions ──────────────────────────────────────────────
drop policy if exists quote_line_versions_office_write on quote_line_versions;
create policy quote_line_versions_office_write on quote_line_versions
  for all to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  )
  with check (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_line_versions_office_read on quote_line_versions;
create policy quote_line_versions_office_read on quote_line_versions
  for select to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists quote_line_versions_super_admin_select on quote_line_versions;
create policy quote_line_versions_super_admin_select on quote_line_versions
  for select
  using (is_platform_super_admin());


commit;
