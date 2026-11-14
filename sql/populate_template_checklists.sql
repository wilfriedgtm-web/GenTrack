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

-- Climatisation — Révision annuelle clim
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''alimentation électrique"},
  {"text":"Nettoyage complet filtres unité intérieure"},
  {"text":"Nettoyage ailettes et ventilateur unité intérieure"},
  {"text":"Nettoyage condenseur unité extérieure"},
  {"text":"Vérifier et purger le bac de condensats + tuyau d''évacuation"},
  {"text":"Vérifier pression réfrigérant (manomètre haute/basse pression)"},
  {"text":"Contrôle détection de fuite réfrigérant"},
  {"text":"Vérifier tensions et intensités électriques"},
  {"text":"Tester le thermostat et les modes de fonctionnement"},
  {"text":"Lubrifier les roulements moteur ventilateur si accessible"},
  {"text":"Consigner les mesures dans le registre d''entretien"}
]'::jsonb WHERE titre = 'Révision annuelle clim' AND categorie = 'Climatisation';

-- ─────────────────────────────────────────────────────────────
-- CHAMBRE FROIDE
-- ─────────────────────────────────────────────────────────────

-- Chambre froide — Nettoyage condenseur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''alimentation du groupe froid"},
  {"text":"Dépoussiérer les ailettes du condenseur (air comprimé ou brosse)"},
  {"text":"Vérifier absence d''obstruction devant le condenseur (min. 50 cm)"},
  {"text":"Nettoyer le ventilateur condenseur (pales et grille)"},
  {"text":"Vérifier bruits anormaux au redémarrage"},
  {"text":"Consigner l''intervention"}
]'::jsonb WHERE titre = 'Nettoyage condenseur' AND categorie = 'Chambre froide';

-- Chambre froide — Vérification joints de porte
UPDATE templates_maintenance SET checklist = '[
  {"text":"Inspecter visuellement les joints sur tout le périmètre"},
  {"text":"Tester l''étanchéité (test du papier : résistance en tirant)"},
  {"text":"Vérifier absence de déformation, fissure ou décollement"},
  {"text":"Nettoyer les joints (eau + savon doux)"},
  {"text":"Vérifier fermeture correcte de la porte et du loquet"},
  {"text":"Remplacer si joint défaillant et noter dans le registre"}
]'::jsonb WHERE titre = 'Vérification joints de porte' AND categorie = 'Chambre froide';

-- Chambre froide — Nettoyage évaporateur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper le groupe froid et laisser le dégivrage se terminer"},
  {"text":"Vérifier absence de givre excessif sur l''évaporateur"},
  {"text":"Nettoyer les ailettes de l''évaporateur (eau chaude ou air comprimé)"},
  {"text":"Nettoyer le ventilateur évaporateur (pales et grille)"},
  {"text":"Vérifier et nettoyer le bac de récupération des condensats"},
  {"text":"Vérifier bon écoulement de la résistance de dégivrage"},
  {"text":"Remettre en marche et vérifier la descente en température"}
]'::jsonb WHERE titre = 'Nettoyage évaporateur' AND categorie = 'Chambre froide';

-- Chambre froide — Vérification charge réfrigérant
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier pression basse pression (manomètre)"},
  {"text":"Vérifier pression haute pression"},
  {"text":"Comparer aux valeurs nominales constructeur (plaque signalétique)"},
  {"text":"Contrôler température d''évaporation et de condensation"},
  {"text":"Vérifier absence de fuite (détecteur électronique ou eau savonneuse)"},
  {"text":"Vérifier absence de bulle dans le voyant liquide"},
  {"text":"Consigner pressions et températures dans le registre"}
]'::jsonb WHERE titre = 'Vérification charge réfrigérant' AND categorie = 'Chambre froide';

-- Chambre froide — Révision compresseur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper l''alimentation électrique (consignation)"},
  {"text":"Vérifier niveau d''huile compresseur"},
  {"text":"Contrôler température de refoulement"},
  {"text":"Vérifier intensité absorbée (clamp-mètre)"},
  {"text":"Vérifier tensions d''alimentation électrique"},
  {"text":"Inspecter les connexions électriques (serrage)"},
  {"text":"Vérifier vibrations et bruits anormaux au démarrage"},
  {"text":"Vérifier les soupapes de sécurité (état + date)"},
  {"text":"Contrôler le pressostat HP/BP"},
  {"text":"Consigner les mesures dans le registre d''entretien"}
]'::jsonb WHERE titre = 'Révision compresseur' AND categorie = 'Chambre froide';

-- ─────────────────────────────────────────────────────────────
-- POMPE
-- ─────────────────────────────────────────────────────────────

-- Pompe — Vérification étanchéité
UPDATE templates_maintenance SET checklist = '[
  {"text":"Inspecter visuellement le presse-étoupe ou la garniture mécanique"},
  {"text":"Vérifier absence de fuite au niveau du corps de pompe"},
  {"text":"Vérifier absence de fuite sur les raccords et vannes"},
  {"text":"Contrôler le goutte-à-goutte presse-étoupe (normal : 1-3 gouttes/min)"},
  {"text":"Vérifier état des joints de brides"},
  {"text":"Consigner les observations et noter si remplacement nécessaire"}
]'::jsonb WHERE titre = 'Vérification étanchéité' AND categorie = 'Pompe';

-- Pompe — Révision garniture mécanique
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper la pompe et consigner électriquement"},
  {"text":"Fermer les vannes d''isolement amont et aval"},
  {"text":"Vider le circuit si nécessaire"},
  {"text":"Déposer le couvercle et accéder à la garniture"},
  {"text":"Remplacer les faces de frottement (fixe et tournante)"},
  {"text":"Remplacer les joints O-ring et les ressorts"},
  {"text":"Remonter en respectant les couples de serrage"},
  {"text":"Remettre en eau et vérifier l''absence de fuite"},
  {"text":"Consigner la date et les pièces remplacées"}
]'::jsonb WHERE titre = 'Révision garniture mécanique' AND categorie = 'Pompe';

-- Pompe — Révision générale pompe
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper et consigner électriquement"},
  {"text":"Fermer les vannes d''isolement et vider le circuit"},
  {"text":"Déposer la pompe et démontage complet"},
  {"text":"Inspecter la roue (usure, cavitation, bouchage)"},
  {"text":"Vérifier et remplacer les roulements si nécessaire"},
  {"text":"Remplacer la garniture mécanique ou le presse-étoupe"},
  {"text":"Vérifier l''arbre (voile, usure, corrosion)"},
  {"text":"Remplacer les joints de corps de pompe"},
  {"text":"Remonter et aligner moteur + pompe (accouplement)"},
  {"text":"Remettre en eau, purger l''air et vérifier débit + pression"},
  {"text":"Mesurer l''intensité absorbée et comparer au nominal"},
  {"text":"Consigner l''ensemble dans le registre d''entretien"}
]'::jsonb WHERE titre = 'Révision générale pompe' AND categorie = 'Pompe';

-- ─────────────────────────────────────────────────────────────
-- TRANSFORMATEUR
-- ─────────────────────────────────────────────────────────────

-- Transformateur — Inspection visuelle transformateur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier absence de fuite d''huile (cuve, joints, robinets)"},
  {"text":"Inspecter le niveau d''huile au regard de niveau"},
  {"text":"Vérifier état des traversées isolantes (fissures, encrassement)"},
  {"text":"Inspecter les connexions HTA et BT (oxydation, desserrage)"},
  {"text":"Vérifier état du radiateur (ailettes, absence de corrosion)"},
  {"text":"Contrôler le fonctionnement des indicateurs (thermomètre, Buchholz)"},
  {"text":"Vérifier absence de bruit ou vibration anormale"},
  {"text":"Consigner les observations dans le registre"}
]'::jsonb WHERE titre = 'Inspection visuelle transformateur' AND categorie = 'Transformateur';

-- Transformateur — Vérification connexions
UPDATE templates_maintenance SET checklist = '[
  {"text":"Consigner le transformateur (HTA + BT) avant toute intervention"},
  {"text":"Vérifier serrage des bornes HTA (couples selon constructeur)"},
  {"text":"Vérifier serrage des bornes BT"},
  {"text":"Inspecter les câbles de raccordement (état gaine, chaleur anormale)"},
  {"text":"Vérifier connexions de mise à la terre (HTA, BT, cuve)"},
  {"text":"Inspecter les parafoudres HTA (état, voyant de déclenchement)"},
  {"text":"Vérifier l''état des sectionneurs et interrupteurs de coupure"},
  {"text":"Consigner les mesures et toute anomalie constatée"}
]'::jsonb WHERE titre = 'Vérification connexions' AND categorie = 'Transformateur';

-- Transformateur — Analyse huile diélectrique
UPDATE templates_maintenance SET checklist = '[
  {"text":"Prélever un échantillon d''huile selon la procédure (flacon propre et sec)"},
  {"text":"Envoyer l''échantillon au laboratoire (rigidité diélectrique, teneur en eau, acidité)"},
  {"text":"Vérifier le niveau d''huile après prélèvement"},
  {"text":"Consigner la date de prélèvement et le numéro de dossier laboratoire"},
  {"text":"Analyser le rapport laboratoire : rigidité > 30 kV/mm, eau < 20 ppm"},
  {"text":"Si résultats hors seuil : planifier traitement ou remplacement huile"},
  {"text":"Mettre à jour le registre du transformateur avec les résultats"}
]'::jsonb WHERE titre = 'Analyse huile diélectrique' AND categorie = 'Transformateur';

-- ─────────────────────────────────────────────────────────────
-- COMPRESSEUR
-- ─────────────────────────────────────────────────────────────

-- Compresseur — Vérification pression & huile
UPDATE templates_maintenance SET checklist = '[
  {"text":"Vérifier pression de service sur le manomètre (comparer au réglage)"},
  {"text":"Vérifier niveau d''huile compresseur (hublot ou jauge)"},
  {"text":"Inspecter absence de fuite d''huile (carter, joints)"},
  {"text":"Vérifier pression de déclenchement et réenclenchement pressostat"},
  {"text":"Vérifier état du filtre à air aspirant (encrassement)"},
  {"text":"Tester la soupape de sécurité (manuelle)"},
  {"text":"Vérifier bon fonctionnement du purgeur automatique condensats"},
  {"text":"Consigner les mesures et observations"}
]'::jsonb WHERE titre = 'Vérification pression & huile' AND categorie = 'Compresseur';

-- Compresseur — Vidange huile compresseur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Faire tourner le compresseur 5 min pour chauffer l''huile"},
  {"text":"Arrêter et dépressuriser complètement le circuit"},
  {"text":"Vidanger l''huile usagée via le bouchon de vidange"},
  {"text":"Remplacer le filtre à huile si présent"},
  {"text":"Remettre le bouchon de vidange avec joint neuf"},
  {"text":"Remplir avec huile neuve de grade préconisé (voir plaque constructeur)"},
  {"text":"Vérifier le niveau sur le hublot ou la jauge"},
  {"text":"Démarrer et vérifier absence de fuite"},
  {"text":"Consigner la date, le grade et la quantité d''huile utilisée"}
]'::jsonb WHERE titre = 'Vidange huile compresseur' AND categorie = 'Compresseur';

-- Compresseur — Révision annuelle compresseur
UPDATE templates_maintenance SET checklist = '[
  {"text":"Couper et consigner électriquement"},
  {"text":"Dépressuriser complètement le réservoir"},
  {"text":"Vidange huile + remplacement filtre huile"},
  {"text":"Remplacement filtre à air aspirant"},
  {"text":"Remplacement courroie(s) de transmission (ou vérification tension)"},
  {"text":"Vérification / remplacement des clapets d''aspiration et refoulement"},
  {"text":"Nettoyage du réfrigérant (ailettes)"},
  {"text":"Purger et nettoyer le réservoir d''air (rinçage condensats)"},
  {"text":"Tester la soupape de sécurité"},
  {"text":"Vérifier serrage connexions électriques"},
  {"text":"Remettre en service et mesurer pression + intensité"},
  {"text":"Consigner la révision dans le registre d''entretien"}
]'::jsonb WHERE titre = 'Révision annuelle compresseur' AND categorie = 'Compresseur';

-- ─────────────────────────────────────────────────────────────
-- GÉNÉRAL
-- ─────────────────────────────────────────────────────────────

-- Général — Inspection mensuelle générale
UPDATE templates_maintenance SET checklist = '[
  {"text":"Tour de site complet : vérifier état général des équipements"},
  {"text":"Vérifier absence de fuite (eau, huile, carburant, réfrigérant)"},
  {"text":"Contrôler les niveaux (huile, carburant, liquide de refroidissement)"},
  {"text":"Vérifier bon fonctionnement des tableaux électriques (voyants, disjoncteurs)"},
  {"text":"Tester les alarmes et détecteurs (fumée, température, intrusion)"},
  {"text":"Vérifier état général des locaux techniques (propreté, accès, ventilation)"},
  {"text":"Consigner les anomalies et planifier les interventions nécessaires"}
]'::jsonb WHERE titre = 'Inspection mensuelle générale' AND categorie = 'Général';

-- Général — Maintenance trimestrielle
UPDATE templates_maintenance SET checklist = '[
  {"text":"Effectuer l''inspection mensuelle générale"},
  {"text":"Vérifier et nettoyer les filtres de ventilation des locaux techniques"},
  {"text":"Tester le groupe électrogène (démarrage à vide 15 min)"},
  {"text":"Vérifier les batteries de secours (onduleurs, éclairage de sécurité)"},
  {"text":"Contrôler les extincteurs (pression, date de visite)"},
  {"text":"Vérifier l''état des équipements de sécurité (EPI disponibles et conformes)"},
  {"text":"Mettre à jour le registre de sécurité et de maintenance"}
]'::jsonb WHERE titre = 'Maintenance trimestrielle' AND categorie = 'Général';

-- Général — Révision semestrielle
UPDATE templates_maintenance SET checklist = '[
  {"text":"Effectuer la maintenance trimestrielle complète"},
  {"text":"Révision préventive de tous les équipements critiques (selon leurs fiches)"},
  {"text":"Vérifier les contrats de maintenance prestataires (validité, prochaine visite)"},
  {"text":"Tester le groupe électrogène en charge (minimum 30 min sous charge réelle)"},
  {"text":"Vérifier et mettre à jour le registre de sécurité"},
  {"text":"Contrôle visuel de toutes les installations électriques (câblage, armoires)"},
  {"text":"Vérifier les plans de maintenance et mettre à jour les fréquences si nécessaire"},
  {"text":"Rédiger le compte-rendu semestriel et transmettre au responsable"}
]'::jsonb WHERE titre = 'Révision semestrielle' AND categorie = 'Général';

-- ─────────────────────────────────────────────────────────────
-- Vérification finale
-- ─────────────────────────────────────────────────────────────
SELECT titre, categorie, jsonb_array_length(checklist) AS nb_items
FROM templates_maintenance
ORDER BY categorie, titre;
