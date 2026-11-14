-- Migration : checklist plans + workflow mission
-- À exécuter manuellement dans Supabase SQL Editor

-- 1. Checklist sur les plans de maintenance
ALTER TABLE plans_maintenance
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]';

-- 2. Checklist sur les templates (propagée aux nouveaux plans)
ALTER TABLE templates_maintenance
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]';

-- 3. Résultats checklist + motif blocage sur les lignes de mission
ALTER TABLE mission_plans
  ADD COLUMN IF NOT EXISTS checklist_completee JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS motif_blocage TEXT;

-- 4. Numéro WhatsApp du responsable embarqué dans la mission
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS resp_tel TEXT;

-- Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='plans_maintenance' AND column_name='checklist') AS plans_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='templates_maintenance' AND column_name='checklist') AS templates_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='mission_plans' AND column_name='checklist_completee') AS mission_plans_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='missions' AND column_name='resp_tel') AS missions_ok;
