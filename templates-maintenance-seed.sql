-- ══════════════════════════════════════════════════════════════════════════════
-- SEED — Templates de maintenance préventive hôteliers
-- À exécuter dans l'éditeur SQL Supabase (projet zbpoxjlkqxnqjzxohasq)
-- Ces templates apparaîtront dans le picker "Depuis un template" de chaque plan.
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO templates_maintenance (titre, frequence, categorie, actif, checklist) VALUES

-- ── ASCENSEUR ─────────────────────────────────────────────────────────────────
('Ascenseur — Visite mensuelle',          '1 mois',    'Ascenseur', true,
  '["Vérifier le fonctionnement des portes palières","Tester le bouton d''arrêt d''urgence","Contrôler l''éclairage cabine et de secours","Vérifier l''interphone","Contrôler le niveau d''huile (hydraulique)","Nettoyer la fosse et la gaine"]'),

('Ascenseur — Révision semestrielle',     '6 mois',    'Ascenseur', true,
  '["Inspection complète des câbles et poulies","Vérifier les parachutes et limiteur de vitesse","Contrôler les guides et galets","Tester les dispositifs de sécurité","Lubrifier les glissières et mécanismes","Vérifier l''alignement des paliers","Rapport de visite à archiver"]'),

('Ascenseur — Vérification annuelle réglementaire', '1 an', 'Ascenseur', true,
  '["Contrôle réglementaire obligatoire par organisme agréé","Vérification du registre de sécurité","Test de charge nominale","Inspection électrique complète","Mise à jour du carnet de maintenance"]'),

-- ── GROUPE ÉLECTROGÈNE ────────────────────────────────────────────────────────
('Groupe électrogène — Contrôle hebdomadaire', '1 semaine', 'Groupe électrogène', true,
  '["Relever le compteur horaire","Vérifier le niveau carburant (diesel)","Vérifier le niveau d''huile moteur","Contrôler le niveau de liquide de refroidissement","Vérifier l''état de la batterie","Test de démarrage automatique (10 min)","Contrôler absence de fuite"]'),

('Groupe électrogène — Maintenance mensuelle', '1 mois', 'Groupe électrogène', true,
  '["Remplacer le filtre à air si colmaté","Vérifier les connexions électriques et bornes","Contrôler la courroie d''alternateur","Tester le tableau de transfert automatique (ATS)","Vérifier les fixations et silent-blocs","Nettoyer le local groupe"]'),

('Groupe électrogène — Vidange et filtres', '250 heure', 'Groupe électrogène', true,
  '["Vidange huile moteur","Remplacement filtre à huile","Remplacement filtre à carburant","Remplacement filtre à air","Contrôle injecteurs","Vérifier la courroie de distribution","Rapport d''entretien à archiver"]'),

-- ── CLIMATISATION ─────────────────────────────────────────────────────────────
('Climatisation — Entretien mensuel',     '1 mois',    'Climatisation', true,
  '["Nettoyer ou remplacer les filtres à air","Vérifier la pression de gaz frigorigène","Contrôler la température de soufflage","Nettoyer les grilles et évaporateurs","Vérifier l''évacuation des condensats","Contrôler le thermostat"]'),

('Climatisation — Révision semestrielle', '6 mois',    'Climatisation', true,
  '["Contrôle complet du circuit frigorigène","Vérifier les connexions électriques","Nettoyer le condenseur extérieur","Vérifier la courroie du ventilateur","Contrôler le compresseur (bruit, vibrations)","Test de performance (deltaT)","Recharge gaz si nécessaire"]'),

-- ── CHAUFFE-EAU / CHAUDIÈRE ───────────────────────────────────────────────────
('Chauffe-eau — Détartrage semestriel',   '6 mois',    'Plomberie', true,
  '["Couper l''alimentation électrique / gaz","Vidanger et détartrer la cuve","Vérifier la résistance électrique ou brûleur","Contrôler la soupape de sécurité","Vérifier l''anode magnésium","Contrôler l''isolation thermique","Remettre en service et tester"]'),

('Chaudière — Entretien annuel',          '1 an',      'Plomberie', true,
  '["Nettoyage brûleur et échangeur","Vérifier les électrodes d''allumage","Contrôler la pression du circuit","Purger les radiateurs","Vérifier les soupapes et vannes de sécurité","Test combustion (rendement)","Rapport d''entretien obligatoire"]'),

-- ── PISCINE ───────────────────────────────────────────────────────────────────
('Piscine — Contrôle hebdomadaire',       '1 semaine', 'Piscine', true,
  '["Mesurer le pH (objectif 7.2–7.6)","Mesurer le taux de chlore (1–3 mg/L)","Contrôler la transparence de l''eau","Nettoyer le skimmer et paniers","Vérifier le débit de filtration","Contrôler la pompe et pression du filtre","Aspirer le fond si nécessaire"]'),

('Piscine — Révision mensuelle',          '1 mois',    'Piscine', true,
  '["Rétrolavage du filtre à sable","Vérifier les buses de refoulement","Contrôler l''éclairage subaquatique","Vérifier l''état du liner ou carrelage","Contrôler le système de chauffage","Nettoyer les margelles et plage","Tester le système d''alarme (si présent)"]'),

-- ── CHAMBRE FROIDE ────────────────────────────────────────────────────────────
('Chambre froide — Contrôle mensuel',     '1 mois',    'Chambre froide', true,
  '["Vérifier la température (relever min/max)","Contrôler l''étanchéité des joints de porte","Nettoyer le condenseur et l''évaporateur","Vérifier le dégivrage automatique","Contrôler le niveau d''huile compresseur","Vérifier l''éclairage intérieur","Nettoyer les grilles d''aération"]'),

('Chambre froide — Révision annuelle',    '1 an',      'Chambre froide', true,
  '["Contrôle complet du circuit frigorigène","Vérifier la charge en gaz","Inspection mécanique compresseur","Vérifier les connexions électriques","Contrôler les sondes de température","Tester les alarmes haute/basse température","Rapport de maintenance à archiver"]'),

-- ── POMPE INCENDIE ────────────────────────────────────────────────────────────
('Pompe incendie — Test mensuel',         '1 mois',    'Incendie', true,
  '["Test de démarrage automatique (15 min)","Vérifier la pression de sortie","Contrôler le niveau du réservoir d''amorçage","Vérifier l''absence de fuite sur le circuit","Contrôler les voyants et alarmes","Vérifier l''alimentation électrique principale et secours","Consigner les relevés dans le registre"]'),

('Système incendie — Vérification mensuelle', '1 mois', 'Incendie', true,
  '["Tester un détecteur de fumée par zone","Vérifier les indicateurs du tableau de signalisation","Contrôler les extincteurs (goupille, pression)","Vérifier l''accessibilité des robinets incendie armés","Contrôler l''éclairage de sécurité (BAES)","Vérifier les issues de secours non obstruées"]'),

-- ── TABLEAU ÉLECTRIQUE ────────────────────────────────────────────────────────
('Tableau électrique — Contrôle semestriel', '6 mois', 'Électricité', true,
  '["Vérifier l''état des disjoncteurs (absence de traces de chauffe)","Serrer les connexions et bornes","Contrôler l''étiquetage des circuits","Tester les différentiels","Mesurer les températures aux points de connexion","Vérifier la mise à la terre","Mettre à jour le schéma unifilaire si modifications"]'),

-- ── HOTTE CUISINE ─────────────────────────────────────────────────────────────
('Hotte cuisine — Nettoyage mensuel',     '1 mois',    'Cuisine', true,
  '["Démonter et dégraisser les filtres à graisse","Nettoyer l''intérieur de la hotte et le plénum","Vérifier le ventilateur (bruit, vibration)","Contrôler le débit d''extraction","Nettoyer les conduits accessibles","Vérifier l''éclairage de la hotte","Remonter et tester le fonctionnement"]'),

-- ── TOITURE ───────────────────────────────────────────────────────────────────
('Toiture — Inspection semestrielle',     '6 mois',    'Bâtiment', true,
  '["Inspecter la membrane d''étanchéité (fissures, décollements)","Contrôler les relevés en pied de mur","Vérifier les évacuations pluviales (déboucher si nécessaire)","Contrôler l''état des solins et joints","Inspecter les lanterneaux et verrières","Vérifier l''état des garde-corps","Dégager la végétation envahissante"]'),

-- ── FAÇADE / ESPACES COMMUNS ──────────────────────────────────────────────────
('Façade et espaces communs — Inspection trimestrielle', '3 mois', 'Bâtiment', true,
  '["Inspecter l''état du ravalement (fissures, éclats)","Vérifier les menuiseries extérieures (joints, fermeture)","Contrôler l''état du parking et des voiries","Vérifier l''éclairage extérieur","Contrôler la signalétique","Inspecter les espaces verts (arrosage, état)"]');

-- ══════════════════════════════════════════════════════════════════════════════
-- Vérification après insertion
-- SELECT categorie, COUNT(*) FROM templates_maintenance GROUP BY categorie ORDER BY categorie;
-- ══════════════════════════════════════════════════════════════════════════════
