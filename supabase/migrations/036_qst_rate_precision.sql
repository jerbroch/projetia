-- La colonne qst_rate ne peut pas contenir le taux réel de la TVQ.
--
-- NUMERIC(5,4) garde quatre décimales : 0.09975 y devient 0.0998. L'écart
-- paraît minuscule et ne l'est pas — il s'applique à chaque facture, et le
-- document remis au client annonce « TVQ 9,975 % » tout en calculant autre
-- chose. Sur 100 000 $ de travaux facturés dans une année, 0.0998 au lieu de
-- 0.09975 prélève 5 $ de trop.
--
-- NUMERIC(6,5) tient cinq décimales, ce qu'exige 0.09975. Même chose pour la
-- TPS par symétrie : rien n'empêche un taux à cinq décimales demain.
ALTER TABLE companies
  ALTER COLUMN qst_rate TYPE NUMERIC(6, 5),
  ALTER COLUMN gst_rate TYPE NUMERIC(6, 5);

ALTER TABLE companies
  ALTER COLUMN qst_rate SET DEFAULT 0.09975,
  ALTER COLUMN gst_rate SET DEFAULT 0.05;

-- Les entreprises existantes portent 0.0998, valeur arrondie à l'écriture.
-- On ne restaure QUE celles-là : une entreprise qui aurait délibérément saisi
-- un autre taux garde le sien.
UPDATE companies SET qst_rate = 0.09975 WHERE qst_rate = 0.0998;
