# GENTRACK

*Document de Contexte Stratégique*

| **Secteur** | Pilotage des équipements critiques |
| --- | --- |
| **Zone géographique** | Afrique francophone subsaharienne |
| **Siège** | Dakar, Sénégal |
| **Repo GitHub** | wilfriedgtm-web/GenTrack · branche main |
| **Version** | v5.0 — Septembre 2026 |

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

GenTrack a pour ambition de devenir la plateforme opérationnelle de référence pour le pilotage des infrastructures critiques en Afrique francophone — en proposant un outil simple, accessible sur WhatsApp, capable de transformer des données terrain brutes en décisions intelligentes.

Nous croyons que l'Afrique n'a pas besoin d'outils compliqués ou coûteux. Elle a besoin d'outils qui fonctionnent là où elle est : sur le terrain, avec un téléphone, sans technicien informatique.

## **Vision**

Faire de GenTrack la plateforme incontournable du pilotage des opérations techniques en Afrique subsaharienne.

## **Mission**

Aider les entreprises africaines à prendre de meilleures décisions grâce à une visibilité en temps réel sur leurs équipements critiques.

Nous y parvenons en collectant automatiquement les données terrain via WhatsApp, en les analysant intelligemment, et en les restituant sous forme de tableaux de bord clairs et d'alertes proactives — sans complexité technique pour l'utilisateur.

## **Positionnement GMAO**

GenTrack ne remplace pas les outils GMAO existants — il les rend exploitables. Les équipes terrain utilisent WhatsApp au quotidien, pas des interfaces GMAO complexes. GenTrack s'intercale entre le terrain et la direction : il capte les données via WhatsApp et les remonte en indicateurs directement exploitables par la Direction. Le GMAO reste le système de référence ; GenTrack est la couche de collecte qui l'alimente.

## **Nos valeurs fondatrices**

- Simplicité radicale — si un gardien sans formation peut l'utiliser, c'est réussi.
- Proximité terrain — nous concevons avec et pour les opérateurs africains.
- Fiabilité avant tout — une alerte manquée peut coûter des millions.
- Impact mesurable — chaque client doit pouvoir chiffrer ce que GenTrack lui a économisé.

---

# **2. Brique Produit**

## **Concept central**

GenTrack est une solution SaaS de gestion opérationnelle des équipements critiques, accessible via WhatsApp pour la collecte terrain et via un dashboard web pour le pilotage. Elle s'adresse aux entreprises disposant d'équipements critiques (groupes électrogènes, cuves, chambres froides, etc.) et constitue une couche de collecte terrain qui complète les GMAO existantes.

## **Ce que fait concrètement GenTrack — V5 (Septembre 2026)**

### **Bot WhatsApp technicien — collecte terrain**

| Commande | Action |
| --- | --- |
| `saisie` | Lance la ronde terrain — bot guide équipement par équipement. Rondes journalières, hebdomadaires, mensuelles. Plusieurs rondes/jour autorisées. |
| `panne` | Signale une panne urgente → signalement en base + notification resp_tech WhatsApp |
| `resolu` | Clôture un signalement → note de résolution + coût + maintenance créée en historique |
| `plein` | Déclare un ravitaillement carburant → calcul niveau + autonomie automatique |
| `vidange` | Déclare une vidange GE → compteur horaire enregistré |
| `rapport` | Génère et envoie le rapport de la dernière ronde |
| `aide` | Affiche les commandes disponibles |

### **Dashboard web — 4 profils**

**Resp. technique (resp_tech) — son site :**
- Accueil, Signalements, Historique, Relevés, Rondes, Commandes OPEX/CAPEX, Config
- Rapport PDF hebdomadaire générable depuis le dashboard
- Commandes : workflow demande → approbation direction → suivi livraison

**Directeur technique (dir_tech) — multi-sites :**
- **Accueil** — tableau de synthèse par hôtel : conformité rondes (J/hebdo), pannes actives, dispo équipements (% sans panne), cuve carburant, maintenances, scoring (Excellent / À surveiller / Critique). Alertes top reco cuves (🚨 Commande urgente / ⚠️ Prévoir ravitaillement).
- **Alertes** — vue consolidée toutes alertes actives tous sites
- **Signalements** — vue consolidée tous signalements multi-sites
- **Fiabilité** — MTBF et MTTR par équipement et par site, sur période configurable (30/90/180/365j). Vue globale groupe + détail par site.
- **Vue équipe** — performance techniciens : MTTR moyen, interventions, conformité rondes, charge de travail
- **Rapport conso** — consommations avec normes et seuils visuels (carburant, coûts, pannes)
- **Commandes** — création et gestion commandes OPEX/CAPEX par hôtel (onglets hôtels + vue globale)
- **Rapport PDF** — rapport complet direction : KPIs globaux, tableau par hôtel avec MTTR, référentiel de normes (conformité, pannes, sites critiques, MTTR groupe), comparatif multi-sites, détail par hôtel

**Directeur opérations (dir_ops) :**
- Vue synthétique tous sites — KPIs clés, alertes, consommations

**Admin (admin.html — Wilfried uniquement) :**
- Gestion complète clients / sites / équipements / contacts / tokens d'accès

### **Signalement QR code**

Page `signalement.html` accessible via QR code — réception, gardien, restauration scanne → sélection équipement → type de problème → description → photo facultative. Signalement créé en base → resp_tech notifié WhatsApp immédiatement.

### **Alertes automatiques**

- Carburant bas (< 40% attention, < 20% critique) → resp_tech + dir_tech
- Vidange imminente → resp_tech
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
- **Zones/lieux** — localisation par chambre/zone pour les signalements (demande DT Azalaï)
- **Relevés énergie** — kWh par équipement (demande DT Azalaï)

### **Moyen terme — 2027**

- **WhatsApp production** — compte Facebook Business Manager + 360dialog (~50$/mois) pour lever les limites sandbox Twilio
- **Présence technicien** — suivi entrées/sorties (demande DT Azalaï)
- **API ouverte** — intégration avec ERPs existants (SAP, Sage, GMAO)
- **Intelligence artificielle** — prédiction de pannes et recommandations proactives

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
| `rapport.html` | Formulaire mobile rapport d'intervention |
| `releve.html` | Formulaire mobile relevé horaire — token 8h |
| `affiche-signalement.html` | Affiche A4 QR code signalement par site |
| `affiche-bot.html` | Affiche guide bot WhatsApp technicien |

## **Tables Supabase principales**

| **Table** | **Description** |
| --- | --- |
| `sites` | Rattachés à un client — config rondes, horaires rappel |
| `equipements` | Par site — type, seuils, conso, capacité, actif_ronde, actif_releve |
| `questions` | Questions configurées par équipement — seuils, alertes |
| `rondes` / `rondes_equipements` / `reponses` | Collecte terrain ronde |
| `signalements` | Incidents — statut, `resolved_at` (pour MTTR), cout_intervention |
| `maintenances` | Interventions — duree_valeur, duree_unite, photo_url |
| `pleins` | Historique ravitaillements carburant |
| `vidanges` | Historique vidanges GE |
| `alertes` | Alertes actives — `resolue` (bool). **Pas de colonne `resolved_at` sur alertes.** |
| `demandes` | Commandes OPEX/CAPEX — workflow demande → approbation → livraison |
| `contacts` | Contacts WhatsApp par site |
| `tokens` | Liens d'accès dashboard — rôle, site_ids |
| `sessions` | État conversationnel bot WhatsApp |

**MTTR** : calculé depuis `signalements.created_at` → `signalements.resolved_at`.

## **État des clients — Septembre 2026**

| **Client** | **Sites** | **Statut** |
| --- | --- | --- |
| **Mangalis** | Noom Abidjan, Seen Abidjan | En production — rondes actives |
| **Azalaï Hôtel Dakar** | Azalaï Hotel Dakar · `c972e0dd-536e-41e5-a6d2-5fe134efd539` | Pilote 30 jours validé. Négociation déploiement groupe 11 hôtels. |
| **Pullman Dakar Teranga** | Pullman Dakar (Accor) | Accord pilote — compte prêt pour config réelle |

## **Contacts clés Azalaï**

- **Ahmed Boussaid** — Directeur Technique Groupe Azalaï
- **Modeste** — Responsable Technique Azalaï Hôtel Dakar (utilisateur resp_tech actif)
- **M. Sené** — Direction Générale (décideur contrat groupe)

## **Edge Functions Supabase**

- **webhook (v77)** — Bot WhatsApp principal. Rondes multi-fréquences, signalements, résolutions, pleins, vidanges, alertes seuils.
- **rappel (v6)** — Cron horaire. Alertes carburant, vidange, rappel rondes.
- **rapport-hebdo (v6)** — Cron lundi 8h UTC. Bilan semaine → resp_tech + dir_tech.

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

- Panne non anticipée : coût moyen > 500 000 FCFA
- GenTrack complète le GMAO sans le remplacer — adoption immédiate, zéro formation IT
- ROI estimé : 3 à 6 mois d'abonnement pour rembourser un sinistre évité
- Visibilité temps réel sur 11 hôtels depuis un seul tableau de bord

---

# **5. Marketing & Communication**

## **Positionnement**

GenTrack se positionne comme le copilote opérationnel des entreprises africaines — la couche terrain qui rend les données techniques réellement disponibles pour la Direction, sans remplacer les outils existants.

Ligne directrice : *"Vos équipements parlent. Enfin, vous les entendez."*

## **Canaux prioritaires**

- **LinkedIn** — études de cas, chiffres terrain, conseils maintenance
- **WhatsApp Business** — démo en direct via le bot GenTrack
- **Landing page** — formulaire démo, témoignages clients

---

# **6. Support**

## **Processus d'onboarding**

1. **Activation (J0)** — création compte admin.html : site, équipements, questions, contacts WhatsApp, seuils d'alerte
2. **Formation terrain (J1–J3)** — envoi affiche bot WhatsApp, test bot avec technicien, première ronde validée
3. **Suivi post-lancement (J7, J30)** — check-in J7, revue valeur J30

## **KPIs support**

- Temps de réponse : < 4h en semaine
- Taux de résolution premier contact : > 80%
- Taux d'activation J30 : > 90% des clients font au moins 20 rondes

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
