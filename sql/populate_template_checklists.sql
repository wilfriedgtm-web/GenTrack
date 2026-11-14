-- Peupler les checklists des templates seeds
-- À exécuter dans Supabase SQL Editor

-- Groupe électrogène — Vérification huile & carburant
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier niveau huile moteur"},
  {"text":"Vérifier niveau carburant"},
  {"text":"Vérifier absence de fuite (huile, carburant, liquide refroidissement)"},
  {"text":"Vérifier niveau liquide de refroidissement"},
  {"text":"Inspecter état courroie alternateur"}
]'::jsonb WHERE titre = 'Vérification huile & carburant' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Vidange huile moteur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vider l''huile usagée (moteur chaud)"},
  {"text":"Remplacer le filtre à huile"},
  {"text":"Remettre bouchon vidange avec joint neuf"},
  {"text":"Remplir avec huile neuve (grade conforme)"},
  {"text":"Vérifier niveau huile après remplissage"},
  {"text":"Démarrer et vérifier absence de fuite"}
]'::jsonb WHERE titre = 'Vidange huile moteur' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Remplacement filtre à air
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper le groupe avant intervention"},
  {"text":"Déposer le boîtier filtre à air"},
  {"text":"Nettoyer le boîtier (souffler à l''air comprimé)"},
  {"text":"Installer le nouveau filtre à air"},
  {"text":"Remonter et vérifier étanchéité"},
  {"text":"Démarrer et vérifier bon fonctionnement"}
]'::jsonb WHERE titre = 'Remplacement filtre à air' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Remplacement filtre carburant
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''arrivée carburant"},
  {"text":"Déposer l''ancien filtre (récupérer le carburant)"},
  {"text":"Installer le nouveau filtre (sens d''écoulement correct)"},
  {"text":"Ouvrir l''arrivée carburant et purger l''air"},
  {"text":"Démarrer et vérifier absence de fuite"},
  {"text":"Vérifier pression carburant au ralenti"}
]'::jsonb WHERE titre = 'Remplacement filtre carburant' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Vérification courroies & câblage
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier tension courroie alternateur (flèche max 10mm)"},
  {"text":"Inspecter état courroie (craquelures, usure)"},
  {"text":"Vérifier serrage des bornes batterie"},
  {"text":"Vérifier état câbles et connexions électriques"},
  {"text":"Tester tension batterie (min 12,5V)"},
  {"text":"Inspecter fusibles et disjoncteurs"}
]'::jsonb WHERE titre = 'Vérification courroies & câblage' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Révision complète GE
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vidange huile moteur + remplacement filtre huile"},
  {"text":"Remplacement filtre à air"},
  {"text":"Remplacement filtre carburant"},
  {"text":"Vérification / remplacement bougies ou injecteurs"},
  {"text":"Vérification tension et état courroies"},
  {"text":"Vérification circuit de refroidissement"},
  {"text":"Test charge batteries et alternateur"},
  {"text":"Essai en charge 30 min et relevé paramètres"},
  {"text":"Vérification AVR (régulateur tension)"},
  {"text":"Resserrage connexions tableau et câblage"}
]'::jsonb WHERE titre = 'Révision complète GE' AND categorie = 'Groupe électrogène';

-- Groupe électrogène — Test démarrage à vide
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier niveau carburant (> 50%)"},
  {"text":"Vérifier niveau huile"},
  {"text":"Démarrer le groupe"},
  {"text":"Vérifier fréquence (50 Hz ± 1 Hz)"},
  {"text":"Vérifier tension (220V ± 5%)"},
  {"text":"Faire tourner 15 min sans charge"},
  {"text":"Arrêt normal et noter les paramètres"}
]'::jsonb WHERE titre = 'Test démarrage à vide' AND categorie = 'Groupe électrogène';

-- Climatisation — Nettoyage filtres
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''unité avant intervention"},
  {"text":"Déposer les filtres à air unité intérieure"},
  {"text":"Nettoyer filtres (eau + brosse douce ou aspiration)"},
  {"text":"Sécher les filtres avant remontage"},
  {"text":"Remonter les filtres et refermer le capot"},
  {"text":"Remettre en marche et vérifier débit d''air"}
]'::jsonb WHERE titre = 'Nettoyage filtres' AND categorie = 'Climatisation';

-- Climatisation — Nettoyage unité extérieure
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''alimentation électrique"},
  {"text":"Nettoyer ailettes condenseur (souffler à l''air comprimé de l''intérieur vers l''extérieur)"},
  {"text":"Nettoyer pale et moteur ventilateur"},
  {"text":"Vérifier absence d''obstruction autour de l''unité"},
  {"text":"Vérifier état tuyauteries et isolant"},
  {"text":"Remettre en marche et vérifier bonne évacuation chaleur"}
]'::jsonb WHERE titre = 'Nettoyage unité extérieure' AND categorie = 'Climatisation';

-- Climatisation — Vérification charge réfrigérant
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier pression côté basse pression (manomètre)"},
  {"text":"Vérifier pression côté haute pression"},
  {"text":"Comparer aux valeurs nominales du constructeur"},
  {"text":"Vérifier absence de fuite (détecteur ou eau savonneuse)"},
  {"text":"Vérifier température soufflage unité intérieure"},
  {"text":"Consigner les mesures dans le registre"}
]'::jsonb WHERE titre = 'Vérification charge réfrigérant' AND categorie = 'Climatisation';

-- Vérification
SELECT titre, categorie, jsonb_array_length(checklist) AS nb_items
FROM templates_maintenance
ORDER BY categorie, titre;
