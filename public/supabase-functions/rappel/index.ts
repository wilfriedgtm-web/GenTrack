// supabase/functions/rappel/index.ts
// GenTrack — Rappels automatiques
// v20 — Nouveaux horaires fixes
//      · Rappel ronde journalière à 7h UTC
//      · Rappel ronde hebdo le lundi à 7h UTC
//      · Rappel relevé horaire à 10h, 14h et 18h UTC
//      · Alertes autonomie carburant (toutes les heures, rate-limited)
// Cron : toutes les heures

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              || 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const TWILIO_SID  = Deno.env.get('TWILIO_SID')               || '';
const TWILIO_TOKEN= Deno.env.get('TWILIO_TOKEN')              || '';
const TWILIO_FROM = Deno.env.get('TWILIO_NUMBER')             || 'whatsapp:+19843418695';
const BASE_URL    = Deno.env.get('APP_URL')                   || 'https://gen-track.vercel.app';

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
  if (!res.ok) {
    console.error(`[WA] error ${res.status} → ${to}`);
    return false;
  }
  return true;
}

function getUTCHour(): number { return new Date().getUTCHours(); }
function getToday(): string {
  return new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Dakar' });
}

// Dernière valeur enregistrée pour une question contenant un mot-clé
async function getDerniereReponse(equipementId: string, motCle: string): Promise<number | null> {
  const questions = await dbGet('questions',
    `&equipement_id=eq.${equipementId}&actif=eq.true&texte=ilike.*${motCle}*&limit=1`
  );
  if (!questions.length) return null;
  const reps = await dbGet('reponses',
    `&question_id=eq.${questions[0].id}&order=created_at.desc&limit=1`
  );
  if (!reps.length) return null;
  const val = parseFloat(reps[0].valeur?.replace(',', '.'));
  return isNaN(val) ? null : val;
}


// ── Handler principal ─────────────────────────────────────────────────────────

serve(async (_req) => {
  const heureUTC = getUTCHour();
  const today    = getToday();
  const stats    = { rappels_ronde: 0, alertes_carburant: 0, erreurs: 0, rappels_skipped: 0 };

  // ── Techniciens actifs récemment (session bot dans les 7 derniers jours) ──────
  // Un tech "actif" = a envoyé au moins un message au bot dans les 7 jours
  // → reçoit les rappels. Les inactifs reçoivent toujours les alertes urgentes.
  const seuilActif = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const sessionsActives = await dbGet('sessions', `&updated_at=gte.${seuilActif}&select=phone`).catch(() => []);
  const phonesActifs = new Set<string>(
    Array.isArray(sessionsActives) ? sessionsActives.map((s: any) => s.phone?.replace('whatsapp:', '')) : []
  );
  const estActif = (whatsapp: string) => phonesActifs.has(whatsapp.replace('whatsapp:', '').replace('+', ''));

  const sites = await dbGet('sites', '&actif=eq.true');

  for (const site of sites) {
    // Équipements actifs du site
    const equipements = await dbGet('equipements',
      `&site_id=eq.${site.id}&actif=eq.true&order=ordre_ronde.asc`
    );
    if (!equipements.length) continue;

    const cuves = equipements.filter((e: any) => e.capacite_litres != null);
    const ges   = equipements.filter((e: any) => e.conso_theorique_lh != null);

    // Contacts du site
    const contacts    = await dbGet('contacts', `&site_id=eq.${site.id}&actif=eq.true`);
    const techniciens = contacts.filter((c: any) => c.role === 'technicien' && c.whatsapp);
    const managers    = contacts.filter((c: any) =>
      (c.role === 'resp_tech' || c.role === 'dir_tech') && c.whatsapp
    );

    // ── 1. ALERTES AUTONOMIE CARBURANT ───────────────────────────
    const consoTotaleH = ges.reduce((s: number, g: any) => s + (parseFloat(g.conso_theorique_lh) || 0), 0);

    for (const cuve of cuves) {
      const niveau = await getDerniereReponse(cuve.id, 'niveau');
      if (niveau === null) continue;

      const cap   = parseFloat(cuve.capacite_litres);
      const pct   = Math.round((niveau / cap) * 100);
      const consoH = cuve.conso_theorique_lh ? parseFloat(cuve.conso_theorique_lh) : consoTotaleH;
      // Formule alignée dashboard : niveau / (consoH * 8h/jour)
      const autoJ = consoH > 0 ? Math.round(niveau / (consoH * 8) * 10) / 10 : null;
      const autoStr = autoJ !== null ? `~${autoJ}j` : 'inconnue';

      let severite: 'critique' | 'attention' | null = null;
      if (pct < 20)      severite = 'critique';
      else if (pct < 40) severite = 'attention';
      if (!severite) continue;

      // Rate limiting : critique → max toutes les 6h, attention → max toutes les 12h
      const alerteSlot = severite === 'critique' ? heureUTC % 6 : heureUTC % 12;
      if (alerteSlot !== 0) continue;

      // Critique → tous les contacts ; attention → managers seulement
      const destinataires = severite === 'critique' ? contacts.filter((c: any) => c.whatsapp) : managers;

      const msg = severite === 'critique'
        ? `🚨 *ALERTE CARBURANT CRITIQUE — GenTrack*\n*${site.nom}*\n\n⛽ ${cuve.nom} : *${pct}%* (${Math.round(niveau)}L / ${Math.round(cap)}L)\n⏱️ Autonomie : *${autoStr}*\n\nCommandez le carburant immédiatement !\n_Tapez *plein* après le ravitaillement._`
        : `⛽ *Carburant à surveiller — GenTrack*\n*${site.nom}*\n\n${cuve.nom} : *${pct}%* (${Math.round(niveau)}L / ${Math.round(cap)}L)\n⏱️ Autonomie estimée : *${autoStr}*\n\nPlanifiez un ravitaillement prochainement.`;

      const dejaEnvoyes = new Set<string>();
      for (const c of destinataires) {
        if (dejaEnvoyes.has(c.whatsapp)) continue;
        dejaEnvoyes.add(c.whatsapp);
        const ok = await sendWA(c.whatsapp, msg);
        if (ok) stats.alertes_carburant++; else stats.erreurs++;
      }
    }

    // ── 2. RAPPEL RONDE JOURNALIÈRE (7h UTC) ─────────────────────
    if (site.journalier_actif && heureUTC === 7 && techniciens.length) {
      const rondesDuJour = await dbGet('rondes',
        `&site_id=eq.${site.id}&date_ronde=eq.${today}&frequence=eq.journalier`
      );
      let rondeComplete = false;
      if (rondesDuJour.length) {
        const valides       = await dbGet('rondes_equipements', `&ronde_id=eq.${rondesDuJour[0].id}&statut=eq.valide`);
        const nbEquipsRonde = equipements.filter((e: any) => e.actif_ronde !== false && e.capacite_litres == null).length;
        if (valides.length >= nbEquipsRonde) rondeComplete = true;
      }

      if (!rondeComplete) {
        const equipsRonde = equipements.filter((e: any) => e.actif_ronde !== false && e.capacite_litres == null);
        const listeEquip  = equipsRonde.map((e: any) => `📟 ${e.nom}`).join('\n');
        const cuveStr     = cuves.length ? `\n⛽ ${cuves.map((c: any) => c.nom).join(', ')}` : '';

        for (const tech of techniciens) {
          if (!estActif(tech.whatsapp)) { stats.rappels_skipped++; continue; }
          const msg =
            `☀️ *GenTrack — Ronde du jour*\n\n` +
            `Bonjour ${tech.nom || ''} ! *${site.nom}*\n\n` +
            `${listeEquip}${cuveStr}\n\n` +
            `• *saisie* — Lancer la ronde\n` +
            `• *plein* — Ravitaillement cuve\n` +
            `• *panne* — Signaler une urgence\n` +
            `• *aide* — Toutes les commandes`;
          const ok = await sendWA(tech.whatsapp, msg);
          if (ok) stats.rappels_ronde++; else stats.erreurs++;
        }
      }
    }

    // Rappel ronde hebdomadaire supprimé (doublon avec rappel journalier)
    // Rappel relevé horaire 10h/14h/18h supprimé (réduction coût WhatsApp — lien accessible depuis l'app)
  }

  console.log('[rappel] Stats :', stats);
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
});
