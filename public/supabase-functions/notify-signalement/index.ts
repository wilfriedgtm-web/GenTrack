// supabase/functions/notify-signalement/index.ts
// GenTrack — Notification signalement v4
// Fix EarlyDrop : waitUntil + Promise.race timeout 8s
// Notifie : 1) resp_tech + dir_tech  2) signaleur (confirmation + lien suivi) si signaleur_whatsapp fourni

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

// ── WhatsApp — timeout 8s via Promise.race (AbortController non fiable sur Supabase) ──
async function sendWA(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOK) {
    console.error('sendWA: credentials manquants');
    return;
  }
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fetchPromise = fetch(
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
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('sendWA timeout 8s')), 8000)
  );
  try {
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (!res.ok) console.error('Twilio error:', await res.text());
    else console.log(`sendWA OK → ${toFmt.slice(0, 16)}...`);
  } catch (e: any) {
    console.error('sendWA error:', e?.name, e?.message);
  }
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

// ── Logique notifications (séparée pour waitUntil) ────────────────────────────
async function sendNotifications(payload: any) {
  const {
    site_id,
    type,
    description,
    signale_par,
    equipement_nom,
    lieu,
    ref_code,
    signaleur_whatsapp,
  } = payload;

  const typeLabel  = TYPE_LABELS[type] || type || 'Signalement';
  const heure      = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
  const suiviUrl   = ref_code ? `${BASE_URL}/suivi-signalement.html?ref=${encodeURIComponent(ref_code)}` : null;
  // dejaEnvoyes = anti-doublon alertes équipe
  // dejaConfirms = indépendant : un resp_tech signaleur reçoit bien les deux messages
  const dejaEnvoyes = new Set<string>();
  const dejaConfirms = new Set<string>();

  console.log(`notify: site=${site_id} ref=${ref_code} type=${type}`);

  // ── 1. Resp_tech + dir_tech + technicien ────────────────────────────────
  const responsables = await db('contacts', {
    query: `&site_id=eq.${site_id}&role=in.(resp_tech,dir_tech,technicien)&actif=eq.true`,
    select: 'whatsapp',
  });

  const msgResp =
    `🚨 *Nouveau signalement — GenTrack*\n\n` +
    `${typeLabel}${equipement_nom ? ' — ' + equipement_nom : ''}` +
    `${lieu ? '\n📍 ' + lieu : ''}` +
    `${signale_par ? '\n👤 ' + signale_par : ''}` +
    `${signaleur_whatsapp ? '\n📞 ' + signaleur_whatsapp : ''}` +
    `\n\n📝 ${description}` +
    `${ref_code ? '\n\n_Réf : ' + ref_code + '_\n_Répondre *OK ' + ref_code + '* pour PEC_' : ''}` +
    `\n_${heure}_`;

  if (Array.isArray(responsables)) {
    for (const r of responsables) {
      if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
        dejaEnvoyes.add(r.whatsapp);
        await sendWA(r.whatsapp, msgResp);
      }
    }
  }
  console.log(`notify: ${responsables?.length ?? 0} contacts → ${dejaEnvoyes.size} envoyés`);

  // ── 2. Signaleur — confirmation + lien de suivi ──────────────────────────
  // Le formulaire pré-remplit sg-wa-input avec le WA du contact connu si disponible.
  // Tout passe par signaleur_whatsapp — pas besoin de lookup séparé par contact_id.
  if (signaleur_whatsapp && !dejaConfirms.has(signaleur_whatsapp)) {
    dejaConfirms.add(signaleur_whatsapp);
    const msgResident =
      `✅ *Votre signalement a bien été enregistré*\n\n` +
      `📋 Référence : *${ref_code || '—'}*\n` +
      `📝 ${description}` +
      `${lieu ? '\n📍 ' + lieu : ''}` +
      `\n\nL'équipe technique a été notifiée.` +
      `${suiviUrl ? `\n\n🔗 Suivez l'avancement de votre demande :\n${suiviUrl}` : ''}` +
      `\n\n_Merci d'avoir utilisé GenTrack._`;
    await sendWA(signaleur_whatsapp, msgResident);
    console.log(`notify: résident envoyé → ${signaleur_whatsapp.slice(0,8)}...`);
  }

  console.log(`notify: DONE — resp=${dejaEnvoyes.size} confirms=${dejaConfirms.size}`);
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const payload = await req.json();

    // Lancer les notifications en arrière-plan — retourner HTTP 200 immédiatement
    // waitUntil empêche l'EarlyDrop de tuer la fonction avant la fin des envois
    const work = sendNotifications(payload).catch((e) => console.error('notify error:', e));
    (globalThis as any).EdgeRuntime?.waitUntil(work);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err) {
    console.error('notify-signalement parse error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
