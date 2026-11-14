-- =====================================================
-- MIGRATION GMAO v1 — GenTrack
-- À exécuter dans Supabase SQL Editor (admin uniquement)
-- Ne jamais exécuter via MCP
-- Date : 2026-11-14
-- =====================================================


-- =====================================================
-- 1. TABLE PRESTATAIRES
-- Un prestataire par site (Froid Services SN, etc.)
-- =====================================================
CREATE TABLE prestataires (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES sites(id) ON DELETE CASCADE,
  nom         text NOT NULL,
  email       text,
  telephone   text,
  specialite  text,            -- ex: 'froid', 'electricite', 'CVC', 'generateur'
  actif       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_prestataires_site ON prestataires(site_id);


-- =====================================================
-- 2. TABLE PLANS_MAINTENANCE
-- Une tâche récurrente par équipement
-- (ex: nettoyage condenseur CF Crustacé, trimestriel)
-- =====================================================
CREATE TABLE plans_maintenance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id   uuid NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  site_id         uuid REFERENCES sites(id) ON DELETE CASCADE,
  titre           text NOT NULL,
  description     text,
  frequence       text NOT NULL CHECK (frequence IN (
                    'mensuel', 'trimestriel', 'semestriel', 'annuel'
                  )),
  intervenant     text NOT NULL DEFAULT 'interne' CHECK (intervenant IN (
                    'interne', 'prestataire'
                  )),
  prestataire_id  uuid REFERENCES prestataires(id) ON DELETE SET NULL,
  prochaine_date  date,         -- calculée : date_derniere_realisation + frequence
  actif           boolean NOT NULL DEFAULT true,
  created_by      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_plans_maintenance_equipement ON plans_maintenance(equipement_id);
CREATE INDEX idx_plans_maintenance_site       ON plans_maintenance(site_id);
CREATE INDEX idx_plans_maintenance_date       ON plans_maintenance(prochaine_date) WHERE actif = true;


-- =====================================================
-- 3. ALTER MAINTENANCES
-- Ajout des colonnes GMAO
-- La colonne "prestataire" (texte) existante est conservée
-- pour la rétrocompatibilité avec les anciennes entrées
-- =====================================================
ALTER TABLE maintenances
  ADD COLUMN IF NOT EXISTS plan_maintenance_id  uuid REFERENCES plans_maintenance(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prestataire_id       uuid REFERENCES prestataires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rapport_texte        text,
  ADD COLUMN IF NOT EXISTS rapport_fichier_url  text;

CREATE INDEX idx_maintenances_plan        ON maintenances(plan_maintenance_id);
CREATE INDEX idx_maintenances_prestataire ON maintenances(prestataire_id);


-- =====================================================
-- 4. ALTER SIGNALEMENTS
-- prestataire_id : rempli quand le resp_tech affecte
-- au prestataire depuis l'onglet Signalements
-- =====================================================
ALTER TABLE signalements
  ADD COLUMN IF NOT EXISTS prestataire_id uuid REFERENCES prestataires(id) ON DELETE SET NULL;

CREATE INDEX idx_signalements_prestataire ON signalements(prestataire_id);


-- =====================================================
-- RLS (à adapter selon le pattern existant)
-- À activer si RLS est activé sur ces tables
-- =====================================================
-- ALTER TABLE prestataires ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE plans_maintenance ENABLE ROW LEVEL SECURITY;
-- (créer les policies selon le pattern des autres tables)
