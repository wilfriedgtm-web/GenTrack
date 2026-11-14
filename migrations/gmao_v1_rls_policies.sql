-- =====================================================
-- MIGRATION GMAO v1 — Policies RLS
-- À exécuter après gmao_v1_migration.sql
-- Même pattern que maintenances / signalements
-- =====================================================

-- PRESTATAIRES
CREATE POLICY "allow_all" ON prestataires
  FOR ALL USING (true) WITH CHECK (true);

-- PLANS_MAINTENANCE
CREATE POLICY "allow_all" ON plans_maintenance
  FOR ALL USING (true) WITH CHECK (true);
