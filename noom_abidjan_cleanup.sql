-- ============================================================
-- NOOM ABIDJAN — NETTOYAGE DOUBLONS
-- Site ID : 67b9b2c4-d792-4629-9912-7368ec7efdc5
-- À exécuter dans : Supabase SQL Editor
-- À exécuter dans cet ordre exact (3 étapes)
-- ============================================================


-- ============================================================
-- ÉTAPE 1 : Dédupliquer les QUESTIONS sur les équipements
--           CONSERVÉS (TGBT, GEs, et tous les équipements
--           du site dont les questions ont été insérées 2×)
-- ============================================================

DELETE FROM questions
WHERE id IN (
  -- GE 1500 kVA — Perkins 4012 : "État groupe" en doublon
  '7a33c81f-09cd-4a3f-bd26-ebc120350c4a',

  -- GE 500 kVA — Perkins 2506 : "État groupe" en doublon
  'c4ef8815-f051-4894-96e5-1ecb439fac49',

  -- TGBT : 8 nouvelles questions insérées 2×
  'c5f342d8-501d-45d5-9b53-2a7cf0a463e1',  -- Compteur Schiller 1
  'c92f4d2a-9fe8-4b44-b01c-0cfe8265998c',  -- Compteur Schiller 2
  'b8ef9935-2233-45b6-8bd3-68385d8edd75',  -- Compteur Schiller 3
  'f177d8e8-0ca3-45e4-b64e-6cbcd81b5f84',  -- Courant de phase (Appui 1X I)
  '5b8128cd-62ee-430d-8d63-b1a0b4d87501',  -- Energie active (Appui 3X EPF F)
  'e02c2a65-a4fe-472e-bf9e-6d001d45b081',  -- P active (Appui 2X PQS)
  '687a1bf9-5427-428d-a9ac-b2e152dddfd9',  -- Puissance utile (Pu)
  'c7722e19-4fc4-4e31-b024-9a32cfc1bc7d'   -- Tension - valeur maxi (Appui 4X V)
);

-- Dédupliquer aussi les questions sur les PREMIERS équipements eau/électricité
-- (ceux qu'on garde) dont les questions ont été créées 2× lors du 2ème passage
DELETE FROM questions
WHERE id IN (
  SELECT id FROM (
    SELECT q.id,
           ROW_NUMBER() OVER (
             PARTITION BY q.equipement_id, q.texte
             ORDER BY q.id
           ) AS rn
    FROM questions q
    JOIN equipements e ON q.equipement_id = e.id
    WHERE e.site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5'
  ) sub
  WHERE rn > 1
);


-- ============================================================
-- ÉTAPE 2 : Supprimer les QUESTIONS des équipements en doublon
--           (ceux qu'on va supprimer à l'étape 3)
-- ============================================================

DELETE FROM questions
WHERE equipement_id IN (
  'd2757cff-99d8-48cf-ae68-8d98683a85c2',  -- Adoucisseur / Fontaine (copie)
  'ed05de1f-b5c2-4657-b78e-56b11cc5d4b2',  -- Appoint CHILLER 22ème (copie)
  'ecc6354b-5e52-4bd8-acff-cd5a4d17f390',  -- Appoint ECS 22ème (copie)
  'e437c098-7626-4eac-accc-59c77735f060',  -- Bâche à eau (copie)
  'ffd9b9ec-9ce4-418d-ba94-034f39e710dc',  -- Bâches eau (copie)
  '9aa329d6-40cb-41ef-9f29-fb85bf83c3cc',  -- Ballon ECS 5 (3ème) (copie)
  'c5016701-acec-458f-886b-72353785d020',  -- Boucle ECS n°1 (copie)
  '5c5a3be4-d8be-43c0-8041-97bf8699ee90',  -- Boucle ECS n°2 (copie)
  'b52294be-93d2-46ed-b6d7-20c321111320',  -- Boucle ECS n°3 (copie)
  'e2b11458-54e5-480c-87a7-9a8a0b3e28f2',  -- Boucle ECS n°4 (copie)
  'ead25baf-6e85-4974-89f4-02f2a08536c3',  -- Boucle ECS n°5 (copie)
  '6da0a244-af69-43b1-a6f3-b3eed8202b5c',  -- Boucle ECS n°6 (copie)
  'e604f212-69d0-430a-8306-10f72f302435',  -- Boucle ECS n°7 (copie)
  'bbfdc144-1156-42e2-98b6-434f439eea2d',  -- Boucle ECS n°8 (copie)
  '74ac1241-adc5-4da5-bc93-1313b886c369',  -- LOCAL 22è — Compteur ECS (copie)
  'cb186efc-15bc-4e9a-9e2f-20e3aa48387c',  -- LOCAL 7b — Appoint Eau glacée (copie)
  '7308baed-cc60-4787-b599-f4955a144382',  -- Local transfo (copie)
  'ab07b7ea-34a1-4d33-ac48-ee17740d03cd',  -- Night Club 3ème étage (copie)
  'e297648d-6ca2-4843-b2fe-7cc341fd3e25',  -- PISCINE (copie)
  'd7abd667-704c-4519-ae76-6133578e5d9e',  -- Réfroidisseur Groupe 22ème (copie)
  'e78548da-6db8-4ab5-be71-93639f50a2d3',  -- Réseau distribution (copie)
  'ca4c186b-dd20-4534-a1cf-d9cdaeca35c1'   -- SOUS-COMPTEUR ELECTRIQUE (copie)
);


-- ============================================================
-- ÉTAPE 3 : Supprimer les ÉQUIPEMENTS en doublon
--           (on garde le premier de chaque paire = id min)
-- ============================================================

DELETE FROM equipements
WHERE id IN (
  'd2757cff-99d8-48cf-ae68-8d98683a85c2',  -- Adoucisseur / Fontaine (copie)
  'ed05de1f-b5c2-4657-b78e-56b11cc5d4b2',  -- Appoint CHILLER 22ème (copie)
  'ecc6354b-5e52-4bd8-acff-cd5a4d17f390',  -- Appoint ECS 22ème (copie)
  'e437c098-7626-4eac-accc-59c77735f060',  -- Bâche à eau (copie)
  'ffd9b9ec-9ce4-418d-ba94-034f39e710dc',  -- Bâches eau (copie)
  '9aa329d6-40cb-41ef-9f29-fb85bf83c3cc',  -- Ballon ECS 5 (3ème) (copie)
  'c5016701-acec-458f-886b-72353785d020',  -- Boucle ECS n°1 (copie)
  '5c5a3be4-d8be-43c0-8041-97bf8699ee90',  -- Boucle ECS n°2 (copie)
  'b52294be-93d2-46ed-b6d7-20c321111320',  -- Boucle ECS n°3 (copie)
  'e2b11458-54e5-480c-87a7-9a8a0b3e28f2',  -- Boucle ECS n°4 (copie)
  'ead25baf-6e85-4974-89f4-02f2a08536c3',  -- Boucle ECS n°5 (copie)
  '6da0a244-af69-43b1-a6f3-b3eed8202b5c',  -- Boucle ECS n°6 (copie)
  'e604f212-69d0-430a-8306-10f72f302435',  -- Boucle ECS n°7 (copie)
  'bbfdc144-1156-42e2-98b6-434f439eea2d',  -- Boucle ECS n°8 (copie)
  '74ac1241-adc5-4da5-bc93-1313b886c369',  -- LOCAL 22è — Compteur ECS (copie)
  'cb186efc-15bc-4e9a-9e2f-20e3aa48387c',  -- LOCAL 7b — Appoint Eau glacée (copie)
  '7308baed-cc60-4787-b599-f4955a144382',  -- Local transfo (copie)
  'ab07b7ea-34a1-4d33-ac48-ee17740d03cd',  -- Night Club 3ème étage (copie)
  'e297648d-6ca2-4843-b2fe-7cc341fd3e25',  -- PISCINE (copie)
  'd7abd667-704c-4519-ae76-6133578e5d9e',  -- Réfroidisseur Groupe 22ème (copie)
  'e78548da-6db8-4ab5-be71-93639f50a2d3',  -- Réseau distribution (copie)
  'ca4c186b-dd20-4534-a1cf-d9cdaeca35c1'   -- SOUS-COMPTEUR ELECTRIQUE (copie)
);


-- ============================================================
-- ÉTAPE 4 : Supprimer "Ballon EC 3ème étage" et sa question
--           (remplacé par "Ballon EC 5 3ème étage")
-- ============================================================

DELETE FROM questions WHERE id = '1b045ecc-6427-4e05-8dcb-650f4e11804f';
DELETE FROM equipements WHERE id = '90817dcf-2ab0-4a23-ad90-5dc71c1f0281';


-- ============================================================
-- VÉRIFICATION (à lancer après les 4 étapes)
-- Doit retourner 0 ligne si tout est clean
-- ============================================================

SELECT nom, COUNT(*) as nb
FROM equipements
WHERE site_id = '67b9b2c4-d792-4629-9912-7368ec7efdc5'
GROUP BY nom
HAVING COUNT(*) > 1
ORDER BY nom;

-- Vérification doublons questions TGBT + GEs
SELECT e.nom, q.texte, COUNT(*) as nb
FROM questions q
JOIN equipements e ON q.equipement_id = e.id
WHERE q.equipement_id IN (
  '1f0db2b4-8c40-4c58-ae33-27855e02e522',
  'bcbc76b5-478a-492b-8a37-b439543e6139',
  '38711456-7211-4b7b-a128-fda6ec7c785b'
)
GROUP BY e.nom, q.texte
HAVING COUNT(*) > 1;
