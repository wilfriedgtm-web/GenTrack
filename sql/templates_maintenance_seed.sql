-- ============================================================
-- GenTrack — Templates de maintenance
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Créer la table
CREATE TABLE IF NOT EXISTS templates_maintenance (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT NOT NULL,
  frequence   TEXT NOT NULL,
  description TEXT,
  categorie   TEXT,
  actif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed — 25 templates pré-définis
INSERT INTO templates_maintenance (titre, frequence, categorie) VALUES

-- Groupe électrogène
('Test démarrage à vide',           '1 semaine',   'Groupe électrogène'),
('Vérification huile & carburant',  '1 semaine',   'Groupe électrogène'),
('Vidange huile moteur',            '500 heure',   'Groupe électrogène'),
('Remplacement filtre à air',       '500 heure',   'Groupe électrogène'),
('Remplacement filtre carburant',   '3 mois',      'Groupe électrogène'),
('Vérification courroies & câblage','6 mois',      'Groupe électrogène'),
('Révision complète GE',            '1 an',        'Groupe électrogène'),

-- Climatisation
('Nettoyage filtres',               '1 mois',      'Climatisation'),
('Nettoyage unité extérieure',      '3 mois',      'Climatisation'),
('Vérification charge réfrigérant', '6 mois',      'Climatisation'),
('Révision annuelle clim',          '1 an',        'Climatisation'),

-- Chambre froide
('Nettoyage condenseur',            '1 mois',      'Chambre froide'),
('Vérification joints de porte',    '1 mois',      'Chambre froide'),
('Nettoyage évaporateur',           '3 mois',      'Chambre froide'),
('Vérification charge réfrigérant', '6 mois',      'Chambre froide'),
('Révision compresseur',            '1 an',        'Chambre froide'),

-- Pompe
('Vérification étanchéité',         '1 mois',      'Pompe'),
('Révision garniture mécanique',    '3 mois',      'Pompe'),
('Révision générale pompe',         '6 mois',      'Pompe'),

-- Transformateur
('Inspection visuelle transformateur','1 mois',    'Transformateur'),
('Vérification connexions',         '6 mois',      'Transformateur'),
('Analyse huile diélectrique',      '1 an',        'Transformateur'),

-- Compresseur
('Vérification pression & huile',   '1 mois',      'Compresseur'),
('Vidange huile compresseur',       '500 heure',   'Compresseur'),
('Révision annuelle compresseur',   '1 an',        'Compresseur'),

-- Général
('Inspection mensuelle générale',   '1 mois',      'Général'),
('Maintenance trimestrielle',       '3 mois',      'Général'),
('Révision semestrielle',           '6 mois',      'Général');
