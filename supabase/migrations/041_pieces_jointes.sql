-- Pièces jointes : photos de chantier, plans, documents.
--
-- Attachées à un CALL ou à une FACTURE — souvent aux deux, puisqu'une facture
-- générée depuis un call hérite des pièces de ce call. Le lien se fait par
-- scheduled_job_id, jamais par recopie : dupliquer les rangées ferait diverger
-- les deux vues dès la première suppression.
--
-- Une facture rapide n'a pas de call ; un call peut n'être jamais facturé. Les
-- deux liens sont donc facultatifs, mais il en faut au moins un — une pièce
-- jointe rattachée à rien serait invisible et impossible à retrouver.

CREATE TABLE IF NOT EXISTS job_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,

  -- SET NULL et non CASCADE : supprimer un call ne doit pas faire disparaître
  -- la preuve du travail accompli. La pièce reste, rattachée à la facture.
  scheduled_job_id UUID REFERENCES scheduled_jobs (id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices (id) ON DELETE SET NULL,

  -- Chemin dans le compartiment privé : {company_id}/{job_id}/{uuid}.{ext}
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,

  -- Qui a déposé le fichier. NULL possible : un employé archivé garde ses
  -- photos, mais sa fiche peut disparaître.
  uploaded_by_employee_id UUID REFERENCES employees (id) ON DELETE SET NULL,
  uploaded_by_user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,

  -- Horodatage, sans GPS. Le passage par le canvas efface déjà les métadonnées
  -- de position, et c'est voulu : on n'envoie pas les coordonnées du domicile
  -- d'un client dans un courriel. Le MOMENT, lui, est une preuve utile.
  taken_at TIMESTAMPTZ,

  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_attachments_par_call
  ON job_attachments (scheduled_job_id) WHERE scheduled_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_attachments_par_facture
  ON job_attachments (invoice_id) WHERE invoice_id IS NOT NULL;

-- « Rattachée à quelque chose » est une règle de CRÉATION, pas un invariant
-- permanent — et la différence n'est pas théorique.
--
-- Une contrainte CHECK s'applique aussi aux mises à jour. Avec ON DELETE SET
-- NULL sur le call, supprimer un call vidait le lien et violait aussitôt le
-- CHECK : la suppression échouait. Éprouvé, et c'est ainsi que le défaut est
-- apparu. Un déclencheur BEFORE INSERT dit la même chose sans bloquer le
-- chemin de suppression.
CREATE OR REPLACE FUNCTION _piece_jointe_rattachee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scheduled_job_id IS NULL AND NEW.invoice_id IS NULL THEN
    RAISE EXCEPTION 'Une pièce jointe doit être rattachée à un call ou à une facture.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_attachments_rattachee ON job_attachments;
CREATE TRIGGER job_attachments_rattachee
  BEFORE INSERT ON job_attachments
  FOR EACH ROW EXECUTE FUNCTION _piece_jointe_rattachee();

-- Et quand les deux liens finissent par disparaître, la pièce n'est plus
-- retrouvable par personne : elle part avec eux. Sans ça, le compartiment
-- accumulerait des fichiers que rien ne désigne.
CREATE OR REPLACE FUNCTION _piece_jointe_orpheline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scheduled_job_id IS NULL AND NEW.invoice_id IS NULL THEN
    DELETE FROM job_attachments WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS job_attachments_orpheline ON job_attachments;
CREATE TRIGGER job_attachments_orpheline
  AFTER UPDATE OF scheduled_job_id, invoice_id ON job_attachments
  FOR EACH ROW EXECUTE FUNCTION _piece_jointe_orpheline();

-- Vingt fichiers par call. Au-delà, ce n'est plus une preuve, c'est une
-- galerie — et le téléversement depuis un chantier devient interminable.
-- Le garde est ICI et pas seulement dans l'application : une boucle de
-- téléversement qui part en vrille ne doit pas remplir le compartiment.
CREATE OR REPLACE FUNCTION _limite_pieces_jointes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE n INTEGER;
BEGIN
  IF NEW.scheduled_job_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO n
  FROM job_attachments
  WHERE scheduled_job_id = NEW.scheduled_job_id;

  IF n >= 20 THEN
    RAISE EXCEPTION 'Ce call a déjà 20 pièces jointes, le maximum. Retirez-en une avant d''en ajouter.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_attachments_limite ON job_attachments;
CREATE TRIGGER job_attachments_limite
  BEFORE INSERT ON job_attachments
  FOR EACH ROW EXECUTE FUNCTION _limite_pieces_jointes();

ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;

-- Les deux politiques reprennent MOT POUR MOT celles de field_hours, éprouvées
-- lors de l'audit de séparation des rôles. Le bureau voit tout ce qui appartient
-- à son entreprise ; l'employé, seulement les pièces des calls où il est
-- assigné — et il ne peut déposer que sous son propre nom.
CREATE POLICY job_attachments_office ON job_attachments
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  )
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND auth_user_has_office_role(company_id)
  );

-- L'EMPLOYÉ AJOUTE, IL NE RETIRE JAMAIS — pas même ses propres photos.
--
-- C'est ce qui rend une photo valable comme preuve : un fichier qu'on peut
-- faire disparaître après coup ne prouve rien. L'employé qui a cassé une
-- pièce et qui l'a photographiée ne doit pas pouvoir effacer sa photo une
-- heure plus tard.
--
-- Deux politiques distinctes et non `FOR ALL` : lecture et insertion
-- seulement. Ni UPDATE ni DELETE ne sont accordés — et sans politique qui
-- l'autorise, la RLS ne refuse pas bruyamment, elle ne touche simplement
-- AUCUNE rangée. Le refus doit donc aussi être dit à l'écran ; la base est le
-- filet, pas le message.
CREATE POLICY job_attachments_employee_lecture ON job_attachments
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT auth_user_company_ids())
    AND scheduled_job_id IS NOT NULL
    AND auth_employee_assigned_to_job(scheduled_job_id)
  );

CREATE POLICY job_attachments_employee_ajout ON job_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT auth_user_company_ids())
    AND scheduled_job_id IS NOT NULL
    AND auth_employee_assigned_to_job(scheduled_job_id)
    AND uploaded_by_employee_id = auth_user_employee_id()
  );

-- Le compartiment est PRIVÉ, contrairement à company-logos. Une photo de
-- chantier montre l'intérieur de la maison d'un client : elle ne doit pas être
-- devinable par URL. L'accès passera par des URL signées à durée limitée.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pieces-jointes',
  'pieces-jointes',
  FALSE,
  15728640,  -- 15 Mo : un plan PDF scanné passe, avec de la marge
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Aucune politique de lecture publique sur le compartiment : tout passe par la
-- clé de service, qui signe des URL. C'est ce qui distingue une photo de
-- chantier d'un logo d'entreprise.
