// supabase/functions/notif-ronde-zones/index.ts
// GenTrack — Notification WhatsApp au resp_tech quand un tech valide sa ronde de zones
// Appelé depuis ronde-zones.html après submitRonde() — PAS de JWT user (anon key)
// verify_jwt: false (voir config ci-dessous)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL     = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID   = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM  = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// ── Supabase helper (service role) ────────────────────────────────────────────
async function db(table: string, query = '', select = '*'): Promise<any[]> {
  const url = `${SUPA_URL}/rest/v1/${table}?select=${select}${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
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

// ── Twilio WhatsApp ────────────────────────────────────────────────────────────
async function sendWA(to: string, message: string): Promise<void> {
  const toFmt  = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const payload = { From: TWILIO_FROM, To: toFmt, Body: message };
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload).toString(),
    }
  );
  const data = await res.json();
  if (!res.ok) console.error('Twilio sendWA error:', data?.code, data?.message);
}

// ── Responsables du site (resp_tech + dir_tech) ───────────────────────────────
async function getResponsables(siteId: string): Promise<any[]> {
  const seen   = new Set<string>();
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
    const { site_id, contact_id, contact_nom, nb_zones, nb_total, nb_incidents } = body as {
      site_id:      string;
      contact_id:   string;
      contact_nom:  string;
      nb_zones:     number;
      nb_total:     number;
      nb_incidents: number;
    };

    if (!site_id) {
      return new Response(
        JSON.stringify({ error: 'site_id est requis' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // ── Nom du site ───────────────────────────────────────────────────────────
    const sites   = await db('sites', `&id=eq.${site_id}`, 'nom');
    const siteNom = sites[0]?.nom || 'Résidence';

    // ── Nom du tech (préférer celui fourni, sinon chercher en base) ───────────
    let techNom = contact_nom || 'Technicien';
    if (!techNom && contact_id) {
      const contacts = await db('contacts', `&id=eq.${contact_id}`, 'nom');
      techNom = contacts[0]?.nom || 'Technicien';
    }

    // ── Date + heure (Africa/Dakar) ───────────────────────────────────────────
    const now   = new Date();
    const date  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' });
    const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });

    // ── Message WhatsApp ──────────────────────────────────────────────────────
    let msg  = `🏠 *Ronde de zones terminée — ${siteNom}*\n`;
    msg     += `_${date} · ${heure} · ${techNom}_\n\n`;
    msg     += `✅ ${nb_zones}/${nb_total} zone${nb_total !== 1 ? 's' : ''} contrôlée${nb_zones !== 1 ? 's' : ''}`;
    if (nb_incidents > 0) {
      msg   += `\n⚠️ ${nb_incidents} incident${nb_incidents > 1 ? 's' : ''} signalé${nb_incidents > 1 ? 's' : ''} — à traiter`;
    } else {
      msg   += `\n✅ Aucun incident`;
    }

    // ── Envoi aux responsables ────────────────────────────────────────────────
    const responsables = await getResponsables(site_id);
    const sent         = new Set<string>();
    let   sentCount    = 0;

    for (const r of responsables) {
      if (!r.whatsapp || sent.has(r.whatsapp)) continue;
      sent.add(r.whatsapp);
      await sendWA(r.whatsapp, msg);
      sentCount++;
    }

    console.log(`notif-ronde-zones: ${sentCount} message(s) envoyé(s) pour site ${site_id} — tech ${techNom}`);

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('notif-ronde-zones error:', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
