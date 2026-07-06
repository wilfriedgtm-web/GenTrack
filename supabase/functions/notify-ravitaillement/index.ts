// supabase/functions/notify-ravitaillement/index.ts
// GenTrack — Notification WA lors d'un ravitaillement carburant

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL = Deno.env.get('SUPABASE_URL') || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID = Deno.env.get('TWILIO_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_TOKEN') || '';
const TWILIO_NUMBER = Deno.env.get('TWILIO_NUMBER') || 'whatsapp:+14155238886';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function db(table: string, query = '', method = 'GET', body?: any) {
  const url = `${SUPA_URL}/rest/v1/${table}?select=*${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return [];
  return res.json();
}

async function sendWA(to: string, message: string) {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: TWILIO_NUMBER,
        To: toFormatted,
        Body: message
      }).toString()
    }
  );
  const data = await res.json();
  console.log(`WA → ${to}:`, JSON.stringify(data).substring(0, 100));
  return data;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { client_id, groupe_id, litres, valide_par } = await req.json();

    if (!client_id || !groupe_id || !litres || !valide_par) {
      return new Response(JSON.stringify({ error: 'Paramètres manquants' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer les infos client, groupe et techniciens
    const [clients, groupes, gardiens] = await Promise.all([
      db('clients', `&id=eq.${client_id}`),
      db('groupes', `&id=eq.${groupe_id}`),
      db('gardiens', `&client_id=eq.${client_id}&actif=eq.true`)
    ]);

    const client = Array.isArray(clients) ? clients[0] : null;
    const groupe = Array.isArray(groupes) ? groupes[0] : null;

    if (!client || !groupe) {
      return new Response(JSON.stringify({ error: 'Client ou groupe introuvable' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Enregistrer dans saisies (source='dashboard') pour que les coûts soient calculés partout
    await db('saisies', '', 'POST', {
      client_id,
      groupe_id,
      date: new Date().toISOString().split('T')[0],
      litres_ajoutes: litres,
      niveau_carburant: null,
      heures_marche: null,
      niveau_huile: null,
      operateur: valide_par,
      source: 'dashboard'
    });

    // Construire le message
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Africa/Dakar'
    });
    const message =
      `⛽ *Ravitaillement enregistré*\n` +
      `*${client.nom}*\n\n` +
      `📟 ${groupe.nom}${groupe.reference ? ' · ' + groupe.reference : ''}\n` +
      `💧 *${litres} litres* ajoutés\n` +
      `📅 ${dateStr}\n` +
      `👤 Validé par ${valide_par}\n\n` +
      `_Enregistré via GenTrack_`;

    // Envoyer à tous les techniciens (table gardiens)
    const destinataires: string[] = [];
    if (Array.isArray(gardiens)) {
      for (const g of gardiens) {
        if (g.whatsapp) {
          await sendWA(g.whatsapp, message);
          destinataires.push(g.nom || g.whatsapp);
        }
      }
    }

    // Envoyer aussi au patron (whatsapp_patron)
    if (client.whatsapp_patron) {
      await sendWA(client.whatsapp_patron, message);
      destinataires.push('Responsable');
    }

    // Fallback ancien système (whatsapp_gardien)
    if (client.whatsapp_gardien && (!gardiens || gardiens.length === 0)) {
      await sendWA(client.whatsapp_gardien, message);
    }

    console.log(`Ravitaillement notifié — ${litres}L · ${groupe.nom} · ${destinataires.join(', ')}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Notifications envoyées à ${destinataires.length} destinataire(s)`,
      destinataires
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Erreur notify-ravitaillement:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
