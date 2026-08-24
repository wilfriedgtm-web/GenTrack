# GENTRACK

*Document de Contexte Stratégique*

| **Secteur** | Pilotage des équipements critiques |
| --- | --- |
| **Zone géographique** | Afrique francophone subsaharienne |
| **Siège** | Dakar, Sénégal |
| **Repo GitHub** | wilfriedgtm-web/GenTrack · branche main |
| **Version** | v2.1 — Août 2026 |

# **Sommaire**

1. Ambition, Vision & Mission
2. Brique Produit
3. Architecture Technique
4. Commercial
5. Marketing & Communication
6. Support

---

# **1. Ambition, Vision & Mission**

## **Ambition**

GenTrack a pour ambition de devenir la plateforme opérationnelle de référence pour le pilotage des infrastructures critiques en Afrique francophone — à commencer par les groupes électrogènes — en proposant un outil simple, accessible sur WhatsApp, capable de transformer des données terrain brutes en décisions intelligentes.

Nous croyons que l'Afrique n'a pas besoin d'outils compliqués ou coûteux. Elle a besoin d'outils qui fonctionnent là où elle est : sur le terrain, avec un téléphone, sans technicien informatique.

## **Vision**

Faire de GenTrack la plateforme incontournable du pilotage des opérations industrielles et énergétiques en Afrique subsaharienne.

Dans 5 ans, chaque entreprise gérant des équipements critiques — groupes électrogènes, pompes, véhicules ou climatiseurs — doit avoir accès à GenTrack pour éviter les pannes coûteuses et les pertes liées au manque de visibilité opérationnelle.

## **Mission**

Aider les entreprises africaines à prendre de meilleures décisions grâce à une visibilité en temps réel sur leurs équipements critiques.

Nous y parvenons en collectant automatiquement les données terrain via WhatsApp, en les analysant intelligemment, et en les restituant sous forme de tableaux de bord clairs et d'alertes proactives — sans complexité technique pour l'utilisateur.

## **Nos valeurs fondatrices**

- Simplicité radicale — si un gardien sans formation peut l'utiliser, c'est réussi.
- Proximité terrain — nous concevons avec et pour les opérateurs africains.
- Fiabilité avant tout — une alerte manquée peut coûter des millions.
- Impact mesurable — chaque client doit pouvoir chiffrer ce que GenTrack lui a économisé.

---

# **2. Brique Produit**

## **Concept central**

GenTrack est une solution SaaS de gestion opérationnelle des équipements critiques, accessible via WhatsApp pour la collecte terrain et via un dashboard web pour le pilotage. Elle s'adresse aux entreprises disposant d'équipements critiques (groupes électrogènes, cuves, chambres froides, etc.) et constitue une mini-GMAO accessible sans formation.

## **Ce que fait concrètement GenTrack — V2 (Août 2026)**

### **Bot WhatsApp technicien — collecte terrain**

Le technicien envoie des messages WhatsApp simples. Le bot guide chaque action pas à pas.

**Commandes disponibles :**

| Commande | Action |
| --- | --- |
| `saisie` | Lance la ronde terrain — le bot demande les valeurs équipement par équipement (compteur horaire, niveau huile, température, état général). Supporte rondes journalières, hebdomadaires et mensuelles. Plusieurs rondes par jour autorisées. |
| `panne` | Signale une panne urgente — sélection équipement → type de panne → description → crée automatiquement un signalement dans la base et notifie le responsable technique via WhatsApp |
| `resolu` | Clôture un signalement ouvert — sélection du signalement → note de résolution → intervenant → coût → crée une fiche maintenance dans l'historique |
| `plein` | Déclare un ravitaillement carburant — litres ajoutés → opérateur → calcul automatique du niveau et de l'autonomie → enregistrement dans l'historique pleins + maintenance |
| `vidange` | Déclare une vidange groupe électrogène — sélection GE → intervenant → enregistrement avec compteur horaire |
| `rapport` | Génère et envoie le rapport de la dernière ronde (tous équipements, toutes réponses, anomalies, recommandations) |
| `aide` | Affiche les commandes disponibles |

**Logique de ronde :**
- Bot adaptatif : propose uniquement les rondes non encore faites sur la période (journalier/hebdo/mensuel)
- Si plusieurs rondes disponibles, propose le choix
- Si relevé horaire configuré, envoie un lien mobile sécurisé (token 8h) pour saisie directe
- À la fin de chaque équipement : récapitulatif → confirmation → option de signaler une anomalie
- Anomalie terrain → signalement créé automatiquement + responsable notifié
- Seuil dépassé → alerte non bloquante envoyée aux destinataires configurés

**Rapport de fin de ronde envoyé automatiquement au responsable :** état de chaque GE, compteurs, niveaux, seuils franchis, recommandations vidange.

### **Relevé horaire — formulaire mobile**

- Page mobile sécurisée par token (lien unique valable 8h, renouvelable)
- Technicien ouvre le lien depuis WhatsApp → remplit les valeurs heure par heure
- Supporte types de réponse : numérique, choix, texte libre
- Alerte automatique si valeur hors seuil
- Observations libres par équipement

### **Signalement QR code — formulaire public**

- Page `signalement.html` accessible via QR code (affiché dans les espaces communs)
- Réception, gardien ou client scanne → sélection équipement → type de problème → description → photo facultative
- Photo uploadée dans Supabase Storage (bucket `gentrack-photos`)
- Signalement créé en base → resp_tech notifié WhatsApp immédiatement

### **Rapport d'intervention — formulaire mobile technicien**

- Page `rapport.html` — lien envoyé au technicien lors de l'affectation d'un signalement
- Technicien saisit : équipement, type intervention, description, pièces remplacées, coût, durée, photo
- Photo uploadée dans Supabase Storage
- Fiche maintenance créée en base

### **Dashboard web — 4 profils**

**Resp. technique (resp_tech) — son site, vue complète :**

- **Accueil** — statut composite des équipements (rouge/orange/vert/jaune/gris selon signalements + rondes + relevés, avec légende couleurs), niveau cuve carburant (%, litres, autonomie en jours), relevés horaires du jour, KPIs alertes actives
- **Alertes** — alertes actives (seuils dépassés, pannes, anomalies) + historique 30j. Chaque alerte de seuil propose "+ Signalement" (pré-rempli, résolution automatique de l'alerte à la création)
- **Signalements** — liste filtrée (ouverts / en cours / résolus), détail complet (description, équipement, photos, note résolution, coût), affecter à un technicien avec lien WA, clôturer, créer manuellement. Résolution d'une panne → création automatique d'une fiche maintenance
- **Maintenance** — journal unifié chronologique : pannes résolues, vidanges, ravitaillements, interventions techniques. Filtres par type. Vue via `vue_journal_maintenance`
- **Relevés** — historique relevés horaires, détail par créneau
- **Rondes** — journal des rondes, détail complet par équipement (toutes réponses)
- **Config** — gestion équipements (actif/inactif ronde/relevé, seuils, conso, capacité, kVA), questions par équipement, contacts WhatsApp, QR code signalement, affiche signalement imprimable, affiche bot WhatsApp imprimable, planning rondes (jour/fréquence), rapport hebdomadaire

**Directeur technique (dir_tech) — multi-sites :**

- Vue consolidée tous ses sites : pannes actives, rondes, signalements, maintenances, indicateurs carburant
- Rapport PDF exportable (bouton Imprimer)

**Directeur opérations (dir_ops) :**

- Vue synthétique tous sites — KPIs clés, alertes, consommations

**Admin (admin.html — Wilfried uniquement) :**

- Gestion complète clients / sites / équipements / contacts / tokens d'accès

### **Alertes automatiques**

- Carburant bas (< 40% attention, < 20% critique) → resp_tech + dir_tech via WhatsApp
- Vidange imminente (< 20h restantes selon compteur) → resp_tech
- Rappel ronde quotidien si ronde non faite → technicien
- Rapport hebdomadaire automatique (chaque lundi) → resp_tech + dir_tech
- Seuil relevé dépassé → destinataires configurés par équipement
- Panne signalée → resp_tech immédiatement

### **Affiches imprimables (nouveau)**

- **Affiche signalement** — poster A4 avec QR code par site, 3 étapes illustrées, imprimable PDF, accessible depuis Config
- **Affiche bot WhatsApp** — poster illustré pour les techniciens avec les 5 commandes (flux chat illustrés, grille des commandes rapides, conseils), téléchargeable par resp_tech

---

## **Roadmap produit**

### **Court terme — Q4 2026 (Oct–Nov)**

- **Configuration Pullman Dakar** — après réception fiche collecte de Ndiaga Diouf : 2 GE SDMO 1 400 kVA, cuve 8 725 L, 3 chambres froides, groupe eau glacée. Objectif : pilote opérationnel avant fin octobre
- **Rondes multiples par jour (shifts)** — commandes `saisie 2` (2ème shift) disponibles, plusieurs rondes/jour déjà supportées en base, à affiner UX bot
- **Export PDF rapports** — rapport mensuel exportable depuis le dashboard client
- **Seen Abidjan contacts** — configurer les numéros WhatsApp des techniciens Seen pour activer leurs rondes

### **Moyen terme — Nov–Déc 2026**

- **WhatsApp production** — avant le premier client payant : créer compte Facebook Business Manager → soumettre numéro dédié à Meta → passer à 360dialog (~50$/mois) pour lever les limites sandbox Twilio
- **Bons de travaux (BT)** — module complet : création manuelle ou automatique depuis panne/signalement, assignation, statuts, durée, coût, historique par équipement
- **Suivi consommations** — électricité (kWh), eau (m³), fioul. Courbes, comparatifs mois/mois, estimations coût

### **Long terme (2027)**

- Extension à d'autres équipements : pompes, véhicules de flotte, climatiseurs industriels
- Intelligence artificielle : prédiction de pannes et recommandations proactives
- API ouverte pour intégration avec les ERPs existants (SAP, Sage, etc.)

---

# **3. Architecture Technique**

## **Stack globale**

| **Composant** | **Technologie & détails** |
| --- | --- |
| **Frontend** | Vercel — HTML vanilla + JS, pas de framework |
| **Base de données** | Supabase (PostgreSQL) — auth, storage, realtime |
| **Bot WhatsApp** | Twilio sandbox + Edge Functions Supabase (Deno / TypeScript) |
| **Stockage fichiers** | Supabase Storage — bucket `gentrack-photos` (public) |
| **Repo & CI/CD** | GitHub wilfriedgtm-web/GenTrack · branche main = prod |
| **Fonctions serverless** | Edge Functions Supabase (Deno runtime) |

## **Fichiers frontend**

| **Fichier** | **Rôle** |
| --- | --- |
| `dashboard.html` | Dashboard principal — tous rôles (resp_tech, dir_tech, dir_ops) via token |
| `admin.html` | Dashboard admin Wilfried — gestion complète clients/sites/équipements |
| `signalement.html` | Formulaire mobile signalement QR code — public, sans auth |
| `rapport.html` | Formulaire mobile rapport d'intervention — accès par lien |
| `releve.html` | Formulaire mobile relevé horaire — accès par token 8h |
| `affiche-signalement.html` | Affiche imprimable A4 QR code signalement par site |
| `affiche-bot.html` | Affiche imprimable guide bot WhatsApp technicien |

## **Tables Supabase — Système actif**

| **Table** | **Description** |
| --- | --- |
| `clients` | Nom, pays, couleur_marque |
| `sites` | Rattachés à un client — ville, pays, heure_rappel, jour_hebdo, jour_mensuel, journalier_actif, hebdo_actif, mensuel_actif, releve_horaire_actif |
| `types_equipements` | Catalogue des types : GE, cuve, chambre froide, GEG, etc. |
| `equipements` | Rattachés à un site — type, nom, actif, actif_ronde, actif_releve, ordre_ronde, conso_theorique_lh, capacite_litres, seuil_vidange_heures, prix_litre |
| `questions` | Questions configurées par équipement — texte, type_reponse, ordre, frequences, seuil_min, seuil_max, options, alerte_severite, alerte_canal |
| `rondes` | Une ronde = une visite terrain — date_ronde, technicien_id, site_id, frequence |
| `rondes_equipements` | Lien ronde / équipement — statut (en_cours / valide), valide_at |
| `reponses` | Réponses aux questions — valeur, ronde_equipement_id, releve_id |
| `anomalies` | Anomalies signalées en cours de ronde |
| `signalements` | Incidents — type, description, statut, source, photo_url, assigne_a, resolved_by, cout_intervention |
| `maintenances` | Historique interventions — type, statut, date, coût, quantité, unité, photo_url |
| `pleins` | Historique ravitaillements carburant — litres, niveau_apres, coût, opérateur |
| `vidanges` | Historique vidanges GE — heures_au_moment, intervenant |
| `alertes` | Alertes actives par site |
| `contacts` | Contacts WhatsApp par site — rôle, actif |
| `tokens` | Liens d'accès dashboard — rôle, site_ids, expire_at |
| `sessions` | État conversationnel du bot WhatsApp |
| `releves_horaires` | Sessions de relevé horaire — token, site_id, statut, expires_at |
| `alertes_destinataires` | Destinataires personnalisés par équipement pour alertes seuil |

## **Vues SQL**

| **Vue** | **Description** |
| --- | --- |
| `vue_statut_equipements` | Statut composite par équipement : priorité rouge (signalement ouvert/en_cours) > orange (résolu <48h, période surveillance) > vert (ronde validée aujourd'hui) > jaune (relevé récent <24h) > gris |
| `vue_journal_maintenance` | Journal unifié : UNION ALL de signalements résolus + vidanges + pleins + maintenances. Colonnes communes : id, type, titre, description, date_ref, equipement_id/nom, cout, statut, intervenant, source |

## **État des clients — Août 2026**

| **Client** | **Sites** | **Statut** |
| --- | --- | --- |
| **Mangalis** | Noom Abidjan | Équipements + questions configurés (eau, électricité, ECS). GE en attente infos client. Prêt pour démarrage rondes. |
| **Mangalis** | Seen Abidjan | Compte créé — contacts WhatsApp à configurer |
| **Azalaï Dakar** | Azalaï Hotel Dakar | En production — G1, G2, Cuve actifs |
| **Pullman Dakar Teranga** | Pullman Dakar (Accor) | Démo faite — accord pilote — compte nettoyé, prêt pour config réelle |

## **Edge Functions Supabase**

### **webhook (v77)**

Bot WhatsApp principal, déclenché par Twilio à chaque message entrant.

- Rondes structurées multi-fréquences (journalier / hebdo / mensuel / relevé horaire)
- Filtrage équipements par `actif_ronde` et `actif_releve`
- Panne → signalement + alerte resp_tech
- Résolu → patch signalement + création fiche maintenance
- Plein → pleins + maintenances (type ravitaillement) + mise à jour niveau
- Vidange → table vidanges
- Anomalie ronde → signalement automatique
- Seuils dépassés → alertes non bloquantes vers destinataires configurés
- Rapport de fin de ronde envoyé au technicien + resp_tech

### **rappel (v6)**

Cron horaire. Chaque site reçoit son rappel à l'heure UTC configurée.

- Alerte autonomie carburant (< 40% / < 20%)
- Alerte vidange imminente (< 20h)
- Rappel ronde si non complète

### **rapport-hebdo (v6)**

Cron chaque lundi 8h UTC. Bilan semaine → resp_tech + dir_tech.

## **Accès dashboard par rôle**

| **Rôle token** | **Accès** |
| --- | --- |
| `resp_tech` | Son site — tous onglets (Accueil, Signalements, Historique, Relevés, Rondes, Config) |
| `dir_tech` | Ses sites — vue consolidée Opérations + Technique |
| `dir_ops` | Tous sites — vue synthétique Opérations |

---

# **4. Commercial**

## **Cibles prioritaires**

### **Segment 1 — Hôtellerie & hospitality**

- Hôtels, lodges, restaurants haut de gamme
- Groupes hôteliers panafricains (Accor / Pullman, Radisson, Azalaï, Mangalis)

### **Segment 2 — PME & ETI avec besoins énergétiques critiques**

- Cliniques, hôpitaux privés
- Entrepôts logistiques et froids
- Télécommunications (antennes relais)

### **Segment 3 — Distributeurs & revendeurs**

- Revendeurs Cummins, Perkins, SDMO, Kohler en Afrique de l'Ouest
- Sociétés de maintenance et dépannage électrique

## **Modèle de revenus**

### **Abonnement SaaS mensuel**

**Starter :** 1 à 3 équipements — accès bot + dashboard — Prix cible : 25 000 – 45 000 FCFA/mois

**Business :** 4 à 10 équipements — alertes avancées + multi-sites — Prix cible : 70 000 – 120 000 FCFA/mois

**Enterprise :** 10+ équipements — API + rapports personnalisés — Tarification sur mesure

### **Revenus annexes**

- Frais d'intégration et d'onboarding (setup)
- Formation des équipes terrain
- Rapports et audits énergétiques sur demande

## **Prospects actifs — Août 2026**

| **Prospect** | **Contact** | **Statut** | **Notes** |
| --- | --- | --- | --- |
| **Pullman Dakar Teranga** (Accor 5★) | M. Ndiaga Diouf — Adjoint RT — +221 78 620 07 10 | Accord pilote ✅ — démo faite 04/08 | 2 GE SDMO 1 400 kVA, cuve 8 725 L, 3 CF, GEG. Compte prêt pour config réelle. |
| **Azalaï Dakar** | M. Modeste | Démo prévue | Compte actif en production, démo à venir |

## **Profil client hôtelier — enseignements Pullman Dakar**

- Rondes multiples par jour (toutes les 2-3h) — GenTrack supporte ✅
- Équipes structurées avec GMAO existante (Itis + Maintenance Hotel) — GenTrack complète sans remplacer
- Chambres froides et groupe eau glacée = équipements clés à côté des GE
- Sensibles au professionnalisme de l'outil et à la simplicité d'onboarding
- Groupe Accor = potentiel de déploiement multi-sites en cas de satisfaction pilote

## **Argumentaire commercial clé**

- Un groupe en panne coûte entre 500 000 et 2 000 000 FCFA — GenTrack l'évite.
- La visibilité en temps réel réduit les vols de carburant (problème majeur des sites non surveillés).
- ROI moyen estimé : 3 à 6 mois d'abonnement suffisent à rembourser un sinistre évité.
- Aucune formation informatique requise — le gardien envoie des messages, le patron reçoit les rapports.

---

# **5. Marketing & Communication**

## **Positionnement**

GenTrack se positionne comme le copilote opérationnel des entreprises africaines — pas un ERP complexe, pas une solution importée inadaptée, mais une plateforme pensée pour fonctionner là où l'Afrique est : sur le terrain, avec WhatsApp, aujourd'hui.

Ligne directrice : *"Vos équipements parlent. Enfin, vous les entendez."*

## **Canaux prioritaires**

- **LinkedIn** — publications hebdomadaires : études de cas, chiffres terrain, conseils maintenance
- **WhatsApp Business** — démo en direct via le bot GenTrack
- **Landing page** — formulaire démo (Tally), témoignages clients, CTA clair

---

# **6. Support**

## **Philosophie**

Répondre en moins de 4h en semaine, toujours en français, toujours avec une solution concrète.

## **Processus d'onboarding**

**Étape 1 — Activation (J0)**
- Création du compte dans admin.html : site, équipements avec questions configurées, contacts WhatsApp
- Configuration seuils d'alerte personnalisés

**Étape 2 — Formation terrain (J1 à J3)**
- Envoi affiche bot WhatsApp (téléchargeable depuis dashboard)
- Test bot WhatsApp avec le technicien en direct (commande `aide` puis `saisie`)
- Première ronde validée avec le responsable

**Étape 3 — Suivi post-lancement (J7, J30)**
- Check-in J7 : tout fonctionne ?
- Revue J30 : alertes déclenchées, rondes effectuées, valeur générée
- Proposition d'upgrade si quota dépassé

## **KPIs support**

- Temps de réponse moyen : < 4h en semaine
- Taux de résolution premier contact : > 80%
- NPS client : Objectif > 50 à fin 2026
- Taux de churn mensuel : < 3%
- Taux d'activation J30 : > 90% des clients font au moins 20 rondes

---

# **7. Récapitulatif de session — Août 2026**

## **Ce qui a été livré dans cette session**

### **Bot WhatsApp — refonte complète (webhook v77)**

- Rondes multi-fréquences indépendantes (journalier / hebdo / mensuel) avec détection automatique de ce qui reste à faire
- Relevé horaire : génération d'un lien mobile sécurisé par token (8h), renouvelable
- `panne` → écrit dans `signalements` (plus dans `pannes`) + notifie resp_tech
- `resolu` → patch signalement + création fiche `maintenances`
- `plein` → enregistrement `pleins` + `maintenances` (type ravitaillement) + calcul niveau automatique
- Anomalie ronde → signalement automatique créé en base
- Seuil dépassé → alerte non bloquante envoyée aux destinataires configurés
- Calculs cuve identiques au dashboard (%, autonomie en jours)
- Rapport de ronde complet envoyé technicien + resp_tech à chaque fin de ronde
- Filtrage équipements par `actif_ronde` et `actif_releve`

### **Dashboard — nouvelles fonctionnalités**

- **Photos signalements** : upload réel vers Supabase Storage depuis `signalement.html`, affichage + téléchargement dans le modal détail (fix bug select query `photo_url` manquant)
- **Photos maintenances** : upload réel depuis `rapport.html`, affichage + téléchargement dans les cartes historique (resp_tech + dir_tech)
- **Suivi vidanges** par compteur cumulé (modal déclarer, historique, prochaine vidange estimée)
- **Suivi pleins** carburant (historique, coût, niveau recalculé)
- **Rapport hebdomadaire** resp_tech générable depuis le dashboard
- **Dashboard dir_tech amélioré** — vue consolidée multi-sites, rapport PDF style cohérent
- **Config équipements** enrichie : champs conso, capacité, kVA, seuil vidange, prix litre
- **Planning rondes** : toggle journalier/hebdo/mensuel + jour configurable par site
- **Toggles actif_ronde / actif_releve** par équipement dans la config

### **Affiches imprimables (nouvelles pages)**

- `affiche-signalement.html` — poster A4 avec QR code dynamique par site, 3 étapes illustrées, bouton Imprimer/PDF, accessible depuis Config > QR Code
- `affiche-bot.html` — poster guide bot WhatsApp technicien avec 5 commandes illustrées (flux chat), grille commandes rapides, conseils, accessible depuis le menu + panel

### **DB — migrations appliquées**

- `actif_ronde` + `actif_releve` sur `equipements`
- `jour_hebdo` + `jour_mensuel` sur `sites`
- `photo_url` sur `maintenances`
- `price_litre` sur `equipements`
- Table `pleins` : id, equipement_id, site_id, date, litres_ajoutes, niveau_apres, cout, operateur
- Table `vidanges` : id, site_id, equipement_id, date, heures_au_moment, intervenant
- Bucket Supabase Storage `gentrack-photos` (public)
- Questions templates hebdo/mensuel GE

### **Compte Pullman Dakar — nettoyé pour démo**

- Toutes les données de test supprimées (rondes, réponses, signalements, maintenances, pleins, alertes, relevés)
- Compte vierge, prêt pour la configuration réelle avec les équipements de Ndiaga Diouf

---

## **Ce qui a été livré — Session 2 (Août 2026)**

### **Statut équipements composite — dashboard accueil**

- Le statut de chaque équipement est maintenant calculé en combinant les 3 sources : rondes, relevés horaires et signalements
- Priorité : 🔴 rouge (signalement ouvert/en_cours) > 🟠 orange (signalement résolu depuis <48h, surveillance) > 🟢 vert (ronde validée aujourd'hui) > 🟡 jaune (relevé récent <24h) > ⚫ gris (aucune donnée)
- Vue SQL `vue_statut_equipements` créée (3 CTEs : sig, ronde_ok, releve_eq via reponses→questions)
- Légende couleurs ajoutée sur l'accueil
- Relevés horaires du jour affichés dans "Ma journée"

### **Journal maintenance unifié — onglet Maintenance**

- L'onglet Maintenance est devenu un journal chronologique complet : pannes résolues, vidanges, ravitaillements, interventions techniques
- Vue SQL `vue_journal_maintenance` créée (UNION ALL des 4 sources)
- Filtres par type : tous / panne / vidange / ravitaillement / maintenance
- Séparation claire des onglets : Alertes (à traiter) / Signalements (historique incidents) / Maintenance (journal financier)

### **Auto-création maintenance à la résolution d'une panne**

- Quand un signalement de type panne est résolu depuis le dashboard, une fiche maintenance est automatiquement créée dans le journal

### **Bouton "+ Signalement" depuis les alertes**

- Dans le tab Alertes, chaque alerte de seuil (valeur hors plage) affiche un bouton "+ Signalement"
- Le modal s'ouvre pré-rempli avec le message de l'alerte
- À la création du signalement, l'alerte est automatiquement marquée résolue

### **Fix relevé horaire — double envoi**

- Problème : premier envoi échouait, second fonctionnait (création de doublons en base)
- Correction DB : contrainte `UNIQUE(releve_id, question_id)` ajoutée sur `reponses` (après nettoyage des doublons existants)
- Correction code : `supaPost` remplacé par `supaUpsert` avec `resolution=ignore-duplicates` dans `releve.html`

### **Noom Abidjan — configuration initiale**

- Équipements créés à partir des fichiers Excel fournis : eau froide, eau chaude (ECS), électricité par réseau/compteur
- Questions configurées pour rondes et relevés horaires (valeurs, seuils, fréquences)
- GE non configurés — en attente infos client (nombre, marque/puissance, compteur horaire, intervalle vidange)
- Willo ajouté comme resp_tech et tech pour tests (retiré des hôtels Madame T)
- Données de test nettoyées après validation (rondes, relevés, signalements, alertes, maintenances)

### **DB — migrations appliquées**

- Vue `vue_statut_equipements`
- Vue `vue_journal_maintenance`
- Contrainte `UNIQUE(releve_id, question_id)` sur `reponses`

---

---

## **Ce qui a été livré — Session 3 (Août 2026)**

### **Notifications WhatsApp signalements — refonte complète**

- Colonne `notif_signalement` (boolean, default false) ajoutée sur la table `contacts` — n'importe quel rôle peut recevoir les notifications, indépendamment du rôle
- Edge Function `notify-signalement` v6 : filtre sur `notif_signalement=true` (plus de filtre par rôle), photo incluse en lien texte (`📷 Photo : <url>`), lien rapport REF (`📌 Réf : *REF-XXXX* / Répondez *OK REF-XXXX* pour prendre en charge`), lien dashboard pour resp_tech et dir_tech uniquement
- Dashboard Config contacts : badge "📲 Signalements" visible, checkbox dans l'ajout/édition d'un contact
- `signalement.html` : changé `Prefer: return=minimal` → `return=representation` pour récupérer le `ref_code` après INSERT ; payload notify enrichi avec `ref_code`, `photo_url`, `signalement_id`

### **Bot WhatsApp — nouvelles commandes (webhook v86)**

- **`OK REF-XXXX`** : prise en charge d'un signalement par le technicien — regex flexible (case insensitive, avec ou sans tiret/espace), met à jour `pris_en_charge_par` + `pris_en_charge_at` + `statut=en_cours`, notifie les contacts `notif_signalement=true`, reset session idle
- **`resolu`** : normalisation accents (résolu / Résolu / RESOLU / resolut → même traitement), cherche un signalement `en_cours` avec `pris_en_charge_par = nom du technicien`, envoie directement le lien `rapport.html?sg=<id>` sans étapes intermédiaires
- APP_URL corrigé (`https://gen-track.vercel.app`) dans webhook et notify-signalement
- Session reset to idle systématique après OK REF processing

### **Dashboard — cartes signalements enrichies**

- `ref_code` affiché sur chaque carte (badge gris)
- `pris_en_charge_par` affiché (badge vert "✅ Pris en charge par X"), fallback sur `assigne_a` (badge amber "👷 Affecté à X")
- Durée intervention : champ valeur + sélecteur unité (heures / minutes / jours) dans le modal maintenance et dans `rapport.html`
- `duree_valeur` + `duree_unite` écrits dans la table `maintenances`

### **Dashboard — UX navigation alertes**

- Bandeau "🚨 X alertes actives" sur l'accueil → cliquable, scroll smooth vers la section alertes de la même page
- Carte panne sur l'accueil → cliquable, bascule sur l'onglet Signalements, scroll + flash doré vers la carte du signalement concerné
- `id="sg-card-<id>"` ajouté sur chaque carte signalement (resp_tech + dir_tech)
- Bouton "✓ Résolu" conservé avec `event.stopPropagation()` pour ne pas déclencher la navigation

### **Affiche bot — mise à jour**

- Section "Prise en charge" ajoutée : explication du flux `OK REF-XXXX`, exemple de notification reçue, notification envoyée après prise en charge

### **DB — migrations appliquées**

- `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notif_signalement boolean NOT NULL DEFAULT false`
- Willo ajouté comme technicien chez Madame T Dakar avec `notif_signalement=true`, `whatsapp=+33658150628`
- Ancien contact Willo resp_tech : `whatsapp` mis à NULL (contact conservé car référencé dans rondes)

### **Versions Edge Functions**

| Fonction | Version | Changement principal |
| --- | --- | --- |
| `webhook` | v86 | Normalisation accents résolu, regex OK REF flexible, prise en charge bot |
| `notify-signalement` | v6 | Photo lien texte, filtre notif_signalement, APP_URL correct, lien dashboard managers |

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
