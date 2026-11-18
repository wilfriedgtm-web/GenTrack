-- Fix: Cos phi seuil_max → NULL
-- Le seuil_max=1.0 pour le Cos phi est une limite physique théorique (facteur de puissance parfait),
-- pas un seuil opérationnel. Le laisser à 1.0 déclenche de fausses alertes "approche seuil max"
-- pour toute valeur > 0.9 (ce qui est en réalité une excellente performance).
-- Le seuil pertinent est uniquement seuil_min=0.85 (seuil de pénalité EDF).

UPDATE questions
SET seuil_max = NULL
WHERE id = '86ee0fa9-f597-4358-bea7-fb106e9f9987'
  AND texte = 'Facteur de P. (Cos phi)';

-- Vérification :
-- SELECT id, texte, seuil_min, seuil_max FROM questions WHERE id = '86ee0fa9-f597-4358-bea7-fb106e9f9987';
-- Résultat attendu : seuil_max = NULL
