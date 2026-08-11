# GenTrack — Récap Preprod v5
*Mise à jour après Session C*

---

## Ce qui a été fait — Session C

### Vue Dir Tech — live data
- **Bloc Vue multi-sites** : carte par hôtel cliquable (›) avec statut ronde du jour, nb équipements, badge pannes
- **Bloc Équipements en alerte** : alertes + pannes non résolues consolidées tous sites, bouton "✓ Résolu" → PATCH DB
- **Bloc Suivi équipe** : rondes du jour groupées par `technicien_id` → `contacts.nom`, % complétion + sites couverts
- **Bloc Pannes récentes** : 7 derniers jours tous sites, statut résolu/en cours
- **Onglet Alertes** : vue complète multi-sites avec badge site sur chaque panne
- **Onglet Historique** : 7 jours, groupé par date puis par site avec barre de progression

### Détail par hôtel (Dir Tech)
- Clic sur une carte hôtel → vue détail du site (réutilise la logique Session B)
- Onglets Accueil / Alertes / Historique au niveau du site
- Bouton "← Tous les hôtels" pour revenir à la vue multi-sites
- Navigation sidebar aware du contexte (multi-sites vs détail site)

### Auth — suppression OTP, passage token URL
- Supprimé : flow magic link, formulaire email, edge function pour login
- **Nouveau flow** : lien direct `dashboard.html?token=SESSION_TOKEN` → validation via `supaGet` sur `auth_sessions`
- Token stocké en localStorage après premier clic (pas besoin de repasser par le lien)
- Écran "Lien invalide ou expiré" si token absent ou expiré
- RLS policy `anon_select_by_token` ajoutée sur `auth_sessions` (SELECT USING true)
- Pour générer un lien : INSERT dans `auth_sessions` → récupérer `session_token` → construire URL

### DB
- Contact créé : `w.skybirdd@gmail.com` / rôle `dir_tech` / client Azalaï
- Session token générée manuellement pour ce contact (expire 30j)

---

## Stack technique
| Composant | Détail |
|-----------|--------|
| Frontend | Vercel — `public/dashboard.html` |
| Backend | Supabase Edge Function `auth-otp` (conservée mais non utilisée pour le login) |
| Auth | Token URL `?token=SESSION_TOKEN` → `auth_sessions` via anon key |
| DB | Supabase PostgreSQL |
| Repo | `wilfriedgtm-web/GenTrack` — branch `master` |
| URL preprod | `gen-track-git-master-wilfriedgtm-webs-projects.vercel.app` |
| Supabase project | `zbpoxjlkqxnqjzxohasq` |

**Brand** : fond crème `#F5F0E8` / sidebar `#111110` / accent amber `#C49A1C` / Cormorant Garamond + Inter  
**Session localStorage** : `gt_session` = `{ session_token, role, site_ids, contact, client_id, email }`  
**Rôles** : `dir_ops` > `dir_tech` > `resp_tech` > `technicien`

---

## Tables clés (schéma confirmé)
| Table | Usage |
|-------|-------|
| `equipements` | Équipements par site, `type_id` → `types_equipements` |
| `types_equipements` | GE, Cuve fioul, Chambre froide, Groupe eau glacée |
| `rondes` | Par site + date + fréquence + `technicien_id` |
| `rondes_equipements` | Statut par équipement : `en_attente / en_cours / valide` |
| `reponses` | Valeurs saisies par question |
| `questions` | Par équipement, avec `seuil_min`, `seuil_max`, `frequences` |
| `alertes` | Par `client_id`, `resolue` boolean |
| `pannes` | Par `site_id` + `equipement_id`, `resolue` boolean |
| `sites` | 4 sites : Azalaï Dakar, Seen Abidjan, Noom Abidjan, Pullman Dakar · colonne `actif` |
| `contacts` | Rôle + email + site_id + client_id |
| `auth_sessions` | `session_token` unique par `contact_id`, expire 30j · RLS SELECT USING true |

---

## Plan de sessions (état)
| Session | Livrable | Statut |
|---------|----------|--------|
| A | `dashboard.html` shell + login magic link | ✅ Fait |
| B | Vue Resp Tech — live data | ✅ Fait |
| C | Vue Dir Tech + détail par hôtel | ✅ Fait |
| **D** | Vue Dir Ops | ⬜ À faire |
| **E** | Historique + recommandations | ⬜ À faire |
| **F** | Export PDF | ⬜ À faire |
| G | Bot v2 — catalogue + webhook | ⬜ Après démos |

---

## Session D — Vue Dir Ops (prochain livrable)

Le `dir_ops` a accès à tous les sites du client, comme le `dir_tech`.  
Focus : **vision business** plutôt que technique.

**Bloc 1 — Vue d'ensemble multi-sites**
- Même principe que Dir Tech : carte par hôtel cliquable
- KPIs : statut ronde du jour + nb alertes + nb pannes en cours

**Bloc 2 — Actions requises**
- Alertes critiques non résolues, tous sites (consolidées)
- Pannes non résolues > X jours (signalement retard)

**Bloc 3 — Mes hôtels** *(grille ou liste)*
- Conformité rondes sur 7 jours par hôtel (%)
- Nb équipements en alerte
- Dernière panne signalée

**Bloc 4 — Activité récente**
- Pannes des 14 derniers jours tous sites, resolues ou non

**Onglet Alertes** : même logique que Dir Tech (multi-sites)  
**Onglet Historique** : 14 jours, consolidé multi-sites

**Tables** : mêmes que Dir Tech (`alertes`, `pannes`, `rondes`, `rondes_equipements`, `sites`)  
**Différence vs Dir Tech** : pas de "Suivi équipe", plus orienté délais/résolution que technique

---

## ⚠️ Points à surveiller

**RLS** : si une table retourne vide, ajouter `FOR SELECT USING (true)` sur `rondes`, `rondes_equipements`, `equipements`, `types_equipements`, `alertes`, `pannes`.

**Génération de liens** : pour créer un lien d'accès pour un contact :
```sql
INSERT INTO auth_sessions (contact_id, phone, role, site_ids, client_id, expire_at, last_used_at)
VALUES (
  'UUID_CONTACT',
  'email@domaine.com',
  'ROLE',
  ARRAY(SELECT id FROM sites WHERE client_id = 'UUID_CLIENT' AND actif = true),
  'UUID_CLIENT',
  NOW() + INTERVAL '30 days',
  NOW()
)
RETURNING session_token;
-- URL : dashboard.html?token=SESSION_TOKEN
```

**`phone` non null** : le champ `phone` dans `auth_sessions` est NOT NULL — toujours le remplir (utiliser l'email si pas de tel).

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
