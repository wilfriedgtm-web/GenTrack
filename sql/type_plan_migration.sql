-- Migration : type_plan sur plans_maintenance
-- À exécuter manuellement dans Supabase SQL Editor

ALTER TABLE plans_maintenance
  ADD COLUMN IF NOT EXISTS type_plan TEXT NOT NULL DEFAULT 'calendrier';

-- Vérification
SELECT COUNT(*) AS type_plan_ok
FROM information_schema.columns
WHERE table_name='plans_maintenance' AND column_name='type_plan';
