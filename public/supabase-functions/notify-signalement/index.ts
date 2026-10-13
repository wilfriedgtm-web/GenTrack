// supabase/functions/notify-signalement/index.ts
// GenTrack — Notification signalement v2
// Notifie : resp_tech + dir_tech (toujours) + demandeur connu (contact.whatsapp) + résident (numéro libre + lien suivi)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOK  = Deno.env.get('TWILIO_TOKEN')             || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const BASE_URL    = 'https://gen-track.vercel.app';

// ── DB helper ─────────────────────────────────────────────────────────────────
async function db(table: string, opts: { query?: string; select?: string } = {}) {
  const { query = '', select = '*' } = opts;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${select}${query}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text.trim()) return [];
  return JSON.parse(text);
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
async function sendWA(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOK) return;
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOK}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: body }).toString(),
    }
  );
  if (!res.ok) console.error('Twilio error:', await res.text());
}

// ── Labels ────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  panne: '⚡ Panne',
  anomalie: '👁 Anomalie visuelle',
  bruit: '🔊 Bruit anormal',
  odeur: '💨 Odeur suspecte',
  fuite: '💧 Fuite',
  autre: '📝 Autre',
  anomalie_zone: '⚠️ Anomalie zone',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const payload = await req.json();
    const {
      site_id,
      type,
      description,
      signale_par,
      equipement_nom,
      lieu,
      ref_code,
      signalement_id,
      signaleur_contact_id,
      signaleur_whatsapp,
    } = payload;

    const typeLabel  = TYPE_LABELS[type] || type || 'Signalement';
    const heure      = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
    const suiviUrl   = ref_code ? `${BASE_URL}/suivi-signalement.html?ref=${encodeURIComponent(ref_code)}` : null;
    const dejaEnvoyes = new Set<string>();

    // ── 1. Resp_tech + dir_tech ───────────────────────────────────────────────
    const responsables = await db('contacts', {
      query: `&site_id=eq.${site_id}&role=in.(resp_tech,dir_tech)&actif=eq.true`,
      select: 'whatsapp',
    });

    const msgResp =
      `🚨 *Nouveau signalement — GenTrack*\n\n` +
      `${typeLabel}${equipement_nom ? ' — ' + equipement_nom : ''}` +
      `${lieu ? '\n📍 ' + lieu : ''}` +
      `${signale_par ? '\n👤 ' + signale_par : ''}` +
      `\n\n📝 ${description}` +
      `${ref_code ? '\n\n_Réf : ' + ref_code + '_\n_Répondre *OK ' + ref_code + '* pour PEC_' : ''}` +
      `\n_${heure}_`;

    if (Array.isArray(responsables)) {
      for (const r of responsables) {
        if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
          dejaEnvoyes.add(r.whatsapp);
          sendWA(r.whatsapp, msgResp).catch(() => {});
        }
      }
    }

    // ── 2. Demandeur connu (manager/gouvernant avec compte) ───────────────────
    if (signaleur_contact_id) {
      const contacts = await db('contacts', {
        query: `&id=eq.${signaleur_contact_id}&actif=eq.true`,
        select: 'whatsapp,nom',
      });
      const demandeur = Array.isArray(contacts) ? contacts[0] : null;
      if (demandeur?.whatsapp && !dejaEnvoyes.has(demandeur.whatsapp)) {
        dejaEnvoyes.add(demandeur.whatsapp);
        const msgDemandeur =
          `✅ *Votre signalement a bien été reçu*\n\n` +
          `📋 Référence : *${ref_code || '—'}*\n` +
          `📝 ${description}` +
          `${lieu ? '\n📍 ' + lieu : ''}` +
          `\n\nL'équipe technique a été notifiée et va traiter votre demande.` +
          `\n\n_Conservez votre référence pour le suivi._`;
        sendWA(demandeur.whatsapp, msgDemandeur).catch(() => {});
      }
    }

    // ── 3. Résident (numéro libre) — lien de suivi ────────────────────────────
    if (signaleur_whatsapp && !dejaEnvoyes.has(signaleur_whatsapp)) {
      dejaEnvoyes.add(signaleur_whatsapp);
      const msgResident =
        `✅ *Votre signalement a bien été enregistré*\n\n` +
        `📋 Référence : *${ref_code || '—'}*\n` +
        `📝 ${description}` +
        `${lieu ? '\n📍 ' + lieu : ''}` +
        `\n\nL'équipe technique a été notifiée.` +
        `${suiviUrl ? `\n\n🔗 Suivez l'avancement de votre demande :\n${suiviUrl}` : ''}` +
        `\n\n_Merci d'avoir utilisé GenTrack._`;
      sendWA(signaleur_whatsapp, msgResident).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, notified: dejaEnvoyes.size }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err) {
    console.error('notify-signalement error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
