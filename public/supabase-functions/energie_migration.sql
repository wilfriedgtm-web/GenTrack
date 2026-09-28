-- ============================================================
-- GenTrack — Module Énergie
-- Migration Supabase
-- ============================================================

-- ── Table 1 : Configuration des fluides par site ─────────────
-- Chaque ligne = un fluide à suivre (K1, K2, eau, gasoil, cos phi...)
-- Le bot lit cette table dynamiquement pour construire les questions

CREATE TABLE IF NOT EXISTS energie_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,                         -- "Électricité Jour (K1)"
  unite         TEXT,                                  -- "kWh", "m³", "%", null
  type_valeur   TEXT NOT NULL DEFAULT 'index',         -- 'index' (croissant) | 'instantane' (valeur brute)
  seuil_alerte_bas  NUMERIC,                           -- alerte si valeur < seuil (gasoil, cos phi)
  objectif_mensuel  NUMERIC,                           -- objectif mensuel configurable resp_tech
  actif         BOOLEAN NOT NULL DEFAULT true,         -- toggle resp_tech
  ordre         INTEGER NOT NULL DEFAULT 0,            -- ordre d'affichage dans le bot
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accès rapide par site
CREATE INDEX IF NOT EXISTS energie_config_site_idx ON energie_config(site_id, actif, ordre);

-- ── Table 2 : Relevés journaliers ────────────────────────────
-- Une ligne par jour par site
-- Les valeurs sont stockées en JSONB { "uuid-fluide": 6944.0, ... }
-- Référence l'id de energie_config pour chaque fluide

CREATE TABLE IF NOT EXISTS releves_energie (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date_releve   DATE NOT NULL,
  valeurs       JSONB NOT NULL DEFAULT '{}',           -- { energie_config.id: valeur_numerique }
  saisi_par     TEXT,                                  -- nom du technicien
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, date_releve)                         -- un seul relevé par jour par site
);

-- Index pour accès rapide par site + date
CREATE INDEX IF NOT EXISTS releves_energie_site_date_idx ON releves_energie(site_id, date_releve DESC);

-- ── Données initiales — Azalaï Hotel Dakar ───────────────────
-- À lancer APRÈS avoir récupéré l'ID du site Azalaï
-- Remplacer 'SITE_ID_AZALAI' par l'UUID réel

/*
INSERT INTO energie_config (site_id, nom, unite, type_valeur, seuil_alerte_bas, objectif_mensuel, ordre) VALUES
  ('SITE_ID_AZALAI', 'Électricité Jour (K1)',   'kWh', 'index',      NULL,  95000, 1),
  ('SITE_ID_AZALAI', 'Électricité Nuit (K2)',   'kWh', 'index',      NULL,  60000, 2),
  ('SITE_ID_AZALAI', 'Eau bâche potable',       'm³',  'index',      NULL,    850, 3),
  ('SITE_ID_AZALAI', 'Citerne gasoil (GE)',     '%',   'instantane',   30,   NULL, 4),
  ('SITE_ID_AZALAI', 'Cos phi réseau',          NULL,  'instantane', 0.85,   NULL, 5);
*/

-- ── RLS (Row Level Security) — à adapter selon votre config ──
-- ALTER TABLE energie_config  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE releves_energie ENABLE ROW LEVEL SECURITY;
