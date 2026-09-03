-- Empreinte du contenu d'une pièce jointe, pour refuser les doublons.
--
-- Un employé qui tape deux fois sur « Prendre une photo » — un geste banal sur
-- un chantier, avec des gants et un écran mouillé — envoyait deux fois la même
-- image. Le client recevait sa facture avec la même photo répétée, ce qui fait
-- douter du sérieux de tout le reste.
--
-- L'empreinte est un SHA-256 des octets RÉELLEMENT téléversés, calculé côté
-- serveur. Deux photos prises coup sur coup ne sont jamais identiques au bit
-- près — seul un renvoi du MÊME fichier l'est. C'est donc bien le double-clic
-- qu'on attrape, pas deux photos qui se ressemblent.

ALTER TABLE job_attachments
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN job_attachments.content_hash IS
  'SHA-256 hexadécimal du contenu téléversé. NULL pour les rangées créées avant la migration 042.';

-- L'unicité porte sur (call, empreinte), et l'index est PARTIEL pour deux
-- raisons :
--
--   • `content_hash IS NOT NULL` épargne les rangées d'avant cette migration.
--     Les recalculer demanderait de retélécharger chaque fichier, ce qu'une
--     migration SQL ne sait pas faire. Elles restent donc telles quelles.
--
--   • `scheduled_job_id IS NOT NULL` laisse passer la même photo sur deux
--     calls différents : c'est légitime, par exemple une pièce défectueuse
--     photographiée lors d'un premier appel puis d'un retour sous garantie.
CREATE UNIQUE INDEX IF NOT EXISTS job_attachments_pas_de_doublon
  ON job_attachments (scheduled_job_id, content_hash)
  WHERE scheduled_job_id IS NOT NULL AND content_hash IS NOT NULL;

-- L'index est le FILET, pas le message. Une contrainte d'unicité violée rend
-- une erreur Postgres que personne ne comprend ; c'est l'application qui doit
-- dire « cette photo est déjà sur ce call ». Le filet sert au cas où deux
-- téléversements simultanés passeraient la vérification en même temps.
