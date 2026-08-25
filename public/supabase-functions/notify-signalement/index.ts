// supabase/functions/notify-signalement/index.ts
// Appelée par signalement.html après un INSERT dans signalements
// Envoie un WA à tous les contacts avec notif_signalement=true

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')             || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const APP_URL     = Deno.env.get('APP_URL')                   || 'https://gen-track.vercel.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TYPE_LABELS: Record<string, string> = {
  panne:    '🔧 Panne',
  anomalie: '⚠️ Anomalie visuelle',
  bruit:    '🔊 Bruit anormal',
  odeur:    '💨 Odeur suspecte',
  fuite:    '💧 Fuite',
  autre:    '📋 Autre',
};

async function supaGet(table: string, query: string) {
  const url = `${SUPA_URL}/rest/v1/${table}?select=*${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return [];
  return await res.json();
}

async function sendWA(to: string, message: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log('[WA] Twilio non configuré — message ignoré:', to, message.slice(0, 80));
    return;
  }
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const body = new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) console.error('[WA] Twilio error:', JSON.stringify(data));
}

function getHeure() {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar',
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: CORS });

  try {
    const {
      site_id,
      type,
      description,
      signale_par,
      equipement_nom,
      lieu,
      ref_code,
      photo_url,
      signalement_id,
    } = await req.json();

    if (!site_id) {
      return new Response(
        JSON.stringify({ error: 'site_id requis' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Nom du site
    const sites   = await supaGet('sites',    `&id=eq.${site_id}&limit=1`);
    const siteNom = sites[0]?.nom || 'Site inconnu';

    // Contacts ayant activé les notifications signalement
    const contacts = await supaGet('contacts', `&site_id=eq.${site_id}&notif_signalement=eq.true&actif=eq.true`);

    // Ligne REF
    const refLine = ref_code ? `\n📌 Réf : *${ref_code}*\nRépondez *OK ${ref_code}* pour prendre en charge.` : '';

    // Lien photo
    const photoLine = photo_url ? `\n📷 Photo : ${photo_url}` : '';

    // Lien dashboard (pour resp_tech et dir_tech)
    const dashLine = signalement_id
      ? `\n🔗 Dashboard : ${APP_URL}/dashboard.html`
      : '';

    // Corps commun du message
    const base = [
      `🚨 *SIGNALEMENT — GenTrack*`,
      `*${siteNom}*`,
      ``,
      equipement_nom ? `🔧 Équipement : *${equipement_nom}*` : null,
      `⚠️ Type : *${TYPE_LABELS[type] || type}*`,
      lieu           ? `📍 Lieu : ${lieu}`                   : null,
      `📝 ${description}`,
      signale_par    ? `👤 Signalé par : ${signale_par}`     : null,
      `🕐 ${getHeure()}`,
    ].filter((l): l is string => l !== null).join('\n');

    let sent = 0;
    const dejaEnvoyes = new Set<string>();

    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        if (!c.whatsapp || dejaEnvoyes.has(c.whatsapp)) continue;
        dejaEnvoyes.add(c.whatsapp);

        const isManager = c.role === 'resp_tech' || c.role === 'dir_tech';
        const message   = base + photoLine + refLine + (isManager ? dashLine : '');

        await sendWA(c.whatsapp, message);
        sent++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[notify-signalement]', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
