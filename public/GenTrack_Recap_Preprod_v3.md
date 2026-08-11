# GenTrack — Récap Preprod v3
*Mise à jour après Session A*

---

## Ce qui a été fait dans cette session (Session A)

### Auth — passage au Magic Link email

**Pourquoi** : Twilio WhatsApp sandbox bloque les numéros français (+33). Trop complexe à déboguer pour le preprod.

**Nouvelle architecture** :
- Login par email au lieu du numéro WhatsApp
- Supabase Auth envoie un **magic link** par email (gratuit, natif, sans service externe)
- Clic sur le lien → atterrissage sur `dashboard.html` → connecté automatiquement
- Session de 30 jours en localStorage (`gt_session`)

**Edge function `auth-otp` v5** — 3 actions :
- `request` : vérifie l'email dans `contacts`, envoie le magic link via Supabase Auth
- `magic_callback` : reçoit l'`access_token` du magic link, récupère l'email via `/auth/v1/user`, trouve le contact, crée la session
- `validate` : vérifie un `session_token` existant au chargement de page

**`dashboard.html`** — nouveau flow login :
1. Saisie de l'email
2. Écran "📬 Vérifiez votre boîte mail"
3. Clic sur le lien → `init()` détecte l'`access_token` dans le hash URL → appelle `magic_callback` → dashboard

### DB
- Colonne `email` renseignée pour les contacts de Wilfried :
  - WILFRIED TCHINDA (technicien) — `wilfried.gtm@gmail.com`
  - Willo (resp_tech) — `wilfried.gtm@gmail.com`
- Contact sélectionné avec priorité de rôle : `dir_ops > dir_tech > resp_tech > technicien`

### Fichiers GitHub (repo `wilfriedgtm-web/GenTrack`, branch `master`)
- `public/dashboard.html` — commité, mais **la dernière version (magic link) n'a peut-être pas été poussée**

---

## ⚠️ À FAIRE EN PREMIER dans la prochaine session

### 1. Vérifier que le bon dashboard.html est en ligne
Le fichier avec le magic link flow doit être dans le repo. Si la page montre encore un input téléphone ou email avec OTP, il faut repousser.

### 2. Changer le Site URL dans Supabase (BLOQUANT)
Sans ça, le magic link redirige vers l'admin au lieu du dashboard.

→ Supabase dashboard → **Authentication → URL Configuration**
- **Site URL** : `https://gen-track-git-master-wilfriedgtm-webs-projects.vercel.app/dashboard.html`
- **Redirect URLs** : ajouter la même URL

### 3. Tester le flow complet
1. Aller sur `/dashboard.html`
2. Entrer `wilfried.gtm@gmail.com`
3. Cliquer le lien dans l'email
4. Vérifier qu'on atterrit sur le dashboard `resp_tech` (vue Willo)

---

## Stack technique

| Composant | Détail |
|-----------|--------|
| Frontend | Vercel — HTML/JS vanilla, `public/dashboard.html` |
| Backend | Supabase Edge Function `auth-otp` (Deno, v5) |
| Auth | Supabase Auth — magic link email |
| DB | Supabase PostgreSQL |
| Repo | `wilfriedgtm-web/GenTrack` — branch `master` |
| Preview URL | `gen-track-git-master-wilfriedgtm-webs-projects.vercel.app` |
| Supabase project | `zbpoxjlkqxnqjzxohasq` |

**Brand** : fond crème `#F5F0E8` / sidebar `#111110` / accent amber `#C49A1C` / fonts Cormorant Garamond + Inter

**Rôles** : `dir_ops` > `dir_tech` > `resp_tech` > `technicien` (priorité si doublon)

**Session localStorage** : `gt_session` = `{ session_token, role, site_ids, contact, client_id, email }`

---

## Plan de sessions (état)

| Session | Livrable | Statut |
|---------|----------|--------|
| **A** | `dashboard.html` shell + login magic link | ✅ Fait (à valider côté Supabase URL) |
| **B** | Vue Resp Tech — live data | ⬜ À faire |
| **C** | Vue Dir Tech + comparaison hôtels | ⬜ À faire |
| **D** | Vue Dir Ops | ⬜ À faire |
| **E** | Historique + recommandations | ⬜ À faire |
| **F** | Export PDF | ⬜ À faire |
| **G** | Bot v2 — catalogue + webhook | ⬜ Après démos |

---

## Session B — Vue Resp Tech (prochain livrable)

Contenu à builder (données live depuis Supabase) :

**Bloc 1 — Ma journée**
- Rondes à faire (avec heure cible) depuis table `rondes`
- Alertes actives depuis `saisies` (valeur hors seuil)
- Relevés horaires en attente (`tokens_releve` non utilisés)

**Bloc 2 — Statut équipements maintenant**
- Dernière valeur par équipement (table `saisies` + `groupes`)
- Statut vert/orange/rouge selon seuils
- > 6h sans saisie → orange automatique

**Bloc 3 — Alertes actives**
- Détail + recommandation + action proposée
- Bouton "Marquer traité"

**Bloc 4 — Historique rapide (3 jours)**
- Accessible en onglet

**Bloc 5 — Configuration** (onglet Config)
- Équipements, seuils, questions de ronde, contacts d'alerte

**Tables impliquées** : `groupes`, `saisies`, `rondes`, `reponses`, `sites`, `contacts`

Le `site_id` du resp_tech est dans `session.site_ids[0]`.

---

## Ce qu'on ne touche pas

- `client.html` — reste en production, legacy tokens, NE PAS MODIFIER
- Le bot WhatsApp — après les démos
- Les tables `groupes`, `saisies`, `cuves` — données de production intactes

---

*GenTrack © 2026 · Dakar, Sénégal · wilfried.gtm@gmail.com*
