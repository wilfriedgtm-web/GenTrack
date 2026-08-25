**GENTRACK**

*Document de Contexte Stratégique*

| **Secteur** | Pilotage des équipements critiques |
| --- | --- |
| **Zone géographique** | Afrique francophone subsaharienne |
| **Siège** | Dakar, Sénégal |
| **Repo GitHub** | wilfriedgtm-web/GenTrack · branche main |
| **Version** | v2.0 — Août 2026 |

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

GenTrack est une solution SaaS de gestion opérationnelle des équipements critiques, accessible via WhatsApp pour la collecte terrain et via un dashboard web pour le pilotage. Elle s'adresse aux entreprises disposant d'au moins un groupe électrogène, et s'étendra progressivement à d'autres équipements critiques.

## **Fonctionnalités actuelles (MVP en production)**

### **Collecte terrain via WhatsApp**

- Bot WhatsApp guidé : le technicien répond à des questions simples (compteur horaire, niveau huile, niveau carburant, incidents)
- Rondes structurées par équipement, avec questions configurables par type d'équipement
- Confirmation automatique de la ronde avec résumé
- Rapport quotidien automatique envoyé au responsable
- Gestion des pannes, vidanges et ravitaillements carburant

### **Dashboard web de pilotage**

- Dashboard admin (admin-v3.html) — vue consolidée pour Wilfried, gestion complète des clients, sites, équipements et contacts
- Dashboard client (client.html) — lien partagé aux hôtels, accès par rôle via token
- Journal des rondes cliquable — détail complet par équipement (toutes réponses, alertes seuils)
- Toggles actif/inactif par équipement — contrôle de ce qui s'affiche sur le dashboard client
- Génération de liens d'accès par rôle (dir_ops, dir_tech, resp_tech)

### **Alertes intelligentes**

- Alerte carburant : notification dès qu'un seuil d'autonomie critique est atteint
- Alerte maintenance : rappel vidange basé sur les heures moteur cumulées
- Alerte anomalie : détection d'une surconsommation ou sous-utilisation

## **Vision produit étendue — Mini-GMAO WhatsApp**

À mesure que GenTrack gagne des clients hôteliers et industriels, le produit évolue naturellement vers une mini-GMAO (Gestion de Maintenance Assistée par Ordinateur) accessible via WhatsApp — sans les complexités et coûts d'un GMAO classique.

### **4 profils utilisateurs**

| **Profil** | **Interface** | **Rôle** |
| --- | --- | --- |
| **Technicien** | WhatsApp uniquement | Saisie rondes, signalement pannes, BT terrain |
| **Réception** | WhatsApp uniquement | Signalement incidents chambres/espaces communs |
| **Resp. technique** | WhatsApp + Dashboard | Gestion BT, validation rondes, suivi équipements |
| **Directeur** | Dashboard uniquement | Vue consolidée, consommations, coûts, KPIs |

### **5 modules dashboard**

1. **Opérations** — suivi temps réel des équipements, rondes du jour, statuts
2. **Consommations** — électricité (kWh), eau (m³), carburant (L) — courbes + estimations
3. **Maintenance / Bons de travaux** — BT ouverts, historique, coûts, délais d'intervention
4. **Incidents** — signalements réception + techniciens, traçabilité complète
5. **Équipements** — fiche technique, historique pannes/vidanges, marque/référence/série

### **Flux bot étendu (futur)**

- Technicien : `saisie`, `saisie 2`, `saisie semaine`, `saisie mois`, `saisie autre`, `panne`, `vidange`, `ravitaillement`, `aide`
- Réception : `signalement` → description → localisation → photo → BT créé automatiquement
- Resp. tech. : `rapport` → résumé du jour envoyé par message

## **Roadmap produit**

### **Court terme — Q4 2026 (Oct–Nov)**

- **Rondes complètes** — permettre d'ajouter facilement tous les équipements demandés par le client (plus limité à 3 équipements en démo). Admin : ajout rapide avec marque/référence, ordre de ronde, fréquences. Objectif : Pullman Dakar avec 7 équipements réels opérationnel
- **Types de saisie multiples** — implémenter dans le webhook les commandes `saisie 2` (2ème shift), `saisie semaine` (ronde hebdo — questions avec `frequences=['hebdo']`), `saisie mois` (ronde mensuelle), `saisie autre` (inspection libre). Une commande = une nouvelle ronde. Plusieurs rondes/jour = normal et supporté
- **Commande `aide`** — le bot répond avec la liste des commandes disponibles selon le rôle du technicien. Toujours disponible, même en cours de ronde
- **Configuration Pullman Dakar** — après réception fiche collecte de Ndiaga Diouf : 2 GE SDMO 1 400 kVA, cuve 8 725 L, 3 chambres froides, groupe eau glacée
- **Seen Abidjan** — activer les contacts WhatsApp techniciens
- **Export PDF** — rapport mensuel exportable depuis le dashboard client

### **Moyen terme — Nov–Déc 2026**

- **Signalements réception** — nouvelle commande `signalement` pour les non-techniciens (réceptionnistes, gardiens). Description libre + localisation + photo facultative → incident créé dans la base → resp_tech notifié → BT généré automatiquement
- **Bons de travaux (BT)** — module complet : création manuelle ou automatique depuis panne/signalement, assignation technicien, statuts (ouvert / en cours / terminé), durée et coût, historique par équipement
- **Suivi consommations** — saisie mensuelle ou hebdo électricité (kWh relevé compteur), eau (m³), fioul consommé. Dashboard avec courbes, comparatifs mois/mois, estimations coût
- **WhatsApp production** — avant le premier client payant : créer compte Facebook Business Manager → soumettre numéro dédié à Meta → passer à 360dialog (~50$/mois) pour lever les limites sandbox Twilio (pas d'opt-in forcé, numéro propre GenTrack, SLA)

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
| **Bot WhatsApp** | Twilio + Edge Functions Supabase (Deno / TypeScript) — numéro production +19843418695 |
| **Repo & CI/CD** | GitHub wilfriedgtm-web/GenTrack · branche main = prod |
| **Fonctions serverless** | Edge Functions Supabase (Deno runtime) |

## **Fichiers frontend**

| **Fichier** | **Rôle** |
| --- | --- |
| **admin-v3.html** | Dashboard admin — interface principale de pilotage (Wilfried) |
| **client.html** | Dashboard client — lien partagé aux hôtels, accès par rôle via token |

## **Tables Supabase — Nouveau système (actif)**

| **Table** | **Description** |
| --- | --- |
| **clients** | Nom, pays, couleur_marque |
| **sites** | Rattachés à un client — ville, pays |
| **types_equipements** | Catalogue des types : GE, cuve, chambre froide, GEG, etc. — avec icône et code |
| **equipements** | Rattachés à un site — type, nom, actif, ordre_ronde, conso_theorique_lh, capacite_litres, seuil_vidange_heures |
| **questions** | Questions configurées par équipement — texte, type_reponse (numérique / choix), ordre |
| **rondes** | Une ronde = une visite terrain par un technicien — date_ronde, technicien_id, site_id |
| **rondes_equipements** | Lien entre une ronde et chaque équipement inspecté |
| **reponses** | Réponses aux questions pour chaque ronde_equipement |
| **contacts** | Rattachés à client + site — rôle (technicien / resp_tech), whatsapp, actif |
| **tokens** | Liens d'accès dashboard — rôle (dir_ops / dir_tech / resp_tech), site_ids (JSON), expire_at |
| **alertes** | Alertes actives par client |
| **pannes** | Incidents signalés — résolution et coût associé |
| **vidanges** | Historique des vidanges par équipement |
| **signalements** | Incidents signalés par réception/gardiens — type, description, lieu, statut, ref_code, assigne_a, pris_en_charge_at |

## **Tables Supabase — Ancien système (désactivé)**

Ces tables existent encore en base pour conserver l'historique mais ne sont plus utilisées nulle part.

| **Table** | **Statut** |
| --- | --- |
| **groupes** | Plus utilisé — remplacé par `equipements` |
| **cuves** | Plus utilisé — remplacé par `equipements` avec `capacite_litres` |
| **saisies** | Données historiques conservées — plus alimentées |
| **saisies_cuve** | Données historiques conservées — plus alimentées |

## **État des clients — Août 2026**

| **Client** | **Sites** | **Système** | **Statut** |
| --- | --- | --- | --- |
| **Mangalis** | Noom Abidjan, Seen Abidjan, Noom Sea Plaza | Nouveau ✅ | En production — rondes actives. Noom Sea Plaza configuré (équipements + questions), contacts à ajouter après appel Kha Lo |
| **Azalaï Dakar** | Azalaï Hotel Dakar | Nouveau ✅ | Migré — G1, G2, Cuve carburant actifs. Signalements activés |
| **Pullman Dakar Teranga** | Pullman Dakar (Accor) | Nouveau ✅ | Prospect actif — démo 04/08/2026, accord de principe pilote. Guides opérateurs livrés |
| **ONOMO** | — | — | Supprimé (prospect inactif) |

## **Edge Functions Supabase**

### **webhook (v89)**

Bot WhatsApp principal, déclenché par Twilio à chaque message entrant. Numéro production : +19843418695.

- Identification du contact entrant et routage par rôle
- Rondes structurées : questions par équipement, réponses enregistrées dans `reponses`
- Pannes, résolu et vidange 100% sur nouveau système (`equipements`) — plus de dépendance à `groupes`
- Filtrage des équipements par site_id du technicien
- Notifications pannes vers resp_tech/dir_tech via table `contacts`
- Commande `signalement` : réception/gardiens signalent un incident libre (type, description, lieu) → créé dans `signalements` → ref_code généré → resp_tech notifié WhatsApp

### **rappel (v19)**

Cron horaire (toutes les heures). Chaque site reçoit son rappel à son `heure_rappel` UTC configurée en base (défaut : 8h UTC = 9h Dakar). Configurable par site depuis l'admin.

- Alertes autonomie carburant (< 40% attention, < 20% critique) → resp_tech + dir_tech
- Alertes vidange imminente (< 20h restantes) → resp_tech
- Rappel ronde du jour aux techniciens si la ronde n'est pas encore complète
- **Rate limiting** : alertes `critique` max toutes les 6h (`heureUTC % 6 === 0`), `attention` max toutes les 12h (`heureUTC % 12 === 0`) — évite le spam
- Tout sur le nouveau système (equipements / rondes / reponses)

### **rapport-hebdo (v11)**

Cron hebdomadaire déclenché chaque lundi à 8h UTC. Tout sur le nouveau système.

- Bilan de la semaine envoyé aux resp_tech et dir_tech par site
- Heures de marche GE, niveau huile, alerte vidange, niveau cuve, autonomie estimée, taux de saisie, pannes

### **notify-signalement (v8)**

Déclenchée à chaque nouveau signalement créé via le bot ou le dashboard.

- Notifie le resp_tech du site par WhatsApp avec type, lieu, description et ref_code
- Permet au resp_tech de répondre "OK REF-XXXX" pour prise en charge

### **notify-ravitaillement**

Appelée depuis le dashboard web pour notifier l'équipe lors d'un ravitaillement saisi manuellement.

### **send-message**

Utilitaire d'envoi WhatsApp ponctuel, utilisé par les autres fonctions.

### **notify-new-client**

Déclenchée à la création d'un client — envoie les messages de bienvenue à l'équipe terrain.

## **Accès dashboard par rôle**

| **Rôle token** | **Accès & périmètre** |
| --- | --- |
| **dir_ops** | Vue consolidée tous les sites — onglet Opérations uniquement |
| **dir_tech** | Ses sites définis dans site_ids du token — onglets Opérations + Technique |
| **resp_tech** | Son site unique — onglets Opérations + Technique |

## **Ce qui est en production et stable — V1 complète**

- Dashboard admin avec gestion complète sites / équipements / contacts / tokens / heure de rappel
- Dashboard client multi-rôle — nouveau système uniquement (rondes / réponses) — journal avec détail cliquable
- Bot WhatsApp — rondes, pannes v2 (équipements), résolu, vidange, ravitaillement
- Rappels quotidiens configurables par site et rapports hebdomadaires automatiques
- Nouveau système 100% opérationnel pour tous les clients actifs
- Pannes signalées via bot remontent dans le dashboard et les rapports

## **Chantiers techniques prioritaires (post-V1)**

- **Seen Abidjan contacts** — configurer les numéros WhatsApp des techniciens Seen pour activer leurs rondes
- **Rondes hebdo/mensuel** — les questions par fréquence sont déjà dans le schéma (`frequences` sur questions), la logique bot et le dashboard supportent les 3 fréquences. À activer client par client selon leurs besoins
- **Export PDF** — rapport mensuel exportable depuis le dashboard client

## **Ce qui a été livré — Juillet 2026**

- ✅ Migration complète tous clients vers nouveau système (equipements / rondes / reponses)
- ✅ `rappel` v6 — alertes autonomie + vidange + rappel ronde — heure configurable par site
- ✅ `rapport-hebdo` v6 — bilan hebdo complet sur nouveau système
- ✅ `heure_rappel` configurable par site depuis l'admin (modal ✏️ sur carte site)
- ✅ Bug G1 Azalaï corrigé (`capacite_litres` retiré — G1 et G2 visibles sur dashboard client)
- ✅ Test en direct validé : rappel WhatsApp envoyé, ronde bot fonctionnelle sur Azalaï
- ✅ Pannes v2 migrées — webhook v64 — panne/résolu/vidange sur `equipements`, notifications vers `contacts`
- ✅ Dashboard client — journal des rondes avec détail complet cliquable (toutes réponses, tous équipements)

## **Ce qui a été livré — Août 2026**

- ✅ Anomalies self-explanatory — `buildAnomaliesNew` affiche désormais `val (attendu : [valeur_attendue])` pour les questions choix, rendant chaque anomalie compréhensible sans contexte
- ✅ Vidange fix — compteur restant calculé depuis la dernière vidange (`compteur - heures_au_moment`), GE1 affiche correctement 0/250h post-vidange
- ✅ Démo Pullman Dakar Teranga (04/08/2026) — première démo groupe hôtelier Accor, accord de principe pilote obtenu avec Ndiaga Diouf (Adjoint RT)
- ✅ **Module Signalements complet** — table `signalements`, commande bot `signalement` (choix type → description → lieu → ref_code auto), edge function `notify-signalement` v8, réponse "OK REF-XXXX" par resp_tech pour prise en charge, dashboard affichage statut + durée
- ✅ **Types d'équipements étendus** — ajout 'Compteur / Énergie' et 'Onduleur / UPS' dans `types_equipements`
- ✅ **Noom Sea Plaza configuré** — site Mangalis créé, 4 équipements insérés (GE, Cuve carburant 1 & 2, Compteur), questions configurées par type, hebdo_actif activé. Contacts en attente appel Kha Lo
- ✅ **Migration numéro WhatsApp production** — abandon sandbox Twilio +14155238886, passage au numéro GenTrack +19843418695. Webhook Twilio WhatsApp Sender configuré. Tous les fichiers (HTML, edge functions) mis à jour
- ✅ **Rate limiting rappels** — alertes critique max toutes les 6h, attention max toutes les 12h — évite le spam sans changement de schéma DB
- ✅ **Guides opérateurs Pullman livrés** — guide-responsable + guide-technicien mis à jour (nouveau numéro, sans sandbox), déployés en production
- ✅ **Codebase propre** — zéro référence à l'ancien sandbox dans tout le code, signalements test Azalaï supprimés, push GitHub + Vercel production à jour

---

# **4. Commercial**

## **Cibles prioritaires**

### **Segment 1 — PME & ETI avec besoins énergétiques critiques**

- Hôtels, lodges, restaurants haut de gamme
- Cliniques, hôpitaux privés
- Entrepôts logistiques et froids
- Télécommunications (antennes relais)

### **Segment 2 — Distributeurs & revendeurs de groupes électrogènes**

- Revendeurs Cummins, Perkins, Sdmo, Kohler en Afrique de l'Ouest
- Sociétés de maintenance et de dépannage électrique

### **Segment 3 — Grandes entreprises & industries**

- Mines, industries extractives, BTP
- Groupes hôteliers panafricains (Radisson, Azalaï, Mangalis)

## **Modèle de revenus**

### **Abonnement SaaS mensuel**

**Starter :** 1 à 3 équipements — accès bot + dashboard — Prix cible : 25 000 – 45 000 FCFA/mois

**Business :** 4 à 10 équipements — alertes avancées + multi-sites — Prix cible : 70 000 – 120 000 FCFA/mois

**Enterprise :** 10+ équipements — API + rapports personnalisés — Tarification sur mesure

### **Revenus annexes**

- Frais d'intégration et d'onboarding (setup)
- Formation des équipes terrain
- Rapports et audits énergétiques sur demande

## **Stratégie de vente**

### **Phase 1 — Validation locale (Q3 2026)**

- Cibler 5 à 10 clients pilotes à Dakar (hôtels, cliniques)
- Démo sur site personnalisée avec un cas concret chiffré
- Offre de démarrage gratuite 30 jours pour lever les freins

**Prospects actifs — Août 2026**

| **Prospect** | **Contact** | **Statut** | **Notes** |
| --- | --- | --- | --- |
| **Pullman Dakar Teranga** (Accor 5★) | Ndiaga Diouf — Adjoint RT — +221 78 620 07 10 | Démo faite 04/08, accord pilote | 2 GE SDMO 1 400 kVA, cuve 8 725 L, 3 CF, GEG. Rondes toutes les 2-3h. GMAO Itis + Maintenance Hotel actuellement. Follow-up 05/08 avant 16h |

**Profil client hôtelier — enseignements Pullman Dakar**

- Rondes multiples par jour (toutes les 2-3h) — GenTrack supporte plusieurs rondes/jour ✅
- Équipes structurées avec GMAO existante — GenTrack complète (saisie terrain) sans remplacer
- Chambres froides et groupe eau glacée = équipements clés à côté des GE
- Sensibles au professionnalisme de l'outil et à la simplicité d'onboarding
- Groupe Accor = potentiel de déploiement multi-sites en cas de satisfaction pilote

### **Phase 2 — Déploiement régional (2027)**

- Partenariats revendeurs en Côte d'Ivoire, Cameroun, Mali
- Programme revendeur avec commission sur abonnement
- Présence aux salons BTP et énergie de la sous-région

## **Argumentaire commercial clé**

- Un groupe en panne coûte entre 500 000 et 2 000 000 FCFA — GenTrack l'évite.
- La visibilité en temps réel réduit les vols de carburant (problème majeur des sites non surveillés).
- ROI moyen estimé : 3 à 6 mois d'abonnement suffisent à rembourser un sinistre évité.
- Aucune formation informatique requise — le gardien envoie des messages, le patron reçoit les rapports.

---

# **5. Marketing & Communication**

## **Positionnement**

GenTrack se positionne comme le copilote opérationnel des entreprises africaines — pas un ERP complexe, pas une solution importée inadaptée, mais une plateforme pensée pour fonctionner là où l'Afrique est : sur le terrain, avec WhatsApp, aujourd'hui.

Ligne directrice : "Vos équipements parlent. Enfin, vous les entendez."

## **Cibles de communication**

- Directeurs Généraux & DAF de PME/ETI (décideurs budget)
- Responsables techniques & chefs de maintenance (prescripteurs)
- Distributeurs et revendeurs de groupes (partenaires de revente)
- Investisseurs et partenaires institutionnels

## **Canaux prioritaires**

### **LinkedIn**

- Page entreprise GenTrack Power Operations
- Publications hebdomadaires : études de cas, chiffres terrain, conseils maintenance

### **WhatsApp Business**

- Démo en direct via le bot GenTrack
- Campagnes de nurturing par message

### **Landing page**

- Formulaire de demande de démo (Tally)
- Témoignages clients et KPIs d'impact
- CTA clair : démo WhatsApp ou email

## **Messages clés par audience**

### **Pour le DG**

"Sachez en 30 secondes si vos groupes tournent, ce qu'ils consomment, et quand intervenir — sans appeler personne."

### **Pour le responsable technique**

"Vos données terrain arrivent automatiquement, vos alertes partent avant la panne. Zéro saisie manuelle, zéro oubli."

### **Pour le revendeur**

"Proposez GenTrack à vos clients pour un suivi post-vente différenciant — et touchez une commission récurrente chaque mois."

---

# **6. Support**

## **Philosophie du support**

Le support GenTrack est une extension de l'expérience produit, pas une hotline. Chaque interaction doit renforcer la confiance du client, résoudre son problème rapidement, et transformer un utilisateur passif en ambassadeur actif.

Principe directeur : répondre en moins de 4h en semaine, toujours en français, toujours avec une solution concrète.

## **Niveaux de support**

### **Niveau 1 — Autonomie guidée**

- Guide d'onboarding simplifié remis à chaque client
- FAQ WhatsApp : les 10 questions les plus fréquentes
- Tutoriels vidéo courts (moins de 2 minutes) pour les actions clés

### **Niveau 2 — Support direct**

- Support humain par WhatsApp (temps de réponse < 4h en semaine)
- Appel de suivi mensuel avec chaque client actif
- Rapport mensuel automatique envoyé au décideur

### **Niveau 3 — Support Enterprise**

- Interlocuteur dédié (account manager)
- Formation sur site des équipes terrain
- Audit énergétique trimestriel inclus
- SLA personnalisé avec engagement de temps de résolution

## **Processus d'onboarding**

### **Étape 1 — Activation (J0)**

- Création du compte client dans l'admin (admin-v3.html)
- Création du site, des équipements avec questions configurées, et des contacts WhatsApp
- Configuration des seuils d'alerte personnalisés

### **Étape 2 — Formation terrain (J1 à J3)**

- Envoi du guide technicien (1 page illustrée en français)
- Test du bot WhatsApp avec le technicien en direct
- Première ronde validée avec le responsable

### **Étape 3 — Suivi post-lancement (J7, J30)**

- Appel de check-in à J7 pour valider que tout fonctionne
- Revue de performance à J30 : alertes déclenchées, rondes effectuées, valeur générée
- Proposition d'upgrade si le client dépasse son quota

## **Indicateurs de qualité support (KPIs)**

**Temps de réponse moyen :** < 4h en semaine

**Taux de résolution premier contact :** > 80%

**NPS client :** Objectif > 50 à fin 2026

**Taux de churn mensuel :** Objectif < 3%

**Taux d'activation à J30 :** > 90% des clients font au moins 20 rondes

## **Outils support**

- WhatsApp Business : canal principal
- Supabase dashboard : visualisation des données client en temps réel
- Email wilfried.gtm@gmail.com : escalades et communications formelles
- Notion / Google Workspace : base de connaissance interne et suivi clients

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
