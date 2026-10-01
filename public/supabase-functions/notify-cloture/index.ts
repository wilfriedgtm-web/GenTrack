// supabase/functions/notify-cloture/index.ts
// Appelée par rapport.html après clôture d'un signalement.
// Envoie WA au resp_tech (rapport complet) + au signaleur (confirmation légère).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const APP_URL     = Deno.env.get('APP_URL')                   || 'https://gen-track.vercel.app';

const VERCEL_PREVIEW_RE = /^https:\/\/gen-track(-[a-z0-9]+)*\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  return origin === 'https://gen-track.vercel.app' || VERCEL_PREVIEW_RE.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin  = req.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const TYPE_LABELS: Record<string, string> = {
  panne:    '🔧 Panne',
  anomalie: '⚠️ Anomalie visuelle',
  bruit:    '🔊 Bruit anormal',
  odeur:    '💨 Odeur suspecte',
  fuite:    '💧 Fuite',
  autre:    '📋 Autre',
};

const ROLE_LABELS: Record<string, string> = {
  gouvernant:  'Gouvernant(e)',
  fb_manager:  'F&B Manager',
  reception:   'Réception',
  demandeur:   'Demandeur',
  resp_tech:   'Resp. Technique',
  dir_tech:    'Dir. Technique',
  dir_ops:     'Dir. Opérations',
  technicien:  'Technicien',
};

async function supaGet(table: string, query: string): Promise<any[]> {
  const url = `${SUPA_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type':  'application/json',
    },
  });
  if (!res.ok) return [];
  return await res.json();
}

async function sendWA(to: string, message: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log('[WA] Twilio non configuré — ignoré:', to, message.slice(0, 80));
    return;
  }
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const body  = new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: message });
  const res   = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method:  'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) console.error('[WA] Twilio error:', JSON.stringify(data));
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const {
      signalement_id,
      tech_nom,
      travaux,
      cout,
      duree_label,
    } = await req.json();

    if (!signalement_id) {
      return new Response(
        JSON.stringify({ error: 'signalement_id requis' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Charger signalement + équipement + site
    const sgs = await supaGet(
      'signalements',
      `id=eq.${signalement_id}&select=id,type,description,lieu,groupe_id,ref_code,signale_par,signaleur_contact_id,equipements(nom)`
    );
    const sg = sgs[0];
    if (!sg) {
      return new Response(
        JSON.stringify({ error: 'signalement introuvable' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const siteId  = sg.groupe_id;
    const eqNom   = sg.equipements?.nom || '';
    const typeLabel = TYPE_LABELS[sg.type] || sg.type || 'Intervention';
    const refCode   = sg.ref_code ? ` [${sg.ref_code}]` : '';

    // Nom du site
    const sites   = await supaGet('sites', `id=eq.${siteId}&select=nom&limit=1`);
    const siteNom = sites[0]?.nom || 'Site inconnu';

    // Contacts du site : resp_tech + signaleur (si contact enregistré)
    const contacts = await supaGet(
      'contacts',
      `site_id=eq.${siteId}&actif=eq.true&select=id,nom,whatsapp,role`
    );

    const respTech = contacts.find((c) => c.role === 'resp_tech');

    // Le signaleur : priorité au contact enregistré (signaleur_contact_id),
    // fallback sur tout contact dont l'id correspond
    let signaleurContact: any = null;
    if (sg.signaleur_contact_id) {
      signaleurContact = contacts.find((c) => c.id === sg.signaleur_contact_id) || null;
      // Si pas dans le même site (edge case), charger directement
      if (!signaleurContact) {
        const rows = await supaGet('contacts', `id=eq.${sg.signaleur_contact_id}&select=id,nom,whatsapp,role&limit=1`);
        signaleurContact = rows[0] || null;
      }
    }

    const dejaEnvoyes = new Set<string>();
    let sent = 0;

    // ── Message RESP_TECH (rapport complet) ──────────────────────────────────
    const msgRespTech = [
      `✅ *CLÔTURE INTERVENTION — GenTrack*`,
      `*${siteNom}*${refCode}`,
      ``,
      eqNom  ? `⚙️ Équipement : *${eqNom}*`       : null,
      `⚠️ Type : *${typeLabel}*`,
      sg.lieu ? `📍 Lieu : ${sg.lieu}`              : null,
      sg.signale_par ? `👤 Signalé par : ${sg.signale_par}` : null,
      ``,
      `👷 *Technicien :* ${tech_nom}`,
      `📝 *Travaux :* ${travaux}`,
      cout     ? `💰 *Coût :* ${Number(cout).toLocaleString('fr-FR')} FCFA` : null,
      duree_label ? `⏱ *Durée :* ${duree_label}` : null,
      ``,
      `🔗 ${APP_URL}/dashboard.html`,
    ].filter((l): l is string => l !== null).join('\n');

    if (respTech?.whatsapp && !dejaEnvoyes.has(respTech.whatsapp)) {
      dejaEnvoyes.add(respTech.whatsapp);
      await sendWA(respTech.whatsapp, msgRespTech);
      sent++;
    }

    // ── Message SIGNALEUR (confirmation légère) ───────────────────────────────
    if (signaleurContact?.whatsapp && !dejaEnvoyes.has(signaleurContact.whatsapp)) {
      const roleLabel = ROLE_LABELS[signaleurContact.role] || signaleurContact.role || '';
      const msgSignaleur = [
        `✅ *Votre signalement a été traité — GenTrack*`,
        `*${siteNom}*${refCode}`,
        ``,
        eqNom   ? `⚙️ ${eqNom}`   : null,
        sg.lieu ? `📍 ${sg.lieu}` : null,
        ``,
        `👷 *Technicien :* ${tech_nom}`,
        `📝 *Travaux :* ${travaux}`,
        cout ? `💰 *Coût :* ${Number(cout).toLocaleString('fr-FR')} FCFA` : null,
        ``,
        `Merci pour votre signalement${roleLabel ? ', ' + roleLabel : ''} ! 🙏`,
      ].filter((l): l is string => l !== null).join('\n');

      dejaEnvoyes.add(signaleurContact.whatsapp);
      await sendWA(signaleurContact.whatsapp, msgSignaleur);
      sent++;
    }

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[notify-cloture]', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
