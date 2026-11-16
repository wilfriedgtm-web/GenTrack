-- Migration : coût et durée sur les missions prestataire
-- À exécuter dans Supabase SQL Editor

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS duree_heures NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS cout         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS devise       TEXT DEFAULT 'FCFA';

-- Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='missions' AND column_name='duree_heures') AS duree_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='missions' AND column_name='cout')         AS cout_ok;
