# GENTRACK

*Document de Contexte Stratégique*

| **Secteur** | GMAO · La donnée produit la maintenance |
| --- | --- |
| **Zone géographique** | Afrique francophone subsaharienne |
| **Siège** | Dakar, Sénégal |
| **Repo GitHub** | wilfriedgtm-web/GenTrack · branche main |
| **Version** | v7.0 — Novembre 2026 |

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

GenTrack a pour ambition de devenir la GMAO de référence pour les entreprises africaines — en partant là où la donnée naît vraiment : le terrain. Pas un formulaire informatique. Un technicien, un téléphone, WhatsApp.

Nous croyons que la maintenance prédictive n'est pas réservée aux grandes multinationales avec des DSI et des budgets IT. Elle doit être accessible à n'importe quelle entreprise africaine qui a des équipements critiques à protéger.

## **Vision**

Faire de GenTrack la GMAO de référence en Afrique subsaharienne — mobile, sans infrastructure IT, où la donnée produit la maintenance.

## **Mission**

Permettre à toute entreprise africaine de piloter la maintenance de ses équipements critiques à partir de ce qu'elle sait déjà faire : envoyer des messages WhatsApp.

GenTrack transforme les données terrain collectées au quotidien — rondes, relevés compteurs, signalements — en plans de maintenance intelligents, en alertes proactives et en tableaux de bord décisionnels. La maintenance naît de la réalité, pas d'une théorie saisie dans un formulaire.

## **Notre différence fondamentale**

Les GMAO traditionnelles (Maximo, SAP PM, Dimo Maint…) fonctionnent de haut en bas : un bureau définit un plan de maintenance → les techniciens sont censés le suivre → les données remontent rarement.

**GenTrack fonctionne de bas en haut.** Le technicien fait sa ronde via WhatsApp. Il relève le compteur horaire. GenTrack sait que le GE a tourné 320 heures. Le plan de maintenance se met à jour automatiquement. L'alerte part quand c'est vraiment le moment — pas selon un calendrier théorique.

La donnée terrain produit la maintenance. Pas l'inverse.

## **Pour qui**

GenTrack cible les entreprises africaines qui ont des équipements critiques à maintenir mais qui n'ont pas — et n'auront jamais — les moyens d'un GMAO enterprise :
- Groupes hôteliers (notre marché d'entrée)
- Cliniques et hôpitaux
- Usines et sites industriels
- Opérateurs télécoms (tours, groupes électrogènes)
- Immobilier commercial et résidentiel haut de gamme

## **Nos valeurs fondatrices**

- **Terrain d'abord** — la donnée part du technicien, pas du bureau.
- **Simplicité radicale** — si un gardien sans formation peut l'utiliser, c'est réussi.
- **Fiabilité avant tout** — une alerte manquée peut coûter des millions.
- **Impact mesurable** — chaque client doit pouvoir chiffrer ce que GenTrack lui a économisé.

---

# **2. Brique Produit**

## **Concept central**

GenTrack est une GMAO SaaS mobile-first, accessible via WhatsApp pour la collecte terrain et via un dashboard web pour le pilotage. Elle couvre l'intégralité du cycle de maintenance : collecte des données terrain → détection des anomalies → planification des interventions → suivi prestataires → historique et reporting.

## **Ce que fait concrètement GenTrack — V7 (Novembre 2026)**

### **Bot WhatsApp technicien — collecte terrain**

| Commande | Rôle | Action |
| --- | --- | --- |
| `saisie` | Technicien | Menu plat — rondes (journalière, hebdo, mensuelle), relevé horaire, relevé énergie. Bot guide équipement par équipement. |
| `panne` | Technicien | Signale une panne urgente → signalement en base + notification resp_tech WhatsApp |
| `resolu` | Technicien | Clôture un signalement → note de résolution + coût + maintenance créée en historique |
| `suivi` | Technicien | **Hub interactif** — liste numérotée des signalements du site (🔴 ouverts, 🟡 en cours, ✅ résolus). Taper un ou plusieurs numéros pour prendre en charge simultanément + recevoir les liens rapport groupés. |
| `bilan` | Technicien | **Fin de journée** — récap automatique (rondes + signalements résolus), puis OUI/NON blocages. Transmis au resp_tech. |
| `bilan` | Resp_tech / Dir_tech | **Vue bilans du jour** — tous les bilans soumis par les techniciens du site. |
| `plein` | Technicien | Déclare un ravitaillement carburant → calcul niveau + autonomie automatique |
| `vidange` | Technicien | Déclare une vidange GE → compteur horaire enregistré, plan de maintenance mis à jour |
| `rapport` | Resp_tech | Menu rapport : (1) Rapport ronde, (2) Rapport signalements, (3) Bilans du jour techniciens |
| `aide` | Tous | Affiche les commandes disponibles (adapté au rôle) |

### **Module Maintenance — GMAO**

Le cœur GMAO de GenTrack. Accessible depuis le dashboard web pour le resp_tech et le dir_tech.

**Plans de maintenance** — deux modes selon l'équipement :

| Mode | Déclencheur | Affichage |
| --- | --- | --- |
| **Calendrier** | Date de prochaine intervention | "Dans X jours" / "En retard Xj" |
| **Compteur horaire** | Relevé terrain (WhatsApp) + intervalle d'heures | "~Xh restantes" / "Dû" |

Le mode compteur est la pièce maîtresse : le plan de maintenance lit automatiquement le dernier relevé horaire saisi par le technicien lors de sa ronde. Quand le GE approche des 300h d'utilisation depuis la dernière vidange, l'alerte part — sans que personne n'ait eu à calculer quoi que ce soit.

**Clôture d'une maintenance** : le technicien (ou resp_tech) clôture l'intervention depuis le dashboard. GenTrack enregistre le compteur au moment de la clôture comme nouvelle base de calcul. Le compteur repart de zéro relatif.

**Missions prestataires** — suivi des interventions externes :
- Création d'une mission liée à un équipement et un prestataire
- Checklist d'intervention configurable
- Rapport et coût associés
- Historique complet par prestataire

**actif_maintenance** — un équipement peut être désactivé de la vue maintenance (ex : matériel en attente de remplacement) sans être retiré des rondes ni des relevés horaires. Il apparaît grisé en bas de liste, exclu des KPIs.

### **Flux rapport d'intervention (rapport.html)**

Quand un technicien prend en charge un signalement via `suivi`, il reçoit un lien `rapport.html?sg=...`. La page affiche le contexte complet (type de panne, équipement, lieu, description, photo déclaration) puis le formulaire de compte-rendu (travaux effectués, coût, durée, photo après).

### **Dashboard web — 4 profils**

**Resp. technique (resp_tech) — son site :**
- Accueil, Signalements, Historique, Relevés, Rondes, Maintenance, Commandes OPEX/CAPEX, Config
- Rapport PDF hebdomadaire générable
- Commandes : workflow demande → approbation direction → suivi livraison

**Directeur technique (dir_tech) — multi-sites :**
- **Accueil** — tableau de synthèse par hôtel : conformité rondes, pannes actives, dispo équipements, cuve carburant, maintenances, scoring (Excellent / À surveiller / Critique).
- **Alertes** — vue consolidée toutes alertes actives tous sites
- **Signalements** — vue consolidée multi-sites
- **Fiabilité** — MTBF et MTTR par équipement et par site, période configurable (30/90/180/365j)
- **Vue équipe** — performance techniciens : MTTR moyen, interventions, conformité rondes, charge
- **Rapport conso** — consommations avec normes et seuils visuels
- **Commandes** — OPEX/CAPEX par hôtel + vue globale
- **Rapport PDF** — rapport complet direction multi-sites

**Directeur opérations (dir_ops) :**
- Vue synthétique tous sites — KPIs clés, alertes, consommations

**Admin (admin.html — Wilfried uniquement) :**
- Gestion complète clients / sites / équipements / contacts / tokens d'accès

### **Signalement QR code**

Page `signalement.html` accessible via QR code — réception, gardien, restauration scanne → sélection équipement → type de problème → description → photo facultative. Signalement créé en base → resp_tech notifié WhatsApp immédiatement.

### **Alertes automatiques**

- Carburant bas (< 40% attention, < 20% critique) → resp_tech + dir_tech
- Vidange imminente → resp_tech
- Plan de maintenance dû (date ou compteur) → resp_tech
- Rappel ronde si non faite → technicien
- Rapport hebdomadaire automatique (lundi) → resp_tech + dir_tech
- Seuil relevé dépassé → destinataires configurés
- Panne signalée → resp_tech immédiatement

---

## **Roadmap produit**

### **Court terme — Q4 2026 (Oct–Déc)**

- **Déploiement Azalaï groupe** — Mauritanie, Guinée-Bissau, puis Abidjan/Cotonou/Bamako, objectif 9-11 hôtels. Formation oct–déc, go-live jan 2027.
- **Export Excel** — données signalements et rondes exportables (demande Ahmed Boussaid, DT Azalaï)
- **Suivi gaz** — tracking consommation gaz (demande DT Azalaï)
- **Zones/lieux** — localisation par chambre/zone pour les signalements
- **Relevés énergie** — kWh par équipement

### **Moyen terme — 2027**

- **WhatsApp production** — compte Facebook Business Manager + 360dialog (~50$/mois)
- **Alertes maintenance WhatsApp** — notification automatique resp_tech quand un plan de maintenance approche de son échéance (compteur ou date)
- **Présence technicien** — suivi entrées/sorties
- **API ouverte** — intégration ERP (SAP, Sage) et connexion entrante depuis GMAOs existants
- **Intelligence artificielle** — prédiction de pannes à partir des tendances terrain (relevés compteurs, fréquence des pannes)

---

# **3. Architecture Technique**

## **Stack globale**

| **Composant** | **Technologie** |
| --- | --- |
| **Frontend** | Vercel — HTML vanilla + JS, pas de framework |
| **Base de données** | Supabase (PostgreSQL) · ID projet : `zbpoxjlkqxnqjzxohasq` |
| **Bot WhatsApp** | Twilio sandbox + Edge Functions Supabase (Deno / TypeScript) |
| **Stockage fichiers** | Supabase Storage — bucket `gentrack-photos` (public) |
| **Repo & CI/CD** | GitHub wilfriedgtm-web/GenTrack · branche main = prod |

## **Fichiers frontend**

| **Fichier** | **Rôle** |
| --- | --- |
| `dashboard.html` | Dashboard principal — tous rôles via token |
| `admin.html` | Dashboard admin Wilfried |
| `signalement.html` | Formulaire mobile signalement QR code — public |
| `rapport.html` | Formulaire mobile rapport d'intervention. Affiche le contexte complet du signalement (description + photo originale) puis le formulaire de compte-rendu. |
| `releve.html` | Formulaire mobile relevé horaire — token 8h |
| `affiche-signalement.html` | Affiche A4 QR code signalement par site |
| `affiche-bot.html` | Affiche guide bot WhatsApp technicien |

## **Tables Supabase principales**

| **Table** | **Description** |
| --- | --- |
| `sites` | Rattachés à un client — config rondes, horaires rappel |
| `equipements` | Par site — type, seuils, conso, capacité, `actif_ronde`, `actif_releve`, `actif_maintenance` |
| `questions` | Questions configurées par équipement — seuils, alertes, `unite` ('h' pour compteur horaire) |
| `rondes` / `rondes_equipements` / `reponses` | Collecte terrain ronde |
| `signalements` | Incidents — statut, `resolved_at` (pour MTTR), cout_intervention, `photo_url` |
| `maintenances` | Interventions internes — duree_valeur, duree_unite, photo_url |
| `plans_maintenance` | Plans de maintenance par équipement — `titre`, `frequence`, `prochaine_date` (mode calendrier), `intervalle_heures` + `dernier_compteur` (mode compteur), `actif`, `prestataire_id` |
| `missions` | Interventions prestataires — liées à un `site_id`, équipement, checklist, rapport, coût |
| `prestataires` | Entreprises prestataires — nom, spécialité, contact |
| `bilans_journee` | Bilans fin de journée techniciens |
| `pleins` | Historique ravitaillements carburant |
| `vidanges` | Historique vidanges GE |
| `alertes` | Alertes actives — `resolue` (bool). **Pas de colonne `resolved_at` sur alertes.** |
| `demandes` | Commandes OPEX/CAPEX — workflow demande → approbation → livraison |
| `contacts` | Contacts WhatsApp par site — `role` : technicien / resp_tech / dir_tech |
| `tokens` | Liens d'accès dashboard — rôle, site_ids |
| `sessions` | État conversationnel bot WhatsApp |

**MTTR** : calculé depuis `signalements.created_at` → `signalements.resolved_at`.

**Compteur horaire** : `questions` (unite='h', equipement_id) → `reponses` (valeur) → `rondes_equipements` (ronde_id, equipement_id) → `rondes` (date_ronde). La valeur la plus récente alimente automatiquement les plans de maintenance en mode compteur.

**États bot (activeStates)** : `rapport_choix`, `bilan_recap`, `bilan_blocages`, `suivi_choix`, `saisie_choix_freq`, `saisie_choix_equip`, `saisie_questions`, `panne_desc`, `panne_photo`, `panne_lieu`, `panne_equip`, `resolu_choix`, `resolu_note`, `plein_litres`, `vidange_confirm`

## **État des clients — Novembre 2026**

| **Client** | **Sites** | **Statut** |
| --- | --- | --- |
| **Mangalis** | Noom Abidjan, Seen Abidjan | En production — rondes actives |
| **Azalaï Hôtel Dakar** | Azalaï Hotel Dakar | Pilote 30 jours validé. Négociation déploiement groupe 11 hôtels. |
| **Pullman Dakar Teranga** | Pullman Dakar (Accor) | Accord pilote — compte prêt pour config réelle |

## **Contacts clés Azalaï**

- **Ahmed Boussaid** — Directeur Technique Groupe Azalaï
- **Modeste** — Responsable Technique Azalaï Hôtel Dakar (utilisateur resp_tech actif)
- **M. Sené** — Direction Générale (décideur contrat groupe)

## **Edge Functions Supabase**

- **webhook** — Bot WhatsApp principal. Rondes multi-fréquences, signalements, suivi interactif, bilans journée, résolutions, pleins, vidanges, alertes seuils. Comportement différencié selon `contact.role`.
- **rappel** — Cron horaire. Alertes carburant, vidange, rappel rondes.
- **rapport-hebdo** — Cron lundi 8h UTC. Bilan semaine → resp_tech + dir_tech.

---

# **4. Commercial**

## **Tarification groupe hôtelier**

| **Volume** | **Prix/hôtel/mois** |
| --- | --- |
| 1 à 3 hôtels | 350 000 FCFA |
| 3 à 5 hôtels | 300 000 FCFA |
| 5 à 11 hôtels | 200 000 FCFA |
| **11 hôtels (groupe complet)** | **2 200 000 FCFA/mois** |

Paramétrage, cartographie équipements et formation inclus. Aucune installation IT. Aucune migration.

## **Prospects actifs**

| **Prospect** | **Contact** | **Statut** |
| --- | --- | --- |
| **Azalaï groupe** (11 hôtels) | Ahmed Boussaid (DT), M. Sené (DG) | Pilote Dakar validé — mémo envoyé — réunion 30 min à planifier. Déploiement oct–déc 2026, go-live jan 2027. |
| **Pullman Dakar Teranga** | Ndiaga Diouf (Adjoint RT) | Accord pilote — compte prêt pour config réelle |

## **Résultats pilote Azalaï Dakar (30 jours)**

- 99% conformité rondes
- 12 équipements suivis, 0 jour manqué
- Anomalie CF -8°C (au lieu de -18°C) détectée et résolue — perte produit évitée
- Vidange GE anticipée — prestataire relancé, paiement débloqué

## **Argumentaire commercial**

**L'argument GMAO classique :**
- Les GMAO enterprise (Maximo, SAP PM) coûtent des dizaines de millions de FCFA à déployer, nécessitent un DSI, une formation longue, et n'ont jamais été conçus pour le terrain africain.
- Résultat : 80% des entreprises africaines n'ont aucun suivi structuré de leurs équipements.

**L'argument GenTrack :**
- Déployé en 48h, sans installation, sans technicien informatique.
- Les données terrain que vos techniciens produisent déjà via WhatsApp alimentent automatiquement vos plans de maintenance.
- Panne non anticipée : coût moyen > 500 000 FCFA. GenTrack amortit son coût dès le premier incident évité.
- ROI estimé : 3 à 6 mois d'abonnement pour rembourser un sinistre évité.
- Visibilité temps réel sur l'ensemble de votre parc depuis un seul tableau de bord.

---

# **5. Marketing & Communication**

## **Positionnement**

**GenTrack est une GMAO où la maintenance naît des données que vos équipes produisent déjà.**

Pas un outil de plus à former. Pas un formulaire de plus à remplir. Une plateforme qui part de ce que font déjà vos techniciens — envoyer des messages sur WhatsApp — et en fait une base de données de maintenance intelligente.

La donnée terrain produit la maintenance. Pas l'inverse.

## **Ligne de communication**

> *"La maintenance naît du terrain."*

## **Messages clés par cible**

**Directeur Technique :**
"Sachez exactement quand chaque équipement doit être maintenu — pas selon un calendrier théorique, mais selon les heures réelles de fonctionnement que vos techniciens relèvent chaque jour."

**Directeur Général / Directeur Opérations :**
"Un tableau de bord unique pour savoir, en temps réel, l'état de tous vos équipements critiques — sur tous vos sites, depuis votre téléphone."

**Responsable Technique :**
"Fini les tableurs Excel et les notifications WhatsApp perdues. Vos rondes, vos plans de maintenance et vos prestataires dans un seul outil, accessible depuis votre téléphone."

## **Canaux prioritaires**

- **LinkedIn** — études de cas, chiffres terrain, conseils maintenance
- **WhatsApp Business** — démo en direct via le bot GenTrack
- **Landing page** — formulaire démo, témoignages clients

---

# **6. Support**

## **Processus d'onboarding**

1. **Activation (J0)** — création compte admin.html : site, équipements, questions, contacts WhatsApp, seuils d'alerte, plans de maintenance
2. **Formation terrain (J1–J3)** — envoi affiche bot WhatsApp, test bot avec technicien, première ronde validée
3. **Suivi post-lancement (J7, J30)** — check-in J7, revue valeur J30

## **KPIs support**

- Temps de réponse : < 4h en semaine
- Taux de résolution premier contact : > 80%
- Taux d'activation J30 : > 90% des clients font au moins 20 rondes

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
