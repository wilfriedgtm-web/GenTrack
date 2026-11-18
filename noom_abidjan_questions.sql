-- ============================================================
-- NOOM ABIDJAN — Mise à jour questions GenTrack
-- À exécuter dans Supabase SQL Editor (zbpoxjlkqxnqjzxohasq)
-- Exécuter section par section pour faciliter le débogage
-- ============================================================

-- ============================================================
-- BLOC 3 — GE : Renommer "Niveau huile" → "Niveau gasoil"
--           + Ajouter question "État groupe"
-- ============================================================

UPDATE questions SET texte = 'Niveau gasoil', unite = '%'
WHERE id IN (
  '113c701c-f747-4db3-950b-87c1e7e3471c',  -- GE 1500 kVA Perkins 4012
  '87dc95a2-834f-42e8-9959-129457095c93'   -- GE 500 kVA Perkins 2506
);

INSERT INTO questions (equipement_id, texte, type_reponse, ordre, in_ronde, in_releve, actif, options)
VALUES
  ('bcbc76b5-478a-492b-8a37-b439543e6139', 'État groupe', 'choix', 3, true, false, true, '["Auto","Marche","Arrêt"]'),
  ('38711456-7211-4b7b-a128-fda6ec7c785b', 'État groupe', 'choix', 3, true, false, true, '["Auto","Marche","Arrêt"]');


-- ============================================================
-- BLOC 4 — TGBT : Renommer 5 questions + Ajouter 8 manquantes
-- ============================================================

-- Renommer les questions existantes avec les noms de leur fiche
UPDATE questions SET texte = 'NTI (HC)', ordre = 3 WHERE id = 'fd27fb67-1819-4c4e-b4b6-59acb6c7d277';
UPDATE questions SET texte = 'JT2 (HP)', ordre = 4 WHERE id = '6dd2d44c-e637-41a1-940d-e591d3b6fd95';
UPDATE questions SET texte = 'PT3 (HP)', ordre = 5 WHERE id = '8204f8c6-9a2c-4f2b-9fac-3ac0ad76cedf';
UPDATE questions SET texte = 'EA — P. Actif (01T)', ordre = 6 WHERE id = '7cdc3548-7dd7-4f21-9f15-3de1041f0047';
UPDATE questions SET texte = 'Facteur de P. (Cos phi)', ordre = 7 WHERE id = '86ee0fa9-f597-4358-bea7-fb106e9f9987';

-- Ajouter les questions manquantes sur TGBT
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
VALUES
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Puissance utile (Pu)',              'numerique', 'kW',  8,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Courant de phase (Appui 1X I)',      'numerique', 'A',   9,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Tension - valeur maxi (Appui 4X V)', 'numerique', 'V',  10,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'P active (Appui 2X PQS)',            'numerique', 'kW', 11,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Energie active (Appui 3X EPF F)',    'numerique', 'kWh',12,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Compteur Schiller 1',                'numerique', 'kWh',13,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Compteur Schiller 2',                'numerique', 'kWh',14,  false, true, true),
  ('1f0db2b4-8c40-4c58-ae33-27855e02e522', 'Compteur Schiller 3',                'numerique', 'kWh',15,  false, true, true);


-- ============================================================
-- BLOC 5 — Local transfo + SOUS-COMPTEUR ELECTRIQUE
-- ============================================================

-- Créer les équipements
INSERT INTO equipements (site_id, nom, actif, actif_releve, actif_ronde, ordre_ronde)
VALUES
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Local transfo',           true, true, true,  50),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'SOUS-COMPTEUR ELECTRIQUE', true, true, false, 51);

-- Ajouter les questions (récupérer les IDs créés ci-dessus avec les SELECT)
-- Local transfo
INSERT INTO questions (equipement_id, texte, type_reponse, ordre, in_ronde, in_releve, actif, options)
SELECT id, 'Dispositif de contrôle Cos phi', 'choix', 1, true, true, true, '["OK","Défaut"]'
FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Local transfo';

-- SOUS-COMPTEUR ELECTRIQUE
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'CUISINE',     'numerique', 'kWh', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'SOUS-COMPTEUR ELECTRIQUE'
UNION ALL
SELECT id, 'Night-Club',  'numerique', 'kWh', 2, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'SOUS-COMPTEUR ELECTRIQUE'
UNION ALL
SELECT id, 'SPA',         'numerique', 'kWh', 3, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'SOUS-COMPTEUR ELECTRIQUE'
UNION ALL
SELECT id, 'BUANDERIE',   'numerique', 'kWh', 4, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'SOUS-COMPTEUR ELECTRIQUE';


-- ============================================================
-- BLOC 1 — RÉSEAU EAU : 14 nouveaux équipements + 16 questions
-- ============================================================

INSERT INTO equipements (site_id, nom, actif, actif_releve, actif_ronde, ordre_ronde)
VALUES
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Bâches eau',                        true, true, false, 60),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Réseau distribution',               true, true, false, 61),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Appoint CHILLER 22ème',             true, true, false, 62),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Appoint ECS 22ème',                 true, true, false, 63),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'LOCAL 22è — Compteur ECS',          true, true, false, 64),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Réfroidisseur Groupe 22ème',        true, true, false, 65),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'PISCINE',                           true, true, false, 66),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Bâche à eau',                       true, true, false, 67),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Adoucisseur / Fontaine',            true, true, false, 68),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Ballon EC 3ème étage',              true, true, false, 69),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'LOCAL 7b — Appoint Eau glacée',     true, true, false, 70),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Night Club 3ème étage',             true, true, false, 71);

-- Questions Bâches eau
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Niveau Bache arrivée SODECI',  'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Bâches eau'
UNION ALL
SELECT id, 'Niveau Bache arrivée Traitée', 'numerique', 'm³', 2, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Bâches eau';

-- Questions Réseau distribution
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Pression manomètre départ 7ème',  'numerique', 'bar', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Réseau distribution'
UNION ALL
SELECT id, 'Pression manomètre départ 22ème', 'numerique', 'bar', 2, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Réseau distribution';

-- Questions Appoint CHILLER
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Appoint CHILLER (m³) 22ème', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Appoint CHILLER 22ème';

-- Questions Appoint ECS 22ème
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Appoint eau chaude primaire 22ème', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Appoint ECS 22ème';

-- Questions LOCAL 22è
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'LOCAL 22è (m³) Compteur ECS', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'LOCAL 22è — Compteur ECS';

-- Questions Réfroidisseur Groupe 22ème
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Réfroidisseur Groupe 22ème étage', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Réfroidisseur Groupe 22ème';

-- Questions PISCINE
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'PISCINE (m³)', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'PISCINE';

-- Questions Bâche à eau
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Bache à eau', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Bâche à eau';

-- Questions Adoucisseur / Fontaine
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'ADOUCISSEUR', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Adoucisseur / Fontaine'
UNION ALL
SELECT id, 'FONTAINE',    'numerique', 'm³', 2, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Adoucisseur / Fontaine';

-- Questions Ballon EC 3ème
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Remplissage ballon EC 3ème étage', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Ballon EC 3ème étage';

-- Questions LOCAL 7b
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'LOCAL 7b (m³) Appoint Eau glacée', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'LOCAL 7b — Appoint Eau glacée';

-- Questions Night Club 3ème
INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Night Club 3ème étage', 'numerique', 'm³', 1, false, true, true FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Night Club 3ème étage';


-- ============================================================
-- BLOC 2 — BOUCLES ECS FC 603 : 8 équipements × 6 questions
-- (actif = false par défaut — à activer selon les boucles réelles)
-- ============================================================

INSERT INTO equipements (site_id, nom, actif, actif_releve, actif_ronde, ordre_ronde)
VALUES
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°1', false, true, false, 80),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°2', false, true, false, 81),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°3', false, true, false, 82),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°4', false, true, false, 83),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°5', false, true, false, 84),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°6', false, true, false, 85),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°7', false, true, false, 86),
  ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Boucle ECS n°8', false, true, false, 87);

-- Questions pour chaque boucle ECS (via boucle sur les noms)
DO $$
DECLARE
  boucle_id UUID;
  boucle_nom TEXT;
  boucles TEXT[] := ARRAY[
    'Boucle ECS n°1','Boucle ECS n°2','Boucle ECS n°3','Boucle ECS n°4',
    'Boucle ECS n°5','Boucle ECS n°6','Boucle ECS n°7','Boucle ECS n°8'
  ];
BEGIN
  FOREACH boucle_nom IN ARRAY boucles LOOP
    SELECT id INTO boucle_id FROM equipements
    WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = boucle_nom;

    INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif) VALUES
      (boucle_id, 'Départ boucle',                   'numerique', '°C', 1, false, true, true),
      (boucle_id, 'Retour boucle',                   'numerique', '°C', 2, false, true, true),
      (boucle_id, 'Échangeur primaire — entrée',     'numerique', '°C', 3, false, true, true),
      (boucle_id, 'Échangeur primaire — sortie',     'numerique', '°C', 4, false, true, true),
      (boucle_id, 'Échangeur secondaire — entrée',   'numerique', '°C', 5, false, true, true),
      (boucle_id, 'Échangeur secondaire — sortie',   'numerique', '°C', 6, false, true, true);
  END LOOP;
END $$;


-- ============================================================
-- BLOC 6 — Ballon ECS 5 (3ème étage)
-- Même structure que Ballons ECS 1-4 (22ème)
-- ============================================================

INSERT INTO equipements (site_id, nom, actif, actif_releve, actif_ronde, ordre_ronde)
VALUES ('67b9b2c4-d792-4629-9912-7368ec7efdc5', 'Ballon ECS 5 (3ème)', true, true, true, 72);

INSERT INTO questions (equipement_id, texte, type_reponse, ordre, in_ronde, in_releve, actif)
SELECT id, 'État général', 'choix', 1, true, false, true
FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Ballon ECS 5 (3ème)';

INSERT INTO questions (equipement_id, texte, type_reponse, unite, ordre, in_ronde, in_releve, actif)
SELECT id, 'Température', 'numerique', '°C', 2, false, true, true
FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'Ballon ECS 5 (3ème)';


-- ============================================================
-- NETTOYAGE — Supprimer le doublon GE
-- (vérifier d'abord qu'il n'y a pas de données liées)
-- ============================================================

-- Vérification préalable (exécuter séparément) :
-- SELECT COUNT(*) FROM reponses r
-- JOIN releves_horaires rh ON r.releve_id = rh.id  ... (via jointure sur site)
-- WHERE q.equipement_id = (SELECT id FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'G1 – CAT 1100 kVA (copie)');

-- Si 0 résultats, exécuter :
-- DELETE FROM questions WHERE equipement_id = (SELECT id FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'G1 – CAT 1100 kVA (copie)');
-- DELETE FROM equipements WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5' AND nom = 'G1 – CAT 1100 kVA (copie)';
