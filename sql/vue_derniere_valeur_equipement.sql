-- ============================================================
-- GenTrack — Vue : dernière valeur mesurée par équipement
-- À exécuter dans Supabase SQL Editor
-- ============================================================
-- Retourne, pour chaque équipement, la valeur numérique la plus
-- récente issue des réponses aux rondes.
-- Priorité d'unité : °C > h > m³ > autres
-- ============================================================

CREATE OR REPLACE VIEW vue_derniere_valeur_equipement AS
WITH derniere_par_unite AS (
  -- Pour chaque (équipement, unité) → valeur la plus récente
  SELECT DISTINCT ON (q.equipement_id, q.unite)
    q.equipement_id,
    q.unite,
    r.valeur,
    q.texte AS question_texte,
    r.created_at,
    CASE q.unite
      WHEN '°C'  THEN 1
      WHEN 'h'   THEN 2
      WHEN 'm³'  THEN 3
      WHEN '%'   THEN 4
      WHEN 'L'   THEN 5
      ELSE 6
    END AS prio
  FROM reponses r
  JOIN questions q ON q.id = r.question_id
  WHERE q.type_reponse = 'numerique'
    AND q.unite IS NOT NULL
    AND q.unite != ''
    AND r.valeur ~ '^-?\d+(\.\d+)?$'
  ORDER BY q.equipement_id, q.unite, r.created_at DESC
)
-- Pour chaque équipement → unité la plus prioritaire
SELECT DISTINCT ON (equipement_id)
  equipement_id,
  unite,
  valeur::numeric AS valeur,
  question_texte,
  created_at AS relevee_at
FROM derniere_par_unite
ORDER BY equipement_id, prio, created_at DESC;
