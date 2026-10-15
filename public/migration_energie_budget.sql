-- ============================================================
-- Migration : énergie budget — GenTrack
-- Projet Supabase : zbpoxjlkqxnqjzxohasq
-- À coller et exécuter dans Supabase > SQL Editor
-- ============================================================


-- ── 1. RELEVES_ENERGIE : ajout colonne couverts ─────────────
-- (to_percent existe déjà en type real)

ALTER TABLE releves_energie
  ADD COLUMN IF NOT EXISTS nb_couverts integer;


-- ── 2. TABLE : energie_budget_mensuel ───────────────────────
-- Budget cible par site, par mois/année.
-- Une ligne = un mois budgétisé pour un site.

CREATE TABLE IF NOT EXISTS energie_budget_mensuel (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 uuid          NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  annee                   smallint      NOT NULL,
  mois                    smallint      NOT NULL CHECK (mois BETWEEN 1 AND 12),

  -- Paramètres d'exploitation budgétisés
  to_pct                  numeric(5,2),       -- TO% budgétisé  ex: 62.00
  nb_chambres_budget      integer,            -- Chambres vendues/jour budgétisées
  nb_couverts_budget      integer,            -- Couverts servis/jour budgétisés
  nb_jours                smallint,           -- Nb jours du mois (31, 30, 28…)

  -- Prix de référence pour calcul du CA budgétisé
  prix_moyen_chambre      numeric(14,2),      -- Prix moyen chambre/nuit (FCFA)
  prix_moyen_couvert      numeric(12,2),      -- Prix moyen couvert (FCFA)

  -- CA budgétisé (calculé ou saisi)
  ca_chambres_budget_jour numeric(14,2),      -- CA chambres/jour budgétisé
  ca_couverts_budget_jour numeric(14,2),      -- CA couverts/jour budgétisé

  -- Budget énergie global (somme des lignes energie_budget_fluide)
  budget_energie_mois     numeric(16,2),      -- Total budget énergie mois (FCFA HT)
  budget_energie_jour     numeric(14,2),      -- Budget énergie/jour (FCFA HT)

  note                    text,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (site_id, annee, mois)
);

CREATE INDEX IF NOT EXISTS idx_ebm_site_annee
  ON energie_budget_mensuel (site_id, annee);


-- ── 3. TABLE : energie_budget_fluide ────────────────────────
-- Détail budget par fluide (élec, eau, gasoil…) pour un mois donné.
-- Une ligne = un fluide × un budget mensuel.

CREATE TABLE IF NOT EXISTS energie_budget_fluide (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id             uuid        NOT NULL REFERENCES energie_budget_mensuel(id) ON DELETE CASCADE,
  fluide_id             uuid        NOT NULL REFERENCES energie_config(id) ON DELETE CASCADE,

  -- Quantités budgétisées
  quantite_budget_jour  numeric(14,3),   -- Quantité/jour  (kWh, m³, L, kg…)
  quantite_budget_mois  numeric(16,3),   -- Quantité/mois

  -- Coûts budgétisés
  cout_budget_jour      numeric(14,2),   -- Coût/jour  (FCFA HT)
  cout_budget_mois      numeric(16,2),   -- Coût/mois  (FCFA HT)

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (budget_id, fluide_id)
);

CREATE INDEX IF NOT EXISTS idx_ebf_budget_id  ON energie_budget_fluide (budget_id);
CREATE INDEX IF NOT EXISTS idx_ebf_fluide_id  ON energie_budget_fluide (fluide_id);


-- ── 4. TABLE : energie_prix_periode ─────────────────────────
-- Historique des prix unitaires par fluide avec date de validité.
-- Permet de recalculer les coûts historiques quand un tarif change.
-- Usage : chercher la ligne dont date_debut <= date_releve
--         et date_fin IS NULL (ou date_fin >= date_releve).

CREATE TABLE IF NOT EXISTS energie_prix_periode (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fluide_id   uuid        NOT NULL REFERENCES energie_config(id) ON DELETE CASCADE,
  date_debut  date        NOT NULL,
  date_fin    date,                         -- NULL = tarif en cours
  tarif       numeric(12,4) NOT NULL,       -- Prix unitaire (FCFA/kWh, FCFA/m³…)
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epp_fluide_date
  ON energie_prix_periode (fluide_id, date_debut DESC);


-- ── RLS ─────────────────────────────────────────────────────
-- Pattern du projet : RLS désactivé sur energie_config et releves_energie.
-- On suit le même pattern pour les nouvelles tables.
-- (RLS activé uniquement sur sites et objectifs_energie)

-- Rien à faire : RLS désactivé par défaut à la création.
-- Si tu veux l'activer plus tard, modèle à suivre (comme sites) :
--   ALTER TABLE energie_budget_mensuel ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "allow all" ON energie_budget_mensuel FOR ALL TO public USING (true);


-- ── FIN MIGRATION ────────────────────────────────────────────
-- Tables créées :
--   energie_budget_mensuel  (1 ligne / mois / site)
--   energie_budget_fluide   (1 ligne / fluide / mois)
--   energie_prix_periode    (historique tarifs)
-- Colonne ajoutée :
--   releves_energie.nb_couverts  integer
