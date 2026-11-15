-- Fix : autoriser statut 'bloque' dans mission_plans
-- À exécuter dans Supabase SQL Editor

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE mission_plans
  DROP CONSTRAINT IF EXISTS mission_plans_statut_check;

-- Recréer avec 'bloque' inclus
ALTER TABLE mission_plans
  ADD CONSTRAINT mission_plans_statut_check
  CHECK (statut IN ('a_faire','realise','bloque','echec'));

-- Vérification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'mission_plans'::regclass AND contype = 'c';
