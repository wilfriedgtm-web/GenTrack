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

const SUPA_URL    = Deno.env.get('SUPABASE_URL')    || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')   || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN') || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')|| 'whatsapp:+14155238886';
const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicG94amxrcXhucWp6eG9oYXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjM3ODAsImV4cCI6MjA5NzA5OTc4MH0.9-QyWgon93jGDo5QKMIh_-QbQZ_P9rQrYJnVxegJe7M';
const BASE_URL    = 'https://gen-track.vercel.app';

// ── DB helper ─────────────────────────────────────────────────────────────────
async function db(table: string, opts: any = {}) {
  const { method = 'GET', body, query = '', select = '*' } = opts;
  const key = SUPA_KEY || ANON_KEY;
  const url = `${SUPA_URL}/rest/v1/${table}?select=${select}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': key, 'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return [];
  return res.json();
}

// ── Upload photo Twilio → Supabase Storage ────────────────────────────────────
async function uploadPhoto(mediaUrl: string): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: { 'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}` }
    });
    if (!res.ok) { console.error('Photo fetch failed:', res.status); return null; }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await res.arrayBuffer();
    const up = await fetch(`${SUPA_URL}/storage/v1/object/gentrack-photos/signalements/${filename}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': contentType, 'x-upsert': 'true'
      },
      body: arrayBuffer
    });
    if (!up.ok) { console.error('Storage upload failed:', await up.text()); return null; }
    return `${SUPA_URL}/storage/v1/object/public/gentrack-photos/signalements/${filename}`;
  } catch (e) { console.error('uploadPhoto error:', e); return null; }
}

// ── Twilio ────────────────────────────────────────────────────────────────────
async function sendWA(to: string, message: string) {
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: message }).toString()
  });
  const data = await res.json();
  console.log('Twilio:', JSON.stringify(data).substring(0, 120));
  return data;
}

// ── Sessions ──────────────────────────────────────────────────────────────────
async function getSession(phone: string) {
  const rows = await db('sessions', { query: `&phone=eq.${encodeURIComponent(phone)}&order=updated_at.desc&limit=1` });
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function setSession(phone: string, state: string, data: any = {}) {
  await db('sessions', { method: 'DELETE', query: `&phone=eq.${encodeURIComponent(phone)}` });
  await db('sessions', { method: 'POST', body: { phone, state, data: JSON.stringify(data), updated_at: new Date().toISOString() } });
}

// ── Dates ─────────────────────────────────────────────────────────────────────
function getToday():          string { return new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' }); }
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
  // Sinon en créer un nouveau valable 8h
  if (!token) {
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    const created = await db('releves_horaires', {
      method: 'POST',
      body: { site_id: siteId, statut: 'ouvert', expires_at: expires },
      select: 'token'
    });
    token = Array.isArray(created) ? created[0]?.token : created?.token;
  }
  return token ? `${BASE_URL}/releve.html?token=${token}` : null;
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
  return restants;
}

// Vérifie si une ronde est complète sur une période donnée
async function rondeCompleteDepuis(siteId: string, frequence: string, dateFrom: string, nbEquipements: number): Promise<boolean> {
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
  // Pour les rondes : compter uniquement les équipements actif_ronde
  const equipsRonde = await db('equipements', { query: `&site_id=eq.${site.id}&actif=eq.true&actif_ronde=eq.true` });
  const nbEquip = Array.isArray(equipsRonde) ? equipsRonde.length : 0;

  // Relevé horaire — jamais bloqué, si au moins un équipement actif_releve
  if (site.releve_horaire_actif !== false) {
    const equipsReleve = await db('equipements', { query: `&site_id=eq.${site.id}&actif=eq.true&actif_releve=eq.true&limit=1` });
    if (Array.isArray(equipsReleve) && equipsReleve.length > 0) freqs.push('releve_horaire');
  }

  const periodMap: Record<string, string> = {
    journalier: getToday(),
    hebdo:      getStartOfWeek(),
    mensuel:    getStartOfMonth(),
  };

  for (const freq of ['journalier', 'hebdo', 'mensuel'] as string[]) {
    const isActif = freq === 'journalier' ? site.journalier_actif : freq === 'hebdo' ? site.hebdo_actif : site.mensuel_actif;
    if (!isActif) continue;
    const complete = await rondeCompleteDepuis(site.id, freq, periodMap[freq], nbEquip);
    if (!complete) freqs.push(freq);
  }

  return freqs;
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
        sendWA(d.contact, msg).catch(() => {});
      }
    }
  }
  // 2. Toujours notifier resp_tech + dir_tech du site (garantie)
  const responsables = await db('contacts', { query: `&site_id=eq.${equip.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true` });
  if (Array.isArray(responsables)) {
    for (const r of responsables) {
      if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
        dejaEnvoyes.add(r.whatsapp);
        sendWA(r.whatsapp, msg).catch(() => {});
      }
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
      // Recommandation vidange
      if (equip.seuil_vidange_heures && q.texte.toLowerCase().includes('compteur')) {
        const compteur = parseFloat(r.valeur);
        if (!isNaN(compteur) && equip.conso_theorique_lh > 0) {
          const prochain = Math.ceil((compteur + 0.01) / equip.seuil_vidange_heures) * equip.seuil_vidange_heures;
          const hRestantes = prochain - compteur;
          const jRestants = Math.round(hRestantes / equip.conso_theorique_lh / 8); // 8h/jour
          const em = jRestants <= 7 ? '🔴' : jRestants <= 14 ? '🟡' : '🟢';
          recommandations.push(`${em} ${equip.nom} — Vidange dans ~${jRestants}j (${compteur}h → ${prochain}h)`);
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
  const responsables = await db('contacts', {
    query: `&site_id=eq.${siteId}&role=in.(resp_tech,dir_tech)&actif=eq.true`
  });
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
  if (!freqs.length) return sendWA(phone, `✅ Toutes les rondes sont à jour.\n\nTapez *aide* pour les commandes.`);

  const freqLabels: Record<string, string> = {
    releve_horaire: '📊 Relevé horaire',
    journalier:     '☀️ Ronde journalière',
    hebdo:          '📅 Ronde hebdomadaire',
    mensuel:        '🗓️ Ronde mensuelle',
  };
  const sd = { tech_id: contact.id, tech_nom: contact.nom, site_id: site.id, site_nom: site.nom };

  if (freqs.length === 1) {
    if (freqs[0] === 'releve_horaire') return envoyerLienReleve(phone, site, contact.nom);
    return demarrerRonde(phone, contact, site, sd, freqs[0]);
  }
  const liste = freqs.map((f, i) => `*${i + 1}* — ${freqLabels[f] || f}`).join('\n');
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
    await setSession(phone, 'idle', {});
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
    site_id: siteId, site_nom: site?.nom || '', tech_nom: contact.nom,
    cuve_id: cuve.id, cuve_nom: cuve.nom, cuve_capacite: cap, niveau_precedent: niveauPrec,
    prix_litre: prixLitre, conso_theorique: consoLh,
    question_niveau_id: Array.isArray(qNiveau) && qNiveau[0] ? qNiveau[0].id : null
  });
  return sendWA(phone, `⛽ *Ravitaillement — ${site?.nom || ''}*\n\n🛢️ *${cuve.nom}* (${cap}L)${niveauTxt}${prixTxt}\n\nCombien de litres ont été ajoutés ?\n_(Ex: 500)_`);
}

// ── Gestionnaire des états partagés ──────────────────────────────────────────
async function handleStates(phone: string, msg: string, bodyText: string, contact: any, site: any, state: string, sd: any, mediaUrl = ''): Promise<any> {
  const siteNom = site?.nom || sd.site_nom || '';
  const today = getToday();

  // ── Annuler — prioritaire sur tout autre état ─────────────
  if (['annuler', 'annule', 'retour', 'stop', 'cancel', '0'].includes(msg)) {
    await setSession(phone, 'idle', {});
    return sendWA(phone, `❌ Action annulée.\n\nTapez *aide* pour les commandes.`);
  }

  // ── Choix fréquence ───────────────────────────────────────
  if (state === 'saisie_choix_freq') {
    const freqs: string[] = sd.freqs || [];
    const n = parseInt(msg.trim());
    if (isNaN(n) || n < 1 || n > freqs.length) return sendWA(phone, `Répondez avec un numéro entre 1 et ${freqs.length}.`);
    const freq = freqs[n - 1];
    if (freq === 'releve_horaire') return envoyerLienReleve(phone, site, contact.nom);
    return demarrerRonde(phone, contact, site, sd, freq);
  }

  // ── Choix équipement ──────────────────────────────────────
  if (state === 'saisie_choix_equip') {
    const restants = sd.restants || [];
    const n = parseInt(msg.trim()) - 1;
    if (isNaN(n) || n < 0 || n >= restants.length) return sendWA(phone, `Répondez avec un numéro entre 1 et ${restants.length}.`);
    const equip = restants[n];
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
      equipement_id: sd.equip_id || null,
      type: 'anomalie',
      description: desc,
      signale_par: contact.nom,
      statut: 'ouvert',
      source: 'ronde',
    }}).catch(() => {});
    // Notifier resp_tech (non bloquant)
    db('contacts', { query: `&site_id=eq.${sd.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true` }).then((responsables: any[]) => {
      if (!Array.isArray(responsables)) return;
      const alertMsg = `⚠️ *Anomalie signalée — ${sd.equip_nom}*\n_${siteNom}_\n\n"${desc}"\n\n_Signalé par ${contact.nom} · ${getHeure()}_`;
      for (const r of responsables) if (r.whatsapp) sendWA(r.whatsapp, alertMsg).catch(() => {});
    }).catch(() => {});

    await sendWA(phone, `✅ Anomalie enregistrée. Responsable notifié.`);
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
    // Accepter si texte suffisant OU si photo jointe
    if (desc.length < 10 && !mediaUrl) return sendWA(phone, `❌ Description trop courte. Donnez plus de détails :\n_(minimum 10 caractères, ou joignez une photo)_`);

    // Upload photo si présente
    const photo_url = mediaUrl ? await uploadPhoto(mediaUrl) : null;
    const finalDesc = desc.length >= 3 ? `${sd.panne_type_label} — ${desc}` : `${sd.panne_type_label} — Photo jointe`;

    // ── Écrire dans signalements (plus dans pannes) ──
    await db('signalements', { method: 'POST', body: {
      groupe_id: sd.site_id,
      equipement_id: sd.equipement_id || null,
      type: sd.panne_type_slug || 'panne',
      description: finalDesc,
      signale_par: contact.nom,
      statut: 'ouvert',
      source: 'bot',
      photo_url: photo_url || null,
    }});
    await db('alertes', { method: 'POST', body: {
      groupe_id: sd.site_id,
      type: 'panne',
      severite: 'danger',
      message: `PANNE — ${sd.equip_nom} — ${sd.panne_type_label}`,
      resolue: false,
    }}).catch(() => {});
    await setSession(phone, 'idle', {});

    // Notifier resp_tech
    const responsables = await db('contacts', {
      query: `&site_id=eq.${sd.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true`
    });
    const alertMsg = `🚨 *PANNE SIGNALÉE — GenTrack*\n*${siteNom}*\n\n🔧 Équipement : *${sd.equip_nom}*\n⚠️ Type : *${sd.panne_type_label}*\n📝 Détail : ${desc}\n\n👤 Signalé par : ${contact.nom}\n🕐 ${today} ${getHeure()}\n\n_Tapez *aide* pour affecter._`;
    const dejaEnvoyes = new Set<string>([phone]);
    if (Array.isArray(responsables)) {
      for (const r of responsables) {
        if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
          dejaEnvoyes.add(r.whatsapp);
          await sendWA(r.whatsapp, alertMsg);
        }
      }
    }
    const notifTxt = dejaEnvoyes.size > 1 ? `Le responsable a été alerté. 📲` : `_Aucun responsable configuré._`;
    return sendWA(phone, `🚨 *Signalement enregistré !*\n\n🔧 ${sd.equip_nom}\n⚠️ ${sd.panne_type_label}\n📝 ${desc}\n\n${notifTxt}`);
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
    await setSession(phone, 'idle', {});

    // Notifier resp_tech
    const responsables = await db('contacts', {
      query: `&site_id=eq.${sd.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true`
    });
    const notifMsg = `✅ *Panne résolue — GenTrack*\n*${siteNom}*\n\n📝 ${sd.sg_label}\n${sd.resolution_note ? '🔧 ' + sd.resolution_note + '\n' : ''}${sd.intervenant ? '👷 ' + sd.intervenant + '\n' : ''}${cout > 0 ? '💰 ' + cout.toLocaleString('fr-FR') + ' FCFA\n' : ''}\n_Résolu par ${contact.nom} · ${today}_`;
    if (Array.isArray(responsables)) {
      for (const r of responsables) if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, notifMsg);
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
    const prochainSeuil = (sd.heures_total || 0) + (sd.seuil_vidange || 250);
    await db('vidanges', { method: 'POST', body: {
      site_id: sd.site_id,
      equipement_id: sd.equip_id,
      date: today,
      heures_au_moment: sd.heures_total,
      intervenant: sd.intervenant || contact.nom
    }}).catch(() => {});
    await setSession(phone, 'idle', {});
    const responsables = await db('contacts', { query: `&site_id=eq.${sd.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true` });
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

    // Enregistrer le relevé dans reponses
    if (sd.question_niveau_id) {
      const rondeRows = await db('rondes', { query: `&site_id=eq.${sd.site_id}&date_ronde=eq.${today}&frequence=eq.journalier&limit=1` });
      let rondeId: string;
      if (Array.isArray(rondeRows) && rondeRows[0]) {
        rondeId = rondeRows[0].id;
      } else {
        const newRonde = await db('rondes', { method: 'POST', body: { site_id: sd.site_id, date_ronde: today, frequence: 'journalier' } });
        rondeId = Array.isArray(newRonde) ? newRonde[0].id : newRonde.id;
      }
      const reId = await getOrCreateRondeEquipement(rondeId, sd.cuve_id);
      await db('reponses', { method: 'POST', body: { ronde_equipement_id: reId, question_id: sd.question_niveau_id, valeur: String(niveauL) } });
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
    await setSession(phone, 'idle', {});

    const notifMsg = `⛽ *Ravitaillement effectué*\n*${siteNom}*\n\n🛢️ ${sd.cuve_nom}\n💧 *${sd.litres_ajoutes}L* ajoutés\n📊 Niveau : *${niveauL}L / ${cap}L* (${pct}%) ${col}${autoJ ? `\n⏱️ Autonomie : ~${autoJ}j` : ''}${coutTxt}\n👤 ${operateur}`;
    const responsables = await db('contacts', { query: `&site_id=eq.${sd.site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true` });
    if (Array.isArray(responsables)) {
      for (const r of responsables) if (r.whatsapp && r.whatsapp !== phone) await sendWA(r.whatsapp, notifMsg);
    }
    return sendWA(phone, `✅ *Ravitaillement enregistré !*\n\n🛢️ ${sd.cuve_nom}\n💧 ${sd.litres_ajoutes}L ajoutés — ${niveauL}L / ${cap}L (${pct}%) ${col}${autoJ ? `\n⏱️ Autonomie : ~${autoJ}j` : ''}${coutTxt}\n\n_Équipe notifiée 📲_`);
  }

  return sendWA(phone, `Tapez *aide* pour les commandes.`);
}

// ── Gestionnaire principal ────────────────────────────────────────────────────
async function handleMessage(from: string, bodyText: string, mediaUrl = '') {
  const phone = from.replace('whatsapp:', '');
  const msg = bodyText.trim().toLowerCase();
  console.log(`=== From: ${phone} | Body: ${bodyText}`);

  const contactRaw = await db('contacts', { query: `&whatsapp=eq.${encodeURIComponent(phone)}&actif=eq.true&limit=1` });
  const contact = Array.isArray(contactRaw) ? contactRaw[0] || null : null;

  if (contact) {
    const siteRaw = contact.site_id ? await db('sites', { query: `&id=eq.${contact.site_id}&actif=eq.true&limit=1` }) : [];
    const site = Array.isArray(siteRaw) ? siteRaw[0] || null : null;

    const session = await getSession(phone);
    const state = session?.state || 'idle';
    const sd = session?.data ? JSON.parse(session.data) : {};
    const siteNom = site?.nom || '';

    // Commandes toujours disponibles — avant toute gestion d'état
    if (msg === 'saisie' || msg === 'bonjour') {
      if (!site) return sendWA(phone, `⚠️ Votre compte n'est pas associé à un site. Contactez votre responsable.`);
      await setSession(phone, 'idle', {});
      return demarrerSaisie(phone, contact, site);
    }

    // États de conversation actifs → déléguer
    const activeStates = [
      'saisie_choix_freq','saisie_choix_equip','saisie_question','saisie_followup',
      'saisie_recap','saisie_correction','saisie_anomalie','saisie_anomalie_text',
      'panne_equip','panne_type','panne_description',
      'resolu_choix','resolu_note','resolu_cout','resolu_technicien','resolu_final',
      'vidange_equip','vidange_intervenant','vidange_confirm',
      'plein_litres','plein_confirm_litres','plein_operateur',
    ];
    if (activeStates.includes(state)) {
      return handleStates(phone, msg, bodyText, contact, site, state, sd, mediaUrl);
    }

    // Annuler / retour — disponible à tout moment dans n'importe quel flux
    if (['annuler', 'annule', 'retour', 'stop', 'cancel', '0'].includes(msg)) {
      await setSession(phone, 'idle', {});
      return sendWA(phone, `❌ Action annulée.\n\nTapez *aide* pour les commandes.`);
    }

    // Commandes principales
    if (msg === 'aide' || msg === 'help') {
      return sendWA(phone, `🔧 *GenTrack — Commandes*\n\n• *saisie* — Ronde / Relevé horaire\n• *panne* — Signaler une urgence\n• *resolu* — Clôturer un signalement\n• *plein* — Ravitaillement cuve\n• *vidange* — Déclarer une vidange\n• *rapport* — Dernier rapport\n• *annuler* — Annuler l'action en cours\n• *aide* — Ce menu`);
    }
    if (msg === 'rapport') {
      if (!site) return sendWA(phone, `Aucun site configuré.`);
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
    sendWA('+33658150628', `🔔 *Nouveau prospect GenTrack*\n\n📱 ${phone}\n📝 ${sd2.groupes}\n🌍 ${label}`).catch(() => {});
    return sendWA(phone, `🎉 Parfait !\n\nUn conseiller GenTrack vous contactera dans les 24h.\n\n_Tapez *aide* pour découvrir les fonctionnalités._`);
  }
  await setSession(phone, 'prospect_groupes', {});
  return sendWA(phone, `👋 *Bienvenue sur GenTrack !*\n\nGérez vos groupes électrogènes directement par WhatsApp.\n\n✅ Saisie quotidienne\n✅ Alertes carburant automatiques\n✅ Rapport hebdomadaire\n\nCombien de groupes gérez-vous ?\n\n*1* — 1 groupe\n*2* — 2 à 5 groupes\n*3* — Plus de 5 groupes`);
}

// ── Entrée webhook ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'GET') return new Response('GenTrack WhatsApp Bot v7 ✅', { status: 200 });
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get('From') || '';
    const body = params.get('Body') || '';
    const mediaUrl = params.get('MediaUrl0') || '';
    const numMedia = parseInt(params.get('NumMedia') || '0');
    console.log(`Webhook — From: ${from} | Body: ${body} | Media: ${numMedia}`);
    if (!from || (!body && !mediaUrl)) return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
    handleMessage(from, body, mediaUrl).catch(e => console.error('handleMessage error:', e));
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('Erreur webhook:', err);
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
});
