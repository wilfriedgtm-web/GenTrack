// supabase/functions/notify-signalement/index.ts
// GenTrack — Notification signalement v5
// Fix EarlyDrop : waitUntil + Promise.race timeout 8s
// Notifie : contacts avec notif_signalement=true (indépendant du rôle — configuré dans le dashboard)

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
async function twilioPost(params: Record<string, string>): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOK) {
    console.error('twilioPost: credentials manquants');
    return;
  }
  const fetchPromise = fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOK}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    }
  );
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('twilioPost timeout 8s')), 8000)
  );
  try {
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (!res.ok) console.error('Twilio error:', await res.text());
    else console.log(`sendWA OK → ${params['To']?.slice(0, 16)}...`);
  } catch (e: any) {
    console.error('sendWA error:', e?.name, e?.message);
  }
}

async function sendWA(to: string, body: string, mediaUrl?: string) {
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  // Message texte
  await twilioPost({ From: TWILIO_FROM, To: toFmt, Body: body });
  // Photo en message séparé si présente (plus fiable qu'un caption sur WhatsApp)
  if (mediaUrl) {
    await twilioPost({ From: TWILIO_FROM, To: toFmt, MediaUrl: mediaUrl });
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
    signaleur_contact_id, // présent = créé par un contact interne ; absent = QR code / résident
    photo_url,
  } = payload;

  const typeLabel = TYPE_LABELS[type] || type || 'Signalement';
  const heure     = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
  const dejaEnvoyes = new Set<string>();

  console.log(`notify: site=${site_id} ref=${ref_code} type=${type} internal=${!!signaleur_contact_id}`);

  // ── Nom du site ─────────────────────────────────────────────────────────
  let site_nom = '';
  if (site_id) {
    const sites = await db('sites', { query: `&id=eq.${site_id}&limit=1`, select: 'nom' });
    site_nom = Array.isArray(sites) && sites[0]?.nom ? sites[0].nom : '';
  }

  // ── Destinataires ────────────────────────────────────────────────────────
  // Reçoit la notification : tout contact avec notif_signalement=true ET actif=true
  // La sélection se fait dans le dashboard (checkbox "📲 Signalements") — indépendant du rôle
  // dir_tech, techs non désignés → notif_signalement=false → ne reçoivent rien
  const destinataires = await db('contacts', {
    query: `&site_id=eq.${site_id}&notif_signalement=eq.true&actif=eq.true`,
    select: 'whatsapp',
  });

  const msgResp =
    `🚨 *Nouveau signalement — GenTrack*\n\n` +
    (site_nom ? `🏨 *${site_nom}*\n` : '') +
    `${typeLabel}${equipement_nom ? ' — ' + equipement_nom : ''}` +
    `${lieu ? '\n📍 ' + lieu : ''}` +
    `${signale_par ? '\n👤 ' + signale_par : ''}` +
    `${signaleur_whatsapp && !signaleur_contact_id ? '\n📞 ' + signaleur_whatsapp : ''}` +
    `\n\n📝 ${description}` +
    `${ref_code ? '\n\n_Réf : ' + ref_code + '_\n_Répondre *OK ' + ref_code + '* pour PEC · ou *AFFECTER ' + ref_code + ' NomTech* pour assigner._' : ''}` +
    `\n_${heure}_`;

  if (Array.isArray(destinataires)) {
    for (const r of destinataires) {
      if (r.whatsapp && !dejaEnvoyes.has(r.whatsapp)) {
        dejaEnvoyes.add(r.whatsapp);
        await sendWA(r.whatsapp, msgResp, photo_url || undefined);
      }
    }
  }

  console.log(`notify: DONE — notif_signalement=true → ${dejaEnvoyes.size} envoyés`);
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
