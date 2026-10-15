-- ============================================================
-- Migration : Bâches à eau — GenTrack
-- Projet Supabase : zbpoxjlkqxnqjzxohasq
-- Modèles de questions pour bâche à eau potable et incendie
-- À coller et exécuter dans Supabase > SQL Editor
-- ============================================================

-- ── 1. Nouveau type d'équipement : Bâche à eau ──────────────
-- ID explicite dans la séquence b1000000-…
INSERT INTO types_equipements (id, nom, icone)
SELECT 'b1000000-0000-0000-0000-000000000006', 'Bâche à eau', '💧'
WHERE NOT EXISTS (
  SELECT 1 FROM types_equipements WHERE nom = 'Bâche à eau'
);


-- ── 2. Modèle : Bâche à eau potable ─────────────────────────
INSERT INTO modeles_questions (id, nom, type_id)
SELECT
  'a1000000-0000-0000-0000-000000000010',
  'Bâche à eau potable',
  'b1000000-0000-0000-0000-000000000006'
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions WHERE id = 'a1000000-0000-0000-0000-000000000010'
);

-- Items du modèle bâche potable
INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, options, alerte_severite, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000010',
  'Niveau bâche eau potable',
  'choix',
  '["Bon","Moyen","Faible"]'::jsonb,
  'avertissement',
  ARRAY['journalier'],
  1
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000010' AND ordre = 1
);

INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000010',
  'Si niveau Faible — Suppresseur déclenché ?',
  'oui_non',
  ARRAY['journalier'],
  2
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000010' AND ordre = 2
);

INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000010',
  'Anomalie à signaler ?',
  'oui_non',
  ARRAY['journalier'],
  3
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000010' AND ordre = 3
);


-- ── 3. Modèle : Bâche à eau incendie ────────────────────────
INSERT INTO modeles_questions (id, nom, type_id)
SELECT
  'a1000000-0000-0000-0000-000000000011',
  'Bâche à eau incendie',
  'b1000000-0000-0000-0000-000000000006'
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions WHERE id = 'a1000000-0000-0000-0000-000000000011'
);

-- Items du modèle bâche incendie
INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, options, alerte_severite, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000011',
  'Niveau bâche eau incendie',
  'choix',
  '["Bon","Moyen","Faible"]'::jsonb,
  'avertissement',
  ARRAY['journalier'],
  1
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000011' AND ordre = 1
);

INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000011',
  'Si niveau Faible — Suppresseur déclenché ?',
  'oui_non',
  ARRAY['journalier'],
  2
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000011' AND ordre = 2
);

INSERT INTO modeles_questions_items (modele_id, texte, type_reponse, frequences, ordre)
SELECT
  'a1000000-0000-0000-0000-000000000011',
  'Anomalie à signaler ?',
  'oui_non',
  ARRAY['journalier'],
  3
WHERE NOT EXISTS (
  SELECT 1 FROM modeles_questions_items
  WHERE modele_id = 'a1000000-0000-0000-0000-000000000011' AND ordre = 3
);


-- ── 4. Vérification ─────────────────────────────────────────
SELECT
  mq.nom     AS modele,
  mqi.ordre,
  mqi.texte,
  mqi.type_reponse,
  mqi.options
FROM modeles_questions mq
JOIN modeles_questions_items mqi ON mqi.modele_id = mq.id
WHERE mq.id IN (
  'a1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000011'
)
ORDER BY mq.nom, mqi.ordre;
