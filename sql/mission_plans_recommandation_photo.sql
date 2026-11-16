-- Migration : recommandation + photo_url sur mission_plans
-- À exécuter dans Supabase SQL Editor

ALTER TABLE mission_plans
  ADD COLUMN IF NOT EXISTS recommandation TEXT,
  ADD COLUMN IF NOT EXISTS photo_url      TEXT;

-- Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='mission_plans' AND column_name='recommandation') AS recommandation_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='mission_plans' AND column_name='photo_url') AS photo_url_ok;
