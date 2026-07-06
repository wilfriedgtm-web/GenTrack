// supabase/functions/webhook/index.ts
// GenTrack WhatsApp Bot v2 — Flux saisie unifié avec contexte veille

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL = Deno.env.get('SUPABASE_URL') || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID = Deno.env.get('TWILIO_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_TOKEN') || '';
const TWILIO_NUMBER = Deno.env.get('TWILIO_NUMBER') || 'whatsapp:+14155238886';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicG94amxrcXhucWp6eG9oYXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjM3ODAsImV4cCI6MjA5NzA5OTc4MH0.9-QyWgon93jGDo5QKMIh_-QbQZ_P9rQrYJnVxegJe7M';

// ── SUPABASE ──
async function db(table: string, opts: any = {}) {
  const { method = 'GET', body, query = '', select = '*' } = opts;
  const key = SUPA_KEY || ANON_KEY;
  const url = `${SUPA_URL}/rest/v1/${table}?select=${select}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return [];
  return res.json();
}

// ── TWILIO ──
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
      body: new URLSearchParams({ From: TWILIO_NUMBER, To: toFormatted, Body: message }).toString()
    }
  );
  const data = await res.json();
  console.log('Twilio:', JSON.stringify(data).substring(0, 120));
  return data;
}

// ── SESSION ──
async function getSession(phone: string) {
  const rows = await db('sessions', {
    query: `&phone=eq.${encodeURIComponent(phone)}&order=updated_at.desc&limit=1`
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function setSession(phone: string, state: string, data: any = {}) {
  await db('sessions', { method: 'DELETE', query: `&phone=eq.${encodeURIComponent(phone)}` });
  await db('sessions', {
    method: 'POST',
    body: { phone, state, data: JSON.stringify(data), updated_at: new Date().toISOString() }
  });
}

// ── CONTEXTE VEILLE ──
function buildContexteVeille(derniereSaisie: any): string {
  if (!derniereSaisie || !derniereSaisie.derniere_date) {
    return `📋 _Aucune saisie précédente enregistrée._`;
  }
  const jours = derniereSaisie.jours_retard || 0;
  const quand = jours === 0 ? 'aujourd\'hui' : jours === 1 ? 'hier' : `il y a ${jours} jours`;
  const retardMsg = jours >= 2 ? `\n⚠️ _Saisie manquante depuis ${jours} jours_` : '';
  const carb = derniereSaisie.niveau_carburant != null ? `⛽ ${derniereSaisie.niveau_carburant}L` : '⛽ —';
  const heures = derniereSaisie.heures_marche != null ? `🕐 ${derniereSaisie.heures_marche}h moteur` : '🕐 —';
  const huile = derniereSaisie.niveau_huile ? `🛢️ ${derniereSaisie.niveau_huile}` : '🛢️ —';
  const heure = derniereSaisie.heure_saisie ? ` à ${derniereSaisie.heure_saisie}` : '';
  return `📋 *Dernière saisie — ${quand}${heure}*\n${carb} · ${heures} · ${huile}${retardMsg}`;
}

// ── RAPPORT PATRON ──
async function sendRapportPatron(phone: string, client: any) {
  const groupesRaw = await db('groupes', { query: `&client_id=eq.${client.id}&actif=eq.true` });
  const groupes = Array.isArray(groupesRaw) ? groupesRaw : [];
  const alertesRaw = await db('alertes', { query: `&client_id=eq.${client.id}&resolue=eq.false` });
  const alertes = Array.isArray(alertesRaw) ? alertesRaw : [];
  const today = new Date().toISOString().split('T')[0];
  const saisiesRaw = await db('saisies', { query: `&client_id=eq.${client.id}&date=eq.${today}&order=created_at.desc` });
  const saisies = Array.isArray(saisiesRaw) ? saisiesRaw : [];

  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  let msg = `📊 *Rapport GenTrack*\n*${client.nom}* — ${date}\n\n`;

  for (const g of groupes) {
    const saisie = saisies.filter((s: any) => s.groupe_id === g.id)[0];
    const litresSaisie = saisie?.niveau_carburant; // maintenant en litres
    const capaciteG = g.capacite_reservoir_litres || 500;
    const pctCarb = litresSaisie != null ? Math.round(litresSaisie / capaciteG * 100) : null;
    const emoji = !saisie ? '❓' : pctCarb < 30 ? '🔴' : pctCarb < 50 ? '🟡' : '🟢';
    msg += `${emoji} *${g.nom}* — ${g.marque || ''} ${g.puissance_kva || ''}kVA\n`;
    if (saisie) {
      msg += `   ⛽ ${litresSaisie != null ? litresSaisie + 'L' : '—'} carburant${pctCarb != null ? ' (' + pctCarb + '%)' : ''}\n`;
      // Calcul autonomie intelligente
      if (litresSaisie != null) {
        const consoH = g.conso_theorique_lh || 65;
        const consoJour = consoH * 8;
        const joursAuto = consoJour > 0 ? Math.round((litresSaisie / consoJour) * 10) / 10 : null;
        const autoEmoji = joursAuto !== null ? (joursAuto < 2 ? '🔴' : joursAuto < 5 ? '🟡' : '🟢') : '';
        if (joursAuto !== null) {
          msg += `   ${autoEmoji} Autonomie : *${joursAuto} jour${joursAuto > 1 ? 's' : ''}*\n`;
        }
      }
      msg += `   🕐 Compteur moteur : ${saisie.heures_marche || 0}h\n`;
      msg += `   🛢️ Huile : ${saisie.niveau_huile || 'normal'}\n`;
      if (saisie.litres_ajoutes > 0) msg += `   💧 +${saisie.litres_ajoutes}L ajoutés\n`;
      if (saisie.operateur) msg += `   👤 ${saisie.operateur}\n`;
      const heureSaisie = saisie.created_at ? new Date(saisie.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }) : null;
      if (heureSaisie) msg += `   🕗 Saisie à ${heureSaisie}\n`;
    } else {
      msg += `   ❓ Pas de saisie aujourd'hui\n`;
    }
    msg += '\n';
  }

  if (alertes.length > 0) {
    msg += `⚠️ *${alertes.length} alerte(s) active(s)*\n`;
    alertes.forEach((a: any) => { msg += `• ${a.message}\n`; });
  } else {
    msg += `✅ Aucune alerte active`;
  }
  return sendWA(phone, msg);
}

// ── MENU AIDE ──
function buildMenu(isGardien: boolean, isPatron: boolean) {
  let msg = `🔧 *GenTrack — Commandes*\n\n`;
  if (isGardien) msg += `*Gardien :*\n• *saisie* — Rapport quotidien\n• *plein* — Enregistrer un ravitaillement\n• *panne* — Signaler une urgence\n• *resolu* — Clôturer une panne\n• *aide* — Ce menu\n\n`;
  if (isPatron) msg += `*Responsable :*\n• *rapport* — Bilan des groupes\n• *plein* — Enregistrer un ravitaillement\n• *aide* — Ce menu\n\n`;
  if (!isGardien && !isPatron) msg += `Numéro non reconnu.`;
  return msg;
}

// ── ENREGISTREMENT SAISIE ──
async function enregistrerSaisie(phone: string, data: any, client: any) {
  // Enregistrer la saisie
  await db('saisies', {
    method: 'POST',
    body: {
      client_id: data.client_id,
      groupe_id: data.groupe_id,
      date: new Date().toISOString().split('T')[0],
      niveau_carburant: data.niveau_carburant, // en litres
      litres_ajoutes: data.litres_ajoutes || 0,
      heures_marche: data.heures_marche, // compteur moteur total
      niveau_huile: data.niveau_huile,
      operateur: data.operateur
    }
  });

  // Mettre à jour heures_total du groupe avec le nouveau compteur
  await db('groupes', {
    method: 'PATCH',
    query: `&id=eq.${data.groupe_id}`,
    body: { heures_total: data.heures_marche }
  });

  // Alertes automatiques
  const alertes: any[] = [];
  const capaciteGroupe = data.capacite_reservoir || 500;
  const pctCarburant = Math.round(data.niveau_carburant / capaciteGroupe * 100);
  if (pctCarburant < 30 && !data.litres_ajoutes) {
    alertes.push({ type: 'carburant_bas', severite: 'danger', message: `Carburant critique — ${data.niveau_carburant}L (${pctCarburant}%) — ${data.groupe_nom}` });
  }
  if (data.niveau_huile === 'critique') {
    alertes.push({ type: 'huile_critique', severite: 'danger', message: `Huile critique — ${data.groupe_nom} — Changement immédiat` });
  } else if (data.niveau_huile === 'bas') {
    alertes.push({ type: 'huile_basse', severite: 'warning', message: `Huile basse — ${data.groupe_nom}` });
  }
  if (data.niveau_huile === 'normal') {
    await db('alertes', {
      method: 'PATCH',
      query: `&groupe_id=eq.${data.groupe_id}&type=in.(huile_critique,huile_basse)&resolue=eq.false`,
      body: { resolue: true }
    });
  }
  const compteurActuel = data.heures_marche;
  const pctVidange = Math.round((compteurActuel / (data.seuil_vidange || 250)) * 100);
  if (pctVidange >= 100) {
    alertes.push({ type: 'vidange_requise', severite: 'danger', message: `Vidange requise — ${data.groupe_nom} — ${compteurActuel}h au compteur` });
  } else if (pctVidange >= 80) {
    alertes.push({ type: 'vidange_imminente', severite: 'warning', message: `Vidange bientôt — ${data.groupe_nom} — ${pctVidange}% du seuil` });
  }
  if (data.litres_ajoutes > 0) {
    await db('alertes', {
      method: 'PATCH',
      query: `&groupe_id=eq.${data.groupe_id}&type_alerte=eq.plein_manque&resolue=eq.false`,
      body: { resolue: true }
    });
  }
  for (const alerte of alertes) {
    await db('alertes', {
      method: 'POST',
      body: { client_id: data.client_id, groupe_id: data.groupe_id, ...alerte }
    });
  }

  // Confirmation gardien
  const huileIcon = data.niveau_huile === 'critique' ? '🚨' : data.niveau_huile === 'bas' ? '⚠️' : '✅';
  const capG = data.capacite_reservoir || 500;
  const pctC = Math.round(data.niveau_carburant / capG * 100);
  const carbIcon = pctC < 30 ? '🔴' : pctC < 50 ? '🟡' : '🟢';
  const confirmation =
    `✅ *Saisie enregistrée !*\n\n` +
    `📟 *${data.groupe_nom}*\n` +
    `${carbIcon} ${data.niveau_carburant}L (${pctC}%) carburant\n` +
    `🕐 Compteur : ${data.heures_marche}h (+${data.heures_du_jour || '?'}h aujourd'hui)\n` +
    `${huileIcon} Huile : ${data.niveau_huile}\n` +
    `👤 ${data.operateur}\n` +
    `${data.litres_ajoutes > 0 ? `💧 +${data.litres_ajoutes}L ajoutés\n` : ''}` +
    `\n_Rapport envoyé au responsable 📲_`;
  await sendWA(phone, confirmation);

  // Rapport patron
  const clientFull = await db('clients', { query: `&id=eq.${data.client_id}` });
  if (Array.isArray(clientFull) && clientFull[0]?.whatsapp_patron) {
    await sendRapportPatron(clientFull[0].whatsapp_patron.replace('whatsapp:', ''), clientFull[0]);
  }
}

// ── FLUX PLEIN / RAVITAILLEMENT ──
async function demarrerPlein(phone: string, client: any) {
  const groupesRaw = await db('groupes', { query: `&client_id=eq.${client.id}&actif=eq.true` });
  const groupes = Array.isArray(groupesRaw) ? groupesRaw : [];
  if (!groupes.length) return sendWA(phone, `Aucun groupe configuré. Contactez votre administrateur.`);

  if (groupes.length === 1) {
    const g = groupes[0];
    await setSession(phone, 'plein_litres', {
      client_id: client.id, client_nom: client.nom,
      groupe_id: g.id, groupe_nom: g.nom,
      capacite_reservoir: g.capacite_reservoir_litres || 500
    });
    return sendWA(phone, `⛽ *Ravitaillement — ${client.nom}*\n\n📟 *${g.nom}*\n\nCombien de litres ont été ajoutés ?\n_(Ex: 500)_`);
  }

  // Plusieurs groupes
  const liste = groupes.map((g: any, i: number) => `*${i + 1}* — ${g.nom} (${g.marque} ${g.puissance_kva}kVA)`).join('\n');
  await setSession(phone, 'plein_groupe', {
    client_id: client.id, client_nom: client.nom,
    groupes: groupes.map((g: any) => ({ id: g.id, nom: g.nom, marque: g.marque, kva: g.puissance_kva, capacite: g.capacite_reservoir_litres || 500 }))
  });
  return sendWA(phone, `⛽ *Ravitaillement — ${client.nom}*\n\nQuel groupe a été ravitaillé ?\n\n${liste}\n\nRépondez avec le numéro.`);
}

async function gererFluxPlein(phone: string, bodyText: string, msg: string, client: any, session: any) {
  const state = session?.state || '';
  const sessionData = session?.data ? JSON.parse(session.data) : {};

  // Choix groupe
  if (state === 'plein_groupe') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sessionData.groupes?.length) {
      return sendWA(phone, `Répondez avec un numéro entre 1 et ${sessionData.groupes?.length}`);
    }
    const g = sessionData.groupes[idx];
    await setSession(phone, 'plein_litres', { ...sessionData, groupe_id: g.id, groupe_nom: g.nom, capacite_reservoir: g.capacite });
    return sendWA(phone, `⛽ *${g.nom}*\n\nCombien de litres ont été ajoutés ?\n_(Ex: 500)_`);
  }

  // Litres ajoutés
  if (state === 'plein_litres') {
    const litres = parseFloat(bodyText.trim().replace(',', '.'));
    if (isNaN(litres) || litres <= 0) {
      return sendWA(phone, `❌ Quantité invalide. Entrez un nombre en litres.\n_(Ex: 500)_`);
    }
    await setSession(phone, 'plein_niveau', { ...sessionData, litres_ajoutes: litres });
    return sendWA(phone, `✅ *${litres} litres* ajoutés.\n\n⛽ Quel est le niveau actuel de la cuve après le plein ?\n_(en litres, ex: 8000)_`);
  }

  // Niveau après plein
  if (state === 'plein_niveau') {
    const niveau = parseInt(bodyText.trim().replace(/\s/g, ''));
    const capacite = sessionData.capacite_reservoir || 500;
    if (isNaN(niveau) || niveau < 0 || niveau > capacite * 1.05) {
      return sendWA(phone, `❌ Niveau invalide. Entrez un volume entre 0 et ${capacite} litres.\n_(Ex: 8000)_`);
    }
    await setSession(phone, 'plein_operateur', { ...sessionData, niveau_carburant: niveau });
    return sendWA(phone, `✅ Niveau : *${niveau} litres*\n\n👤 Votre prénom ?`);
  }

  // Opérateur
  if (state === 'plein_operateur') {
    const operateur = bodyText.trim();
    const data = { ...sessionData, operateur };

    // Enregistrer dans saisies
    await db('saisies', {
      method: 'POST',
      body: {
        client_id: data.client_id,
        groupe_id: data.groupe_id,
        date: new Date().toISOString().split('T')[0],
        niveau_carburant: data.niveau_carburant,
        litres_ajoutes: data.litres_ajoutes,
        heures_marche: null,
        niveau_huile: null,
        operateur: data.operateur
      }
    });

    await setSession(phone, 'idle', {});

    // Notification à tous les techniciens + patron
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' });
    const pct = Math.round(data.niveau_carburant / (data.capacite_reservoir || 500) * 100);
    const notifMsg =
      `⛽ *Ravitaillement effectué*\n*${data.client_nom}*\n\n` +
      `📟 ${data.groupe_nom}\n` +
      `💧 *${data.litres_ajoutes}L* ajoutés\n` +
      `📊 Niveau actuel : *${data.niveau_carburant}L* (${pct}%)\n` +
      `📅 ${dateStr}\n` +
      `👤 ${data.operateur}\n\n` +
      `_Enregistré via GenTrack_`;

    // Techniciens (table gardiens)
    const gardiensRaw = await db('gardiens', { query: `&client_id=eq.${data.client_id}&actif=eq.true` });
    const gardiens = Array.isArray(gardiensRaw) ? gardiensRaw : [];
    for (const g of gardiens) {
      if (g.whatsapp && g.whatsapp !== phone) await sendWA(g.whatsapp, notifMsg);
    }
    // Patron
    const clientFull = await db('clients', { query: `&id=eq.${data.client_id}` });
    if (Array.isArray(clientFull) && clientFull[0]?.whatsapp_patron && clientFull[0].whatsapp_patron !== phone) {
      await sendWA(clientFull[0].whatsapp_patron, notifMsg);
    }

    return sendWA(phone,
      `✅ *Ravitaillement enregistré !*\n\n` +
      `📟 ${data.groupe_nom}\n` +
      `💧 ${data.litres_ajoutes}L ajoutés\n` +
      `📊 Niveau : ${data.niveau_carburant}L (${pct}%)\n` +
      `\n_Équipe notifiée 📲_`
    );
  }

  return sendWA(phone, `Tapez *plein* pour recommencer ou *aide* pour les commandes.`);
}

// ═══════════════════════════════════════════════
// ── BOT PRINCIPAL ──
// ═══════════════════════════════════════════════
async function handleMessage(from: string, bodyText: string) {
  const phone = from.replace('whatsapp:', '');
  const msg = bodyText.trim().toLowerCase();
  console.log(`=== From: ${phone} | Body: ${bodyText}`);

  // ── Identifier le client ──
  // Nouveau système : table `gardiens` (multi-techniciens par client, ex: Azalaï Dakar)
  // Ancien système (fallback) : colonne `clients.whatsapp_gardien` (démos /azalai)
  const [gardienRowsRaw, legacyGardienRaw, patronsRaw] = await Promise.all([
    db('gardiens', { query: `&whatsapp=eq.${encodeURIComponent(phone)}&actif=eq.true` }),
    db('clients', { query: `&whatsapp_gardien=eq.${encodeURIComponent(phone)}&actif=eq.true` }),
    db('clients', { query: `&whatsapp_patron=eq.${encodeURIComponent(phone)}&actif=eq.true` })
  ]);
  const gardienRows = Array.isArray(gardienRowsRaw) ? gardienRowsRaw : [];
  const legacyGardienClients = Array.isArray(legacyGardienRaw) ? legacyGardienRaw : [];
  const clientsPatron = Array.isArray(patronsRaw) ? patronsRaw : [];

  let clients: any[] = [];
  if (gardienRows.length > 0) {
    // Le numéro appartient à un technicien enregistré dans `gardiens`
    const gardien = gardienRows[0];
    const clientRaw = await db('clients', { query: `&id=eq.${gardien.client_id}&actif=eq.true` });
    const clientArr = Array.isArray(clientRaw) ? clientRaw : [];
    if (clientArr.length > 0) {
      // On attache le nom du technicien pour pré-remplir plus tard si besoin
      clients = [{ ...clientArr[0], gardien_nom: gardien.nom }];
    }
  } else if (legacyGardienClients.length > 0) {
    // Client encore sur l'ancien système (ex: démos /azalai)
    clients = legacyGardienClients;
  }

  const isGardien = clients.length > 0;
  const isPatron = clientsPatron.length > 0;

  // ── Commandes globales ──
  if (msg === 'aide' || msg === 'help') {
    return sendWA(phone, buildMenu(isGardien, isPatron));
  }

  // ── FLUX PATRON ──
  if (isPatron && !isGardien) {
    const client = clientsPatron[0];
    if (msg === 'rapport' || msg === 'status' || msg === 'bonjour') {
      return sendRapportPatron(phone, client);
    }
    if (msg === 'plein' || msg === 'ravitaillement') {
      return demarrerPlein(phone, client);
    }
    // Flux plein en cours pour le patron
    const sessionPatron = await getSession(phone);
    if (sessionPatron?.state?.startsWith('plein_')) {
      return gererFluxPlein(phone, bodyText, msg, client, sessionPatron);
    }
    return sendWA(phone, `Tapez *rapport* pour recevoir le bilan de vos groupes.\nTapez *plein* pour enregistrer un ravitaillement.\nTapez *aide* pour la liste des commandes.`);
  }

  // ── FLUX GARDIEN ──
  if (isGardien) {
    const client = clients[0];
    const session = await getSession(phone);
    const state = session?.state || 'idle';
    const sessionData = session?.data ? JSON.parse(session.data) : {};

    // Commande RESOLU
    if (msg === 'resolu' || msg === 'résolu') {
      const groupesRaw = await db('groupes', { query: `&client_id=eq.${client.id}&actif=eq.true` });
      const groupes = Array.isArray(groupesRaw) ? groupesRaw : [];
      const groupeIds = groupes.map((g: any) => g.id);
      // Chercher les pannes ouvertes de ce client
      const pannesRaw = await db('pannes', {
        query: `&client_id=eq.${client.id}&resolue=eq.false&order=date_panne.desc`
      });
      const pannesOuvertes = Array.isArray(pannesRaw) ? pannesRaw : [];
      if (!pannesOuvertes.length) {
        return sendWA(phone, `✅ Aucune panne ouverte pour ${client.nom}.\n\nTapez *panne* pour en signaler une nouvelle.`);
      }
      const panneLabels: any = { ne_demarre_pas:'Ne démarre pas', arret_inopin:'Arrêt inopiné', bruit_anormal:'Bruit anormal', surchauffe:'Surchauffe', fuite:'Fuite', autre:'Autre' };
      const groupeMap: any = Object.fromEntries(groupes.map((g: any) => [g.id, g.nom]));
      const liste = pannesOuvertes.map((p: any, i: number) =>
        `*${i + 1}* — ${groupeMap[p.groupe_id]||'—'} · ${panneLabels[p.type]||p.type}`
      ).join('\n');
      await setSession(phone, 'resolu_choix', {
        client_id: client.id,
        client_nom: client.nom,
        pannes: pannesOuvertes.map((p: any) => ({ id: p.id, groupe: groupeMap[p.groupe_id]||'—', type: panneLabels[p.type]||p.type }))
      });
      return sendWA(phone, `✅ *Clôturer une panne*\n*${client.nom}*\n\nQuelle panne est résolue ?\n\n${liste}\n\nRépondez avec le numéro.`);
    }

    // Flux résolution — choix panne
    if (state === 'resolu_choix') {
      const idx = parseInt(msg) - 1;
      if (isNaN(idx) || idx < 0 || idx >= sessionData.pannes?.length) {
        return sendWA(phone, `Répondez avec un numéro entre 1 et ${sessionData.pannes?.length}`);
      }
      const panne = sessionData.pannes[idx];
      await setSession(phone, 'resolu_note', { ...sessionData, panne_id: panne.id, panne_label: panne.groupe+' · '+panne.type });
      return sendWA(phone,
        `✅ *${panne.groupe} · ${panne.type}*\n\nComment a été résolue la panne ?\n_(Ex: Démarreur remplacé, ou tapez - pour passer)_`
      );
    }

    // Flux résolution — note
    if (state === 'resolu_note') {
      const note = bodyText.trim() === '-' ? null : bodyText.trim();
      await setSession(phone, 'resolu_cout', { ...sessionData, resolution_note: note });
      return sendWA(phone,
        `${note ? '✅ *'+note+'*\n\n' : ''}Un technicien est-il intervenu ?\n\n*1* — Oui\n*2* — Non`
      );
    }

    // Flux résolution — technicien
    if (state === 'resolu_cout') {
      if (msg === '1') {
        await setSession(phone, 'resolu_technicien', sessionData);
        return sendWA(phone, `Nom du technicien / prestataire ?\n_(Ex: Mamadou Diallo, ou tapez - pour passer)_`);
      } else if (msg === '2') {
        await setSession(phone, 'resolu_final', { ...sessionData, intervenant: null, cout: 0, piece: null });
        return sendWA(phone, `Coût de la réparation en FCFA ?\n_(Ex: 85000, ou tapez 0 si aucun coût)_`);
      }
      return sendWA(phone, `Répondez *1* (oui) ou *2* (non)`);
    }

    if (state === 'resolu_technicien') {
      const intervenant = bodyText.trim() === '-' ? null : bodyText.trim();
      await setSession(phone, 'resolu_final', { ...sessionData, intervenant });
      return sendWA(phone, `Coût de la réparation en FCFA ?\n_(Ex: 85000, ou tapez 0 si aucun coût)_`);
    }

    // Flux résolution — final
    if (state === 'resolu_final') {
      const cout = parseInt(msg.replace(/\s/g,''))||0;
      const data = { ...sessionData, cout };
      // Marquer la panne résolue
      await db('pannes', {
        method: 'PATCH',
        query: `&id=eq.${data.panne_id}`,
        body: {
          resolue: true,
          date_resolution: new Date().toISOString(),
          resolu_par: data.operateur||'Gardien',
          resolu_via: 'WhatsApp',
          resolution_note: data.resolution_note||null,
          intervenant: data.intervenant||null,
          cout_reparation: data.cout,
        }
      });
      // Résoudre l'alerte associée
      await db('alertes', {
        method: 'PATCH',
        query: `&client_id=eq.${data.client_id}&type=eq.panne&resolue=eq.false`,
        body: { resolue: true }
      });
      await setSession(phone, 'idle', {});

      // Notifier le patron
      const clientFull = await db('clients', { query: `&id=eq.${data.client_id}` });
      if (Array.isArray(clientFull) && clientFull[0]?.whatsapp_patron) {
        const patronPhone = clientFull[0].whatsapp_patron.replace('whatsapp:', '');
        const msg_patron =
          `✅ *Panne résolue*\n*${data.client_nom}*\n\n` +
          `📟 ${data.panne_label}\n` +
          `📅 ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Dakar'})}\n` +
          `${data.resolution_note?'🔧 '+data.resolution_note+'\n':''}` +
          `${data.intervenant?'👷 '+data.intervenant+'\n':''}` +
          `${data.cout>0?'💰 '+data.cout.toLocaleString('fr-FR')+' FCFA\n':''}` +
          `\n_Signalé résolu par le gardien via WhatsApp_`;
        await sendWA(patronPhone, msg_patron);
      }

      return sendWA(phone,
        `✅ *Panne clôturée !*\n\n${data.panne_label}\n` +
        `${data.resolution_note?'🔧 '+data.resolution_note+'\n':''}` +
        `${data.cout>0?'💰 '+data.cout.toLocaleString('fr-FR')+' FCFA\n':''}` +
        `\n_Le responsable a été notifié. 📲_`
      );
    }

    // Commande PANNE — priorité absolue
    if (msg === 'panne' || msg === 'urgence') {
      const groupesRaw = await db('groupes', { query: `&client_id=eq.${client.id}&actif=eq.true` });
      const groupes = Array.isArray(groupesRaw) ? groupesRaw : [];
      await setSession(phone, 'panne_groupe', {
        client_id: client.id,
        client_nom: client.nom,
        groupes: groupes.map((g: any) => ({ id: g.id, nom: g.nom, marque: g.marque, kva: g.puissance_kva }))
      });
      const liste = groupes.map((g: any, i: number) => `*${i + 1}* — ${g.nom} (${g.marque} ${g.puissance_kva}kVA)`).join('\n');
      return sendWA(phone, `🚨 *SIGNALEMENT DE PANNE*\n*${client.nom}*\n\nQuel groupe est en panne ?\n\n${liste}\n\nRépondez avec le numéro.`);
    }

    // Commande RAPPORT patron depuis gardien
    if (msg === 'rapport') {
      return sendRapportPatron(phone, client);
    }

    // Commande PLEIN / RAVITAILLEMENT
    if (msg === 'plein' || msg === 'ravitaillement') {
      return demarrerPlein(phone, client);
    }

    // Flux plein en cours
    if (state?.startsWith('plein_')) {
      return gererFluxPlein(phone, bodyText, msg, client, session);
    }

    // ════════════════════════════════════════
    // FLUX SAISIE UNIFIÉ
    // ════════════════════════════════════════

    // Démarrage saisie
    if (state === 'idle' || msg === 'saisie' || msg === 'bonjour') {
      const groupesRaw = await db('groupes', { query: `&client_id=eq.${client.id}&actif=eq.true` });
      const groupes = Array.isArray(groupesRaw) ? groupesRaw : [];
      if (!groupes.length) {
        return sendWA(phone, `Aucun groupe configuré pour ${client.nom}. Contactez votre administrateur.`);
      }
      if (groupes.length === 1) {
        // Un seul groupe — sélection automatique + affichage contexte
        const g = groupes[0];
        const [dernieresRaw, autoRaw] = await Promise.all([
          db('v_derniere_saisie', { query: `&groupe_id=eq.${g.id}` }),
          db('v_autonomie_groupes', { query: `&groupe_id=eq.${g.id}` })
        ]);
        const derniere = Array.isArray(dernieresRaw) ? dernieresRaw[0] : null;
        const autoData = Array.isArray(autoRaw) ? autoRaw[0] : null;
        const contexte = buildContexteVeille(derniere);
        await setSession(phone, 'saisie_carburant', {
          client_id: client.id,
          client_nom: client.nom,
          groupe_id: g.id,
          groupe_nom: g.nom,
          heures_total: g.heures_total || 0,
          seuil_vidange: g.seuil_vidange_heures || 250,
          prix_litre: client.prix_litre_fcfa || 695,
          capacite_reservoir: g.capacite_reservoir_litres || 500,
          conso_theorique: g.conso_theorique_lh || 1.8,
          conso_jour: autoData?.conso_jour_estimee || null
        });
        return sendWA(phone,
          `Bonjour 👋 *${client.nom}*\n\n` +
          `📟 *${g.nom}* — ${g.marque || ''} ${g.puissance_kva || ''}kVA\n\n` +
          `${contexte}\n\n` +
          `⛽ Quel est le niveau carburant ce matin ? _(en litres, ex: 6500)_`
        );
      }
      // Plusieurs groupes — choix
      await setSession(phone, 'saisie_choix_groupe', {
        client_id: client.id,
        client_nom: client.nom,
        groupes: groupes.map((g: any) => ({
          id: g.id, nom: g.nom, marque: g.marque, kva: g.puissance_kva,
          heures_total: g.heures_total || 0, seuil_vidange: g.seuil_vidange_heures || 250
        }))
      });
      const liste = groupes.map((g: any, i: number) =>
        `*${i + 1}* — ${g.nom} (${g.marque} ${g.puissance_kva}kVA)`
      ).join('\n');
      return sendWA(phone, `Bonjour 👋 *${client.nom}*\n\nQuel groupe a tourné aujourd'hui ?\n\n${liste}\n\nRépondez avec le numéro.`);
    }

    // Choix groupe (si plusieurs)
    if (state === 'saisie_choix_groupe') {
      const idx = parseInt(msg) - 1;
      if (isNaN(idx) || idx < 0 || idx >= sessionData.groupes?.length) {
        return sendWA(phone, `Répondez avec un numéro entre 1 et ${sessionData.groupes?.length}`);
      }
      const g = sessionData.groupes[idx];
      const [dernieresRaw2, autoRaw2] = await Promise.all([
        db('v_derniere_saisie', { query: `&groupe_id=eq.${g.id}` }),
        db('v_autonomie_groupes', { query: `&groupe_id=eq.${g.id}` })
      ]);
      const derniere = Array.isArray(dernieresRaw2) ? dernieresRaw2[0] : null;
      const autoData2 = Array.isArray(autoRaw2) ? autoRaw2[0] : null;
      const contexte = buildContexteVeille(derniere);
      await setSession(phone, 'saisie_carburant', {
        client_id: sessionData.client_id,
        client_nom: sessionData.client_nom,
        groupe_id: g.id,
        groupe_nom: g.nom,
        heures_total: g.heures_total || 0,
        seuil_vidange: g.seuil_vidange || 250,
        prix_litre: 695,
        capacite_reservoir: g.capacite_reservoir_litres || 500,
        conso_theorique: g.conso_theorique_lh || 1.8,
        conso_jour: autoData2?.conso_jour_estimee || null
      });
      return sendWA(phone,
        `📟 *${g.nom}* — ${g.marque || ''} ${g.kva || ''}kVA\n\n` +
        `${contexte}\n\n` +
        `⛽ Niveau carburant ce matin ? _(en litres, ex: 6500)_`
      );
    }

    // Étape carburant (en litres)
    if (state === 'saisie_carburant') {
      const litres = parseInt(msg.replace(/\s/g, ''));
      const capacite = sessionData.capacite_reservoir || 500;
      if (isNaN(litres) || litres < 0 || litres > capacite * 1.05) {
        return sendWA(phone, `❌ Entrez un volume en litres entre 0 et ${capacite}.\nEx: *6500*`);
      }
      // Calculer autonomie et % pour info
      const consoJour = sessionData.conso_jour || (sessionData.conso_theorique || 65) * 8;
      const pct = Math.round(litres / capacite * 100);
      const joursAuto = consoJour > 0 ? Math.round((litres / consoJour) * 10) / 10 : null;
      const autoMsg = joursAuto !== null
        ? `\n⏱️ Autonomie estimée : *${joursAuto} jour${joursAuto > 1 ? 's' : ''}*`
        : '';
      const autoEmoji = joursAuto !== null ? (joursAuto < 2 ? '🔴' : joursAuto < 5 ? '🟡' : '🟢') : '';

      // Seuil alerte à 30%
      if (pct < 30 || (joursAuto !== null && joursAuto < 2)) {
        await setSession(phone, 'saisie_plein_question', { ...sessionData, niveau_carburant: litres, litres_restants: litres, jours_autonomie: joursAuto });
        return sendWA(phone,
          `⚠️ Carburant à *${litres}L* (${pct}%) — niveau critique.${autoMsg}\n\n` +
          `Avez-vous fait un plein récemment ?\n\n*1* — Oui, j'ai fait le plein\n*2* — Non, pas encore`
        );
      }
      await setSession(phone, 'saisie_heures', { ...sessionData, niveau_carburant: litres, litres_ajoutes: 0 });
      const dernierCompteur = sessionData.heures_total || 0;
      return sendWA(phone, `${autoEmoji} Carburant : *${litres}L* (${pct}%)${autoMsg}\n\n🕐 Relevé du compteur moteur ce matin ?\n_(Dernier relevé connu : ${dernierCompteur}h)_`);
    }

    // Question plein (si carburant bas)
    if (state === 'saisie_plein_question') {
      if (msg === '1') {
        await setSession(phone, 'saisie_plein_litres', sessionData);
        return sendWA(phone, `⛽ Combien de litres avez-vous ajouté ?\n_(Ex: 150)_`);
      } else if (msg === '2') {
        // Pas de plein → alerte patron + continuer saisie
        await setSession(phone, 'saisie_heures', { ...sessionData, litres_ajoutes: 0 });
        const dernierCompteurBas = sessionData.heures_total || 0;
        return sendWA(phone,
          `⚠️ _Alerte carburant bas envoyée au responsable._\n\n` +
          `🕐 Relevé du compteur moteur ce matin ?\n_(Dernier relevé connu : ${dernierCompteurBas}h)_`
        );
      }
      return sendWA(phone, `Répondez *1* (oui, plein fait) ou *2* (non, pas encore).`);
    }

    // Litres ajoutés (si plein fait)
    if (state === 'saisie_plein_litres') {
      const litres = parseFloat(bodyText.trim().replace(',', '.'));
      if (isNaN(litres) || litres <= 0) {
        return sendWA(phone, `❌ Quantité invalide. Entrez un nombre en litres.\n_(Ex: 150)_`);
      }
      await setSession(phone, 'saisie_heures', { ...sessionData, litres_ajoutes: litres });
      const dernierCompteurPlein = sessionData.heures_total || 0;
      return sendWA(phone,
        `✅ Plein enregistré : *${litres} litres*\n\n` +
        `🕐 Relevé du compteur moteur ce matin ?\n_(Dernier relevé connu : ${dernierCompteurPlein}h)_`
      );
    }

    // Étape heures moteur (compteur total)
    if (state === 'saisie_heures') {
      const compteur = parseFloat(msg.replace(',', '.'));
      const heuresPrecedentes = sessionData.heures_total || 0;
      if (isNaN(compteur) || compteur < heuresPrecedentes) {
        return sendWA(phone, `❌ Relevé invalide. Le compteur doit être supérieur à ${heuresPrecedentes}h.\n_(Ex: ${(heuresPrecedentes + 8).toFixed(1)})_`);
      }
      // Heures du jour = différence avec le compteur précédent
      const heuresDuJour = Math.round((compteur - heuresPrecedentes) * 10) / 10;
      // Vérifier seuil vidange sur le compteur actuel
      const seuil = sessionData.seuil_vidange || 250;
      const pctVidange = Math.round((compteur / seuil) * 100);
      let vidangeMsg = '';
      if (pctVidange >= 100) {
        vidangeMsg = `\n\n🔧 *Vidange requise !* Compteur : ${compteur}h/${seuil}h — Contactez le technicien.`;
      } else if (pctVidange >= 80) {
        vidangeMsg = `\n\n🔧 Vidange bientôt : ${compteur}h/${seuil}h (${pctVidange}%).`;
      }
      // On stocke le compteur ET les heures du jour
      await setSession(phone, 'saisie_huile', { ...sessionData, heures_marche: compteur, heures_du_jour: heuresDuJour, vidange_msg: vidangeMsg });
      return sendWA(phone,
        `✅ Compteur : *${compteur}h* (+${heuresDuJour}h aujourd'hui).${vidangeMsg}\n\n` +
        `🛢️ Niveau d'huile ?\n\n*1* — Normal ✅\n*2* — Bas ⚠️\n*3* — Critique 🚨`
      );
    }

    // Étape huile
    if (state === 'saisie_huile') {
      const huileMap: any = { '1': 'normal', '2': 'bas', '3': 'critique' };
      const huile = huileMap[msg.trim()];
      if (!huile) {
        return sendWA(phone, `❌ Répondez avec *1* (Normal), *2* (Bas) ou *3* (Critique)`);
      }
      const huileAlerte = huile === 'critique'
        ? '\n\n🚨 _Huile critique — changement immédiat requis !_'
        : huile === 'bas' ? '\n\n⚠️ _Huile basse — vérifiez avant le prochain démarrage._' : '';
      // Plus de question prénom — nom gardien connu via table gardiens
      const operateur = client.gardien_nom || 'Technicien';
      const dataFinal = { ...sessionData, niveau_huile: huile, operateur };
      await setSession(phone, 'idle', {});
      return enregistrerSaisie(phone, dataFinal, client);
    }

    // saisie_final — fallback au cas où la session persiste
    if (state === 'saisie_final') {
      await setSession(phone, 'idle', {});
      return enregistrerSaisie(phone, sessionData, client);
    }

    // ════════════════════════════════════════
    // FLUX PANNE
    // ════════════════════════════════════════
    if (state === 'panne_groupe') {
      const idx = parseInt(msg) - 1;
      if (isNaN(idx) || idx < 0 || idx >= sessionData.groupes?.length) {
        return sendWA(phone, `Répondez avec un numéro entre 1 et ${sessionData.groupes?.length}`);
      }
      const groupe = sessionData.groupes[idx];
      await setSession(phone, 'panne_type', { ...sessionData, groupe_id: groupe.id, groupe_nom: groupe.nom });
      return sendWA(phone,
        `🚨 *${groupe.nom}* en panne\n\nType de problème ?\n\n` +
        `*1* — Ne démarre pas\n*2* — Arrêt inopiné\n*3* — Bruit anormal\n*4* — Surchauffe\n*5* — Autre\n\nRépondez avec le numéro.`
      );
    }

    if (state === 'panne_type') {
      const panneLabels: any = { '1': 'Ne démarre pas', '2': 'Arrêt inopiné', '3': 'Bruit anormal', '4': 'Surchauffe', '5': 'Autre' };
      const panneTypes: any = { '1': 'ne_demarre_pas', '2': 'arret_inopin', '3': 'bruit_anormal', '4': 'surchauffe', '5': 'autre' };
      const panneType = panneTypes[msg.trim()];
      if (!panneType) return sendWA(phone, `Répondez avec un numéro entre 1 et 5`);
      const panneLabel = panneLabels[msg.trim()];

      await db('pannes', {
        method: 'POST',
        body: { client_id: sessionData.client_id, groupe_id: sessionData.groupe_id, type: panneType, description: panneLabel, date_panne: new Date().toISOString() }
      });
      await db('alertes', {
        method: 'POST',
        body: { client_id: sessionData.client_id, groupe_id: sessionData.groupe_id, type: 'panne', severite: 'danger', message: `PANNE — ${sessionData.groupe_nom} — ${panneLabel}` }
      });
      await setSession(phone, 'idle', {});

      const clientFull = await db('clients', { query: `&id=eq.${sessionData.client_id}` });
      if (Array.isArray(clientFull) && clientFull[0]?.whatsapp_patron) {
        await sendWA(clientFull[0].whatsapp_patron.replace('whatsapp:', ''),
          `🚨 *PANNE SIGNALÉE*\n*${sessionData.client_nom}*\n\nGroupe : ${sessionData.groupe_nom}\nProblème : ${panneLabel}\n\nIntervention requise immédiatement.`
        );
      }
      return sendWA(phone, `🚨 *Panne signalée !*\n\n${sessionData.groupe_nom} — ${panneLabel}\n\nLe responsable a été alerté immédiatement. 📲`);
    }

    // Message non reconnu en cours de session
    return sendWA(phone, `Tapez *saisie* pour le rapport quotidien ou *panne* pour signaler une urgence.\nTapez *aide* pour la liste des commandes.`);
  }

  // ── FLUX PROSPECT ──
  const session = await getSession(phone);
  const state2 = session?.state || 'idle';
  const sessionData2 = session?.data ? JSON.parse(session.data) : {};

  if (state2 === 'prospect_groupes') {
    const choix: any = { '1': '1 groupe', '2': '2 à 5 groupes', '3': 'Plus de 5 groupes' };
    const label = choix[msg.trim()];
    if (!label) return sendWA(phone, `Répondez avec *1*, *2* ou *3* 👇`);
    await setSession(phone, 'prospect_pays', { ...sessionData2, groupes: label });
    return sendWA(phone, `✅ *${label}*\n\nVous êtes dans quel pays ?\n\n*1* — Sénégal\n*2* — Côte d'Ivoire\n*3* — Cameroun\n*4* — Autre`);
  }

  if (state2 === 'prospect_pays') {
    const pays: any = { '1': 'Sénégal', '2': "Côte d'Ivoire", '3': 'Cameroun', '4': 'Autre' };
    const label = pays[msg.trim()];
    if (!label) return sendWA(phone, `Répondez avec *1*, *2*, *3* ou *4* 👇`);
    await setSession(phone, 'prospect_done', { ...sessionData2, pays: label });
    await sendWA('+33658150628',
      `🔔 *Nouveau prospect GenTrack*\n\n📱 ${phone}\n📟 ${sessionData2.groupes}\n🌍 ${label}\n\n_Répondez rapidement !_`
    );
    return sendWA(phone,
      `🎉 Parfait !\n\nUn conseiller GenTrack vous contactera dans les 24h.\n\n_Tapez *aide* pour voir toutes les fonctionnalités._`
    );
  }

  // Premier contact prospect
  await setSession(phone, 'prospect_groupes', {});
  return sendWA(phone,
    `👋 *Bienvenue sur GenTrack !*\n\nGérez vos groupes électrogènes directement par WhatsApp.\n\n✅ Saisie quotidienne\n✅ Alertes carburant automatiques\n✅ Rapport hebdomadaire\n\nVous gérez combien de groupes ?\n\n*1* — 1 groupe\n*2* — 2 à 5 groupes\n*3* — Plus de 5 groupes`
  );
}

// ── HANDLER HTTP ──
serve(async (req) => {
  if (req.method === 'GET') return new Response('GenTrack WhatsApp Bot v2 ✅', { status: 200 });
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get('From') || '';
    const body = params.get('Body') || '';
    console.log(`Webhook — From: ${from} | Body: ${body}`);
    if (!from || !body) {
      return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
    }
    handleMessage(from, body).catch(e => console.error('handleMessage error:', e));
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('Erreur webhook:', err);
    return new Response('<?xml version="1.0"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
});
