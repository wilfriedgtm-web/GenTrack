// supabase/functions/notify-equipe/index.ts  — v1
// Notifications déclenchées depuis equipe.html :
//   • action=pec             → WA léger au resp_tech ("pris en charge par X")
//   • action=affecter_tech   → WA au tech interne avec lien rapport
//   • action=affecter_prestataire → WA + email au prestataire

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const APP_URL     = Deno.env.get('APP_URL')                   || 'https://gen-track.vercel.app';

const TYPE_LABELS: Record<string, string> = {
  panne:'⚡ Panne', anomalie:'⚠️ Anomalie', bruit:'🔊 Bruit',
  odeur:'💨 Odeur', fuite:'💧 Fuite', seuil:'📈 Seuil', autre:'📋 Autre',
};

function corsHeaders(req: Request): Record<string,string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = /^https:\/\/(gen-track(-[a-z0-9]+)*\.vercel\.app|localhost(:\d+)?)$/.test(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

async function supaGet(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
  });
  if (!res.ok) return [];
  return await res.json();
}

async function sendWA(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.log('[notify-equipe] Twilio non configuré — WA ignoré:', to);
    return;
  }
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const params = new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );
  if (!res.ok) console.error('[notify-equipe] WA error:', await res.text());
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  // SendGrid — si SENDGRID_KEY non configuré, log et ignore
  const sgKey = Deno.env.get('SENDGRID_KEY') || '';
  if (!sgKey) {
    console.log('[notify-equipe] SendGrid non configuré — email ignoré:', to);
    return;
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sgKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@gentrack.io', name: 'GenTrack' },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  });
  if (!res.ok) console.error('[notify-equipe] Email error:', await res.text());
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: cors });

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const { action, signalement_id, tech_nom, tech_wa, prest_nom, prest_tel, prest_email, rapport_url } = body;

  if (!action || !signalement_id) {
    return new Response(JSON.stringify({ error: 'action et signalement_id requis' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // Charger le signalement + site
  const sgs = await supaGet('signalements',
    `id=eq.${signalement_id}&select=id,ref_code,type,description,lieu,groupe_id,signale_par,equipements(nom)`
  );
  const sg = sgs[0];
  if (!sg) {
    return new Response(JSON.stringify({ error: 'Signalement introuvable' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const siteId = sg.groupe_id;
  const ref    = sg.ref_code ? `[${sg.ref_code}]` : `[${signalement_id.slice(0,8)}]`;
  const type   = TYPE_LABELS[sg.type] || sg.type || 'Signalement';
  const desc   = sg.description || '';
  const lieu   = sg.lieu ? `\n📍 ${sg.lieu}` : '';
  const eqNom  = sg.equipements?.nom ? `\n⚙️ ${sg.equipements.nom}` : '';

  // Charger le resp_tech du site
  const respContacts = await supaGet('contacts',
    `site_id=eq.${siteId}&role=eq.resp_tech&actif=eq.true&select=nom,whatsapp&limit=1`
  );
  const resp = respContacts[0] || null;

  // ─── CAS 1 : PEC (prise en charge par un technicien) ───────
  if (action === 'pec') {
    // WA léger au resp_tech (Option A)
    if (resp?.whatsapp) {
      const msgResp =
        `✅ *${ref} pris en charge*\n` +
        `👷 ${tech_nom || 'Un technicien'}\n` +
        `${type}${eqNom}${lieu}\n\n` +
        `_Le rapport sera soumis à la clôture._`;
      await sendWA(resp.whatsapp, msgResp);
    }
    return new Response(JSON.stringify({ ok: true, action }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // ─── CAS 2 : Affectation technicien interne ─────────────────
  if (action === 'affecter_tech') {
    const url = rapport_url || `${APP_URL}/rapport.html?sg=${signalement_id}`;

    // WA au technicien avec lien rapport
    if (tech_wa) {
      const msgTech =
        `📋 *Signalement assigné — ${ref}*\n` +
        `🏨 ${siteId}\n` +
        `${type}${eqNom}${lieu}\n` +
        `📝 ${desc.slice(0, 120)}${desc.length > 120 ? '…' : ''}\n\n` +
        `Ouvre et remplis ton rapport :\n${url}`;
      await sendWA(tech_wa, msgTech);
    }

    // WA léger au resp_tech
    if (resp?.whatsapp) {
      const msgResp =
        `✅ *${ref} affecté*\n` +
        `👷 ${tech_nom || 'Technicien'} — en cours`;
      await sendWA(resp.whatsapp, msgResp);
    }

    return new Response(JSON.stringify({ ok: true, action }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // ─── CAS 3 : Affectation prestataire ────────────────────────
  if (action === 'affecter_prestataire') {
    const url = rapport_url || `${APP_URL}/rapport.html?sg=${signalement_id}`;

    // WA au prestataire
    if (prest_tel) {
      const msgPrest =
        `📋 *Mission assignée — ${ref}*\n` +
        `${type}${eqNom}${lieu}\n` +
        `📝 ${desc.slice(0, 120)}${desc.length > 120 ? '…' : ''}\n\n` +
        `Remplissez votre rapport d'intervention :\n${url}`;
      await sendWA(prest_tel, msgPrest);
    }

    // Email au prestataire
    if (prest_email) {
      const subject = `GenTrack — Mission assignée ${ref}`;
      const emailBody =
        `Bonjour ${prest_nom || 'Prestataire'},\n\n` +
        `Une intervention vous a été assignée.\n\n` +
        `Référence : ${ref}\n` +
        `Type : ${type}\n` +
        (sg.lieu ? `Lieu : ${sg.lieu}\n` : '') +
        `Description : ${desc}\n\n` +
        `Remplissez votre rapport d'intervention ici :\n${url}\n\n` +
        `Cordialement,\nL'équipe GenTrack`;
      await sendEmail(prest_email, subject, emailBody);
    }

    // WA léger au resp_tech
    if (resp?.whatsapp) {
      const msgResp =
        `✅ *${ref} affecté à prestataire*\n` +
        `🔧 ${prest_nom || 'Prestataire'} — en cours`;
      await sendWA(resp.whatsapp, msgResp);
    }

    return new Response(JSON.stringify({ ok: true, action }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
});
