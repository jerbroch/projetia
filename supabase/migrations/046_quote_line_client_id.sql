-- =====================================================================
-- ConstructionOS — Migration 046
-- Le point de jonction entre l'identité côté client et l'identité durable
-- + un compteur d'échecs d'écriture du versionnage
-- =====================================================================


-- ---------------------------------------------------------------------
-- POURQUOI UNE COLONNE PLUTÔT QU'UNE CORRESPONDANCE
--
-- L'éditeur de soumission donne déjà à chaque ligne un identifiant stable
-- (`ql-…`, `qm-…`, `qf-…`, voir generateId dans src/lib/id.ts). Il est
-- écrit dans quotes.cost_estimation, relu par mapCostEstimationFromDb, et
-- traverse donc les sauvegardes intact — vérifié sur les soumissions
-- réelles de production.
--
-- Il ne peut pas servir de clé primaire : quote_line_items.id est un uuid.
-- D'où cette colonne, qui joint les deux sans jamais deviner par
-- description ni par position.
--
-- NOT NULL : une ligne sans point de jonction ne pourrait jamais recevoir
-- d'heures. Mieux vaut que l'écriture échoue tout de suite que de créer
-- une identité orpheline que personne ne retrouvera.
--
-- UNIQUE (quote_id, client_line_id) et non global : la duplication d'une
-- soumission recopie cost_estimation verbatim, donc les mêmes identifiants
-- client se retrouvent sur une autre soumission. C'est légitime — ce sont
-- deux ouvrages distincts qui portent le même nom de baptême.
-- ---------------------------------------------------------------------

begin;


alter table quote_line_items
  add column if not exists client_line_id text;

-- La table est vide sur le dev comme en production : le NOT NULL ne peut
-- pas buter sur de l'historique. On échoue explicitement s'il en existe.
do $$
declare n bigint;
begin
  select count(*) into n from quote_line_items where client_line_id is null;
  if n > 0 then
    raise exception
      '% ligne(s) sans client_line_id. Les renseigner avant de poser le NOT NULL.', n;
  end if;
end $$;

alter table quote_line_items
  alter column client_line_id set not null;

create unique index if not exists idx_qli_client_line
  on quote_line_items(quote_id, client_line_id);


-- =====================================================================
-- LES ÉCHECS D'ÉCRITURE, VISIBLES
--
-- Le versionnage est non bloquant : une soumission ne doit jamais échouer
-- parce que l'écriture des versions a raté. Mais un échec journalisé dans
-- les logs du serveur n'est jamais lu.
--
-- Même principe que le taux d'attribution des heures : un défaut doit se
-- voir, pas seulement s'enregistrer. Cette table se consulte.
-- =====================================================================

create table if not exists versioning_write_failures (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  quote_id    uuid,             -- pas de clé étrangère : on veut garder la
                                -- trace même si la soumission est supprimée
  operation   text not null,    -- 'create' | 'update' | 'duplicate'
  error       text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_vwf_company on versioning_write_failures(company_id, created_at desc);


-- =====================================================================
-- RLS — mêmes principes que quote_versions (migration 045)
-- =====================================================================

alter table versioning_write_failures enable row level security;

-- L'écriture vient du serveur, avec le client de l'utilisateur : il lui
-- faut le droit d'insérer sa propre trace, sinon l'échec du versionnage
-- serait suivi d'un échec d'enregistrement de cet échec.
drop policy if exists vwf_office_write on versioning_write_failures;
create policy vwf_office_write on versioning_write_failures
  for all to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  )
  with check (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists vwf_office_read on versioning_write_failures;
create policy vwf_office_read on versioning_write_failures
  for select to authenticated
  using (
    company_id in (select auth_user_company_ids())
    and auth_user_has_office_role(company_id)
  );

drop policy if exists vwf_super_admin_select on versioning_write_failures;
create policy vwf_super_admin_select on versioning_write_failures
  for select
  using (is_platform_super_admin());


commit;
