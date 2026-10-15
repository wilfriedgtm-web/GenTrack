// supabase/functions/webhook/index.ts
// GenTrack WhatsApp Bot v7
// Changements v7 :
// - panne → écrit dans signalements (plus pannes)
// - resolu → lit/patch signalements + crée maintenances
// - saisie → menu relevé horaire (jamais bloqué) + rondes indépendantes par période
// - anomalie ronde → auto-crée un signalement
// - seuil dépassé → alerte non bloquante, le tech continue
// - autonomie cuve → niveau / (consoH * 8h/j) — aligné dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL         = Deno.env.get('SUPABASE_URL')           || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID       = Deno.env.get('TWILIO_SID')             || '';
const TWILIO_TOKEN     = Deno.env.get('TWILIO_TOKEN')            || '';
const TWILIO_FROM      = Deno.env.get('TWILIO_NUMBER')           || 'whatsapp:+19843418695';
const PROSPECT_NOTIFY  = Deno.env.get('PROSPECT_NOTIFY_NUMBER')  || '';
const WEBHOOK_URL      = Deno.env.get('WEBHOOK_URL')             || '';
const BASE_URL         = 'https://gen-track.vercel.app';

// ── Supabase Storage upload ───────────────────────────────────────────────────
async function uploadTwilioPhoto(twilioUrl: string, prefix: string = 'panne'): Promise<string | null> {
  try {
    // 1. Télécharger la photo depuis Twilio avec Basic Auth
    const imgRes = await fetch(twilioUrl, {
      headers: { 'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` }
    });
    if (!imgRes.ok) { console.error('uploadTwilioPhoto: fetch failed', imgRes.status); return null; }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
    const blob = await imgRes.arrayBuffer();

    // 2. Upload vers Supabase Storage bucket gentrack-photos
    const filename = `${prefix}/${Date.now()}.${ext}`;
    const upRes = await fetch(`${SUPA_URL}/storage/v1/object/gentrack-photos/${filename}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPA_KEY}`,
        'apikey': SUPA_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: blob,
    });
    if (!upRes.ok) { const err = await upRes.text(); console.error('uploadTwilioPhoto: storage upload failed', err); return null; }

    // 3. Retourner l'URL publique
    return `${SUPA_URL}/storage/v1/object/public/gentrack-photos/${filename}`;
  } catch (e) {
    console.error('uploadTwilioPhoto error:', e);
    return null;
  }
}

// ── DB helper ─────────────────────────────────────────────────────────────────
async function db(table: string, opts: any = {}) {
  const { method = 'GET', body, query = '', select = '*', prefer } = opts;
  const key = SUPA_KEY;
  const url = `${SUPA_URL}/rest/v1/${table}?select=${select}${query}`;
  const defaultPrefer = method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : '';
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': key, 'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': prefer ?? defaultPrefer,
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!text.trim()) return [];
  return JSON.parse(text);
}

// ── Twilio ────────────────────────────────────────────────────────────────────
async function sendWA(to: string, message: string, mediaUrl?: string) {
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const payload: Record<string, string> = { From: TWILIO_FROM, To: toFmt, Body: message };
  if (mediaUrl) payload['MediaUrl'] = mediaUrl;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(payload).toString()
  });
  const data = await res.json();
  if (!res.ok) console.error('Twilio error:', data?.code, data?.message);
  return data;
}

// ── Sessions ──────────────────────────────────────────────────────────────────
async function getSession(phone: string) {
  const rows = await db('sessions', { query: `&phone=eq.${encodeURIComponent(phone)}&order=updated_at.desc&limit=1` });
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function setSession(phone: string, state: string, data: any = {}) {
  await db('sessions', {
    method: 'POST',
    query: '&on_conflict=phone',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { phone, state, data: JSON.stringify(data), updated_at: new Date().toISOString() },
  });
}

// ── Dates ─────────────────────────────────────────────────────────────────────
function getToday():          string { return new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' }); }
function getHier():           string { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' }); }
function getHeure():          string { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }); }
function getStartOfWeek():    string {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
}
function getStartOfMonth():   string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
}

// ── Lien relevé horaire ───────────────────────────────────────────────────────
async function getReleveLink(siteId: string): Promise<string | null> {
  const now = new Date().toISOString();
  // Chercher un relevé ouvert non expiré pour ce site
  const rows = await db('releves_horaires', {
    query: `&site_id=eq.${siteId}&statut=eq.ouvert&expires_at=gt.${now}&order=expires_at.desc&limit=1`,
    select: 'token'
  });
  let token = Array.isArray(rows) && rows[0]?.token ? rows[0].token : null;
  // Sinon en créer un nouveau valable 12h
  if (!token) {
    const expires = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    const created = await db('releves_horaires', {
      method: 'POST',
      body: { site_id: siteId, statut: 'ouvert', expires_at: expires },
      select: 'token'
    });
    token = Array.isArray(created) ? created[0]?.token : created?.token;
  }
  return token ? `${BASE_URL}/releve.html?token=${token}` : null;
}

// ── Multi-site ────────────────────────────────────────────────────────────────
async function getSitesForContact(contactId: string, primarySiteId?: string, extraSiteIds: string[] = []): Promise<any[]> {
  const userSites = await db('user_sites', { query: `&contact_id=eq.${contactId}`, select: 'site_id' });
  let siteIds: string[] = Array.isArray(userSites) ? userSites.map((us: any) => us.site_id) : [];
  if (primarySiteId && !siteIds.includes(primarySiteId)) siteIds.push(primarySiteId);
  // Sites issus d'autres lignes contact avec le même numéro (multi-site sans user_sites)
  for (const sid of extraSiteIds) if (sid && !siteIds.includes(sid)) siteIds.push(sid);
  if (!siteIds.length) return [];
  const sites = await db('sites', { query: `&id=in.(${siteIds.join(',')})&actif=eq.true&order=nom.asc` });
  return Array.isArray(sites) ? sites : [];
}

// Retourne tous les resp_tech/dir_tech qui gèrent ce site (contact.site_id + user_sites)
async function getResponsablesForSite(siteId: string): Promise<any[]> {
  const seen = new Set<string>();
  const result: any[] = [];
  // 1. Contact dont c'est le site principal
  const direct = await db('contacts', { query: `&site_id=eq.${siteId}&role=in.(resp_tech,dir_tech)&actif=eq.true` });
  if (Array.isArray(direct)) for (const c of direct) { if (!seen.has(c.id)) { seen.add(c.id); result.push(c); } }
  // 2. Contacts liés via user_sites (multi-site resp_tech / dir_tech)
  const us = await db('user_sites', { query: `&site_id=eq.${siteId}`, select: 'contact_id' }).catch(() => []);
  if (Array.isArray(us) && us.length > 0) {
    const cids = us.map((r: any) => r.contact_id).filter(Boolean);
    if (cids.length) {
      const linked = await db('contacts', { query: `&id=in.(${cids.join(',')})&role=in.(resp_tech,dir_tech)&actif=eq.true` }).catch(() => []);
      if (Array.isArray(linked)) for (const c of linked) { if (!seen.has(c.id)) { seen.add(c.id); result.push(c); } }
    }
  }
  return result;
}

// ── Équipements / questions ───────────────────────────────────────────────────
async function getEquipementsTechnicien(siteId: string): Promise<any[]> {
  const raw = await db('equipements', { query: `&site_id=eq.${siteId}&actif=eq.true&actif_ronde=eq.true&order=ordre_ronde.asc` });
  return Array.isArray(raw) ? raw : [];
}
async function getQuestions(equipementId: string, frequence: string): Promise<any[]> {
  const rows = await db('questions', {
    query: `&equipement_id=eq.${equipementId}&actif=eq.true&frequences=cs.${encodeURIComponent('{' + frequence + '}')}&order=ordre.asc`
  });
  return Array.isArray(rows) ? rows : [];
}
async function getLastValues(questions: any[]): Promise<Record<string, string>> {
  const lastValues: Record<string, string> = {};
  for (const q of questions) {
    const rows = await db('reponses', { query: `&question_id=eq.${q.id}&order=created_at.desc&limit=1` });
    if (Array.isArray(rows) && rows[0]) lastValues[q.id] = rows[0].valeur;
  }
  return lastValues;
}

// ── Rondes ────────────────────────────────────────────────────────────────────
async function getOrCreateRonde(siteId: string, techId: string, frequence: string): Promise<string> {
  const existing = await db('rondes', {
    query: `&site_id=eq.${siteId}&date_ronde=eq.${getToday()}&frequence=eq.${frequence}&limit=1`
  });
  if (Array.isArray(existing) && existing.length > 0) return existing[0].id;
  const created = await db('rondes', { method: 'POST', body: { site_id: siteId, technicien_id: techId, date_ronde: getToday(), frequence } });
  return Array.isArray(created) ? created[0].id : created.id;
}
async function getOrCreateRondeEquipement(rondeId: string, equipementId: string): Promise<string> {
  const existing = await db('rondes_equipements', {
    query: `&ronde_id=eq.${rondeId}&equipement_id=eq.${equipementId}&limit=1`
  });
  if (Array.isArray(existing) && existing.length > 0) return existing[0].id;
  const created = await db('rondes_equipements', { method: 'POST', body: { ronde_id: rondeId, equipement_id: equipementId, statut: 'en_cours' } });
  return Array.isArray(created) ? created[0].id : created.id;
}
async function getEquipementsRestants(rondeId: string, siteId: string, frequence: string): Promise<any[]> {
  const equipements = await db('equipements', { query: `&site_id=eq.${siteId}&actif=eq.true&actif_ronde=eq.true&order=ordre_ronde.asc` });
  if (!Array.isArray(equipements)) return [];
  const valides = await db('rondes_equipements', { query: `&ronde_id=eq.${rondeId}&statut=eq.valide` });
  const validatedIds = new Set((Array.isArray(valides) ? valides : []).map((r: any) => r.equipement_id));
  const restants: any[] = [];
  for (const e of equipements) {
    if (validatedIds.has(e.id)) continue;
    const qs = await db('questions', {
      query: `&equipement_id=eq.${e.id}&actif=eq.true&frequences=cs.${encodeURIComponent('{' + frequence + '}')}&limit=1`
    });
    if (Array.isArray(qs) && qs.length > 0) restants.push(e);
  }
  // Ajouter "Relevé énergie" comme équipement spécial pour la ronde journalière
  // — uniquement si le site a le module "general" (pas uniquement "residence")
  if (frequence === 'journalier') {
    const siteRaw = await db('sites', { query: `&id=eq.${siteId}&limit=1`, select: 'modules' });
    const siteMods: string[] = Array.isArray(siteRaw) && siteRaw[0] && Array.isArray(siteRaw[0].modules) ? siteRaw[0].modules : [];
    const hasEnergieModule = siteMods.length === 0 || siteMods.includes('general');
    if (hasEnergieModule) {
      const hasConfig = await db('energie_config', { query: `&site_id=eq.${siteId}&actif=eq.true&limit=1`, select: 'id' });
      if (Array.isArray(hasConfig) && hasConfig.length > 0) {
        const dejaSaisi = await releveEnergieFaitAujourdhui(siteId);
        if (!dejaSaisi) restants.push({ id: '__releve_energie__', nom: '⚡ Relevé énergie' });
      }
    }
  }
  return restants;
}

// Vérifie si une ronde est complète sur une période donnée
async function rondeCompleteDepuis(siteId: string, frequence: string, dateFrom: string, nbEquipements: number): Promise<boolean> {
  // Si aucun équipement de ronde configuré, la ronde ne peut jamais être "complète"
  if (nbEquipements === 0) return false;
  const rondes = await db('rondes', {
    query: `&site_id=eq.${siteId}&date_ronde=gte.${dateFrom}&frequence=eq.${frequence}`
  });
  if (!Array.isArray(rondes) || !rondes.length) return false;
  for (const ronde of rondes) {
    const valides = await db('rondes_equipements', { query: `&ronde_id=eq.${ronde.id}&statut=eq.valide` });
    if ((Array.isArray(valides) ? valides.length : 0) >= nbEquipements) return true;
  }
  return false;
}

// Fréquences disponibles pour un site
// - releve_horaire : jamais bloqué, toujours disponible si actif
// - journalier : bloqué si déjà complet aujourd'hui
// - hebdo : bloqué si déjà complet cette semaine
// - mensuel : bloqué si déjà complet ce mois
async function getFrequencesDisponibles(site: any): Promise<string[]> {
  const freqs: string[] = [];
  // Pour les rondes : compter uniquement les équipements actif_ronde, hors cuves (capacite_litres)
  const equipsRonde = await db('equipements', { query: `&site_id=eq.${site.id}&actif=eq.true&actif_ronde=eq.true&capacite_litres=is.null` });
  const nbEquip = Array.isArray(equipsRonde) ? equipsRonde.length : 0;

  const periodMap: Record<string, string> = {
    journalier: getToday(),
    hebdo:      getStartOfWeek(),
    mensuel:    getStartOfMonth(),
  };

  // Rondes d'abord (journalier, hebdo, mensuel)
  for (const freq of ['journalier', 'hebdo', 'mensuel'] as string[]) {
    const isActif = freq === 'journalier' ? site.journalier_actif : freq === 'hebdo' ? site.hebdo_actif : site.mensuel_actif;
    if (!isActif) continue;
    const complete = await rondeCompleteDepuis(site.id, freq, periodMap[freq], nbEquip);
    if (!complete) freqs.push(freq);
  }

  // Relevé horaire
  if (site.releve_horaire_actif !== false) {
    const equipsReleve = await db('equipements', { query: `&site_id=eq.${site.id}&actif=eq.true&actif_releve=eq.true&limit=1` });
    if (Array.isArray(equipsReleve) && equipsReleve.length > 0) freqs.push('releve_horaire');
  }

  // Relevé énergie — disponible si le site a le module "general" (ou pas de module restrictif)
  // + une energie_config active existe + pas encore saisi aujourd'hui
  const mods: string[] = Array.isArray(site.modules) ? site.modules : [];
  const hasEnergieModule = mods.length === 0 || mods.includes('general');
  if (hasEnergieModule) {
    const hasConfig = await db('energie_config', { query: `&site_id=eq.${site.id}&actif=eq.true&limit=1`, select: 'id' });
    if (Array.isArray(hasConfig) && hasConfig.length > 0) {
      const dejaSaisi = await releveEnergieFaitAujourdhui(site.id);
      if (!dejaSaisi) freqs.push('releve_energie');
    }
  }

  // Ronde de zones — disponible si des zones actives existent pour ce site
  const zonesActives = await db('zones', { query: `&site_id=eq.${site.id}&actif=eq.true&limit=1`, select: 'id' });
  if (Array.isArray(zonesActives) && zonesActives.length > 0) freqs.push('ronde_zones');

  return freqs;
}

// Vérifie si le relevé énergie d'hier a déjà été saisi pour ce site
// (le bot enregistre la consommation de la veille, d'où getHier())
async function releveEnergieFaitAujourdhui(siteId: string): Promise<boolean> {
  const rows = await db('releves_energie', {
    query: `&site_id=eq.${siteId}&date_releve=eq.${getHier()}&limit=1`,
    select: 'id'
  });
  return Array.isArray(rows) && rows.length > 0;
}

// ── Calculs cuve — identiques au dashboard ────────────────────────────────────
// pct = niveau / capacite * 100
// autonomie = niveau / (consoH * 8h/jour)  ← 8h de marche par jour
function calcCuve(niveauL: number, capaciteL: number, consoH: number) {
  const pct = Math.min(100, Math.round(niveauL / capaciteL * 100));
  const autoJ = consoH > 0 ? Math.round(niveauL / (consoH * 8) * 10) / 10 : null;
  const col = pct <= 20 ? '🔴' : pct <= 40 ? '🟡' : '🟢';
  return { pct, autoJ, col };
}

// ── Seuils — non bloquants ────────────────────────────────────────────────────
async function alerterSeuilsEnArrierePlan(equip: any, questions: any[], reponses: Array<{question_id: string, valeur: string}>, siteNom: string, contact: any) {
  const alertes: string[] = [];
  for (const r of reponses) {
    const q = questions.find((q: any) => q.id === r.question_id);
    if (!q || q.type_reponse !== 'numerique') continue;
    const val = parseFloat(r.valeur.replace(',', '.'));
    if (isNaN(val)) continue;
    if (q.seuil_min != null && val < q.seuil_min) alertes.push(`⬇️ *${q.texte}* : ${val}${q.unite || ''} (min : ${q.seuil_min})`);
    if (q.seuil_max != null && val > q.seuil_max) alertes.push(`⬆️ *${q.texte}* : ${val}${q.unite || ''} (max : ${q.seuil_max})`);
  }
  if (!alertes.length) return;
  const msg = `🚨 *Seuil dépassé — ${equip.nom}*\n_${siteNom}_\n\n${alertes.join('\n')}\n\n_Signalé par ${contact.nom} · ${getHeure()}_`;
  const dejaEnvoyes = new Set<string>();
  // 1. Destinataires configurés sur l'équipement
  const dests = await db('alertes_destinataires', { query: `&equipement_id=eq.${equip.id}` });
  if (Array.isArray(dests)) {
    for (const d of dests) {
      if (d.type_contact === 'whatsapp' && !dejaEnvoyes.has(d.contact)) {
        dejaEnvoyes.add(d.contact);
        await sendWA(d.contact, msg).catch(() => {});
      }
    }
  }
  // 2. Toujours notifier resp_tech + dir_tech + technicien du site
  const responsables = await getResponsablesForSite(equip.site_id);
  const techsSeuil = await db('contacts', { query: `&site_id=eq.${equip.site_id}&role=eq.technicien&actif=eq.true` }).catch(() => []);
  const destsSeuil = [...(Array.isArray(responsables) ? responsables : []), ...(Array.isArray(techsSeuil) ? techsSeuil : [])];
  for (const r of destsSeuil) {
    if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
      dejaEnvoyes.add(r.whatsapp);
      await sendWA(r.whatsapp, msg).catch(() => {});
    }
  }
}

// ── Format questions ──────────────────────────────────────────────────────────
function fmtQuestion(q: any, lastVal?: string): string {
  if (q.type_reponse === 'choix' && Array.isArray(q.options) && q.options.length > 0) {
    const opts = q.options.map((opt: string, i: number) => `*${i + 1}* — ${opt}`).join('\n');
    return `❓ *${q.texte}*\n\n${opts}`;
  }
  if (q.type_reponse === 'numerique') {
    let text = `🕐 *${q.texte}*`;
    if (q.unite) text += ` _(${q.unite})_`;
    if (lastVal != null) text += `\n_(Dernier relevé : *${lastVal}${q.unite ? ' ' + q.unite : ''}*)_`;
    else if (q.exemple != null) text += `\n_(ex : ${q.exemple}${q.unite ? ' ' + q.unite : ''})_`;
    return text;
  }
  if (q.type_reponse === 'oui_non') return `❓ *${q.texte}*\n_(OUI ou NON)_`;
  let text = `📝 *${q.texte}*`;
  if (q.unite) text += ` _(${q.unite})_`;
  return text;
}
function fmtRecap(nomEquip: string, questions: any[], reponses: Array<{question_id: string, valeur: string}>): string {
  let text = `📋 *Récap — ${nomEquip}*\n\n`;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const r = reponses.find(r => r.question_id === q.id);
    const val = r?.valeur || '—';
    const unite = q.unite ? ` ${q.unite}` : '';
    text += `${i + 1}. ${q.texte} : *${val}${unite}*\n`;
  }
  text += `\nValidez cette saisie ? *(OUI / NON)*`;
  return text;
}
// ── Format relevé énergie ─────────────────────────────────────────────────────
function fmtFluidQuestion(fluide: any, lastVal: any, idx: number, total: number): string {
  let txt = `⚡ *Relevé énergie (${idx}/${total})*\n\n📊 *${fluide.nom}*`;
  if (fluide.unite) txt += ` _(${fluide.unite})_`;
  txt += '\n';
  if (lastVal != null) txt += `_(Dernier relevé : *${lastVal}${fluide.unite ? ' ' + fluide.unite : ''}*)_`;
  else txt += `_(Saisissez la valeur actuelle)_`;
  return txt;
}
function fmtRecapEnergie(fluides: any[], reponses: Record<string, number>, lastReleve: Record<string, any>, siteNom: string): string {
  let txt = `⚡ *Récap relevé énergie*\n_${siteNom} · consommation du ${getHier()}_\n\n`;
  for (const f of fluides) {
    const v = reponses[f.id];
    if (v == null) continue;
    const lv = lastReleve[f.id];
    const delta = (f.type_valeur === 'index' && lv != null)
      ? ` (+${Math.round((v - parseFloat(String(lv))) * 10) / 10}${f.unite ? ' ' + f.unite : ''})`
      : '';
    const emoji = (f.seuil_alerte_bas != null && v < f.seuil_alerte_bas) ? '⚠️' : '✅';
    txt += `${emoji} ${f.nom} : *${v}${f.unite ? ' ' + f.unite : ''}*${delta}\n`;
  }
  txt += `\nValider ce relevé ? *(OUI / NON)*`;
  return txt;
}

async function getLastSaisieContext(equipementId: string, questions: any[], lastValues: Record<string, string>): Promise<string> {
  const lastRE = await db('rondes_equipements', {
    query: `&equipement_id=eq.${equipementId}&statut=eq.valide&order=valide_at.desc&limit=1`
  });
  if (!Array.isArray(lastRE) || !lastRE[0]?.valide_at) return '';
  const valideAt = new Date(lastRE[0].valide_at);
  const todayStr = getToday();
  const heureStr = valideAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
  const valideDateStr = valideAt.toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  const hierStr = hier.toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
  let quand = valideDateStr === todayStr ? `aujourd'hui à ${heureStr}` : valideDateStr === hierStr ? `hier à ${heureStr}` : valideAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Dakar' });
  const parts: string[] = [];
  for (const q of questions) {
    const lv = lastValues[q.id];
    if (!lv) continue;
    if (q.type_reponse === 'numerique') parts.push(`🕐 ${lv}${q.unite || ''}`);
    else if (q.type_reponse === 'choix') parts.push(lv);
  }
  if (!parts.length) return '';
  return `📋 _Dernière saisie — ${quand}_\n_${parts.join(' · ')}_\n\n`;
}

// ── Rapport de fin de ronde ───────────────────────────────────────────────────
function chunkJoin(header: string, lines: string[], maxLen = 1400): string[] {
  if (!lines.length) return [];
  const out: string[] = [];
  let current = header; let hasContent = false;
  for (const line of lines) {
    const candidate = current + '\n\n' + line;
    if (candidate.length > maxLen && hasContent) { out.push(current); current = header + ' _(suite)_\n\n' + line; hasContent = true; }
    else { current = candidate; hasContent = true; }
  }
  if (hasContent) out.push(current);
  return out;
}
async function sendRapportRonde(rondeId: string, phone: string, techNom: string, siteNom: string, clientId: string, siteId: string, frequence: string) {
  const heure = getHeure(); const today = getToday();
  const rondeEquipements = await db('rondes_equipements', { query: `&ronde_id=eq.${rondeId}&statut=eq.valide` });
  if (!Array.isArray(rondeEquipements)) return;
  const equipements = await db('equipements', { query: `&site_id=eq.${siteId}&actif=eq.true&order=ordre_ronde.asc` });

  const anomalies: Array<{equip: string, desc: string}> = [];
  const alertesSeuils: string[] = [];
  const recommandations: string[] = [];
  const groupOrder: string[] = [];
  const groupLines: Record<string, string[]> = {};

  for (const re of rondeEquipements) {
    const equip = Array.isArray(equipements) ? equipements.find((e: any) => e.id === re.equipement_id) : null;
    if (!equip) continue;
    const [repRaw, anoRaw, questions] = await Promise.all([
      db('reponses', { query: `&ronde_equipement_id=eq.${re.id}` }),
      db('anomalies', { query: `&ronde_equipement_id=eq.${re.id}` }),
      getQuestions(equip.id, frequence)
    ]);
    const reps = Array.isArray(repRaw) ? repRaw : [];
    if (Array.isArray(anoRaw)) for (const a of anoRaw) anomalies.push({ equip: equip.nom, desc: a.description });
    let ligne = `*${equip.nom}*\n`;
    for (const r of reps) {
      const q = questions.find((q: any) => q.id === r.question_id);
      if (!q) continue;
      const unite = q.unite ? ` ${q.unite}` : '';
      let emoji = '';
      if (q.type_reponse === 'numerique') {
        const val = parseFloat(r.valeur);
        if (!isNaN(val)) {
          const ko = (q.seuil_min != null && val < q.seuil_min) || (q.seuil_max != null && val > q.seuil_max);
          emoji = ko ? ' ⚠️' : ' ✅';
          if (ko) alertesSeuils.push(`${equip.nom} — ${q.texte} : ${val}${unite}`);
        }
      }
      ligne += `${q.texte} : ${r.valeur}${unite}${emoji}\n`;
      // Recommandation vidange — aligné dashboard
      if (equip.seuil_vidange_heures && q.texte.toLowerCase().includes('compteur')) {
        const compteur = parseFloat(r.valeur);
        const seuil = parseFloat(equip.seuil_vidange_heures);
        if (!isNaN(compteur) && seuil > 0) {
          const typeCompteur = equip.type_compteur_heures || 'cumule';
          let heuresDepuis: number;
          let prochain: number;
          if (typeCompteur === 'depuis_entretien') {
            heuresDepuis = Math.max(0, compteur);
            prochain = seuil;
          } else {
            const baseline = equip.heures_dernier_vidange != null ? parseFloat(equip.heures_dernier_vidange) : 0;
            heuresDepuis = Math.max(0, compteur - baseline);
            prochain = baseline + seuil;
          }
          const hRestantes = Math.max(0, Math.round(seuil - heuresDepuis));
          const pct = Math.round(heuresDepuis / seuil * 100);
          const em = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
          recommandations.push(`${em} ${equip.nom} — Vidange dans ~${hRestantes}h (${Math.round(heuresDepuis)}h → ${Math.round(prochain)}h)`);
        }
      }
      // Recommandation cuve — aligné dashboard
      if (equip.capacite_litres && q.texte.toLowerCase().includes('niveau')) {
        const niveau = parseFloat(r.valeur);
        if (!isNaN(niveau)) {
          const allEquips = Array.isArray(equipements) ? equipements : [];
          const consoH = equip.conso_theorique_lh
            ? parseFloat(equip.conso_theorique_lh)
            : allEquips.filter((e: any) => e.id !== equip.id && e.conso_theorique_lh).reduce((s: number, e: any) => s + parseFloat(e.conso_theorique_lh), 0);
          const { pct, autoJ, col } = calcCuve(niveau, parseFloat(equip.capacite_litres), consoH);
          recommandations.push(`${col} Cuve — ${niveau}L / ${equip.capacite_litres}L (${pct}%)${autoJ ? ` · Autonomie ~${autoJ}j` : ''}`);
        }
      }
    }
    const typeNom = equip.capacite_litres ? 'Cuve carburant' : equip.conso_theorique_lh ? 'Groupes électrogènes' : 'Autres équipements';
    if (!groupLines[typeNom]) { groupLines[typeNom] = []; groupOrder.push(typeNom); }
    groupLines[typeNom].push(ligne.trim());
  }

  const typeEmoji: Record<string, string> = { 'Groupes électrogènes': '⚡', 'Cuve carburant': '⛽', 'Autres équipements': '🔧' };
  const messages: string[] = [];
  let intro = `📋 *Rapport ronde ${frequence} — ${today}*\n${siteNom} · ${heure}\nTechnicien : ${techNom}`;
  if (anomalies.length > 0) { intro += `\n\n⚠️ *Anomalies*`; for (const a of anomalies) intro += `\n• ${a.equip} — ${a.desc}`; }
  if (alertesSeuils.length > 0) { intro += `\n\n🌡️ *Seuils dépassés*`; for (const a of alertesSeuils) intro += `\n• ${a}`; }
  if (!anomalies.length && !alertesSeuils.length) intro += `\n\n✅ Aucune anomalie`;
  messages.push(intro);
  for (const typeNom of groupOrder) {
    const emoji = typeEmoji[typeNom] || '🔧';
    for (const m of chunkJoin(`${emoji} *${typeNom}*`, groupLines[typeNom])) messages.push(m);
  }
  if (recommandations.length > 0) for (const m of chunkJoin('💡 *Recommandations*', recommandations)) messages.push(m);

  const dejaEnvoyes = new Set<string>([phone]);
  for (const m of messages) await sendWA(phone, m);
  const responsables = await getResponsablesForSite(siteId);
  if (Array.isArray(responsables)) {
    for (const r of responsables) {
      if (!r.whatsapp || dejaEnvoyes.has(r.whatsapp)) continue;
      dejaEnvoyes.add(r.whatsapp);
      for (const m of messages) await sendWA(r.whatsapp, m);
    }
  }
}

// ── Démarrer ronde ────────────────────────────────────────────────────────────
async function demarrerSaisie(phone: string, contact: any, site: any): Promise<any> {
  const freqs = await getFrequencesDisponibles(site);

  const freqLabels: Record<string, string> = {
    releve_horaire:  '📊 Relevé horaire',
    journalier:      '☀️ Ronde journalière',
    hebdo:           '📅 Ronde hebdomadaire',
    mensuel:         '🗓️ Ronde mensuelle',
    releve_energie:  '⚡ Relevé énergie',
    ronde_zones:     '🏠 Ronde de zones',
  };
  const EXTRAS = [
    '🚨 Déclarer une panne',
    '📋 Suivi des signalements',
    '🌙 Bilan de journée',
  ];

  const sd = { tech_id: contact.id, tech_nom: contact.nom, site_id: site.id, site_nom: site.nom, active_site_id: site.id };

  const freqListe = freqs.map((f: string, i: number) => `*${i + 1}* — ${freqLabels[f] || f}`).join('\n');
  const sep = freqs.length ? '\n\n' : '';
  const extrasListe = EXTRAS.map((label, i) => `*${freqs.length + i + 1}* — ${label}`).join('\n');
  const liste = freqListe + sep + extrasListe;

  await setSession(phone, 'saisie_choix_freq', { ...sd, freqs });
  return sendWA(phone, `Bonjour ${contact.nom} 👋\n*${site.nom}*\n\nQue souhaitez-vous faire ?\n\n${liste}`);
}

async function envoyerLienReleve(phone: string, site: any, techNom: string): Promise<any> {
  const link = await getReleveLink(site.id);
  if (!link) return sendWA(phone, `⚠️ Lien de relevé non disponible.\nContactez votre responsable technique.`);
  return sendWA(phone,
    `📊 *Relevé horaire — ${site.nom}*\n\nBonjour ${techNom} !\n\nOuvrez ce lien pour saisir le relevé :\n${link}\n\n_Vous pouvez faire plusieurs relevés dans la journée._`
  );
}

async function envoyerLienRondeZones(phone: string, site: any, contact: any): Promise<any> {
  const link = `${BASE_URL}/ronde-zones.html?site=${site.id}&contact=${contact.id}`;
  return sendWA(phone,
    `🏠 *Ronde de zones — ${site.nom}*\n\nBonjour ${contact.nom} !\n\nOuvrez ce lien pour effectuer la ronde :\n${link}\n\n_Validez chaque zone au fur et à mesure._`
  );
}

async function demarrerReleveEnergie(phone: string, contact: any, site: any): Promise<any> {
  const fluides = await db('energie_config', {
    query: `&site_id=eq.${site.id}&actif=eq.true&order=ordre.asc`
  });
  if (!Array.isArray(fluides) || !fluides.length) {
    return sendWA(phone, `⚠️ Aucun fluide configuré pour le relevé énergie.\nContactez votre responsable.`);
  }
  // Récupérer le dernier relevé pour afficher les valeurs précédentes
  const lastReleveRaw = await db('releves_energie', {
    query: `&site_id=eq.${site.id}&order=date_releve.desc&limit=1`
  });
  const lastRow = Array.isArray(lastReleveRaw) && lastReleveRaw.length > 0 ? lastReleveRaw[0] : null;
  const lastReleve: Record<string, any> = lastRow?.valeurs || {};

  const f = fluides[0];
  const sd = {
    site_id: site.id, site_nom: site.nom,
    tech_id: contact.id, tech_nom: contact.nom,
    fluides: fluides.map((fl: any) => ({
      id: fl.id, nom: fl.nom,
      unite: fl.unite || '',
      type_valeur: fl.type_valeur || 'index',
      seuil_alerte_bas: fl.seuil_alerte_bas ?? null,
      seuil_delta_alerte: fl.seuil_delta_alerte ?? null
    })),
    reponses: {} as Record<string, number>,
    anomalies: {} as Record<string, string>,
    field_idx: 0,
    last_releve: lastReleve
  };
  await setSession(phone, 'energie_saisie', sd);
  return sendWA(phone, fmtFluidQuestion(f, lastReleve[f.id] ?? null, 1, fluides.length));
}

// Lancé depuis la ronde — stocke le contexte ronde pour y revenir après validation
async function demarrerReleveEnergieDepuisRonde(phone: string, contact: any, site: any, rondeCtx: any): Promise<any> {
  const fluides = await db('energie_config', { query: `&site_id=eq.${site.id}&actif=eq.true&order=ordre.asc` });
  if (!Array.isArray(fluides) || !fluides.length) {
    return sendWA(phone, `⚠️ Aucun fluide configuré pour le relevé énergie.\nContactez votre responsable.`);
  }
  const lastReleveRaw = await db('releves_energie', { query: `&site_id=eq.${site.id}&order=date_releve.desc&limit=1` });
  const lastRow = Array.isArray(lastReleveRaw) && lastReleveRaw.length > 0 ? lastReleveRaw[0] : null;
  const lastReleve: Record<string, any> = lastRow?.valeurs || {};
  const f = fluides[0];
  const sd = {
    site_id: site.id, site_nom: site.nom,
    tech_id: contact.id, tech_nom: contact.nom,
    fluides: fluides.map((fl: any) => ({
      id: fl.id, nom: fl.nom, unite: fl.unite || '',
      type_valeur: fl.type_valeur || 'index',
      seuil_alerte_bas: fl.seuil_alerte_bas ?? null,
      seuil_delta_alerte: fl.seuil_delta_alerte ?? null
    })),
    reponses: {} as Record<string, number>,
    anomalies: {} as Record<string, string>,
    field_idx: 0,
    last_releve: lastReleve,
    ronde_context: {
      ronde_id: rondeCtx.ronde_id,
      site_id: rondeCtx.site_id,
      site_nom: rondeCtx.site_nom,
      frequence: rondeCtx.frequence,
      tech_id: rondeCtx.tech_id,
      tech_nom: rondeCtx.tech_nom,
      client_id: rondeCtx.client_id || null
    }
  };
  await setSession(phone, 'energie_saisie', sd);
  return sendWA(phone, fmtFluidQuestion(f, lastReleve[f.id] ?? null, 1, fluides.length));
}

async function demarrerRonde(phone: string, contact: any, site: any, sd: any, frequence: string): Promise<any> {
  const rondeId = await getOrCreateRonde(site.id, contact.id, frequence);
  const restants = await getEquipementsRestants(rondeId, site.id, frequence);
  if (!restants.length) return sendWA(phone, `✅ Ronde ${frequence} déjà complète.`);
  const liste = restants.map((e: any, i: number) => `*${i + 1}* — ${e.nom}`).join('\n');
  await setSession(phone, 'saisie_choix_equip', {
    ...sd, frequence, ronde_id: rondeId,
    restants: restants.map((e: any) => ({ id: e.id, nom: e.nom }))
  });
  const freq_label: Record<string, string> = { journalier: 'journalière', hebdo: 'hebdomadaire', mensuel: 'mensuelle' };
  return sendWA(phone, `Bonjour ${contact.nom} 👋\n*${site.nom}* — Ronde ${freq_label[frequence] || frequence}\n\n${restants.length} équipement(s) à vérifier :\n\n${liste}\n\nLequel commencer ?`);
}

async function continuerRonde(phone: string, sd: any, contact: any, site: any): Promise<any> {
  const restants = await getEquipementsRestants(sd.ronde_id, sd.site_id, sd.frequence);
  if (!restants.length) {
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
    return sendRapportRonde(sd.ronde_id, phone, contact.nom, site?.nom || sd.site_nom, sd.client_id || '', sd.site_id, sd.frequence);
  }
  const liste = restants.map((e: any, i: number) => `*${i + 1}* — ${e.nom}`).join('\n');
  await setSession(phone, 'saisie_choix_equip', { ...sd, restants: restants.map((e: any) => ({ id: e.id, nom: e.nom })) });
  return sendWA(phone, `${restants.length} équipement(s) restant(s) :\n\n${liste}\n\nLequel faire ?`);
}

// ── Panne → signalement ───────────────────────────────────────────────────────
async function demarrerPanne(phone: string, contact: any, site: any): Promise<any> {
  const equips = await getEquipementsTechnicien(site?.id || contact.site_id);
  if (!equips.length) return sendWA(phone, `Aucun équipement configuré. Contactez votre administrateur.`);
  const liste = equips.map((e: any, i: number) => `*${i + 1}* — ${e.nom}`).join('\n');
  await setSession(phone, 'panne_equip', {
    active_site_id: site?.id || contact.site_id,
    site_id: site?.id || contact.site_id,
    site_nom: site?.nom || '',
    tech_nom: contact.nom,
    equips: equips.map((e: any) => ({ id: e.id, nom: e.nom, type_id: e.type_id }))
  });
  return sendWA(phone, `🚨 *SIGNALEMENT DE PANNE*\n*${site?.nom || ''}*\n\nQuel équipement est en panne ?\n\n${liste}\n\nRépondez avec le numéro.`);
}

// ── Résolu → signalement + maintenance ───────────────────────────────────────
async function demarrerResolu(phone: string, contact: any, site: any): Promise<any> {
  const siteId = site?.id || contact.site_id;
  const signalements = await db('signalements', {
    query: `&groupe_id=eq.${siteId}&statut=in.(ouvert,en_cours)&order=created_at.desc`
  });
  const ouverts = Array.isArray(signalements) ? signalements : [];
  if (!ouverts.length) return sendWA(phone, `✅ Aucun signalement ouvert pour *${site?.nom || ''}*.`);

  const equipIds = [...new Set(ouverts.map((s: any) => s.equipement_id).filter(Boolean))];
  const equipMap: Record<string, string> = {};
  if (equipIds.length > 0) {
    const equips = await db('equipements', { query: `&id=in.(${equipIds.join(',')})` });
    if (Array.isArray(equips)) for (const e of equips) equipMap[e.id] = e.nom;
  }

  const liste = ouverts.map((s: any, i: number) => {
    const equipNom = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
    const typeLabel: Record<string, string> = { panne: '⚡ Panne', anomalie: '👁 Anomalie', autre: '📝 Autre' };
    return `*${i + 1}* — ${equipNom} · ${(typeLabel[s.type] || s.type)} · ${(s.description || '').substring(0, 40)}`;
  }).join('\n');

  await setSession(phone, 'resolu_choix', {
    active_site_id: siteId,
    site_id: siteId,
    site_nom: site?.nom || '',
    tech_nom: contact.nom,
    signalements: ouverts.map((s: any) => ({
      id: s.id,
      equipement: s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—',
      equipement_id: s.equipement_id || null,
      groupe_id: s.groupe_id,
      type: s.type,
      description: s.description || s.type
    }))
  });
  return sendWA(phone, `✅ *Clôturer un signalement*\n*${site?.nom || ''}*\n\nQuel signalement est résolu ?\n\n${liste}\n\nRépondez avec le numéro.`);
}

// ── Suivi → hub interactif numéroté ──────────────────────────────────────────
async function demarrerSuivi(phone: string, contact: any, site: any): Promise<any> {
  const siteId = site?.id || contact.site_id;
  const siteNom = site?.nom || '';
  const today = getToday();

  const signalements = await db('signalements', {
    query: `&groupe_id=eq.${siteId}&statut=in.(ouvert,en_cours,resolu)&order=created_at.asc&limit=50`
  });
  const allSigs = Array.isArray(signalements) ? signalements : [];

  const sigs = allSigs.filter((s: any) =>
    s.statut === 'ouvert' || s.statut === 'en_cours' ||
    (s.statut === 'resolu' && (s.resolved_at || '').substring(0, 10) === today)
  );

  if (!sigs.length) return sendWA(phone, `✅ *${siteNom}*\n\nAucun signalement en cours ni résolu aujourd'hui.`);

  const equipIds = [...new Set(sigs.map((s: any) => s.equipement_id).filter(Boolean))];
  const equipMap: Record<string, string> = {};
  if (equipIds.length > 0) {
    const equips = await db('equipements', { query: `&id=in.(${equipIds.join(',')})` });
    if (Array.isArray(equips)) for (const e of equips) equipMap[e.id] = e.nom;
  }

  const ouverts = sigs.filter((s: any) => s.statut === 'ouvert');
  const enCours = sigs.filter((s: any) => s.statut === 'en_cours');
  const resolus = sigs.filter((s: any) => s.statut === 'resolu');

  // Construire la liste numérotée en continu (ouverts → en_cours → résolus)
  const indexed: Array<{ num: number; id: string; ref_code: string; statut: string; desc: string }> = [];
  let num = 1;
  let msg = `📋 *Suivi signalements*\n*${siteNom}*\n`;

  if (ouverts.length) {
    msg += `\n🔴 *Non pris en charge (${ouverts.length})*\n`;
    for (const s of ouverts) {
      const eq = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
      const desc = (s.description || '').substring(0, 45);
      msg += `*${num}* — ${s.ref_code || '—'} · ${eq} — ${desc}\n`;
      indexed.push({ num, id: s.id, ref_code: s.ref_code || '', statut: s.statut, desc: (s.description || '').substring(0, 60) });
      num++;
    }
  }
  if (enCours.length) {
    msg += `\n🟡 *En cours (${enCours.length})*\n`;
    for (const s of enCours) {
      const eq = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
      const desc = (s.description || '').substring(0, 45);
      const par = s.assigne_a || s.pris_en_charge_par || '—';
      msg += `*${num}* — ${s.ref_code || '—'} · ${eq} — ${desc} _(${par})_\n`;
      indexed.push({ num, id: s.id, ref_code: s.ref_code || '', statut: s.statut, desc: (s.description || '').substring(0, 60) });
      num++;
    }
  }
  if (resolus.length) {
    msg += `\n✅ *Résolus aujourd'hui (${resolus.length})*\n`;
    for (const s of resolus) {
      const eq = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
      const desc = (s.description || '').substring(0, 45);
      msg += `*${num}* — ${s.ref_code || '—'} · ${eq} — ${desc}\n`;
      indexed.push({ num, id: s.id, ref_code: s.ref_code || '', statut: s.statut, desc: (s.description || '').substring(0, 60) });
      num++;
    }
  }

  // Footer interactif uniquement si des signalements actifs existent
  const nonResolus = indexed.filter(i => i.statut !== 'resolu');
  if (nonResolus.length > 0) {
    msg += `\n_Tapez un ou plusieurs numéros pour prendre en charge et recevoir le lien rapport._\n_Ex : *1 2* ou *3*_`;
  }

  await setSession(phone, 'suivi_choix', {
    active_site_id: siteId,
    site_id: siteId,
    site_nom: siteNom,
    tech_nom: contact.nom,
    sigs: indexed,
  });
  return sendWA(phone, msg.trim());
}

// ── Bilan fin de journée ───────────────────────────────────────────────────────
async function demarrerBilan(phone: string, contact: any, site: any): Promise<any> {
  const siteId = site?.id || contact.site_id;
  const siteNom = site?.nom || '';
  const today = getToday();

  const freqLabels: Record<string, string> = {
    journalier: 'Ronde journalière', hebdo: 'Ronde hebdomadaire',
    mensuel: 'Ronde mensuelle', releve_horaire: 'Relevé horaire', releve_energie: 'Relevé énergie',
  };

  // Rondes effectuées aujourd'hui par ce tech
  const rondesRaw = await db('rondes', {
    query: `&site_id=eq.${siteId}&technicien_id=eq.${contact.id}&date_ronde=eq.${today}`,
    select: 'id,frequence'
  });
  const rondesArr = Array.isArray(rondesRaw) ? rondesRaw : [];

  // Signalements résolus aujourd'hui sur le site (quel que soit le résolveur — rapport.html ou commande resolu)
  const sigsRaw = await db('signalements', {
    query: `&groupe_id=eq.${siteId}&statut=eq.resolu&resolved_at=gte.${today}T00:00:00`,
    select: 'id,ref_code,description,equipement_id,resolved_by'
  });
  const sigsArr = Array.isArray(sigsRaw) ? sigsRaw : [];

  // Signalements en cours pris en charge par ce tech (non encore résolus)
  const sigsEnCoursRaw = await db('signalements', {
    query: `&groupe_id=eq.${siteId}&statut=eq.en_cours&pris_en_charge_par=eq.${encodeURIComponent(contact.nom)}`,
    select: 'id,ref_code,description,equipement_id'
  });
  const sigsEnCoursArr = Array.isArray(sigsEnCoursRaw) ? sigsEnCoursRaw : [];

  // Noms équipements pour affichage
  const allSigsForEquip = [...sigsArr, ...sigsEnCoursArr];
  const equipIds = [...new Set(allSigsForEquip.map((s: any) => s.equipement_id).filter(Boolean))];
  const equipMap: Record<string, string> = {};
  if (equipIds.length > 0) {
    const equips = await db('equipements', { query: `&id=in.(${equipIds.join(',')})` });
    if (Array.isArray(equips)) for (const e of equips) equipMap[e.id] = e.nom;
  }

  let msg = `🌙 *Bilan de fin de journée*\n*${siteNom}* · ${today}\n\n`;
  if (rondesArr.length > 0) {
    msg += `📋 *Rondes effectuées :*\n`;
    for (const r of rondesArr) msg += `✅ ${freqLabels[r.frequence] || r.frequence}\n`;
    msg += '\n';
  } else {
    msg += `📋 *Rondes :* aucune aujourd'hui\n\n`;
  }
  if (sigsArr.length > 0) {
    msg += `🔧 *Signalements résolus (${sigsArr.length}) :*\n`;
    for (const s of sigsArr) {
      const eq = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
      msg += `✅ ${s.ref_code || '—'} — ${eq}\n`;
    }
    msg += '\n';
  } else {
    msg += `🔧 *Signalements résolus :* aucun aujourd'hui\n\n`;
  }
  if (sigsEnCoursArr.length > 0) {
    msg += `🔵 *Signalements en cours (${sigsEnCoursArr.length}) :*\n`;
    for (const s of sigsEnCoursArr) {
      const eq = s.equipement_id ? (equipMap[s.equipement_id] || '—') : '—';
      msg += `🔵 ${s.ref_code || '—'} — ${eq}\n`;
    }
    msg += '\n';
  }
  msg += `_Des blocages à signaler sur ces signalements ?_\n*(OUI / NON)*`;

  await setSession(phone, 'bilan_recap', {
    active_site_id: siteId,
    site_id: siteId,
    site_nom: siteNom,
    tech_nom: contact.nom,
    tech_id: contact.id,
    rondes: rondesArr.map((r: any) => ({ frequence: r.frequence })),
    sigs_resolus: sigsArr.map((s: any) => ({
      ref_code: s.ref_code || '—',
      desc: (s.description || '').substring(0, 60),
    })),
    sigs_en_cours: sigsEnCoursArr.map((s: any) => ({
      ref_code: s.ref_code || '—',
      desc: (s.description || '').substring(0, 60),
    })),
  });
  return sendWA(phone, msg.trim());
}

async function envoyerBilan(phone: string, contact: any, sd: any, blocages: string | null): Promise<any> {
  const today = getToday();
  const heure = getHeure();
  const siteNom = sd.site_nom || '';
  const freqLabels: Record<string, string> = {
    journalier: 'Ronde journalière', hebdo: 'Ronde hebdomadaire',
    mensuel: 'Ronde mensuelle', releve_horaire: 'Relevé horaire', releve_energie: 'Relevé énergie',
  };

  // Stocker dans bilans_journee
  await db('bilans_journee', { method: 'POST', body: {
    site_id: sd.site_id,
    tech_id: sd.tech_id || null,
    tech_nom: contact.nom,
    date_bilan: today,
    rondes: sd.rondes || [],
    signalements_resolus: sd.sigs_resolus || [],
    blocages: blocages || null,
  }}).catch(() => {});

  // Construire le message pour resp_tech
  const rondes: any[] = sd.rondes || [];
  const sigsResolus: any[] = sd.sigs_resolus || [];
  const sigsEnCours: any[] = sd.sigs_en_cours || [];
  let recapMsg = `🌙 *Bilan fin de journée — GenTrack*\n*${siteNom}*\n\n`;
  recapMsg += `👷 *${contact.nom}* · ${today} ${heure}\n\n`;
  if (rondes.length > 0) {
    recapMsg += `📋 *Rondes :*\n`;
    for (const r of rondes) recapMsg += `✅ ${freqLabels[r.frequence] || r.frequence}\n`;
    recapMsg += '\n';
  }
  if (sigsResolus.length > 0) {
    recapMsg += `🔧 *Signalements résolus :*\n`;
    for (const s of sigsResolus) recapMsg += `✅ ${s.ref_code} — ${s.desc}\n`;
    recapMsg += '\n';
  }
  if (sigsEnCours.length > 0) {
    recapMsg += `🔵 *Signalements en cours :*\n`;
    for (const s of sigsEnCours) recapMsg += `🔵 ${s.ref_code} — ${s.desc}\n`;
    recapMsg += '\n';
  }
  if (blocages) recapMsg += `⚠️ *Blocages :*\n${blocages}\n\n`;
  if (!rondes.length && !sigsResolus.length && !sigsEnCours.length && !blocages) recapMsg += `_Aucune activité enregistrée aujourd'hui._\n\n`;
  recapMsg += `_Envoyé par ${contact.nom}_`;

  const responsables = await getResponsablesForSite(sd.site_id);
  let envoyeCount = 0;
  if (Array.isArray(responsables)) {
    for (const r of responsables) {
      if (r.whatsapp && r.whatsapp !== phone) { await sendWA(r.whatsapp, recapMsg); envoyeCount++; }
    }
  }
  await setSession(phone, 'idle', { active_site_id: sd.active_site_id });
  const notif = envoyeCount > 0 ? `✅ Bilan envoyé à votre responsable. 📲` : `⚠️ Bilan enregistré — aucun responsable configuré.`;
  return sendWA(phone, notif);
}

// ── Bilans du jour pour resp_tech ──────────────────────────────────────────────
async function afficherBilansResp(phone: string, contact: any, site: any): Promise<any> {
  const siteId = site?.id || contact.site_id;
  const siteNom = site?.nom || '';
  const today = getToday();
  const freqLabels: Record<string, string> = {
    journalier: 'Ronde journalière', hebdo: 'Ronde hebdomadaire',
    mensuel: 'Ronde mensuelle', releve_horaire: 'Relevé horaire', releve_energie: 'Relevé énergie',
  };

  const bilans = await db('bilans_journee', {
    query: `&site_id=eq.${siteId}&date_bilan=eq.${today}&order=created_at.asc`,
    select: 'tech_nom,rondes,signalements_resolus,blocages,created_at'
  });
  const bilansArr = Array.isArray(bilans) ? bilans : [];

  if (!bilansArr.length) {
    return sendWA(phone, `🌙 *Bilans du jour — ${siteNom}*\n\nAucun bilan reçu pour le ${today}.\n_Vos techs l'envoient en tapant *bilan* en fin de journée._`);
  }

  let msg = `🌙 *Bilans du jour — ${siteNom}*\n_${today}_\n`;
  for (const b of bilansArr) {
    const heure = new Date(b.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
    msg += `\n👷 *${b.tech_nom}* · ${heure}\n`;
    const rondes: any[] = b.rondes || [];
    if (rondes.length > 0) msg += `📋 ${rondes.map((r: any) => freqLabels[r.frequence] || r.frequence).join(', ')}\n`;
    const sigs: any[] = b.signalements_resolus || [];
    if (sigs.length > 0) msg += `🔧 Résolus : ${sigs.map((s: any) => s.ref_code).join(', ')}\n`;
    if (b.blocages) msg += `⚠️ ${b.blocages}\n`;
    if (!rondes.length && !sigs.length && !b.blocages) msg += `_Aucune activité_\n`;
  }
  return sendWA(phone, msg.trim());
}

// ── Vidange ───────────────────────────────────────────────────────────────────
async function demarrerVidange(phone: string, contact: any, site: any): Promise<any> {
  const siteId = site?.id || contact.site_id;
  const equips = await getEquipementsTechnicien(siteId);
  const ges = equips.filter((e: any) => e.seuil_vidange_heures);
  if (!ges.length) return sendWA(phone, `Aucun groupe configuré pour les vidanges.`);

  const geAvecCompteur: any[] = [];
  for (const ge of ges) {
    const qCompteur = await db('questions', {
      query: `&equipement_id=eq.${ge.id}&actif=eq.true&texte=ilike.*compteur*&limit=1`
    });
    let derniereHeure = 0;
    if (Array.isArray(qCompteur) && qCompteur[0]) {
      const lastRep = await db('reponses', { query: `&question_id=eq.${qCompteur[0].id}&order=created_at.desc&limit=1` });
      if (Array.isArray(lastRep) && lastRep[0]) derniereHeure = parseFloat(lastRep[0].valeur) || 0;
    }
    const seuil = ge.seuil_vidange_heures || 250;
    const prochainSeuil = Math.ceil((derniereHeure + 0.01) / seuil) * seuil;
    const pct = Math.round((derniereHeure % seuil) / seuil * 100);
    const em = pct >= 90 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
    geAvecCompteur.push({ ...ge, derniereHeure, prochainSeuil, pct, em });
  }

  const liste = geAvecCompteur.map((g: any, i: number) =>
    `*${i + 1}* — ${g.nom} ${g.em} (${g.derniereHeure}h / ${g.prochainSeuil}h)`
  ).join('\n');

  await setSession(phone, 'vidange_equip', {
    active_site_id: siteId,
    site_id: siteId,
    site_nom: site?.nom || '',
    tech_nom: contact.nom,
    equips: geAvecCompteur.map((g: any) => ({ id: g.id, nom: g.nom, heures_total: g.derniereHeure, seuil_vidange: g.seuil_vidange_heures }))
  });
  return sendWA(phone, `🔧 *Déclaration de vidange*\n*${site?.nom || ''}*\n\nQuel groupe vient d'être vidangé ?\n\n${liste}\n\nRépondez avec le numéro.`);
}

// ── Plein carburant ───────────────────────────────────────────────────────────
async function demarrerPlein(phone: string, contact: any, site: any): Promise<any> {
  const CUVE_TYPE_ID = 'de5519d0-363b-4628-b872-2dcf01859002';
  const siteId = site?.id || contact.site_id;
  const allReservoirs = await db('equipements', {
    query: `&site_id=eq.${siteId}&actif=eq.true&capacite_litres=not.is.null&order=ordre_ronde.asc`
  });
  // Priorité : cuve dédiée, sinon GE avec réservoir intégré
  const reservoirs = Array.isArray(allReservoirs) ? [...allReservoirs] : [];
  reservoirs.sort((a: any, b: any) => (a.type_id === CUVE_TYPE_ID ? 0 : 1) - (b.type_id === CUVE_TYPE_ID ? 0 : 1));
  const cuve = reservoirs[0] || null;
  if (!cuve) return sendWA(phone, `Aucun réservoir configuré pour ce site. Contactez votre administrateur.`);

  const qNiveau = await db('questions', {
    query: `&equipement_id=eq.${cuve.id}&actif=eq.true&texte=ilike.*niveau*&limit=1`
  });
  let niveauPrec: number | null = null;
  if (Array.isArray(qNiveau) && qNiveau[0]) {
    const lastRep = await db('reponses', { query: `&question_id=eq.${qNiveau[0].id}&order=created_at.desc&limit=1` });
    if (Array.isArray(lastRep) && lastRep[0]) niveauPrec = parseFloat(lastRep[0].valeur);
  }
  const cap = parseFloat(cuve.capacite_litres);
  const prixLitre = cuve.prix_litre ? parseFloat(cuve.prix_litre) : null;
  const consoLh = cuve.conso_theorique_lh ? parseFloat(cuve.conso_theorique_lh) : 65;
  const niveauTxt = niveauPrec != null ? ` _(niveau actuel : ${niveauPrec}L / ${cap}L, ${Math.round(niveauPrec/cap*100)}%)_` : '';
  const prixTxt = prixLitre ? ` · ${prixLitre.toLocaleString('fr-FR')} FCFA/L` : '';
  await setSession(phone, 'plein_litres', {
    active_site_id: siteId,
    site_id: siteId, site_nom: site?.nom || '', tech_nom: contact.nom,
    cuve_id: cuve.id, cuve_nom: cuve.nom, cuve_capacite: cap, niveau_precedent: niveauPrec,
    prix_litre: prixLitre, conso_theorique: consoLh,
    question_niveau_id: Array.isArray(qNiveau) && qNiveau[0] ? qNiveau[0].id : null
  });
  return sendWA(phone, `⛽ *Ravitaillement — ${site?.nom || ''}*\n\n🛢️ *${cuve.nom}* (${cap}L)${niveauTxt}${prixTxt}\n\nCombien de litres ont été ajoutés ?\n_(Ex: 500)_`);
}

// ── Gestionnaire des états partagés ──────────────────────────────────────────
async function handleStates(phone: string, msg: string, bodyText: string, contact: any, site: any, state: string, sd: any, mediaUrl: string = ''): Promise<any> {
  const siteNom = site?.nom || sd.site_nom || '';
  const today = getToday();

  // ── Annuler — prioritaire sur tout autre état ─────────────
  if (['annuler', 'annule', 'retour', 'stop', 'cancel'].includes(msg)) {
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
    return sendWA(phone, `❌ Action annulée.\n\nTapez *aide* pour les commandes.`);
  }

  // ── Choix fréquence (menu plat) ───────────────────────────
  if (state === 'saisie_choix_freq') {
    const freqs: string[] = sd.freqs || [];
    const EXTRA_KEYS = ['panne', 'suivi', 'bilan'];
    const totalOptions = freqs.length + EXTRA_KEYS.length;
    const n = parseInt(msg.trim());
    if (isNaN(n) || n < 1 || n > totalOptions) return sendWA(phone, `Répondez avec un numéro entre 1 et ${totalOptions}.`);
    if (n <= freqs.length) {
      const freq = freqs[n - 1];
      if (freq === 'releve_horaire') return envoyerLienReleve(phone, site, contact.nom);
      if (freq === 'releve_energie') return demarrerReleveEnergie(phone, contact, site);
      if (freq === 'ronde_zones') return envoyerLienRondeZones(phone, site, contact);
      return demarrerRonde(phone, contact, site, sd, freq);
    }
    const extraKey = EXTRA_KEYS[n - freqs.length - 1];
    if (extraKey === 'panne') return demarrerPanne(phone, contact, site);
    if (extraKey === 'resolu') return demarrerResolu(phone, contact, site);
    if (extraKey === 'suivi') return demarrerSuivi(phone, contact, site);
    if (extraKey === 'bilan') return demarrerBilan(phone, contact, site);
  }

  // ── Choix équipement ──────────────────────────────────────
  if (state === 'saisie_choix_equip') {
    const restants = sd.restants || [];
    const n = parseInt(msg.trim()) - 1;
    if (isNaN(n) || n < 0 || n >= restants.length) return sendWA(phone, `Répondez avec un numéro entre 1 et ${restants.length}.`);
    const equip = restants[n];

    // Équipement spécial : relevé énergie depuis la ronde
    if (equip.id === '__releve_energie__') {
      const siteRaw = await db('sites', { query: `&id=eq.${sd.site_id}&limit=1` });
      const siteObj = Array.isArray(siteRaw) ? siteRaw[0] : null;
      if (!siteObj) return sendWA(phone, `Erreur : site introuvable.`);
      return demarrerReleveEnergieDepuisRonde(phone, contact, siteObj, sd);
    }

    const questions = await getQuestions(equip.id, sd.frequence);
    if (!questions.length) return sendWA(phone, `Aucune question configurée pour ${equip.nom}.`);
    const reId = await getOrCreateRondeEquipement(sd.ronde_id, equip.id);
    const lastValues = await getLastValues(questions);
    const contexte = await getLastSaisieContext(equip.id, questions, lastValues);
    await setSession(phone, 'saisie_question', { ...sd, equip_id: equip.id, equip_nom: equip.nom, re_id: reId, questions, reponses: [], q_idx: 0, lastValues });
    return sendWA(phone, `📝 *${equip.nom}*\n\n${contexte}${fmtQuestion(questions[0], lastValues[questions[0].id])}`);
  }

  // ── Question saisie ───────────────────────────────────────
  if (state === 'saisie_question') {
    const questions = sd.questions || [];
    const reponses = sd.reponses || [];
    const qIdx = sd.q_idx || 0;
    const q = questions[qIdx];
    const lastValues: Record<string, string> = sd.lastValues || {};
    if (!q) return sendWA(phone, `Erreur : question introuvable.`);

    const val = bodyText.trim();
    let valeur: string;

    if (q.type_reponse === 'choix' && Array.isArray(q.options) && q.options.length > 0) {
      const n = parseInt(val.trim());
      if (isNaN(n) || n < 1 || n > q.options.length)
        return sendWA(phone, `❌ Tapez un chiffre entre *1* et *${q.options.length}*.\n\n${fmtQuestion(q)}`);
      valeur = q.options[n - 1];
      if (q.followup_from != null && n >= q.followup_from) {
        const newReps = [...reponses, { question_id: q.id, valeur, choix_idx: n }];
        await setSession(phone, 'saisie_followup', { ...sd, reponses: newReps, q_idx: qIdx });
        return sendWA(phone, `_${valeur}_\n\n${q.followup_prompt}`);
      }
    } else if (q.type_reponse === 'numerique') {
      const numVal = parseFloat(val.replace(',', '.'));
      if (isNaN(numVal)) return sendWA(phone, `❌ Entrez un nombre.\n\n${fmtQuestion(q, lastValues[q.id])}`);
      const lastKnown = lastValues[q.id];
      if (lastKnown && q.texte.toLowerCase().includes('compteur') && numVal < parseFloat(lastKnown))
        return sendWA(phone, `❌ Relevé invalide. Doit être ≥ ${lastKnown}${q.unite ? ' ' + q.unite : ''}.\n_(Ex: ${(parseFloat(lastKnown) + 8).toFixed(0)})_`);
      valeur = String(numVal);
    } else if (q.type_reponse === 'oui_non') {
      if (!['oui', 'non', 'o', 'n'].includes(val.toLowerCase()))
        return sendWA(phone, `❌ Répondez OUI ou NON.\n\n${fmtQuestion(q)}`);
      valeur = ['oui', 'o'].includes(val.toLowerCase()) ? 'oui' : 'non';
    } else {
      valeur = val;
    }

    const newReponses = [...reponses, { question_id: q.id, valeur }];
    const next = qIdx + 1;

    // Alerte seuil en arrière-plan — ne bloque pas la saisie
    const equipRaw = await db('equipements', { query: `&id=eq.${sd.equip_id}&limit=1` });
    const equip = Array.isArray(equipRaw) ? equipRaw[0] : null;
    if (equip) alerterSeuilsEnArrierePlan(equip, [q], [{ question_id: q.id, valeur }], siteNom, contact).catch(() => {});

    if (next < questions.length) {
      await setSession(phone, 'saisie_question', { ...sd, reponses: newReponses, q_idx: next });
      const nextQ = questions[next];
      let confirmMsg = '';
      if (q.type_reponse === 'numerique') {
        const delta = lastValues[q.id] ? ` (+${Math.round((parseFloat(valeur) - parseFloat(lastValues[q.id])) * 10) / 10}${q.unite || ''})` : '';
        confirmMsg = `✅ ${q.texte} : *${valeur}${q.unite || ''}*${delta}\n\n`;
      } else if (q.type_reponse === 'choix') {
        confirmMsg = `✅ *${valeur}*\n\n`;
      }
      return sendWA(phone, `${confirmMsg}${fmtQuestion(nextQ, lastValues[nextQ.id])}`);
    }
    await setSession(phone, 'saisie_recap', { ...sd, reponses: newReponses });
    return sendWA(phone, fmtRecap(sd.equip_nom, questions, newReponses));
  }

  // ── Follow-up choix ───────────────────────────────────────
  if (state === 'saisie_followup') {
    const questions = sd.questions || [];
    const reponses = sd.reponses || [];
    const qIdx = sd.q_idx || 0;
    const q = questions[qIdx];
    const followupText = bodyText.trim();
    if (!followupText) return sendWA(phone, q?.followup_prompt || 'Décrivez le problème :');
    const updatedReponses = reponses.map((r: any) =>
      r.question_id === q.id ? { ...r, valeur: `${r.valeur} — ${followupText}` } : r
    );
    const next = qIdx + 1;
    if (next < questions.length) {
      await setSession(phone, 'saisie_question', { ...sd, reponses: updatedReponses, q_idx: next });
      return sendWA(phone, `✅ Noté.\n\n${fmtQuestion(questions[next], (sd.lastValues || {})[questions[next].id])}`);
    }
    await setSession(phone, 'saisie_recap', { ...sd, reponses: updatedReponses });
    return sendWA(phone, `✅ Noté.\n\n${fmtRecap(sd.equip_nom, questions, updatedReponses)}`);
  }

  // ── Récap validation ──────────────────────────────────────
  if (state === 'saisie_recap') {
    const v = msg.toLowerCase();
    if (v === 'non') {
      const questions = sd.questions || [];
      const liste = questions.map((q: any, i: number) => `*${i + 1}* — ${q.texte}`).join('\n');
      await setSession(phone, 'saisie_correction', sd);
      return sendWA(phone, `Quelle question corriger ?\n\n${liste}`);
    }
    if (v !== 'oui') return sendWA(phone, `Répondez *OUI* pour valider ou *NON* pour corriger.`);

    await db('reponses', { method: 'DELETE', query: `&ronde_equipement_id=eq.${sd.re_id}` });
    for (const r of (sd.reponses || [])) {
      await db('reponses', { method: 'POST', body: { ronde_equipement_id: sd.re_id, question_id: r.question_id, valeur: r.valeur } });
    }
    await db('rondes_equipements', { method: 'PATCH', query: `&id=eq.${sd.re_id}`, body: { statut: 'valide', valide_at: new Date().toISOString() } });

    const equipRaw = await db('equipements', { query: `&id=eq.${sd.equip_id}&limit=1` });
    const equip = Array.isArray(equipRaw) ? equipRaw[0] : null;
    if (equip) alerterSeuilsEnArrierePlan(equip, sd.questions || [], sd.reponses || [], siteNom, contact).catch(() => {});

    // Demander si anomalie à signaler
    await setSession(phone, 'saisie_anomalie', sd);
    return sendWA(phone, `✅ *${sd.equip_nom}* validé.\n\nAnomalie à signaler ? *(OUI / NON)*`);
  }

  // ── Correction ────────────────────────────────────────────
  if (state === 'saisie_correction') {
    const questions = sd.questions || [];
    const n = parseInt(msg.trim()) - 1;
    if (isNaN(n) || n < 0 || n >= questions.length) return sendWA(phone, `Répondez avec un numéro entre 1 et ${questions.length}.`);
    await setSession(phone, 'saisie_question', { ...sd, q_idx: n, reponses: (sd.reponses || []).slice(0, n) });
    return sendWA(phone, fmtQuestion(questions[n], (sd.lastValues || {})[questions[n].id]));
  }

  // ── Anomalie → crée un signalement, continue la ronde ─────
  if (state === 'saisie_anomalie') {
    const v = msg.toLowerCase();
    if (v === 'oui') { await setSession(phone, 'saisie_anomalie_text', sd); return sendWA(phone, `Décrivez l'anomalie :`); }
    if (v === 'non') return continuerRonde(phone, sd, contact, site);
    return sendWA(phone, `Répondez *OUI* ou *NON*.`);
  }

  if (state === 'saisie_anomalie_text') {
    const desc = bodyText.trim();
    // Enregistrer dans anomalies (traçabilité ronde)
    await db('anomalies', { method: 'POST', body: { ronde_equipement_id: sd.re_id, description: desc } });
    // Créer un signalement → remonte dans le dashboard
    await db('signalements', { method: 'POST', body: {
      groupe_id: sd.site_id,
      site_id: sd.site_id,
      equipement_id: sd.equip_id || null,
      type: 'anomalie',
      description: desc,
      signale_par: contact.nom,
      statut: 'ouvert',
      source: 'ronde',
      ronde_id: sd.ronde_id || null,
    }}).catch(() => {});
    // Notifier resp_tech + dir_tech + techniciens (sauf l'émetteur)
    const responsablesAno = await getResponsablesForSite(sd.site_id).catch(() => []);
    const techsAno = await db('contacts', { query: `&site_id=eq.${sd.site_id}&role=eq.technicien&actif=eq.true` }).catch(() => []);
    const alertMsg = `⚠️ *Anomalie signalée — ${sd.equip_nom}*\n_${siteNom}_\n\n"${desc}"\n\n_Signalé par ${contact.nom} · ${getHeure()}_`;
    const dejaAno = new Set<string>([phone]);
    for (const r of [...(Array.isArray(responsablesAno) ? responsablesAno : []), ...(Array.isArray(techsAno) ? techsAno : [])]) {
      if (r.whatsapp && !dejaAno.has(r.whatsapp)) { dejaAno.add(r.whatsapp); await sendWA(r.whatsapp, alertMsg).catch(() => {}); }
    }

    await sendWA(phone, `✅ Anomalie enregistrée. Responsables notifiés.`);
    return continuerRonde(phone, sd, contact, site); // continue la ronde sans bloquer
  }

  // ── Panne flow ────────────────────────────────────────────
  if (state === 'panne_equip') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= (sd.equips?.length || 0))
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${sd.equips?.length}`);
    const e = sd.equips[idx];
    const panneTypes = e.type_id ? await db('panne_types', { query: `&type_equipement_id=eq.${e.type_id}&order=ordre.asc` }) : [];
    if (!Array.isArray(panneTypes) || !panneTypes.length) {
      await setSession(phone, 'panne_description', { ...sd, equipement_id: e.id, equip_nom: e.nom, panne_type_label: 'Panne', panne_type_slug: 'panne' });
      return sendWA(phone, `🚨 *${e.nom}*\n\nDécrivez le problème en détail :\n_(minimum 10 caractères)_`);
    }
    const liste = panneTypes.map((pt: any, i: number) => `*${i + 1}* — ${pt.label}`).join('\n');
    await setSession(phone, 'panne_type', { ...sd, equipement_id: e.id, equip_nom: e.nom, panne_types: panneTypes });
    return sendWA(phone, `🚨 *${e.nom}* — Quel type de panne ?\n\n${liste}\n\nRépondez avec le numéro.`);
  }

  if (state === 'panne_type') {
    const panneTypes: any[] = sd.panne_types || [];
    const idx = parseInt(msg.trim()) - 1;
    if (isNaN(idx) || idx < 0 || idx >= panneTypes.length)
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${panneTypes.length}.`);
    const pt = panneTypes[idx];
    await setSession(phone, 'panne_description', { ...sd, panne_type_label: pt.label, panne_type_slug: pt.slug });
    return sendWA(phone, `✅ *${pt.label}*\n\nDécrivez le problème en détail :`);
  }

  if (state === 'panne_description') {
    const desc = bodyText.trim();
    // Accepter si description suffisante OU si une photo est jointe (la photo vaut description)
    if (!mediaUrl && desc.length < 10) return sendWA(phone, `❌ Description trop courte. Donnez plus de détails :\n_(minimum 10 caractères, ou joignez une photo)_`);

    const fullDesc = `${sd.panne_type_label}${desc ? ` — ${desc}` : ''}`;

    // ── Upload photo vers Supabase Storage si disponible ──
    let publicPhotoUrl: string | null = null;
    if (mediaUrl) {
      publicPhotoUrl = await uploadTwilioPhoto(mediaUrl, 'pannes');
    }

    // ── Écrire dans signalements ──
    const sigRes = await db('signalements', { method: 'POST', body: {
      groupe_id: sd.site_id,
      site_id: sd.site_id,
      equipement_id: sd.equipement_id || null,
      type: sd.panne_type_slug || 'panne',
      description: fullDesc,
      signale_par: contact.nom,
      statut: 'ouvert',
      source: 'bot',
      ...(publicPhotoUrl ? { photo_url: publicPhotoUrl } : {}),
    }});
    const refCode = (Array.isArray(sigRes) ? sigRes[0]?.ref_code : sigRes?.ref_code) || '';
    await db('alertes', { method: 'POST', body: {
      groupe_id: sd.site_id,
      type: 'panne',
      severite: 'danger',
      message: `PANNE — ${sd.equip_nom} — ${sd.panne_type_label}`,
      resolue: false,
    }}).catch(() => {});
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });

    // Notifier resp_tech + dir_tech + technicien du site (multi-site inclus)
    const responsables = await getResponsablesForSite(sd.site_id);
    const techniciens = await db('contacts', { query: `&site_id=eq.${sd.site_id}&role=eq.technicien&actif=eq.true` });
    const tousDestinataires = [...(Array.isArray(responsables) ? responsables : []), ...(Array.isArray(techniciens) ? techniciens : [])];
    const refLine = refCode ? `\n\n_Répondre *OK ${refCode}* pour PEC · ou *AFFECTER ${refCode}* pour assigner à un tech._` : `\n\n_Tapez *resolu* pour clôturer._`;
    const photoLine = publicPhotoUrl ? `\n📷 Photo jointe` : '';
    const alertMsg = `🚨 *PANNE SIGNALÉE — GenTrack*\n*${siteNom}*\n\n🔧 Équipement : *${sd.equip_nom}*\n⚠️ Type : *${sd.panne_type_label}*${desc ? `\n📝 Détail : ${desc}` : ''}${photoLine}\n\n👤 Signalé par : ${contact.nom}\n🕐 ${today} ${getHeure()}${refLine}`;
    const dejaEnvoyes = new Set<string>([phone]);
    for (const r of tousDestinataires) {
      if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
        dejaEnvoyes.add(r.whatsapp);
        // Envoyer le texte d'alerte + la photo séparément si disponible
        await sendWA(r.whatsapp, alertMsg);
        if (publicPhotoUrl) await sendWA(r.whatsapp, `📷 Photo — ${sd.equip_nom}${refCode ? ` (${refCode})` : ''}`, publicPhotoUrl);
      }
    }
    const notifTxt = dejaEnvoyes.size > 1 ? `Les responsables ont été alertés. 📲` : `_Aucun responsable configuré._`;
    return sendWA(phone, `🚨 *Signalement enregistré !*\n\n🔧 ${sd.equip_nom}\n⚠️ ${sd.panne_type_label}${desc ? `\n📝 ${desc}` : ''}${publicPhotoUrl ? '\n📷 Photo enregistrée' : ''}\n\n${notifTxt}`);
  }

  // ── Suivi choix — PEC groupée + liens rapport ─────────────
  if (state === 'suivi_choix') {
    const sigs: any[] = sd.sigs || [];
    if (!sigs.length) {
      await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
      return sendWA(phone, `Aucun signalement disponible. Tapez *suivi* pour rafraîchir.`);
    }
    // Parser les numéros : "1 2", "1,2", "3"
    const parts = msg.trim().split(/[\s,]+/).map((p: string) => parseInt(p)).filter((n: number) => !isNaN(n));
    if (!parts.length) {
      return sendWA(phone, `Tapez un ou plusieurs numéros entre 1 et ${sigs.length}.\n_Ex : *1 2* ou *3*_`);
    }
    const invalid = parts.filter((n: number) => n < 1 || n > sigs.length);
    if (invalid.length) return sendWA(phone, `Numéro(s) invalide(s) : ${invalid.join(', ')}. Choisissez entre 1 et ${sigs.length}.`);

    const chosen = parts
      .map((n: number) => sigs.find((s: any) => s.num === n))
      .filter(Boolean)
      .filter((s: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === idx); // dédoublonner

    const appUrl = Deno.env.get('APP_URL') || 'https://gen-track.vercel.app';

    // PEC uniquement pour les ouverts
    const ouvertChosen = chosen.filter((s: any) => s.statut === 'ouvert');
    for (const s of ouvertChosen) {
      await db('signalements', { method: 'PATCH', query: `&id=eq.${s.id}`, body: {
        statut: 'en_cours',
        pris_en_charge_par: contact.nom,
        pris_en_charge_at: new Date().toISOString(),
      }}).catch(() => {});
    }

    let responseMsg = '';
    if (ouvertChosen.length > 0) {
      const refList = ouvertChosen.map((s: any) => s.ref_code).filter(Boolean).join(' · ');
      responseMsg += `✅ *Pris en charge !*\n📋 ${refList}\n\n`;
    }
    responseMsg += `📝 *Rapport(s) d'intervention :*\n\n`;
    for (const s of chosen) {
      responseMsg += `*${s.ref_code || s.id}* — ${s.desc.substring(0, 40)}\n${appUrl}/rapport.html?sg=${s.id}\n\n`;
    }

    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
    return sendWA(phone, responseMsg.trim());
  }

  // ── Rapport choix (resp_tech) ──────────────────────────────
  if (state === 'rapport_choix') {
    const n = parseInt(msg.trim());
    if (isNaN(n) || n < 1 || n > 3) return sendWA(phone, `Répondez avec *1*, *2* ou *3*.`);
    const siteObj = site || { id: sd.site_id, nom: sd.site_nom };
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id });
    if (n === 1) {
      const rondes = await db('rondes', { query: `&site_id=eq.${sd.site_id}&order=date_ronde.desc,created_at.desc&limit=1` });
      if (!Array.isArray(rondes) || !rondes.length) return sendWA(phone, `Aucune ronde enregistrée pour *${sd.site_nom}*.`);
      const ronde = rondes[0];
      return sendRapportRonde(ronde.id, phone, contact.nom, sd.site_nom, '', sd.site_id, ronde.frequence);
    }
    if (n === 2) return demarrerSuivi(phone, contact, siteObj);
    if (n === 3) return afficherBilansResp(phone, contact, { id: sd.site_id, nom: sd.site_nom });
  }

  // ── Bilan recap — question blocages ───────────────────────
  if (state === 'bilan_recap') {
    const v = msg.toLowerCase();
    if (v === 'oui') {
      await setSession(phone, 'bilan_blocages', sd);
      return sendWA(phone, `📝 Décrivez vos blocages ou difficultés :\n_(Ex : REF-2341 — attente pièce, REF-2338 — accès refusé)_`);
    }
    if (v === 'non') return envoyerBilan(phone, contact, sd, null);
    return sendWA(phone, `Répondez *OUI* ou *NON*.`);
  }

  // ── Bilan blocages — description puis envoi ───────────────
  if (state === 'bilan_blocages') {
    const blocages = bodyText.trim();
    if (!blocages) return sendWA(phone, `Décrivez vos blocages :`);
    return envoyerBilan(phone, contact, sd, blocages);
  }

  // ── Résolu flow ───────────────────────────────────────────
  if (state === 'resolu_choix') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= (sd.signalements?.length || 0))
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${sd.signalements?.length}`);
    const sg = sd.signalements[idx];
    await setSession(phone, 'resolu_note', { ...sd, sg_id: sg.id, sg_equipement: sg.equipement, sg_equipement_id: sg.equipement_id, sg_groupe_id: sg.groupe_id, sg_label: sg.equipement + ' · ' + sg.description });
    return sendWA(phone, `✅ *${sg.equipement} · ${sg.description}*\n\nComment a été résolu le problème ?\n_(Ex: Démarreur remplacé, ou tapez - pour passer)_`);
  }

  if (state === 'resolu_note') {
    const note = bodyText.trim() === '-' ? null : bodyText.trim();
    await setSession(phone, 'resolu_cout', { ...sd, resolution_note: note });
    return sendWA(phone, `${note ? '✅ *' + note + '*\n\n' : ''}Un technicien est-il intervenu ?\n\n*1* — Oui\n*2* — Non`);
  }

  if (state === 'resolu_cout') {
    if (msg === '1') { await setSession(phone, 'resolu_technicien', sd); return sendWA(phone, `Nom du technicien / prestataire ?\n_(ou - pour passer)_`); }
    if (msg === '2') { await setSession(phone, 'resolu_final', { ...sd, intervenant: null }); return sendWA(phone, `Coût de l'intervention en FCFA ?\n_(Ex: 85000, ou 0)_`); }
    return sendWA(phone, `Répondez *1* (oui) ou *2* (non)`);
  }

  if (state === 'resolu_technicien') {
    const intervenant = bodyText.trim() === '-' ? null : bodyText.trim();
    await setSession(phone, 'resolu_final', { ...sd, intervenant });
    return sendWA(phone, `Coût de l'intervention en FCFA ?\n_(Ex: 85000, ou 0)_`);
  }

  if (state === 'resolu_final') {
    const cout = parseInt(msg.replace(/\s/g, '')) || 0;
    // PATCH signalement
    await db('signalements', { method: 'PATCH', query: `&id=eq.${sd.sg_id}`, body: {
      statut: 'resolu',
      note_resolution: sd.resolution_note || null,
      cout_intervention: cout > 0 ? cout : null,
      resolved_by: contact.nom,
      resolved_at: new Date().toISOString(),
    }});
    // POST maintenance
    await db('maintenances', { method: 'POST', body: {
      groupe_id: sd.sg_groupe_id,
      equipement_id: sd.sg_equipement_id || null,
      type: 'panne',
      titre: 'Panne résolue — ' + sd.sg_equipement,
      description: sd.resolution_note || sd.sg_label,
      date_intervention: today,
      statut: 'realise',
      cout: cout > 0 ? cout : null,
      prestataire: sd.intervenant || contact.nom,
      created_by: contact.nom,
    }}).catch(() => {});
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });

    // Notifier resp_tech (multi-site inclus)
    const responsables = await getResponsablesForSite(sd.site_id);
    const notifMsg = `✅ *Panne résolue — GenTrack*\n*${siteNom}*\n\n📝 ${sd.sg_label}\n${sd.resolution_note ? '🔧 ' + sd.resolution_note + '\n' : ''}${sd.intervenant ? '👷 ' + sd.intervenant + '\n' : ''}${cout > 0 ? '💰 ' + cout.toLocaleString('fr-FR') + ' FCFA\n' : ''}\n_Résolu par ${contact.nom} · ${today}_`;
    if (Array.isArray(responsables)) {
      for (const r of responsables) if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, notifMsg);
    }

    // Notifier le demandeur (contact connu ou résident)
    const sgRows = await db('signalements', {
      query: `&id=eq.${sd.sg_id}&limit=1`,
      select: 'signaleur_contact_id,signaleur_whatsapp,ref_code,description',
    }).catch(() => []);
    const sgRow = Array.isArray(sgRows) ? sgRows[0] : null;
    if (sgRow) {
      const refCode = sgRow.ref_code || '';
      const msgResolu =
        `✅ *Votre demande a été résolue — GenTrack*\n\n` +
        `📋 Référence : *${refCode || sd.sg_label}*\n` +
        `${sd.resolution_note ? '🔧 ' + sd.resolution_note + '\n' : ''}` +
        `${cout > 0 ? '💰 ' + cout.toLocaleString('fr-FR') + ' FCFA\n' : ''}` +
        `\n_Résolu le ${today}._`;
      // Contact connu (manager/gouvernant)
      if (sgRow.signaleur_contact_id) {
        const contacts = await db('contacts', {
          query: `&id=eq.${sgRow.signaleur_contact_id}&actif=eq.true`,
          select: 'whatsapp',
        }).catch(() => []);
        const c = Array.isArray(contacts) ? contacts[0] : null;
        if (c?.whatsapp && c.whatsapp !== phone) await sendWA(c.whatsapp, msgResolu).catch(() => {});
      }
      // Résident (numéro libre)
      if (sgRow.signaleur_whatsapp && sgRow.signaleur_whatsapp !== phone) {
        await sendWA(sgRow.signaleur_whatsapp, msgResolu).catch(() => {});
      }
    }

    return sendWA(phone, `✅ *Clôturé !*\n\n${sd.sg_label}\n${sd.resolution_note ? '🔧 ' + sd.resolution_note + '\n' : ''}${cout > 0 ? '💰 ' + cout.toLocaleString('fr-FR') + ' FCFA\n' : ''}\n_Responsable notifié. 📲_`);
  }

  // ── Vidange flow ──────────────────────────────────────────
  if (state === 'vidange_equip') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= (sd.equips?.length || 0))
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${sd.equips?.length}`);
    const g = sd.equips[idx];
    await setSession(phone, 'vidange_intervenant', { ...sd, equip_id: g.id, equip_nom: g.nom, heures_total: g.heures_total, seuil_vidange: g.seuil_vidange });
    return sendWA(phone, `🔧 *Vidange — ${g.nom}*\n🕐 Compteur actuel : *${g.heures_total}h*\n\nQui a effectué la vidange ?`);
  }

  if (state === 'vidange_intervenant') {
    await setSession(phone, 'vidange_confirm', { ...sd, intervenant: bodyText.trim() });
    return sendWA(phone, `✅ *Récapitulatif*\n\n📝 ${sd.equip_nom}\n🕐 ${sd.heures_total}h\n👤 ${bodyText.trim()}\n\nConfirmer ? *1* Oui · *2* Annuler`);
  }

  if (state === 'vidange_confirm') {
    if (msg === '2') { await setSession(phone, 'idle', {}); return sendWA(phone, `❌ Annulée.`); }
    if (msg !== '1') return sendWA(phone, `*1* pour confirmer, *2* pour annuler.`);
    const seuil = sd.seuil_vidange || 250;
    const prochainSeuil = Math.ceil((sd.heures_total + 0.01) / seuil) * seuil + seuil;
    await db('vidanges', { method: 'POST', body: {
      site_id: sd.site_id,
      equipement_id: sd.equip_id,
      date: today,
      heures_au_moment: sd.heures_total,
      intervenant: sd.intervenant || contact.nom
    }}).catch(() => {});
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
    const responsables = await getResponsablesForSite(sd.site_id);
    const vidangeMsg = `🔧 *Vidange effectuée*\n*${siteNom}*\n\n📝 ${sd.equip_nom}\n🕐 ${sd.heures_total}h\n👤 ${sd.intervenant || contact.nom}\n\n_Prochaine : ~${prochainSeuil}h_`;
    if (Array.isArray(responsables)) {
      for (const r of responsables) if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, vidangeMsg);
    }
    return sendWA(phone, `✅ *Vidange enregistrée !*\n\n📝 ${sd.equip_nom}\n🕐 ${sd.heures_total}h\n👤 ${sd.intervenant || contact.nom}\n\n_Prochaine vidange : ~${prochainSeuil}h_ 📲`);
  }

  // ── Plein carburant flow ──────────────────────────────────
  if (state === 'plein_litres') {
    const litres = parseFloat(bodyText.trim().replace(',', '.').replace(/\s/g, ''));
    if (isNaN(litres) || litres <= 0) return sendWA(phone, `❌ Quantité invalide.\n_(Ex: 500)_`);
    const cap = sd.cuve_capacite || 500;
    // Calcul automatique du niveau après
    const niveauApresCalc = Math.min(cap, (sd.niveau_precedent != null ? sd.niveau_precedent : 0) + litres);
    if (sd.niveau_precedent != null && (sd.niveau_precedent + litres) > cap * 1.05) {
      await setSession(phone, 'plein_confirm_litres', { ...sd, litres_ajoutes: litres, niveau_apres_calc: niveauApresCalc });
      return sendWA(phone, `⚠️ Total calculé (${Math.round(sd.niveau_precedent + litres)}L) dépasse la capacité (${cap}L).\nNiveau enregistré automatiquement : *${Math.round(niveauApresCalc)}L*\n\nVous confirmez *${litres}L* ajoutés ?\n\n*1* — Oui\n*2* — Re-saisir`);
    }
    await setSession(phone, 'plein_operateur', { ...sd, litres_ajoutes: litres, niveau_apres_calc: niveauApresCalc });
    return sendWA(phone, `✅ *${litres}L* ajoutés — niveau calculé : *${Math.round(niveauApresCalc)}L*\n\n👤 Votre prénom ?`);
  }

  if (state === 'plein_confirm_litres') {
    if (msg.trim() === '1') {
      await setSession(phone, 'plein_operateur', sd);
      return sendWA(phone, `👤 Votre prénom ?`);
    }
    if (msg.trim() === '2') { await setSession(phone, 'plein_litres', sd); return sendWA(phone, `🔄 Combien de litres ont été ajoutés ?`); }
    return sendWA(phone, `*1* confirmer · *2* re-saisir`);
  }

  if (state === 'plein_operateur') {
    const operateur = bodyText.trim();
    const niveauL = sd.niveau_apres_calc != null ? Math.round(sd.niveau_apres_calc) : (sd.niveau_precedent || 0);
    const cap = sd.cuve_capacite || 500;
    const prixLitre: number | null = sd.prix_litre ? parseFloat(sd.prix_litre) : null;
    const cout = prixLitre && sd.litres_ajoutes ? Math.round(prixLitre * sd.litres_ajoutes) : 0;
    const { pct, autoJ, col } = calcCuve(niveauL, cap, sd.conso_theorique || 65);
    const coutTxt = cout > 0 ? `\n💰 Coût : *${cout.toLocaleString('fr-FR')} FCFA*` : '';

    // Enregistrer le relevé dans reponses — uniquement si une ronde journalière existe déjà
    // (on ne crée PAS de ronde fantôme depuis le flow plein, ça polluerait la ronde formelle)
    if (sd.question_niveau_id) {
      const rondeRows = await db('rondes', { query: `&site_id=eq.${sd.site_id}&date_ronde=eq.${today}&frequence=eq.journalier&limit=1` });
      if (Array.isArray(rondeRows) && rondeRows[0]) {
        const reId = await getOrCreateRondeEquipement(rondeRows[0].id, sd.cuve_id);
        await db('reponses', { method: 'POST', body: { ronde_equipement_id: reId, question_id: sd.question_niveau_id, valeur: String(niveauL) } });
      }
    }

    // Enregistrer dans l'historique pleins
    await db('pleins', { method: 'POST', body: {
      equipement_id: sd.cuve_id,
      site_id: sd.site_id,
      date: today,
      litres_ajoutes: sd.litres_ajoutes || null,
      niveau_apres: niveauL,
      cout: cout || null,
      operateur: operateur || null,
    }}).catch(() => {});

    // Aussi dans maintenances pour l'onglet Maintenance/Ravitaillement
    await db('maintenances', { method: 'POST', body: {
      groupe_id: sd.site_id,
      equipement_id: sd.cuve_id,
      type: 'ravitaillement',
      titre: `Ravitaillement — ${sd.cuve_nom}`,
      date_intervention: today,
      quantite: sd.litres_ajoutes || null,
      unite: 'L',
      cout: cout || 0,
      statut: 'realise',
      created_by: operateur || null,
    }}).catch(() => {});

    if (pct <= 20) {
      await db('alertes', { method: 'POST', body: { groupe_id: sd.site_id, type: 'carburant_bas', severite: 'danger', message: `Critique — ${niveauL}L (${pct}%) — ${sd.cuve_nom}`, resolue: false } }).catch(() => {});
    } else {
      await db('alertes', { method: 'PATCH', query: `&groupe_id=eq.${sd.site_id}&type=eq.carburant_bas&resolue=eq.false`, body: { resolue: true } }).catch(() => {});
    }
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });

    const notifMsg = `⛽ *Ravitaillement effectué*\n*${siteNom}*\n\n🛢️ ${sd.cuve_nom}\n💧 *${sd.litres_ajoutes}L* ajoutés\n📊 Niveau : *${niveauL}L / ${cap}L* (${pct}%) ${col}${autoJ ? `\n⏱️ Autonomie : ~${autoJ}j` : ''}${coutTxt}\n👤 ${operateur}`;
    const responsables = await getResponsablesForSite(sd.site_id);
    if (Array.isArray(responsables)) {
      for (const r of responsables) if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, notifMsg);
    }
    return sendWA(phone, `✅ *Ravitaillement enregistré !*\n\n🛢️ ${sd.cuve_nom}\n💧 ${sd.litres_ajoutes}L ajoutés — ${niveauL}L / ${cap}L (${pct}%) ${col}${autoJ ? `\n⏱️ Autonomie : ~${autoJ}j` : ''}${coutTxt}\n\n_Équipe notifiée 📲_`);
  }

  // ── Relevé énergie — saisie des fluides ──────────────────────────────────
  if (state === 'energie_saisie') {
    const fluides: any[] = sd.fluides || [];
    const reponses: Record<string, number> = sd.reponses || {};
    const idx: number = sd.field_idx || 0;
    const f = fluides[idx];
    if (!f) return sendWA(phone, `Erreur : fluide introuvable. Tapez *saisie* pour recommencer.`);

    const numVal = parseFloat(bodyText.trim().replace(',', '.'));
    if (isNaN(numVal)) {
      return sendWA(phone, `❌ Entrez un nombre.\n\n${fmtFluidQuestion(f, sd.last_releve?.[f.id] ?? null, idx + 1, fluides.length)}`);
    }
    // Validation index croissant
    const lastVal = sd.last_releve?.[f.id];
    if (f.type_valeur === 'index' && lastVal != null && numVal < parseFloat(String(lastVal))) {
      return sendWA(phone, `❌ Valeur invalide. L'index doit être ≥ ${lastVal}${f.unite ? ' ' + f.unite : ''}.\n\n${fmtFluidQuestion(f, lastVal, idx + 1, fluides.length)}`);
    }

    const newReponses = { ...reponses, [f.id]: numVal };

    // Alerte seuil bas
    if (f.seuil_alerte_bas != null && numVal < f.seuil_alerte_bas) {
      const responsablesSeuil = await getResponsablesForSite(sd.site_id).catch(() => []);
      if (Array.isArray(responsablesSeuil)) {
        const alertMsg = `⚠️ *Alerte énergie — ${f.nom}*\n_${siteNom}_\n\nValeur : *${numVal}${f.unite ? ' ' + f.unite : ''}* (seuil : ${f.seuil_alerte_bas})\n\n_Relevé par ${contact.nom} · ${getHeure()}_`;
        for (const r of responsablesSeuil) if (r.whatsapp) await sendWA(r.whatsapp, alertMsg).catch(() => {});
      }
    }

    // ── Vérification delta (seuil_delta_alerte) ──────────────────────────────
    const lastValNum = lastVal != null ? parseFloat(String(lastVal)) : null;
    const deltaVal = lastValNum != null ? Math.abs(numVal - lastValNum) : null;
    if (f.seuil_delta_alerte != null && deltaVal != null && deltaVal > f.seuil_delta_alerte) {
      const dir = numVal > lastValNum! ? '+' : '-';
      await setSession(phone, 'energie_delta_confirm', {
        ...sd, reponses: newReponses, field_idx: idx,
        delta_step: 'normal',
        delta_fid: f.id, delta_val: numVal, delta_from: lastValNum, delta_ecart: deltaVal
      });
      return sendWA(phone,
        `⚠️ *Écart important — ${f.nom}*\n` +
        `Valeur saisie : *${numVal}${f.unite ? ' ' + f.unite : ''}*\n` +
        `Dernier relevé : ${lastValNum}${f.unite ? ' ' + f.unite : ''} (écart : ${dir}${Math.round(deltaVal).toLocaleString('fr-FR')}${f.unite ? ' ' + f.unite : ''})\n\n` +
        `Répondez :\n` +
        `• *OUI* — l'écart est normal, je confirme la valeur\n` +
        `• *NON* — erreur de saisie, je veux corriger`
      );
    }

    const next = idx + 1;
    // Confirmation delta si index
    let confirmMsg = '';
    if (f.type_valeur === 'index' && lastVal != null) {
      const delta = Math.round((numVal - parseFloat(String(lastVal))) * 10) / 10;
      confirmMsg = `✅ ${f.nom} : *${numVal}${f.unite ? ' ' + f.unite : ''}* (+${delta}${f.unite ? ' ' + f.unite : ''})\n\n`;
    } else {
      confirmMsg = `✅ ${f.nom} : *${numVal}${f.unite ? ' ' + f.unite : ''}*\n\n`;
    }

    if (next < fluides.length) {
      const nextF = fluides[next];
      const nextLast = sd.last_releve?.[nextF.id] ?? null;
      await setSession(phone, 'energie_saisie', { ...sd, reponses: newReponses, field_idx: next });
      return sendWA(phone, `${confirmMsg}${fmtFluidQuestion(nextF, nextLast, next + 1, fluides.length)}`);
    }

    // Tous les fluides saisis → récap
    await setSession(phone, 'energie_recap', { ...sd, reponses: newReponses });
    return sendWA(phone, fmtRecapEnergie(fluides, newReponses, sd.last_releve || {}, siteNom));
  }

  // ── Relevé énergie — confirmation écart anormal ──────────────────────────
  if (state === 'energie_delta_confirm') {
    const v = msg.toLowerCase().trim();
    const fluides: any[] = sd.fluides || [];
    const idx: number = sd.field_idx || 0;
    const f = fluides[idx];
    const next = idx + 1;

    if (sd.delta_step === 'normal') {
      // OUI = l'écart est normal → demander si déclarer anomalie
      if (v === 'oui') {
        await setSession(phone, 'energie_delta_confirm', { ...sd, delta_step: 'declare' });
        return sendWA(phone,
          `Voulez-vous déclarer une anomalie au responsable ?\n` +
          `_(Le responsable sera notifié et pourra corriger la valeur dans le dashboard)_\n\n` +
          `Répondez *OUI* ou *NON*`
        );
      }
      // NON = erreur de saisie → re-poser la question du fluide
      if (v === 'non') {
        const newReponses = { ...sd.reponses };
        delete newReponses[sd.delta_fid]; // annuler la valeur incorrecte
        await setSession(phone, 'energie_saisie', { ...sd, reponses: newReponses, field_idx: idx });
        const lastV = sd.last_releve?.[f.id] ?? null;
        return sendWA(phone, `🔄 Saisissez à nouveau la valeur.\n\n${fmtFluidQuestion(f, lastV, idx + 1, fluides.length)}`);
      }
      return sendWA(phone, `Répondez *OUI* (l'écart est normal, je confirme) ou *NON* (erreur de saisie, je veux corriger).`);
    }

    if (sd.delta_step === 'declare') {
      const newAnomalies: Record<string, string> = { ...(sd.anomalies || {}) };
      if (v === 'oui') {
        newAnomalies[sd.delta_fid] = 'déclarée';
        // Notifier le resp tech immédiatement
        const responsablesA = await getResponsablesForSite(sd.site_id).catch(() => []);
        if (Array.isArray(responsablesA)) {
          const fNom = f?.nom || 'Fluide';
          const alertMsg = `🚨 *Anomalie énergie déclarée — ${fNom}*\n_${siteNom}_\n\nValeur saisie : *${sd.delta_val}${f?.unite ? ' ' + f.unite : ''}*\nDernier relevé : ${sd.delta_from}${f?.unite ? ' ' + f.unite : ''} (écart : ${Math.round(sd.delta_ecart).toLocaleString('fr-FR')}${f?.unite ? ' ' + f.unite : ''})\n\nTech a confirmé la valeur mais déclaré une anomalie.\n_Vérifier et corriger dans le dashboard si besoin._\n\n_Saisi par ${contact.nom} · ${getHeure()}_`;
          for (const r of responsablesA) if (r.whatsapp) await sendWA(r.whatsapp, alertMsg).catch(() => {});
        }
      } else if (v === 'non') {
        newAnomalies[sd.delta_fid] = 'normale';
      } else {
        return sendWA(phone, `Répondez *OUI* (déclarer une anomalie) ou *NON* (continuer normalement).`);
      }

      // Continuer le relevé avec la valeur confirmée
      const confirmedReponses = sd.reponses || {};
      const confirmMsg = `✅ ${f?.nom || 'Fluide'} : *${sd.delta_val}${f?.unite ? ' ' + f.unite : ''}* ${v === 'oui' ? '_(anomalie déclarée)_' : ''}\n\n`;
      if (next < fluides.length) {
        const nextF = fluides[next];
        const nextLast = sd.last_releve?.[nextF.id] ?? null;
        await setSession(phone, 'energie_saisie', { ...sd, reponses: confirmedReponses, anomalies: newAnomalies, field_idx: next });
        return sendWA(phone, `${confirmMsg}${fmtFluidQuestion(nextF, nextLast, next + 1, fluides.length)}`);
      }
      await setSession(phone, 'energie_recap', { ...sd, reponses: confirmedReponses, anomalies: newAnomalies });
      return sendWA(phone, fmtRecapEnergie(fluides, confirmedReponses, sd.last_releve || {}, siteNom));
    }
  }

  // ── Relevé énergie — validation recap ────────────────────────────────────
  if (state === 'energie_recap') {
    const v = msg.toLowerCase();
    if (v === 'non') {
      await setSession(phone, 'idle', {});
      // Si lancé depuis une ronde, y retourner plutôt que laisser le tech en plan
      if (sd.ronde_context?.ronde_id) {
        const siteRaw = await db('sites', { query: `&id=eq.${sd.ronde_context.site_id}&limit=1` });
        const siteObj = Array.isArray(siteRaw) ? siteRaw[0] : null;
        await sendWA(phone, `❌ Relevé annulé.`);
        return continuerRonde(phone, sd.ronde_context, contact, siteObj);
      }
      return sendWA(phone, `❌ Relevé annulé.\n\nTapez *saisie* pour recommencer.`);
    }
    if (v !== 'oui') return sendWA(phone, `Répondez *OUI* pour valider ou *NON* pour annuler.`);

    const valeurs = sd.reponses || {};
    // Le relevé du matin représente la consommation de la veille → date_releve = hier
    const dateReleve = getHier();

    // Upsert dans releves_energie (un seul relevé par jour)
    const existingRow = await db('releves_energie', {
      query: `&site_id=eq.${sd.site_id}&date_releve=eq.${dateReleve}&limit=1`,
      select: 'id'
    });
    const anomalies = sd.anomalies && Object.keys(sd.anomalies).length ? sd.anomalies : null;
    if (Array.isArray(existingRow) && existingRow.length > 0) {
      await db('releves_energie', {
        method: 'PATCH',
        query: `&id=eq.${existingRow[0].id}`,
        body: { valeurs, saisi_par: contact.nom, anomalies, updated_at: new Date().toISOString() }
      });
    } else {
      await db('releves_energie', {
        method: 'POST',
        body: { site_id: sd.site_id, date_releve: dateReleve, valeurs, saisi_par: contact.nom, anomalies }
      });
    }
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });

    // Notifier resp_tech
    const fluides: any[] = sd.fluides || [];
    const lastReleve: Record<string, any> = sd.last_releve || {};
    const responsablesEnergie = await getResponsablesForSite(sd.site_id).catch(() => []);
    if (Array.isArray(responsablesEnergie)) {
      const lines = fluides.map((f: any) => {
        const val = valeurs[f.id];
        if (val == null) return null;
        const lv = lastReleve[f.id];
        const delta = (f.type_valeur === 'index' && lv != null)
          ? ` (+${Math.round((val - parseFloat(String(lv))) * 10) / 10}${f.unite ? ' ' + f.unite : ''})`
          : '';
        const em = (f.seuil_alerte_bas != null && val < f.seuil_alerte_bas) ? '⚠️' : '✅';
        return `${em} ${f.nom} : *${val}${f.unite ? ' ' + f.unite : ''}*${delta}`;
      }).filter(Boolean).join('\n');
      const notifMsg = `⚡ *Relevé énergie — ${siteNom}*\n_Consommation du ${dateReleve} · saisi à ${getHeure()}_\n\n${lines}\n\n_Saisi par ${contact.nom}_`;
      for (const r of responsablesEnergie) if (r.whatsapp) await sendWA(r.whatsapp, notifMsg).catch(() => {});
    }

    // Si lancé depuis une ronde, retour à la liste des équipements restants
    if (sd.ronde_context?.ronde_id) {
      await sendWA(phone, `✅ *Relevé énergie validé !*\n_Consommation du ${dateReleve} · ${siteNom}_`);
      const siteRaw = await db('sites', { query: `&id=eq.${sd.ronde_context.site_id}&limit=1` });
      const siteObj = Array.isArray(siteRaw) ? siteRaw[0] : null;
      return continuerRonde(phone, sd.ronde_context, contact, siteObj);
    }
    return sendWA(phone, `✅ *Relevé énergie validé !*\n_Consommation du ${dateReleve} · ${siteNom}_\n\n_Responsable notifié 📲_`);
  }

  // ── Affectation interactive : choix du tech ──────────────────────────────
  if (state === 'affecter_choix') {
    const techs: any[] = sd.techs || [];
    const idx = parseInt(msg.trim()) - 1;
    if (isNaN(idx) || idx < 0 || idx >= techs.length)
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${techs.length}.`);
    const tech = techs[idx];
    const assigneNom = contact?.nom || phone;
    await db('signalements', { method: 'PATCH', query: `&id=eq.${sd.sg_id}`, body: {
      statut: 'en_cours',
      assigne_a: tech.nom,
      pris_en_charge_par: tech.nom,
      pris_en_charge_at: new Date().toISOString(),
    }});
    if (tech.whatsapp) {
      const missionLines = [
        `🔧 *Mission assignée — GenTrack*`,
        sd.sg_site_nom ? `📍 *${sd.sg_site_nom}*` : null,
        ``,
        `📋 *${sd.sg_ref}*`,
        sd.sg_equip ? `🔩 Équipement : *${sd.sg_equip}*` : null,
        sd.sg_lieu ? `📍 Lieu : ${sd.sg_lieu}` : null,
        `📝 ${sd.sg_desc}`,
        sd.sg_signale_par ? `👤 Signalé par : ${sd.sg_signale_par}` : null,
        sd.sg_photo ? `📷 Photo : ${sd.sg_photo}` : null,
        ``,
        `👤 Assigné par : ${assigneNom}`,
        `🕐 ${getHeure()}`,
        ``,
        `_Répondez *OK ${sd.sg_ref}* pour confirmer la prise en charge._`,
      ].filter((l): l is string => l !== null).join('\n');
      await sendWA(tech.whatsapp, missionLines);
    }
    await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
    return sendWA(phone, `✅ *${sd.sg_ref}* affecté à *${tech.nom}*${tech.whatsapp ? ' — notifié 📲' : ' ⚠️ pas de WA configuré'}.`);
  }

  return sendWA(phone, `Tapez *aide* pour les commandes.`);
}

// ── Gestionnaire principal ────────────────────────────────────────────────────
async function handleMessage(from: string, bodyText: string, mediaUrl: string = '') {
  const phone = from.replace('whatsapp:', '');
  const msg = bodyText.trim().toLowerCase();

  // Récupérer TOUS les contacts avec ce numéro (cas multi-site avec 2 lignes contact)
  const contactsRaw = await db('contacts', { query: `&whatsapp=eq.${encodeURIComponent(phone)}&actif=eq.true&order=created_at.asc` });
  const allContactsForPhone: any[] = Array.isArray(contactsRaw) ? contactsRaw : [];
  const contact = allContactsForPhone[0] || null;
  // Tous les site_id liés à ce numéro (multi-ligne contact)
  const phoneSiteIds: string[] = allContactsForPhone.map((c: any) => c.site_id).filter(Boolean);

  if (contact) {
    // ── Session — chargée en premier pour résolution du site actif ────────────
    const session = await getSession(phone);
    const state = session?.state || 'idle';
    const sd = session?.data ? JSON.parse(session.data) : {};

    // ── Résolution du site actif (multi-site) ─────────────────────────────────
    let site: any = null;

    // 1. Site actif stocké en session (active_site_id ou site_id d'un flux en cours)
    const storedSiteId = sd.active_site_id || (state !== 'idle' ? sd.site_id : null);
    if (storedSiteId) {
      const siteRaw = await db('sites', { query: `&id=eq.${storedSiteId}&actif=eq.true&limit=1` });
      site = Array.isArray(siteRaw) ? siteRaw[0] || null : null;
    }

    // 2. Si pas de site actif → résoudre via user_sites + toutes les lignes contact de ce numéro
    if (!site) {
      const allSites = await getSitesForContact(contact.id, contact.site_id || undefined, phoneSiteIds);
      if (allSites.length === 1) {
        site = allSites[0];
        // Stocker en session si on est idle
        if (state === 'idle') await setSession(phone, 'idle', { ...sd, active_site_id: site.id });
      } else if (allSites.length > 1 && state !== 'choix_site') {
        // Multi-site — afficher le menu de choix
        const liste = allSites.map((s: any, i: number) => `*${i + 1}* — ${s.nom}`).join('\n');
        await setSession(phone, 'choix_site', {
          sites: allSites.map((s: any) => ({ id: s.id, nom: s.nom })),
          pending_msg: msg,
        });
        return sendWA(phone, `📍 *Sur quel site travaillez-vous ?*\n\n${liste}\n\n_Tapez *site* pour changer de site._`);
      }
    }

    // 3. Choix de site — géré avant tout autre état ───────────────────────────
    if (state === 'choix_site') {
      const sites: any[] = sd.sites || [];
      const n = parseInt(msg.trim());
      if (isNaN(n) || n < 1 || n > sites.length) {
        const liste = sites.map((s: any, i: number) => `*${i + 1}* — ${s.nom}`).join('\n');
        return sendWA(phone, `Répondez avec un numéro entre 1 et ${sites.length}.\n\n${liste}`);
      }
      const siteShort = sites[n - 1];
      // Recharger le site complet depuis la DB (la session ne stocke que id+nom)
      const siteFullRaw = await db('sites', { query: `&id=eq.${siteShort.id}&actif=eq.true&limit=1` });
      site = (Array.isArray(siteFullRaw) && siteFullRaw[0]) ? siteFullRaw[0] : siteShort;
      const pendingMsg = sd.pending_msg || '';
      await setSession(phone, 'idle', { active_site_id: site.id });
      // Re-dispatcher la commande originale
      if (pendingMsg === 'saisie' || pendingMsg === 'bonjour') return demarrerSaisie(phone, contact, site);
      if (pendingMsg === 'panne' || pendingMsg === 'urgence') return demarrerPanne(phone, contact, site);
      if (pendingMsg === 'plein' || pendingMsg === 'ravitaillement') return demarrerPlein(phone, contact, site);
      if (pendingMsg === 'vidange') return demarrerVidange(phone, contact, site);
      if (pendingMsg === 'resolu' || pendingMsg === 'résolu') return demarrerResolu(phone, contact, site);
      return sendWA(phone, `✅ *${site.nom}* sélectionné.\n\nTapez *saisie* pour commencer.`);
    }

    const siteNom = site?.nom || '';

    // ── Commandes toujours disponibles ────────────────────────────────────────
    if (msg === 'saisie' || msg === 'bonjour') {
      // Multi-site : toujours proposer le choix du site à chaque "saisie"
      const sitesForSaisie = await getSitesForContact(contact.id, contact.site_id || undefined, phoneSiteIds);
      if (sitesForSaisie.length > 1) {
        const liste = sitesForSaisie.map((s: any, i: number) => `*${i + 1}* — ${s.nom}${s.id === sd.active_site_id ? ' ✓' : ''}`).join('\n');
        await setSession(phone, 'choix_site', { sites: sitesForSaisie.map((s: any) => ({ id: s.id, nom: s.nom })), pending_msg: 'saisie' });
        return sendWA(phone, `📍 *Sur quel site travaillez-vous aujourd'hui ?*\n\n${liste}`);
      }
      if (!site && sitesForSaisie.length === 1) { site = sitesForSaisie[0]; }
      if (!site) return sendWA(phone, `⚠️ Votre compte n'est pas associé à un site. Contactez votre responsable.`);
      await setSession(phone, 'idle', { active_site_id: site.id });
      return demarrerSaisie(phone, contact, site);
    }

    // Changer de site manuellement
    if (msg === 'site' || msg === 'changer site') {
      const allSites = await getSitesForContact(contact.id, contact.site_id || undefined, phoneSiteIds);
      if (allSites.length <= 1) return sendWA(phone, `Vous n'avez qu'un seul site configuré.`);
      const liste = allSites.map((s: any, i: number) => `*${i + 1}* — ${s.nom}${s.id === (sd.active_site_id) ? ' ✓' : ''}`).join('\n');
      await setSession(phone, 'choix_site', { sites: allSites.map((s: any) => ({ id: s.id, nom: s.nom })), pending_msg: '' });
      return sendWA(phone, `📍 *Choisir un site :*\n\n${liste}`);
    }

    // ── Prise en charge signalement : "OK REF-XXXX" ───────────────────────────
    // Fonctionne même pendant une ronde — ne reset pas la session si ronde active
    const okRefNorm = bodyText.trim().toUpperCase().replace(/\s+/g, ' ');
    const okRefMatch = okRefNorm.match(/^OK\s+REF[-\s]?(\d+)$/);
    const okRefCode = okRefMatch ? `REF-${okRefMatch[1]}` : null;
    if (okRefMatch) {
      const refCode = okRefCode;
      // Accepte ouvert ET en_cours (cas d'affectation par resp_tech via AFFECTER)
      const sigs = await db('signalements', { query: `&ref_code=eq.${refCode}&statut=in.(ouvert,en_cours)&limit=1` });
      const sig = Array.isArray(sigs) ? sigs[0] : null;
      if (!sig) return sendWA(phone, `❌ Signalement *${refCode}* introuvable ou déjà clôturé.`);
      const preneurNom = contact?.nom || phone;
      await db('signalements', { method: 'PATCH', query: `&id=eq.${sig.id}`, body: {
        statut: 'en_cours',
        assigne_a: preneurNom,
        pris_en_charge_par: preneurNom,
        pris_en_charge_at: new Date().toISOString(),
      }});
      // Récupérer le nom du site du signalement
      const siteIdSig = sig.site_id || sig.groupe_id;
      let siteNomSig = '';
      if (siteIdSig) {
        const siteRawSig = await db('sites', { query: `&id=eq.${siteIdSig}&limit=1`, select: 'nom' });
        siteNomSig = Array.isArray(siteRawSig) && siteRawSig[0] ? siteRawSig[0].nom : '';
        const responsables = await getResponsablesForSite(siteIdSig);
        const notifPec = `ℹ️ *Prise en charge — GenTrack*\n📍 *${siteNomSig}*\n\n📋 ${refCode}\n👷 *${preneurNom}* s'en occupe\n🕐 ${getHeure()}`;
        if (Array.isArray(responsables)) {
          for (const r of responsables) {
            if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, notifPec);
          }
        }
      }
      // Préserver la session si une ronde est en cours
      const rondeStates = ['saisie_choix_equip','saisie_question','saisie_followup','saisie_recap','saisie_correction','saisie_anomalie','saisie_anomalie_text','saisie_choix_freq'];
      if (!rondeStates.includes(state)) {
        await setSession(phone, 'idle', { active_site_id: sd.active_site_id || siteIdSig });
      }
      const siteInfo = siteNomSig ? `\n📍 *${siteNomSig}*` : '';
      const photoLine = sig.photo_url ? `\n📷 Photo : ${sig.photo_url}` : '';
      const appUrlPec = Deno.env.get('APP_URL') || 'https://gen-track.vercel.app';
      const rapportUrlPec = `${appUrlPec}/rapport.html?sg=${sig.id}`;
      const rondeNote = rondeStates.includes(state) ? `\n_Votre ronde continue._\n\n` : `\n\n`;
      return sendWA(phone, `✅ *Pris en charge !*${siteInfo}\n📋 ${refCode}${photoLine}${rondeNote}📝 Rapport d'intervention :\n${rapportUrlPec}`);
    }

    // ── Affectation interactive : "AFFECTER REF-XXXX" (sans nom → menu) ─────
    const affecterSimpleMatch = bodyText.trim().replace(/\s+/g,' ').match(/^aff[eé]ct[eé]r?\s+(?:ref)?[-\s]?(\d+)$/i);
    if (affecterSimpleMatch) {
      const refCode = 'REF-' + affecterSimpleMatch[1];
      const sigs = await db('signalements', { query: `&ref_code=eq.${refCode}&statut=in.(ouvert,en_cours)&limit=1` });
      const sig = Array.isArray(sigs) ? sigs[0] : null;
      if (!sig) return sendWA(phone, `❌ Signalement *${refCode}* introuvable ou déjà clôturé.`);
      const siteIdSig = sig.site_id || sig.groupe_id;
      // Nom du site du signalement
      const siteRawSig = await db('sites', { query: `&id=eq.${siteIdSig}&limit=1`, select: 'nom' });
      const siteNomSig = Array.isArray(siteRawSig) && siteRawSig[0] ? siteRawSig[0].nom : '';
      // Nom équipement
      let equipNom = '';
      if (sig.equipement_id) {
        const eqRaw = await db('equipements', { query: `&id=eq.${sig.equipement_id}&limit=1`, select: 'nom' });
        equipNom = Array.isArray(eqRaw) && eqRaw[0] ? eqRaw[0].nom : '';
      }
      const techsRaw = await db('contacts', { query: `&site_id=eq.${siteIdSig}&role=eq.technicien&actif=eq.true&order=nom.asc` });
      const techs = Array.isArray(techsRaw) ? techsRaw : [];
      if (!techs.length) return sendWA(phone, `❌ Aucun technicien configuré pour ce site.`);
      const liste = techs.map((t: any, i: number) => `*${i + 1}* — ${t.nom}`).join('\n');
      await setSession(phone, 'affecter_choix', {
        active_site_id: sd.active_site_id,
        sg_id: sig.id,
        sg_ref: refCode,
        sg_desc: (sig.description || '—').substring(0, 100),
        sg_equip: equipNom,
        sg_lieu: sig.lieu || '',
        sg_signale_par: sig.signale_par || '',
        sg_photo: sig.photo_url || '',
        sg_site_nom: siteNomSig,
        site_id: siteIdSig,
        techs: techs.map((t: any) => ({ nom: t.nom, whatsapp: t.whatsapp || null }))
      });
      return sendWA(phone, `🔧 *Affecter — ${refCode}*\n📍 *${siteNomSig}*\n📝 ${(sig.description || '').substring(0, 60)}\n\nChoisir le technicien :\n\n${liste}\n\nRépondez avec le numéro.`);
    }

    // ── Affectation signalement : "AFFECTER REF-XXXX NomTech" ───────────────
    const affecterMatch = bodyText.trim().replace(/\s+/g,' ').match(/^aff[eé]ct[eé]r?\s+(?:ref)?[-\s]?(\d+)\s+(.+)$/i);
    if (affecterMatch) {
      const refCode = 'REF-' + affecterMatch[1];
      const techName = affecterMatch[2].trim();

      const sigs = await db('signalements', { query: `&ref_code=eq.${refCode}&statut=in.(ouvert,en_cours)&limit=1` });
      const sig = Array.isArray(sigs) ? sigs[0] : null;
      if (!sig) return sendWA(phone, `❌ Signalement *${refCode}* introuvable ou déjà clôturé.`);

      const siteRawSig = await db('sites', { query: `&id=eq.${sig.site_id||sig.groupe_id}&limit=1`, select: 'nom' });
      const siteNomSig = Array.isArray(siteRawSig) && siteRawSig[0] ? siteRawSig[0].nom : '';

      const techRaw = await db('contacts', { query: `&nom=ilike.${encodeURIComponent(techName)}&actif=eq.true&site_id=eq.${sig.site_id||sig.groupe_id}&limit=1` });
      const tech = Array.isArray(techRaw) ? techRaw[0] : null;
      if (!tech) return sendWA(phone, `❌ Contact *${techName}* introuvable sur ce site.`);

      const assigneNom = contact?.nom || phone;
      await db('signalements', { method: 'PATCH', query: `&id=eq.${sig.id}`, body: {
        statut: 'en_cours',
        assigne_a: tech.nom,
        pris_en_charge_par: tech.nom,
        pris_en_charge_at: new Date().toISOString(),
      }});

      // Notifier le tech — site en 2e ligne pour visibilité immédiate
      if (tech.whatsapp) {
        const missionMsg = `🔧 *Mission assignée — GenTrack*\n📍 *${siteNomSig}*\n\n📋 *${refCode}*\n${sig.description ? `📝 ${sig.description}\n` : ''}👤 Assigné par : ${assigneNom}\n🕐 ${getHeure()}\n\n_Répondez *OK ${refCode}* pour confirmer la prise en charge._`;
        await sendWA(tech.whatsapp, missionMsg);
      }

      return sendWA(phone, `✅ *${refCode}* affecté à *${tech.nom}*${tech.whatsapp ? ' — notifié 📲' : ' ⚠️ pas de WA configuré'}.`);
    }

    // ── RESOLU : lien rapport d'intervention ──────────────────────────────────
    const bodyNorm = bodyText.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (bodyNorm === 'resolu' && contact) {
      const contactNom = contact.nom;
      // Chercher par pris_en_charge_par d'abord, puis par assigne_a (cas d'affectation directe)
      let sig: any = null;
      const sigByPec = await db('signalements', {
        query: `&pris_en_charge_par=eq.${encodeURIComponent(contactNom)}&statut=eq.en_cours&limit=1`
      });
      sig = Array.isArray(sigByPec) ? sigByPec[0] || null : null;
      if (!sig) {
        const sigByAssign = await db('signalements', {
          query: `&assigne_a=eq.${encodeURIComponent(contactNom)}&statut=eq.en_cours&limit=1`
        });
        sig = Array.isArray(sigByAssign) ? sigByAssign[0] || null : null;
      }

      if (sig) {
        // Récupérer le nom du site pour afficher dans le message
        const siteIdSig = sig.site_id || sig.groupe_id;
        let siteNomSig = '';
        if (siteIdSig) {
          const siteRawSig = await db('sites', { query: `&id=eq.${siteIdSig}&limit=1`, select: 'nom' });
          siteNomSig = Array.isArray(siteRawSig) && siteRawSig[0] ? siteRawSig[0].nom : '';
        }
        const appUrl = Deno.env.get('APP_URL') || 'https://gen-track.vercel.app';
        const rapportUrl = `${appUrl}/rapport.html?sg=${sig.id}`;
        await setSession(phone, 'idle', { active_site_id: sd.active_site_id || siteIdSig });
        const siteInfo = siteNomSig ? `📍 *${siteNomSig}*\n` : '';
        return sendWA(phone, `✅ *Clôturer l'intervention — GenTrack*\n${siteInfo}\n📋 ${sig.ref_code || ''}\n\nRemplissez le rapport d'intervention :\n${rapportUrl}`);
      } else {
        await setSession(phone, 'idle', { active_site_id: sd.active_site_id });
        return sendWA(phone, `ℹ️ Aucun signalement en cours à votre nom.\n\nRépondez d'abord *OK REF-XXXX* (avec le code reçu) pour prendre en charge un signalement.`);
      }
    }

    // États de conversation actifs → déléguer
    const activeStates = [
      'saisie_choix_freq','saisie_choix_equip','saisie_question','saisie_followup',
      'saisie_recap','saisie_correction','saisie_anomalie','saisie_anomalie_text',
      'energie_saisie','energie_recap','energie_delta_confirm',
      'panne_equip','panne_type','panne_description',
      'resolu_choix','resolu_note','resolu_cout','resolu_technicien','resolu_final',
      'vidange_equip','vidange_intervenant','vidange_confirm',
      'plein_litres','plein_confirm_litres','plein_operateur',
      'affecter_choix',
      'rapport_choix','bilan_recap','bilan_blocages','suivi_choix',
    ];
    if (activeStates.includes(state)) {
      return handleStates(phone, msg, bodyText, contact, site, state, sd, mediaUrl);
    }

    // Annuler / retour — disponible à tout moment dans n'importe quel flux
    if (['annuler', 'annule', 'retour', 'stop', 'cancel'].includes(msg)) {
      await setSession(phone, 'idle', { active_site_id: sd.active_site_id || sd.site_id });
      return sendWA(phone, `❌ Action annulée.\n\nTapez *aide* pour les commandes.`);
    }

    // Commandes principales
    if (msg === 'aide' || msg === 'help') {
      const siteActif = siteNom ? `\n_Site actif : *${siteNom}* (tapez *site* pour changer)_` : '';
      const isRespAide = ['resp_tech', 'dir_tech'].includes(contact.role || '');
      const bilanLine = isRespAide
        ? `• *bilan* — Bilans du jour de vos techniciens`
        : `• *bilan* — Bilan fin de journée (rondes + résolus + blocages)`;
      return sendWA(phone, `🔧 *GenTrack — Commandes*\n\n• *saisie* — Ronde / Relevé horaire\n• *panne* — Signaler une urgence\n• *resolu* — Clôturer un signalement\n• *suivi* — Suivi signalements (interactif)\n${bilanLine}\n• *plein* — Ravitaillement cuve\n• *vidange* — Déclarer une vidange\n• *rapport* — Dernier rapport / Tableau de bord\n• *site* — Changer de site\n• *annuler* — Annuler l'action en cours\n• *aide* — Ce menu${siteActif}`);
    }
    if (msg === 'rapport') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
      const isResp = ['resp_tech', 'dir_tech'].includes(contact.role || '');
      if (isResp) {
        await setSession(phone, 'rapport_choix', { active_site_id: site.id, site_id: site.id, site_nom: site.nom });
        return sendWA(phone, `📊 *Rapport — ${site.nom}*\n\nQue souhaitez-vous consulter ?\n\n*1* — 📋 Dernière ronde journalière\n*2* — 🔴 Suivi des signalements\n*3* — 🌙 Bilans de fin de journée`);
      }
      // Technicien → rapport direct
      const rondes = await db('rondes', { query: `&site_id=eq.${site.id}&order=date_ronde.desc,created_at.desc&limit=1` });
      if (!Array.isArray(rondes) || !rondes.length) return sendWA(phone, `Aucune ronde enregistrée pour *${site.nom}*.`);
      const ronde = rondes[0];
      return sendRapportRonde(ronde.id, phone, contact.nom, site.nom, '', site.id, ronde.frequence);
    }
    if (msg === 'panne' || msg === 'urgence') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
      return demarrerPanne(phone, contact, site);
    }
    if (msg === 'resolu' || msg === 'résolu') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
      return demarrerResolu(phone, contact, site);
    }
    if (msg === 'plein' || msg === 'ravitaillement') {
      return demarrerPlein(phone, contact, site);
    }
    if (msg === 'vidange') {
      return demarrerVidange(phone, contact, site);
    }
    if (msg === 'suivi') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
      return demarrerSuivi(phone, contact, site);
    }
    if (msg === 'bilan') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
      const isResp = ['resp_tech', 'dir_tech'].includes(contact.role || '');
      if (isResp) return afficherBilansResp(phone, contact, site);
      return demarrerBilan(phone, contact, site);
    }

    return sendWA(phone, `Tapez *saisie* pour lancer une ronde.\nTapez *aide* pour toutes les commandes.`);
  }

  // ── Prospect (numéro inconnu) ─────────────────────────────
  const session = await getSession(phone);
  const state2 = session?.state || 'idle';
  const sd2 = session?.data ? JSON.parse(session.data) : {};

  if (state2 === 'prospect_groupes') {
    const choix: any = { '1': '1 groupe', '2': '2 à 5 groupes', '3': 'Plus de 5 groupes' };
    const label = choix[msg.trim()];
    if (!label) return sendWA(phone, `Répondez avec *1*, *2* ou *3* 👇`);
    await setSession(phone, 'prospect_pays', { ...sd2, groupes: label });
    return sendWA(phone, `✅ *${label}*\n\nVous êtes dans quel pays ?\n\n*1* — Sénégal\n*2* — Côte d'Ivoire\n*3* — Cameroun\n*4* — Autre`);
  }
  if (state2 === 'prospect_pays') {
    const pays: any = { '1': 'Sénégal', '2': "Côte d'Ivoire", '3': 'Cameroun', '4': 'Autre' };
    const label = pays[msg.trim()];
    if (!label) return sendWA(phone, `Répondez avec *1*, *2*, *3* ou *4* 👇`);
    await setSession(phone, 'prospect_done', { ...sd2, pays: label });
    if (PROSPECT_NOTIFY) sendWA(PROSPECT_NOTIFY, `🔔 *Nouveau prospect GenTrack*\n\n📱 ${phone}\n📝 ${sd2.groupes}\n🌍 ${label}`).catch(() => {});
    return sendWA(phone, `🎉 Parfait !\n\nUn conseiller GenTrack vous contactera dans les 24h.\n\n_Tapez *aide* pour découvrir les fonctionnalités._`);
  }
  await setSession(phone, 'prospect_groupes', {});
  return sendWA(phone, `👋 *Bienvenue sur GenTrack !*\n\nGérez vos groupes électrogènes directement par WhatsApp.\n\n✅ Saisie quotidienne\n✅ Alertes carburant automatiques\n✅ Rapport hebdomadaire\n\nCombien de groupes gérez-vous ?\n\n*1* — 1 groupe\n*2* — 2 à 5 groupes\n*3* — Plus de 5 groupes`);
}

// ── Validation signature Twilio ───────────────────────────────────────────────
async function validateTwilioSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TWILIO_TOKEN) {
    console.warn('[security] TWILIO_TOKEN non configuré — validation signature désactivée');
    return true;
  }
  const signature = req.headers.get('X-Twilio-Signature') || '';
  if (!signature) return false;

  const params = new URLSearchParams(rawBody);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  let toSign = WEBHOOK_URL || req.url;
  for (const [key, val] of sorted) toSign += key + val;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(TWILIO_TOKEN),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(toSign));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

// ── Entrée webhook ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'GET') return new Response('GenTrack WhatsApp Bot v7 ✅', { status: 200 });
  try {
    const text = await req.text();
    if (!await validateTwilioSignature(req, text)) {
      console.warn('[security] Signature Twilio invalide — requête rejetée');
      return new Response('Forbidden', { status: 403 });
    }
    const params = new URLSearchParams(text);
    const from = params.get('From') || '';
    const body = params.get('Body') || '';
    const mediaUrl = params.get('MediaUrl0') || '';
    // Ignorer si ni texte ni media
    if (!from || (!body && !mediaUrl)) return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
    const work = handleMessage(from, body, mediaUrl).catch(e => console.error('handleMessage error:', e));
    // Empêche le runtime Supabase de couper la fonction avant la fin du traitement
    (globalThis as any).EdgeRuntime?.waitUntil(work);
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('Erreur webhook:', err);
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
});
