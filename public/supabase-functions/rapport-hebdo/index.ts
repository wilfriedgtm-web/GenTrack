// supabase/functions/rapport-hebdo/index.ts
// GenTrack — Rapport hebdomadaire
// v7 — Nouveau modèle (sites/equipements/contacts/signalements)
// Cron : lundi 8h UTC

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+14155238886';

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

// ── Rapport par site ──────────────────────────────────────────────────────────

async function buildReport(
  site: any,
  equipements: any[],
  dateDebut: string,
  dateFin: string
): Promise<string> {
  const dateDebutFmt = new Date(dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const dateFinFmt   = new Date(dateFin).toLocaleDateString('fr-FR',   { day: 'numeric', month: 'long' });

  const cuves  = equipements.filter((e: any) => e.capacite_litres != null);
  const ges    = equipements.filter((e: any) => e.conso_theorique_lh != null && e.capacite_litres == null);
  const autres = equipements.filter((e: any) => e.conso_theorique_lh == null && e.capacite_litres == null);

  // Rondes de la semaine
  const rondes = await dbGet('rondes',
    `&site_id=eq.${site.id}&date_ronde=gte.${dateDebut}&date_ronde=lte.${dateFin}&order=date_ronde.asc`
  );
  const nbRondes  = rondes.length;
  const rondeIds  = rondes.map((r: any) => r.id);

  let rondesEq: any[] = [];
  let reponses: any[]  = [];
  if (rondeIds.length) {
    rondesEq = await dbGet('rondes_equipements',
      `&ronde_id=in.(${rondeIds.join(',')})&statut=eq.valide`
    );
    if (rondesEq.length) {
      const reIds = rondesEq.map((r: any) => r.id);
      reponses = await dbGet('reponses', `&ronde_equipement_id=in.(${reIds.join(',')})`);
    }
  }

  // Questions des équipements
  const equipIds = equipements.map((e: any) => e.id);
  const questions = equipIds.length
    ? await dbGet('questions', `&equipement_id=in.(${equipIds.join(',')})&actif=eq.true`)
    : [];

  // Signalements de la semaine (remplace pannes)
  const signalements = await dbGet('signalements',
    `&groupe_id=eq.${site.id}&created_at=gte.${dateDebut}T00:00:00&created_at=lte.${dateFin}T23:59:59`
  );

  let msg = `📊 *Rapport hebdomadaire GenTrack*\n`;
  msg += `*${site.nom}*\n`;
  msg += `📅 ${dateDebutFmt} → ${dateFinFmt}\n`;
  msg += `${'─'.repeat(28)}\n\n`;

  // ── Groupes électrogènes ──
  if (ges.length) {
    msg += `⚡ *Groupes électrogènes*\n\n`;
    for (const ge of ges) {
      const reIds   = rondesEq.filter((re: any) => re.equipement_id === ge.id).map((re: any) => re.id);
      const repsGe  = reponses.filter((r: any) => reIds.includes(r.ronde_equipement_id));
      const nbSaisies = reIds.length;

      const qCompteur = questions.find((q: any) => q.equipement_id === ge.id && q.texte.toLowerCase().includes('compteur'));
      const qHuile    = questions.find((q: any) => q.equipement_id === ge.id && q.texte.toLowerCase().includes('huile'));

      let heuresMarche = 0;
      if (qCompteur) {
        const vals = repsGe
          .filter((r: any) => r.question_id === qCompteur.id)
          .map((r: any) => parseFloat(r.valeur?.replace(',', '.')))
          .filter((v: number) => !isNaN(v))
          .sort((a: number, b: number) => a - b);
        if (vals.length >= 2) heuresMarche = vals[vals.length - 1] - vals[0];
      }

      const tauxEmoji = nbSaisies >= 5 ? '🟢' : nbSaisies >= 3 ? '🟡' : '🔴';
      msg += `*${ge.nom}*\n`;
      msg += `   ${tauxEmoji} ${nbSaisies}/7 rondes · 🕐 ${heuresMarche.toFixed(1)}h de marche\n`;

      if (qHuile) {
        const lastHuile = repsGe
          .filter((r: any) => r.question_id === qHuile.id)
          .pop();
        if (lastHuile) {
          const huileEmoji = lastHuile.valeur === 'Normal' ? '✅' : '⚠️';
          msg += `   🛢️ Huile : *${lastHuile.valeur}* ${huileEmoji}\n`;
        }
      }

      if (ge.seuil_vidange_heures && qCompteur) {
        const dernier = repsGe
          .filter((r: any) => r.question_id === qCompteur.id)
          .map((r: any) => parseFloat(r.valeur?.replace(',', '.')))
          .filter((v: number) => !isNaN(v))
          .sort((a: number, b: number) => b - a)[0];
        if (dernier) {
          const prochain   = Math.ceil((dernier + 0.01) / ge.seuil_vidange_heures) * ge.seuil_vidange_heures;
          const restantes  = prochain - dernier;
          const em         = restantes <= 20 ? '🔴' : restantes <= 50 ? '🟡' : '🟢';
          msg += `   ${em} Vidange dans *${Math.round(restantes)}h* (${dernier}h → ${prochain}h)\n`;
        }
      }
      msg += '\n';
    }
  }

  // ── Cuves carburant ──
  if (cuves.length) {
    msg += `⛽ *Carburant*\n\n`;
    const consoTotaleH = ges.reduce((s: number, g: any) => s + (parseFloat(g.conso_theorique_lh) || 0), 0);

    for (const cuve of cuves) {
      const reIds    = rondesEq.filter((re: any) => re.equipement_id === cuve.id).map((re: any) => re.id);
      const repsCuve = reponses.filter((r: any) => reIds.includes(r.ronde_equipement_id));
      const qNiveau  = questions.find((q: any) => q.equipement_id === cuve.id && q.texte.toLowerCase().includes('niveau'));

      if (!qNiveau) continue;
      const vals = repsCuve
        .filter((r: any) => r.question_id === qNiveau.id)
        .map((r: any) => parseFloat(r.valeur?.replace(',', '.')))
        .filter((v: number) => !isNaN(v));
      if (!vals.length) continue;

      const niveauActuel = vals[vals.length - 1];
      const cap  = parseFloat(cuve.capacite_litres);
      const pct  = Math.round((niveauActuel / cap) * 100);
      const em   = pct < 20 ? '🔴' : pct < 40 ? '🟡' : '🟢';
      const consoH = cuve.conso_theorique_lh ? parseFloat(cuve.conso_theorique_lh) : consoTotaleH;
      // Formule alignée dashboard
      const autoJ = consoH > 0 ? Math.round(niveauActuel / (consoH * 8) * 10) / 10 : null;

      msg += `*${cuve.nom}*\n`;
      msg += `   ${em} Niveau actuel : *${niveauActuel}L / ${cap}L* (${pct}%)\n`;
      msg += `   📉 Min : ${Math.min(...vals)}L · 📈 Max : ${Math.max(...vals)}L\n`;
      if (autoJ !== null) msg += `   ⏱️ Autonomie estimée : *~${autoJ}j*\n`;
      msg += '\n';
    }
  }

  // ── Autres équipements ──
  if (autres.length) {
    const autresValides = rondesEq.filter((re: any) => autres.some((e: any) => e.id === re.equipement_id));
    if (autresValides.length) {
      msg += `🔧 *Autres équipements*\n`;
      msg += `   ${autresValides.length} vérification${autresValides.length > 1 ? 's' : ''} effectuée${autresValides.length > 1 ? 's' : ''}\n\n`;
    }
  }

  // ── Signalements (remplace pannes) ──
  if (signalements.length) {
    const totalCout = signalements.reduce((s: number, sg: any) => s + (sg.cout_intervention || 0), 0);
    msg += `🚨 *Signalements*\n`;
    for (const sg of signalements) {
      const statut = sg.statut === 'resolu' ? '✅' : sg.statut === 'en_cours' ? '⏳' : '🔴';
      msg += `   • ${statut} ${sg.description?.substring(0, 60) || sg.type}\n`;
      if (sg.cout_intervention) msg += `     💰 ${sg.cout_intervention.toLocaleString('fr-FR')} FCFA\n`;
    }
    if (totalCout > 0) msg += `   _Total : ${totalCout.toLocaleString('fr-FR')} FCFA_\n`;
    msg += '\n';
  }

  // ── Résumé ──
  const tauxGlobal     = Math.round((nbRondes / 7) * 100);
  const tauxGlobalEmoji = tauxGlobal >= 80 ? '🟢' : tauxGlobal >= 50 ? '🟡' : '🔴';
  msg += `${'─'.repeat(28)}\n`;
  msg += `📈 *Résumé semaine*\n`;
  msg += `   📋 ${nbRondes} ronde${nbRondes > 1 ? 's' : ''} / 7 jours\n`;
  msg += `   ${tauxGlobalEmoji} Taux de saisie : *${tauxGlobal}%*\n`;
  if (!signalements.length) {
    msg += `   ✅ Semaine sans signalement\n`;
  } else {
    msg += `   🚨 ${signalements.length} signalement${signalements.length > 1 ? 's' : ''}\n`;
  }
  msg += `\n_Tapez *rapport* pour le bilan du jour_`;

  return msg;
}

// ── Handler principal ─────────────────────────────────────────────────────────

serve(async (_req) => {
  console.log('[rapport-hebdo]', new Date().toISOString());

  const aujourd = new Date();
  const il_y_a_7j = new Date(aujourd);
  il_y_a_7j.setDate(aujourd.getDate() - 7);
  const dateDebut = il_y_a_7j.toISOString().split('T')[0];
  const dateFin   = aujourd.toISOString().split('T')[0];

  const stats = { rapports_envoyes: 0, erreurs: 0 };
  const sites = await dbGet('sites', '&actif=eq.true');

  for (const site of sites) {
    const equipements = await dbGet('equipements',
      `&site_id=eq.${site.id}&actif=eq.true&order=ordre_ronde.asc`
    );
    if (!equipements.length) continue;

    // Managers uniquement pour le rapport hebdo
    const contacts = await dbGet('contacts',
      `&site_id=eq.${site.id}&actif=eq.true&role=in.(resp_tech,dir_tech)`
    );
    if (!contacts.length) continue;

    const rapport = await buildReport(site, equipements, dateDebut, dateFin);

    const dejaEnvoyes = new Set<string>();
    for (const contact of contacts) {
      if (!contact.whatsapp || dejaEnvoyes.has(contact.whatsapp)) continue;
      dejaEnvoyes.add(contact.whatsapp);
      const ok = await sendWA(contact.whatsapp, rapport);
      if (ok) stats.rapports_envoyes++; else stats.erreurs++;
    }
  }

  console.log('[rapport-hebdo] Stats :', stats);
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
});
