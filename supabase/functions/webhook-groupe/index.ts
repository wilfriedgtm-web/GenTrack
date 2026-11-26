// supabase/functions/webhook-groupe/index.ts
// GenTrack — Webhook WhatsApp Groupe v1
// Reçoit les webhooks du Conversations Service (groupe WhatsApp)
// Commands: OK REF-XXXX | AFFECTER REF-XXXX [num|nom]
// Silence pour tout le reste.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOK  = Deno.env.get('TWILIO_TOKEN')             || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const BASE_URL    = Deno.env.get('APP_URL')                   || 'https://gen-track.vercel.app';

// ── DB helpers ────────────────────────────────────────────────────────────────

async function dbGet(table: string, query = '', select = '*'): Promise<any[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${select}${query}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function dbPatch(table: string, id: string, body: any): Promise<void> {
  await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

async function dbPost(table: string, body: any): Promise<any> {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function dbDelete(table: string, query: string): Promise<void> {
  await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
}

// ── Envoi messages ────────────────────────────────────────────────────────────

// Envoyer dans le groupe via Conversations API
async function sendToGroupe(conversationSid: string, message: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOK) { console.error('[groupe] credentials manquants'); return; }
  const res = await fetch(
    `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOK}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Body: message, Author: 'GenTrack' }).toString(),
    }
  );
  if (!res.ok) console.error('[groupe] sendToGroupe error:', await res.text());
  else console.log('[groupe] sendToGroupe OK');
}

// Envoyer en 1-à-1 au technicien via Programmable Messaging
async function sendWA(to: string, message: string): Promise<void> {
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
      body: new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: message }).toString(),
    }
  );
  if (!res.ok) console.error('[groupe] sendWA error:', res.status, await res.text());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace('whatsapp:', '').replace(/\s+/g, '');
}

// Fuzzy match insensible à la casse et aux accents
function fuzzyMatch(query: string, name: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const q = normalize(query);
  const n = normalize(name);
  return n.includes(q) || q.includes(n) || q.split(/\s+/).some((w) => n.includes(w));
}

// ── Pending AFFECTER (sélection par numéro) ───────────────────────────────────

interface PendingTech { index: number; nom: string; id: string; whatsapp: string }

async function savePending(conversationSid: string, refCode: string, techs: PendingTech[], authorPhone: string): Promise<void> {
  await dbDelete('groupe_pending_affecter',
    `conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}`
  );
  await dbPost('groupe_pending_affecter', {
    conversation_sid: conversationSid,
    ref_code: refCode,
    tech_list: JSON.stringify(techs),
    author_phone: authorPhone,
  });
}

async function getPending(conversationSid: string, authorPhone: string): Promise<{ ref_code: string; tech_list: PendingTech[] } | null> {
  const rows = await dbGet('groupe_pending_affecter',
    `&conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}&expires_at=gt.${new Date().toISOString()}&limit=1`
  );
  if (!rows.length) return null;
  const row = rows[0];
  const list = typeof row.tech_list === 'string' ? JSON.parse(row.tech_list) : row.tech_list;
  return { ref_code: row.ref_code, tech_list: list };
}

async function deletePending(conversationSid: string, authorPhone: string): Promise<void> {
  await dbDelete('groupe_pending_affecter',
    `conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}`
  );
}

// ── Pending SUIVI (numéros → liens rapport) ────────────────────────────────────

interface PendingSig { index: number; id: string; ref_code: string; statut: string }

async function savePendingSuivi(conversationSid: string, sigs: PendingSig[], authorPhone: string): Promise<void> {
  await dbDelete('groupe_pending_suivi',
    `conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}`
  );
  await dbPost('groupe_pending_suivi', {
    conversation_sid: conversationSid,
    sig_list: JSON.stringify(sigs),
    author_phone: authorPhone,
  });
}

async function getPendingSuivi(conversationSid: string, authorPhone: string): Promise<PendingSig[] | null> {
  const rows = await dbGet('groupe_pending_suivi',
    `&conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}&expires_at=gt.${new Date().toISOString()}&limit=1`
  );
  if (!rows.length) return null;
  const row = rows[0];
  const list = typeof row.sig_list === 'string' ? JSON.parse(row.sig_list) : row.sig_list;
  return list;
}

async function deletePendingSuivi(conversationSid: string, authorPhone: string): Promise<void> {
  await dbDelete('groupe_pending_suivi',
    `conversation_sid=eq.${encodeURIComponent(conversationSid)}&author_phone=eq.${encodeURIComponent(authorPhone)}`
  );
}

// ── Suivi signalements ────────────────────────────────────────────────────────

async function afficherSuivi(conversationSid: string, site: any, authorPhone: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const [sigsActifs, sigsResolus] = await Promise.all([
    dbGet('signalements', `&site_id=eq.${site.id}&statut=in.(ouvert,en_cours)&order=created_at.desc&limit=50`),
    dbGet('signalements', `&site_id=eq.${site.id}&statut=eq.resolu&resolved_at=gte.${today}T00:00:00&order=resolved_at.desc&limit=20`),
  ]);
  const sigs = [...sigsActifs, ...sigsResolus];
  if (!sigs.length) {
    await sendToGroupe(conversationSid, `✅ *${site.nom}*\n\nAucun signalement en cours ni résolu aujourd'hui.`);
    return;
  }

  const ouverts  = sigs.filter((s: any) => s.statut === 'ouvert');
  const enCours  = sigs.filter((s: any) => s.statut === 'en_cours');
  const resolus  = sigs.filter((s: any) => s.statut === 'resolu');

  const indexed: PendingSig[] = [];
  let num = 1;
  let msg = `📋 *Suivi signalements*\n*${site.nom}*\n`;

  if (ouverts.length) {
    msg += `\n🔴 *Non pris en charge (${ouverts.length})*\n`;
    for (const s of ouverts) {
      msg += `*${num}* — ${s.ref_code || '—'} · ${(s.description || '').substring(0, 35)}\n`;
      indexed.push({ index: num, id: s.id, ref_code: s.ref_code || '', statut: s.statut });
      num++;
    }
  }
  if (enCours.length) {
    msg += `\n🟡 *En cours (${enCours.length})*\n`;
    for (const s of enCours) {
      const par = s.pris_en_charge_par || 'Non assigné';
      msg += `*${num}* — ${s.ref_code || '—'} · ${(s.description || '').substring(0, 30)} _(${par})_\n`;
      indexed.push({ index: num, id: s.id, ref_code: s.ref_code || '', statut: s.statut });
      num++;
    }
  }
  if (resolus.length) {
    msg += `\n✅ *Résolus aujourd'hui (${resolus.length})*\n`;
    for (const s of resolus) {
      msg += `*${num}* — ${s.ref_code || '—'} · ${(s.description || '').substring(0, 35)}\n`;
      indexed.push({ index: num, id: s.id, ref_code: s.ref_code || '', statut: s.statut });
      num++;
    }
  }

  const nonResolus = indexed.filter(i => i.statut !== 'resolu');
  if (nonResolus.length > 0) {
    msg += `\n_Numéro(s) pour ouvrir le rapport (ex : *1 2*)_`;
  }

  await savePendingSuivi(conversationSid, indexed, authorPhone);
  await sendToGroupe(conversationSid, msg.trim());
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const bodyRaw = await req.text();
  const params  = new URLSearchParams(bodyRaw);

  const eventType       = params.get('EventType') || '';
  const conversationSid = params.get('ConversationSid') || '';
  const author          = params.get('Author') || '';
  const bodyText        = (params.get('Body') || '').trim();

  // Ignorer les messages non-humains (bot, system)
  if (!author.startsWith('whatsapp:')) {
    console.log(`[groupe] Ignoring non-WA author: ${author}`);
    return new Response('ok', { status: 200 });
  }

  // Ignorer les événements autres que nouveaux messages
  if (eventType && eventType !== 'onMessageAdded') {
    return new Response('ok', { status: 200 });
  }

  if (!conversationSid || !bodyText) return new Response('ok', { status: 200 });

  console.log(`[groupe] ConvSid=${conversationSid} Author=${author} Body="${bodyText.slice(0, 60)}"`);

  // ── Trouver le site par whatsapp_groupe_jid (= ConversationSid) ───────────
  const sites = await dbGet('sites',
    `&whatsapp_groupe_jid=eq.${encodeURIComponent(conversationSid)}&actif=eq.true&limit=1`
  );
  if (!sites.length) {
    console.log(`[groupe] Aucun site pour ConvSid=${conversationSid}`);
    return new Response('ok', { status: 200 });
  }
  const site = sites[0];

  // ── Contacts du site ──────────────────────────────────────────────────────
  const contacts     = await dbGet('contacts', `&site_id=eq.${site.id}&actif=eq.true`);
  const techniciens  = contacts
    .filter((c: any) => c.role === 'technicien' && c.whatsapp)
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom));
  const authorPhone  = normalizePhone(author);
  const authorContact = contacts.find((c: any) => normalizePhone(c.whatsapp) === authorPhone) || null;
  const authorNom    = authorContact?.nom || authorPhone;

  // ── Parsing commandes (insensible à la casse) ─────────────────────────────
  const upper = bodyText.toUpperCase().trim();

  // ══ SUIVI ══════════════════════════════════════════════════════════════════
  if (upper === 'SUIVI') {
    await afficherSuivi(conversationSid, site, authorPhone);
    return new Response('ok', { status: 200 });
  }

  // ══ OK REF-XXXX ════════════════════════════════════════════════════════════
  const okMatch = upper.match(/^OK\s+(REF-\S+)/);
  if (okMatch) {
    const refCode = okMatch[1];
    const sigs = await dbGet('signalements',
      `&ref_code=eq.${refCode}&site_id=eq.${site.id}&limit=1`
    );
    if (!sigs.length) {
      await sendToGroupe(conversationSid, `❌ Signalement *${refCode}* introuvable.`);
      return new Response('ok', { status: 200 });
    }
    const sig = sigs[0];
    if (sig.statut !== 'ouvert') {
      await sendToGroupe(conversationSid, `ℹ️ *${refCode}* est déjà ${sig.statut === 'en_cours' ? 'en cours' : 'clôturé'}.`);
      return new Response('ok', { status: 200 });
    }

    const now = new Date().toISOString();
    await dbPatch('signalements', sig.id, {
      statut: 'en_cours',
      pris_en_charge_par: authorNom,
      pris_en_charge_at: now,
      assigne_a: authorContact?.id || null,
    });

    const rapportUrl = `${BASE_URL}/rapport.html?sg=${sig.id}`;
    await sendToGroupe(conversationSid,
      `✅ *${refCode}* pris en charge par *${authorNom}*.\n📋 Rapport : ${rapportUrl}`
    );
    console.log(`[groupe] PEC ${refCode} par ${authorNom}`);
    return new Response('ok', { status: 200 });
  }

  // ══ AFFECTER REF-XXXX [cible] ══════════════════════════════════════════════
  const affecterMatch = bodyText.match(/^AFFECTER\s+(REF-\S+)(?:\s+(.+))?$/i);
  if (affecterMatch) {
    const refCode = affecterMatch[1].toUpperCase();
    const cible   = (affecterMatch[2] || '').trim();

    const sigs = await dbGet('signalements',
      `&ref_code=eq.${refCode}&site_id=eq.${site.id}&limit=1`
    );
    if (!sigs.length) {
      await sendToGroupe(conversationSid, `❌ Signalement *${refCode}* introuvable.`);
      return new Response('ok', { status: 200 });
    }
    const sig = sigs[0];

    // Pas de cible → afficher la liste et sauvegarder l'état
    if (!cible) {
      if (!techniciens.length) {
        await sendToGroupe(conversationSid, `❌ Aucun technicien configuré pour *${site.nom}*.`);
        return new Response('ok', { status: 200 });
      }
      const pendingList: PendingTech[] = techniciens.map((t: any, i: number) => ({
        index: i + 1, nom: t.nom, id: t.id, whatsapp: t.whatsapp,
      }));
      await savePending(conversationSid, refCode, pendingList, authorPhone);

      const liste = pendingList.map((t) => `${t.index}. ${t.nom}`).join('\n');
      await sendToGroupe(conversationSid,
        `↩️ @${authorNom}\n👷 *Techniciens — ${site.nom}*\n\n${liste}\n\n` +
        `Répondez *1*, *2*… pour assigner *${refCode}*.`
      );
      return new Response('ok', { status: 200 });
    }

    // Cible présente → résoudre par numéro ou nom
    await assignerTech(conversationSid, site, sig, cible, techniciens, authorNom, authorContact);
    await deletePending(conversationSid, authorPhone);
    return new Response('ok', { status: 200 });
  }

  // ══ Réponse numérique (1, 2, 3…) ══════════════════════════════════════════
  if (/^\d+(\s+\d+)*$/.test(bodyText.trim())) {
    const numbers = bodyText.trim().split(/\s+/).map((n) => parseInt(n, 10));

    // Priorité 1 : pending AFFECTER (sélection d'un technicien)
    const pending = await getPending(conversationSid, authorPhone);
    if (pending) {
      const idx = numbers[0]; // AFFECTER ne prend qu'un seul numéro
      const tech = pending.tech_list.find((t) => t.index === idx) || null;
      if (!tech) {
        await sendToGroupe(conversationSid,
          `↩️ @${authorNom} — ❌ Numéro invalide. Choisissez entre 1 et ${pending.tech_list.length}.`
        );
        return new Response('ok', { status: 200 });
      }

      const sigs = await dbGet('signalements',
        `&ref_code=eq.${pending.ref_code}&site_id=eq.${site.id}&limit=1`
      );
      const sig = sigs[0] || null;
      if (!sig) {
        await sendToGroupe(conversationSid,
          `↩️ @${authorNom} — ❌ Signalement *${pending.ref_code}* introuvable.`
        );
        await deletePending(conversationSid, authorPhone);
        return new Response('ok', { status: 200 });
      }

      await assignerTech(conversationSid, site, sig, String(idx), pending.tech_list.map((t) => ({
        id: t.id, nom: t.nom, whatsapp: t.whatsapp, role: 'technicien',
      })), authorNom, authorContact);
      await deletePending(conversationSid, authorPhone);
      return new Response('ok', { status: 200 });
    }

    // Priorité 2 : pending SUIVI (sélection de signalements → lien rapport dans le groupe)
    const pendingSuivi = await getPendingSuivi(conversationSid, authorPhone);
    if (pendingSuivi) {
      const matches = numbers
        .map((n) => pendingSuivi.find((s) => s.index === n))
        .filter(Boolean) as PendingSig[];

      if (!matches.length) {
        const max = pendingSuivi.length;
        await sendToGroupe(conversationSid,
          `↩️ @${authorNom} — ❌ Numéro(s) invalide(s). Choisissez entre 1 et ${max}.`
        );
        return new Response('ok', { status: 200 });
      }

      for (const s of matches) {
        const rapportUrl = `${BASE_URL}/rapport.html?sg=${s.id}`;
        await sendToGroupe(conversationSid,
          `📋 *${s.ref_code || '—'}* — @${authorNom}\n${rapportUrl}`
        );
      }

      await deletePendingSuivi(conversationSid, authorPhone);
      return new Response('ok', { status: 200 });
    }

    // Pas de contexte → silence
    return new Response('ok', { status: 200 });
  }

  // Tout le reste → silence
  console.log(`[groupe] Silence pour: "${bodyText.slice(0, 40)}"`);
  return new Response('ok', { status: 200 });
});

// ── Assigner un technicien ────────────────────────────────────────────────────
async function assignerTech(
  conversationSid: string,
  site: any,
  sig: any,
  cible: string,
  techniciens: any[],
  parNom: string,
  parContact: any,
): Promise<void> {
  // Résolution par numéro ou par nom (fuzzy)
  const num = parseInt(cible, 10);
  const techsSorted = [...techniciens].sort((a, b) => a.nom.localeCompare(b.nom));
  let tech: any = null;

  if (!isNaN(num) && num >= 1 && num <= techsSorted.length) {
    tech = techsSorted[num - 1];
  } else {
    tech = techsSorted.find((t) => fuzzyMatch(cible, t.nom)) || null;
  }

  if (!tech) {
    await sendToGroupe(conversationSid,
      `❌ Technicien "*${cible}*" introuvable.\nTapez *AFFECTER ${sig.ref_code}* pour voir la liste.`
    );
    return;
  }

  // Mise à jour DB
  await dbPatch('signalements', sig.id, {
    statut: sig.statut === 'ouvert' ? 'en_cours' : sig.statut,
    assigne_a: tech.id,
    pris_en_charge_par: tech.nom,
    pris_en_charge_at: new Date().toISOString(),
  });

  // Notification 1-à-1 au tech (si session 24h active)
  const techMsg =
    `📋 *Signalement assigné — GenTrack*\n\n` +
    `🏨 *${site.nom}*\n` +
    `Réf : *${sig.ref_code}*\n` +
    `Assigné par : ${parNom}\n\n` +
    `Répondez *OK ${sig.ref_code}* pour confirmer la prise en charge.`;
  await sendWA(tech.whatsapp, techMsg);

  // Confirmation dans le groupe
  await sendToGroupe(conversationSid,
    `✅ *${sig.ref_code}* assigné à *${tech.nom}* par *${parNom}*.\nIl a reçu une notification.`
  );
  console.log(`[groupe] AFFECTER ${sig.ref_code} → ${tech.nom} par ${parNom}`);
}
