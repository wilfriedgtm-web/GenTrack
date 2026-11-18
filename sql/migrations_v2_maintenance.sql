-- ============================================================
-- GenTrack — Migrations v2 Maintenance
-- À exécuter dans Supabase SQL Editor (dans l'ordre)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Supprimer les contraintes CHECK bloquantes sur plans_maintenance
-- ─────────────────────────────────────────────────────────────
ALTER TABLE plans_maintenance
  DROP CONSTRAINT IF EXISTS plans_maintenance_frequence_check;

ALTER TABLE plans_maintenance
  DROP CONSTRAINT IF EXISTS plans_maintenance_intervenant_check;

-- ─────────────────────────────────────────────────────────────
-- 2. RLS policy manquante sur templates_maintenance
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='templates_maintenance' AND policyname='allow_all'
  ) THEN
    EXECUTE 'CREATE POLICY "allow_all" ON templates_maintenance FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Colonne email sur prestataires
-- ─────────────────────────────────────────────────────────────
ALTER TABLE prestataires
  ADD COLUMN IF NOT EXISTS email TEXT;

-- ─────────────────────────────────────────────────────────────
-- 4. Table missions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id          UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  equipement_id    UUID NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  technicien_nom   TEXT,
  technicien_tel   TEXT,
  token            UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  statut           TEXT NOT NULL DEFAULT 'envoyee'
                     CHECK (statut IN ('envoyee','en_cours','realisee','echec')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- Lecture publique par token (page web tech)
CREATE POLICY "missions_read_by_token" ON missions
  FOR SELECT USING (true);

-- Écriture par token (submit depuis page web)
CREATE POLICY "missions_update_by_token" ON missions
  FOR UPDATE USING (true);

-- Création depuis le dashboard (authentifié)
CREATE POLICY "missions_insert_authenticated" ON missions
  FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 5. Table mission_plans
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_plans (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id           UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  plan_maintenance_id  UUID NOT NULL REFERENCES plans_maintenance(id) ON DELETE CASCADE,
  statut               TEXT NOT NULL DEFAULT 'a_faire'
                         CHECK (statut IN ('a_faire','realise','echec')),
  commentaire          TEXT,
  photo_url            TEXT,
  heures_compteur      NUMERIC,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_plans_all" ON mission_plans
  FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 6. Seed templates_maintenance (si table vide)
-- ─────────────────────────────────────────────────────────────
-- (exécuter uniquement si la table est vide — idempotent via ON CONFLICT)
INSERT INTO templates_maintenance (titre, frequence, categorie)
SELECT titre, frequence, categorie FROM (VALUES
  ('Test démarrage à vide',           '1 semaine',  'Groupe électrogène'),
  ('Vérification huile & carburant',  '1 semaine',  'Groupe électrogène'),
  ('Vidange huile moteur',            '500 heure',  'Groupe électrogène'),
  ('Remplacement filtre à air',       '500 heure',  'Groupe électrogène'),
  ('Remplacement filtre carburant',   '3 mois',     'Groupe électrogène'),
  ('Vérification courroies & câblage','6 mois',     'Groupe électrogène'),
  ('Révision complète GE',            '1 an',       'Groupe électrogène'),
  ('Nettoyage filtres',               '1 mois',     'Climatisation'),
  ('Nettoyage unité extérieure',      '3 mois',     'Climatisation'),
  ('Vérification charge réfrigérant', '6 mois',     'Climatisation'),
  ('Révision annuelle clim',          '1 an',       'Climatisation'),
  ('Nettoyage condenseur',            '1 mois',     'Chambre froide'),
  ('Vérification joints de porte',    '1 mois',     'Chambre froide'),
  ('Nettoyage évaporateur',           '3 mois',     'Chambre froide'),
  ('Vérification charge réfrigérant', '6 mois',     'Chambre froide'),
  ('Révision compresseur',            '1 an',       'Chambre froide'),
  ('Vérification étanchéité',         '1 mois',     'Pompe'),
  ('Révision garniture mécanique',    '3 mois',     'Pompe'),
  ('Révision générale pompe',         '6 mois',     'Pompe'),
  ('Inspection visuelle transformateur','1 mois',   'Transformateur'),
  ('Vérification connexions',         '6 mois',     'Transformateur'),
  ('Analyse huile diélectrique',      '1 an',       'Transformateur'),
  ('Vérification pression & huile',   '1 mois',     'Compresseur'),
  ('Vidange huile compresseur',       '500 heure',  'Compresseur'),
  ('Révision annuelle compresseur',   '1 an',       'Compresseur'),
  ('Inspection mensuelle générale',   '1 mois',     'Général'),
  ('Maintenance trimestrielle',       '3 mois',     'Général'),
  ('Révision semestrielle',           '6 mois',     'Général')
) AS v(titre, frequence, categorie)
WHERE NOT EXISTS (SELECT 1 FROM templates_maintenance LIMIT 1);
