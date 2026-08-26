# Brief — Vidéo d'onboarding commentée GenTrack

## Contexte du produit

**GenTrack** est une plateforme SaaS de gestion des équipements critiques (groupes électrogènes, cuves carburant, chambres froides, etc.) pour les hôtels et entreprises d'Afrique francophone.

Elle fonctionne sur deux interfaces complémentaires :
- **WhatsApp** — pour les techniciens terrain (pas d'app à installer, juste un numéro)
- **Dashboard web** — pour les responsables techniques (pilotage en temps réel)

**Public cible de la vidéo :** Nouveaux clients (resp_tech hôteliers) et techniciens terrain. Niveau : non technique.

**Ton :** Simple, rassurant, professionnel. Français. Pas de jargon informatique.

**Durée cible :** 6 à 8 minutes. Découper en 2 chapitres clairs (technicien / responsable).

**Style commentaire :** Voix off en français, ton pédagogique. Chaque action expliquée avant d'être montrée.

---

## Chapitre 1 — Le technicien terrain (via WhatsApp)

### Scène 1 — Rejoindre le bot (30 sec)

**Commentaire suggéré :**
> "En tant que technicien, tout se passe sur WhatsApp. Pas d'application à télécharger. Votre responsable vous envoie un numéro et un code d'activation."

**Action montrée :**
- Écran WhatsApp — le technicien envoie le message `join <mot-clé>` au numéro sandbox GenTrack
- Le bot répond avec un message de bienvenue

**Capture à fournir :** Screenshot WhatsApp du message `join` + réponse bot de bienvenue.

---

### Scène 2 — Découvrir les commandes (20 sec)

**Commentaire suggéré :**
> "Pour voir ce que vous pouvez faire, tapez simplement 'aide'. Le bot vous liste toutes les commandes disponibles."

**Action montrée :**
- Technicien envoie `aide`
- Bot répond avec la liste des commandes (saisie, panne, resolu, plein, rapport)

**Capture à fournir :** Screenshot WhatsApp de la réponse `aide`.

---

### Scène 3 — Faire sa ronde journalière (90 sec)

**Commentaire suggéré :**
> "Chaque jour, le technicien fait sa ronde. Il suffit de taper 'saisie'. Le bot guide équipement par équipement, sans rien oublier."

**Action montrée :**
- Technicien envoie `saisie`
- Bot propose le choix de ronde (journalière)
- Bot demande les valeurs une par une : compteur horaire, niveau huile, température, état général
- Technicien répond à chaque question par un chiffre ou un mot
- À la fin : récapitulatif de l'équipement → confirmation
- Bot passe à l'équipement suivant
- À la fin de la ronde : message de clôture + rapport envoyé

**Commentaire à la fin :**
> "En quelques minutes, toutes les données terrain sont enregistrées. Le responsable reçoit le rapport automatiquement."

**Capture à fournir :** Séquence WhatsApp complète d'une ronde journalière (5-6 messages min→max).

---

### Scène 4 — Relevé horaire (45 sec)

**Commentaire suggéré :**
> "Pour les équipements qui nécessitent un suivi heure par heure — comme la consommation électrique — le bot envoie un lien direct vers un formulaire mobile."

**Action montrée :**
- Bot envoie un lien `releve.html`
- Technicien ouvre le lien sur mobile
- Formulaire s'affiche : valeurs heure par heure, seuils colorés
- Technicien remplit et valide

**Capture à fournir :** Screenshot du formulaire `releve.html` ouvert sur mobile avec quelques valeurs remplies.

---

### Scène 5 — Signaler une panne (45 sec)

**Commentaire suggéré :**
> "Si quelque chose ne va pas, le technicien tape 'panne'. Le bot lui demande l'équipement concerné, le type de panne, et une description. En quelques secondes, le responsable est alerté."

**Action montrée :**
- Technicien envoie `panne`
- Bot demande : quel équipement ? → type de panne ? → description ?
- Bot confirme : "✅ Panne enregistrée — REF-1042. Répondez OK REF-1042 pour prendre en charge."
- (Dans la foulée) Le responsable reçoit le signalement WA avec le ref_code + photo + lien dashboard

**Commentaire :**
> "Le responsable est notifié instantanément avec tous les détails, la photo si elle a été jointe, et la référence du signalement."

**Capture à fournir :**
- Conversation WhatsApp du flux `panne`
- Notification WA reçue par le responsable (avec ref_code, photo, lien)

---

### Scène 6 — Prendre en charge un signalement (30 sec)

**Commentaire suggéré :**
> "Le technicien qui va intervenir répond simplement 'OK REF-1042'. GenTrack enregistre la prise en charge et notifie toute l'équipe."

**Action montrée :**
- Technicien envoie `OK REF-1042`
- Bot confirme : prise en charge enregistrée, responsable notifié

**Capture à fournir :** Screenshot WA de la réponse de confirmation prise en charge.

---

### Scène 7 — Clôturer une intervention (45 sec)

**Commentaire suggéré :**
> "Une fois l'intervention terminée, le technicien envoie 'resolu'. GenTrack lui envoie directement le lien pour remplir son rapport d'intervention."

**Action montrée :**
- Technicien envoie `resolu`
- Bot envoie le lien `rapport.html?sg=...`
- Technicien ouvre le lien — formulaire rapport : équipement, description, pièces, durée, coût, photo après
- Validation → signalement clôturé

**Capture à fournir :**
- Screenshot WA du lien rapport reçu
- Screenshot formulaire `rapport.html` rempli sur mobile

---

### Scène 8 — Déclarer un plein carburant (30 sec)

**Commentaire suggéré :**
> "Pour les ravitaillements carburant, le technicien tape 'plein'. Il indique les litres ajoutés et l'opérateur. Le niveau de la cuve est recalculé automatiquement."

**Action montrée :**
- Technicien envoie `plein`
- Bot demande : équipement → litres ajoutés → opérateur
- Bot confirme avec nouveau niveau et autonomie estimée

**Capture à fournir :** Conversation WA du flux `plein`.

---

## Chapitre 2 — Le responsable technique (via dashboard web)

### Scène 9 — Se connecter au dashboard (20 sec)

**Commentaire suggéré :**
> "Le responsable technique accède à son dashboard via un lien sécurisé, sans mot de passe. Ce lien lui est envoyé lors de la configuration de son compte."

**Action montrée :**
- Responsable ouvre le lien → dashboard se charge
- Écran d'accueil avec les KPIs et le statut des équipements

**Capture à fournir :** Screenshot de l'accueil dashboard (avec données réelles, KPIs visibles, statut couleurs).

---

### Scène 10 — Comprendre l'accueil (45 sec)

**Commentaire suggéré :**
> "L'accueil donne une vue instantanée de l'état du site. Les couleurs parlent d'elles-mêmes : vert, tout va bien. Rouge, il y a un problème à traiter. En haut, un bandeau d'alerte vous dit combien d'actions sont requises — cliquez dessus pour descendre directement aux alertes."

**Action montrée :**
- Zoom sur le bandeau alerte rouge en haut → clic → scroll vers la section alertes
- Zoom sur la grille équipements avec les couleurs
- Zoom sur les KPIs (ronde du jour, alertes actives)
- Section carburant : niveau cuve, autonomie en jours

**Capture à fournir :** Screenshot accueil complet + screenshot section alertes.

---

### Scène 11 — Gérer un signalement (60 sec)

**Commentaire suggéré :**
> "Onglet Signalements — vous retrouvez tous les incidents en cours. Filtrez par statut : ouverts, en cours, résolus. Cliquez sur une carte d'alerte depuis l'accueil pour y accéder directement."

**Action montrée :**
- Clic sur une carte panne depuis l'accueil → scroll + flash vers la carte signalement
- Carte signalement ouverte : description, lieu, photo, ref_code, qui a signalé
- Clic "Affecter" → modal → saisie du technicien → message WA prévisualisé → envoi
- Carte passe en "En cours" avec le badge "Pris en charge par X"

**Capture à fournir :**
- Screenshot liste signalements avec filtres
- Screenshot carte signalement détaillée (avec ref_code, photo, badge prise en charge)
- Screenshot modal affectation avec prévisualisation WA

---

### Scène 12 — Onglet Alertes (30 sec)

**Commentaire suggéré :**
> "L'onglet Alertes regroupe tout ce qui nécessite une action : seuils dépassés, anomalies, pannes. Chaque alerte peut être traitée directement ou transformée en signalement."

**Action montrée :**
- Onglet Alertes : liste des alertes actives
- Clic "+ Signalement" depuis une alerte seuil → modal pré-rempli

**Capture à fournir :** Screenshot onglet alertes.

---

### Scène 13 — Onglet Maintenance (30 sec)

**Commentaire suggéré :**
> "L'onglet Maintenance est votre journal complet d'interventions : pannes résolues, vidanges, ravitaillements. Tout est tracé automatiquement, avec les coûts et les intervenants."

**Action montrée :**
- Onglet Maintenance : journal chronologique filtrable
- Zoom sur une fiche intervention avec coût, durée, photo avant/après

**Capture à fournir :** Screenshot onglet maintenance avec quelques entrées.

---

### Scène 14 — Onglet Config (30 sec)

**Commentaire suggéré :**
> "Dans la configuration, vous gérez vos équipements, vos contacts WhatsApp, et l'affichage sur site. Vous pouvez imprimer le QR code signalement à poser dans les espaces communs, et l'affiche guide pour vos techniciens."

**Action montrée :**
- Onglet Config → Contacts → badge "📲 Signalements"
- Onglet Config → QR Code → bouton Imprimer affiche signalement
- Onglet Config → affiche bot WhatsApp

**Capture à fournir :** Screenshot onglet config (contacts + QR code).

---

### Scène 15 — Conclusion (20 sec)

**Commentaire suggéré :**
> "GenTrack, c'est ça : vos équipements parlent via WhatsApp, vous pilotez depuis votre téléphone ou votre ordinateur. Aucune formation informatique, aucune app à installer. Juste de la visibilité, enfin."

**Action montrée :**
- Retour sur l'accueil dashboard, calme, tout vert
- Split-screen : côté gauche WhatsApp technicien / côté droit dashboard resp_tech

---

## Résumé des captures à préparer

| # | Contenu | Interface |
|---|---------|-----------|
| 1 | Message `join` + réponse bienvenue bot | WhatsApp |
| 2 | Réponse commande `aide` | WhatsApp |
| 3 | Séquence ronde journalière complète | WhatsApp |
| 4 | Formulaire relevé horaire rempli | Mobile (releve.html) |
| 5 | Flux `panne` complet (saisie → confirmation REF) | WhatsApp |
| 6 | Notification signalement reçue par le responsable (avec photo + ref) | WhatsApp |
| 7 | Réponse `OK REF-XXXX` + confirmation | WhatsApp |
| 8 | Message `resolu` + lien rapport | WhatsApp |
| 9 | Formulaire rapport.html rempli sur mobile | Mobile (rapport.html) |
| 10 | Flux `plein` complet | WhatsApp |
| 11 | Accueil dashboard — KPIs + couleurs équipements + section alertes | Dashboard |
| 12 | Liste signalements avec filtres + carte détaillée | Dashboard |
| 13 | Modal affectation technicien avec prévisualisation WA | Dashboard |
| 14 | Onglet Alertes | Dashboard |
| 15 | Onglet Maintenance — journal interventions | Dashboard |
| 16 | Onglet Config — contacts + QR code | Dashboard |

---

## Style visuel

- Couleurs GenTrack : fond crème `#F5F0E8`, accent amber `#C49A1C`, dark `#111110`
- Police : Inter (interface) + Cormorant Garamond (titres)
- Pas de transitions flashy — smooth, professionnel
- Annotations simples : flèches ou encadrés pour pointer les éléments clés
- Logo GenTrack visible en intro et en outro

---

*Brief préparé pour Lovable — GenTrack © 2026*
