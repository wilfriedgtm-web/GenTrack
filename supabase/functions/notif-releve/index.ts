// supabase/functions/notif-releve/index.ts
// GenTrack — Notification WhatsApp lors de la validation d'un relevé horaire (R3)
// Appelé depuis releve.html après supaPatch statut='validé'
// Envoie le lien du rapport au resp_tech et dir_tech du site

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL   = Deno.env.get('SUPABASE_URL')                || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')   || '';
const TWILIO_SID   = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM  = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const BASE_URL     = 'https://gen-track.vercel.app';

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Supabase helper (service role) ───────────────────────────────────────────
async function db(table: string, query = '', select = '*'): Promise<any[]> {
  const url = `${SUPA_URL}/rest/v1/${table}?select=${select}${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey':         SUPA_KEY,
      'Authorization':  `Bearer ${SUPA_KEY}`,
    },
  });
  if (!res.ok) {
    console.error(`db(${table}) error:`, res.status, await res.text());
    return [];
  }
  const text = await res.text();
  if (!text.trim()) return [];
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [];
}

// ── Twilio WhatsApp ───────────────────────────────────────────────────────────
async function sendWA(to: string, message: string): Promise<void> {
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const payload = { From: TWILIO_FROM, To: toFmt, Body: message };
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload).toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) console.error('Twilio sendWA error:', data?.code, data?.message);
}

// ── Responsables du site (resp_tech + dir_tech) ───────────────────────────────
async function getResponsables(siteId: string): Promise<any[]> {
  const seen  = new Set<string>();
  const result: any[] = [];

  // 1. Contacts dont c'est le site principal
  const direct = await db(
    'contacts',
    `&site_id=eq.${siteId}&role=in.(resp_tech,dir_tech)&actif=eq.true`
  );
  for (const c of direct) {
    if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
  }

  // 2. Contacts multi-site via user_sites
  const us = await db('user_sites', `&site_id=eq.${siteId}`, 'contact_id');
  if (us.length > 0) {
    const cids = us.map((r: any) => r.contact_id).filter(Boolean);
    if (cids.length) {
      const linked = await db(
        'contacts',
        `&id=in.(${cids.join(',')})&role=in.(resp_tech,dir_tech)&actif=eq.true`
      );
      for (const c of linked) {
        if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
      }
    }
  }
  return result;
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { releve_id, site_id, contact_id, nb_alertes, nb_valeurs } = body as {
      releve_id:  string;
      site_id:    string;
      contact_id: string | null;
      nb_alertes: number;
      nb_valeurs: number;
    };

    if (!releve_id || !site_id) {
      return new Response(
        JSON.stringify({ error: 'releve_id et site_id sont requis' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ── Récupérer nom du site ───────────────────────────────────────────────
    const sites   = await db('sites',    `&id=eq.${site_id}`,    'nom');
    const siteNom = sites[0]?.nom || 'Hôtel';

    // ── Récupérer nom du technicien ─────────────────────────────────────────
    let techNom = 'Technicien';
    if (contact_id) {
      const contacts = await db('contacts', `&id=eq.${contact_id}`, 'nom');
      techNom = contacts[0]?.nom || 'Technicien';
    }

    // ── Heure de validation (Africa/Dakar) ──────────────────────────────────
    const heure = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar'
    });

    // ── URL du rapport ───────────────────────────────────────────────────────
    const rapportUrl = `${BASE_URL}/rapport-releve.html?id=${releve_id}`;

    // ── Construire le message WhatsApp ───────────────────────────────────────
    let msg = `📊 *Relevé horaire validé — ${siteNom}*\n`;
    msg    += `_Aujourd'hui · ${heure} · ${techNom}_\n\n`;
    msg    += `✅ ${nb_valeurs || 0} valeur${(nb_valeurs || 0) !== 1 ? 's' : ''} saisie${(nb_valeurs || 0) !== 1 ? 's' : ''}`;
    if (nb_alertes > 0) {
      msg  += `\n⚠️ ${nb_alertes} valeur${nb_alertes > 1 ? 's' : ''} hors seuil — à vérifier`;
    } else {
      msg  += `\n✅ Aucune valeur hors seuil`;
    }
    msg    += `\n\n📋 *Rapport complet :*\n${rapportUrl}`;

    // ── Envoyer aux responsables ─────────────────────────────────────────────
    const responsables = await getResponsables(site_id);
    const sent         = new Set<string>();
    let   sentCount    = 0;

    for (const r of responsables) {
      if (!r.whatsapp || sent.has(r.whatsapp)) continue;
      sent.add(r.whatsapp);
      await sendWA(r.whatsapp, msg);
      sentCount++;
    }

    console.log(`notif-releve: ${sentCount} message(s) envoyé(s) pour relevé ${releve_id}`);

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, rapport: rapportUrl }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('notif-releve error:', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
