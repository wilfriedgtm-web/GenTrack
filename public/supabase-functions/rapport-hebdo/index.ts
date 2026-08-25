// supabase/functions/rapport-hebdo/index.ts
// GenTrack — Rapport hebdomadaire détaillé
// v8 — Anomalies + signalements par équipement, CF détaillées, découpage WA
// Cron : lundi 8h UTC

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dbGet(table: string, query = ''): Promise<any[]> {
  const url = `${SUPA_URL}/rest/v1/${table}?select=*${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function sendWA(to: string, message: string): Promise<boolean> {
  if (!to || !TWILIO_SID || !TWILIO_TOKEN) return false;
  const toFmt = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: toFmt, Body: message }).toString(),
    }
  );
  if (!res.ok) { console.error(`[WA] error ${res.status} → ${to}`); return false; }
  return true;
}

// Découpe un bloc en plusieurs messages si > maxLen caractères
function chunkMessage(header: string, lines: string[], maxLen = 1400): string[] {
  if (!lines.length) return [];
  const out: string[] = [];
  let current = header;
  for (const line of lines) {
    if ((current + '\n' + line).length > maxLen && current !== header) {
      out.push(current);
      current = header + ' _(suite)_';
    }
    current += '\n' + line;
  }
  if (current !== header && current !== header + ' _(suite)_') out.push(current);
  return out;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Dakar' });
}

// ── Construction du rapport ───────────────────────────────────────────────────

async function buildMessages(site: any, equipements: any[], dateDebut: string, dateFin: string): Promise<string[]> {
  const dateDebutFmt = new Date(dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const dateFinFmt   = new Date(dateFin).toLocaleDateString('fr-FR',   { day: 'numeric', month: 'long' });

  const cuves  = equipements.filter((e: any) => e.capacite_litres != null);
  const ges    = equipements.filter((e: any) => e.conso_theorique_lh != null && e.capacite_litres == null);
  const autres = equipements.filter((e: any) => e.conso_theorique_lh == null && e.capacite_litres == null);
  const consoTotaleH = ges.reduce((s: number, g: any) => s + (parseFloat(g.conso_theorique_lh) || 0), 0);

  // Rondes de la semaine
  const rondes   = await dbGet('rondes', `&site_id=eq.${site.id}&date_ronde=gte.${dateDebut}&date_ronde=lte.${dateFin}&order=date_ronde.asc`);
  const nbRondes = rondes.length;
  const rondeIds = rondes.map((r: any) => r.id);

  let rondesEq: any[] = [];
  let reponses:  any[] = [];
  let anomalies: any[] = [];

  if (rondeIds.length) {
    rondesEq  = await dbGet('rondes_equipements', `&ronde_id=in.(${rondeIds.join(',')})&statut=eq.valide`);
    if (rondesEq.length) {
      const reIds = rondesEq.map((r: any) => r.id);
      [reponses, anomalies] = await Promise.all([
        dbGet('reponses',  `&ronde_equipement_id=in.(${reIds.join(',')})`),
        dbGet('anomalies', `&ronde_equipement_id=in.(${reIds.join(',')})`),
      ]);
    }
  }

  // Questions de tous les équipements
  const equipIds  = equipements.map((e: any) => e.id);
  const questions = equipIds.length
    ? await dbGet('questions', `&equipement_id=in.(${equipIds.join(',')})&actif=eq.true`)
    : [];

  // Signalements de la semaine pour ce site
  const signalements = await dbGet('signalements',
    `&groupe_id=eq.${site.id}&created_at=gte.${dateDebut}T00:00:00&created_at=lte.${dateFin}T23:59:59`
  );

  const messages: string[] = [];

  // ── Message 1 : En-tête ──────────────────────────────────────
  const tauxGlobal      = Math.round((nbRondes / 7) * 100);
  const tauxEmoji       = tauxGlobal >= 80 ? '🟢' : tauxGlobal >= 50 ? '🟡' : '🔴';
  const nbAnomalies     = anomalies.length;
  const nbSignalements  = signalements.length;
  const nbResolus       = signalements.filter((s: any) => s.statut === 'resolu').length;

  let intro = `📊 *Rapport hebdomadaire — GenTrack*\n*${site.nom}*\n📅 ${dateDebutFmt} → ${dateFinFmt}\n${'─'.repeat(28)}\n\n`;
  intro += `${tauxEmoji} *${nbRondes}/7 rondes* effectuées (${tauxGlobal}%)\n`;
  if (nbAnomalies)    intro += `⚠️ ${nbAnomalies} anomalie${nbAnomalies > 1 ? 's' : ''} relevée${nbAnomalies > 1 ? 's' : ''}\n`;
  if (nbSignalements) intro += `🚨 ${nbSignalements} signalement${nbSignalements > 1 ? 's' : ''} (${nbResolus} résolu${nbResolus > 1 ? 's' : ''})\n`;
  if (!nbAnomalies && !nbSignalements) intro += `✅ Semaine sans incident\n`;
  messages.push(intro.trimEnd());

  // ── Messages GE ──────────────────────────────────────────────
  if (ges.length) {
    const geLines: string[] = [];
    for (const ge of ges) {
      const reIds    = rondesEq.filter((re: any) => re.equipement_id === ge.id).map((re: any) => re.id);
      const repsGe   = reponses.filter((r: any) => reIds.includes(r.ronde_equipement_id));
      const anoGe    = anomalies.filter((a: any) => reIds.includes(a.ronde_equipement_id));
      const sgGe     = signalements.filter((s: any) => s.equipement_id === ge.id);
      const nbSaisies = reIds.length;
      const tEmoji   = nbSaisies >= 5 ? '🟢' : nbSaisies >= 3 ? '🟡' : '🔴';

      const qCompteur = questions.find((q: any) => q.equipement_id === ge.id && q.texte.toLowerCase().includes('compteur'));
      const qHuile    = questions.find((q: any) => q.equipement_id === ge.id && q.texte.toLowerCase().includes('huile'));

      let block = `*${ge.nom}*\n   ${tEmoji} ${nbSaisies}/7 rondes`;

      if (qCompteur) {
        const vals = repsGe.filter((r: any) => r.question_id === qCompteur.id)
          .map((r: any) => parseFloat(r.valeur?.replace(',', '.'))).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
        if (vals.length >= 2) block += ` · 🕐 ${(vals[vals.length - 1] - vals[0]).toFixed(1)}h`;
        if (vals.length) {
          const dernier = vals[vals.length - 1];
          if (ge.seuil_vidange_heures) {
            const prochain  = Math.ceil((dernier + 0.01) / ge.seuil_vidange_heures) * ge.seuil_vidange_heures;
            const restantes = prochain - dernier;
            const vEmoji    = restantes <= 20 ? '🔴' : restantes <= 50 ? '🟡' : '🟢';
            block += `\n   ${vEmoji} Vidange dans *${Math.round(restantes)}h* (${dernier}h → ${prochain}h)`;
          }
        }
      }

      if (qHuile) {
        const lastHuile = repsGe.filter((r: any) => r.question_id === qHuile.id).pop();
        if (lastHuile) block += `\n   🛢️ Huile : *${lastHuile.valeur}* ${lastHuile.valeur === 'Normal' ? '✅' : '⚠️'}`;
      }

      if (anoGe.length) {
        for (const a of anoGe) block += `\n   ⚠️ _${a.description.substring(0, 60)}_`;
      }
      if (sgGe.length) {
        for (const s of sgGe) {
          const sEmoji = s.statut === 'resolu' ? '✅' : s.statut === 'en_cours' ? '⏳' : '🔴';
          block += `\n   ${sEmoji} Signalement : ${(s.description || s.type).substring(0, 50)}`;
          if (s.cout_intervention) block += ` (${s.cout_intervention.toLocaleString('fr-FR')} FCFA)`;
        }
      }
      geLines.push(block);
    }
    for (const m of chunkMessage(`⚡ *Groupes électrogènes*`, geLines)) messages.push(m);
  }

  // ── Messages Cuves ───────────────────────────────────────────
  if (cuves.length) {
    const cuveLines: string[] = [];
    for (const cuve of cuves) {
      const reIds   = rondesEq.filter((re: any) => re.equipement_id === cuve.id).map((re: any) => re.id);
      const repsCuve = reponses.filter((r: any) => reIds.includes(r.ronde_equipement_id));
      const sgCuve   = signalements.filter((s: any) => s.equipement_id === cuve.id);
      const qNiveau  = questions.find((q: any) => q.equipement_id === cuve.id && q.texte.toLowerCase().includes('niveau'));
      if (!qNiveau) continue;

      const vals = repsCuve.filter((r: any) => r.question_id === qNiveau.id)
        .map((r: any) => parseFloat(r.valeur?.replace(',', '.'))).filter((v: number) => !isNaN(v));
      if (!vals.length) continue;

      const niveauActuel = vals[vals.length - 1];
      const cap    = parseFloat(cuve.capacite_litres);
      const pct    = Math.round((niveauActuel / cap) * 100);
      const em     = pct < 20 ? '🔴' : pct < 40 ? '🟡' : '🟢';
      const consoH = cuve.conso_theorique_lh ? parseFloat(cuve.conso_theorique_lh) : consoTotaleH;
      const autoJ  = consoH > 0 ? Math.round(niveauActuel / (consoH * 8) * 10) / 10 : null;

      let block = `*${cuve.nom}*\n   ${em} *${niveauActuel}L / ${cap}L* (${pct}%)`;
      if (vals.length > 1) block += `\n   📉 Min : ${Math.min(...vals)}L · 📈 Max : ${Math.max(...vals)}L`;
      if (autoJ !== null) block += `\n   ⏱️ Autonomie : *~${autoJ}j*`;
      if (sgCuve.length) {
        for (const s of sgCuve) {
          const sEmoji = s.statut === 'resolu' ? '✅' : s.statut === 'en_cours' ? '⏳' : '🔴';
          block += `\n   ${sEmoji} ${(s.description || s.type).substring(0, 50)}`;
        }
      }
      cuveLines.push(block);
    }
    if (cuveLines.length) {
      for (const m of chunkMessage(`⛽ *Carburant*`, cuveLines)) messages.push(m);
    }
  }

  // ── Messages Chambres froides / Autres ───────────────────────
  if (autres.length) {
    const cfLines: string[] = [];
    for (const eq of autres) {
      const reIds  = rondesEq.filter((re: any) => re.equipement_id === eq.id).map((re: any) => re.id);
      const repsEq = reponses.filter((r: any) => reIds.includes(r.ronde_equipement_id));
      const anoEq  = anomalies.filter((a: any) => reIds.includes(a.ronde_equipement_id));
      const sgEq   = signalements.filter((s: any) => s.equipement_id === eq.id);
      const nbSaisies = reIds.length;
      const tEmoji = nbSaisies >= 5 ? '🟢' : nbSaisies >= 3 ? '🟡' : '🔴';

      let block = `*${eq.nom}*\n   ${tEmoji} ${nbSaisies}/7 vérifications`;

      // Température — question contenant "température" ou "temp"
      const qTemp = questions.find((q: any) =>
        q.equipement_id === eq.id && (q.texte.toLowerCase().includes('température') || q.texte.toLowerCase().includes('temp'))
        && q.type_reponse === 'numerique'
      );
      if (qTemp) {
        const temps = repsEq.filter((r: any) => r.question_id === qTemp.id)
          .map((r: any) => parseFloat(r.valeur?.replace(',', '.'))).filter((v: number) => !isNaN(v));
        if (temps.length) {
          const tMin = Math.min(...temps);
          const tMax = Math.max(...temps);
          const tActuel = temps[temps.length - 1];
          const unite = qTemp.unite || '°C';
          // Seuil alerte si défini
          const hors = (qTemp.seuil_min != null && tActuel > qTemp.seuil_min) || (qTemp.seuil_max != null && tActuel < qTemp.seuil_max);
          const tEmoji2 = hors ? '🔴' : '🟢';
          block += `\n   ${tEmoji2} Temp actuelle : *${tActuel}${unite}*`;
          if (tMin !== tMax) block += ` (min ${tMin}${unite} / max ${tMax}${unite})`;
        }
      }

      if (anoEq.length) {
        for (const a of anoEq) block += `\n   ⚠️ _${a.description.substring(0, 60)}_`;
      }
      if (sgEq.length) {
        for (const s of sgEq) {
          const sEmoji = s.statut === 'resolu' ? '✅' : s.statut === 'en_cours' ? '⏳' : '🔴';
          block += `\n   ${sEmoji} ${(s.description || s.type).substring(0, 50)}`;
          if (s.cout_intervention) block += ` (${s.cout_intervention.toLocaleString('fr-FR')} FCFA)`;
        }
      }
      cfLines.push(block);
    }
    if (cfLines.length) {
      const header = autres.some((e: any) => e.nom.toLowerCase().includes('froide') || e.nom.toLowerCase().includes('cf'))
        ? '❄️ *Chambres froides*'
        : '🔧 *Autres équipements*';
      for (const m of chunkMessage(header, cfLines)) messages.push(m);
    }
  }

  // ── Message final : Signalements sans équipement + résumé ────
  const sgSansEquip = signalements.filter((s: any) => !s.equipement_id);
  let résumé = `${'─'.repeat(28)}\n📈 *Résumé semaine*\n`;
  résumé += `   ${tauxEmoji} ${nbRondes}/7 rondes · ${tauxGlobal}%\n`;
  if (nbAnomalies)    résumé += `   ⚠️ ${nbAnomalies} anomalie${nbAnomalies > 1 ? 's' : ''}\n`;
  if (nbSignalements) résumé += `   🚨 ${nbSignalements} signalement${nbSignalements > 1 ? 's' : ''} · ${nbResolus} résolu${nbResolus > 1 ? 's' : ''}\n`;
  if (sgSansEquip.length) {
    for (const s of sgSansEquip) {
      const sEmoji = s.statut === 'resolu' ? '✅' : s.statut === 'en_cours' ? '⏳' : '🔴';
      résumé += `   ${sEmoji} ${(s.description || s.type).substring(0, 50)}\n`;
    }
  }
  const totalCout = signalements.reduce((s: number, sg: any) => s + (sg.cout_intervention || 0), 0);
  if (totalCout > 0) résumé += `   💰 Coût total : ${totalCout.toLocaleString('fr-FR')} FCFA\n`;
  résumé += `\n_Tapez *rapport* pour le bilan du jour_`;
  messages.push(résumé.trimEnd());

  return messages;
}

// ── Handler principal ─────────────────────────────────────────────────────────

serve(async (_req) => {
  console.log('[rapport-hebdo]', new Date().toISOString());

  const aujourd = new Date();
  const il_y_a_7j = new Date(aujourd);
  il_y_a_7j.setDate(aujourd.getDate() - 7);
  const dateDebut = il_y_a_7j.toISOString().split('T')[0];
  const dateFin   = aujourd.toISOString().split('T')[0];

  const stats = { rapports_envoyes: 0, messages_envoyes: 0, erreurs: 0 };
  const sites = await dbGet('sites', '&actif=eq.true&hebdo_actif=eq.true');

  for (const site of sites) {
    const equipements = await dbGet('equipements', `&site_id=eq.${site.id}&actif=eq.true&order=ordre_ronde.asc`);
    if (!equipements.length) continue;

    const contacts = await dbGet('contacts', `&site_id=eq.${site.id}&actif=eq.true&role=in.(resp_tech,dir_tech)`);
    if (!contacts.length) continue;

    const messageParts = await buildMessages(site, equipements, dateDebut, dateFin);

    const dejaEnvoyes = new Set<string>();
    for (const contact of contacts) {
      if (!contact.whatsapp || dejaEnvoyes.has(contact.whatsapp)) continue;
      dejaEnvoyes.add(contact.whatsapp);

      let ok = true;
      for (const part of messageParts) {
        const sent = await sendWA(contact.whatsapp, part);
        if (sent) stats.messages_envoyes++; else { ok = false; stats.erreurs++; }
        // Petite pause entre messages pour éviter rate limit Twilio
        await new Promise(r => setTimeout(r, 800));
      }
      if (ok) stats.rapports_envoyes++;
    }
  }

  console.log('[rapport-hebdo] Stats :', stats);
  return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } });
});
