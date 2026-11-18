-- =====================================================
-- MIGRATION GMAO v2 — Fiche équipement enrichie
-- À exécuter dans Supabase SQL Editor (admin uniquement)
-- Ne jamais exécuter via MCP
-- Date : 2026-11-14
-- =====================================================

ALTER TABLE equipements
  ADD COLUMN IF NOT EXISTS marque               text,
  ADD COLUMN IF NOT EXISTS modele               text,
  ADD COLUMN IF NOT EXISTS numero_serie         text,
  ADD COLUMN IF NOT EXISTS date_mise_en_service date,
  ADD COLUMN IF NOT EXISTS garantie_fin         date,
  ADD COLUMN IF NOT EXISTS contrat_type         text CHECK (contrat_type IN ('mensuel','trimestriel','semestriel','annuel','ponctuel')),
  ADD COLUMN IF NOT EXISTS contrat_actif        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes_tech           text;
