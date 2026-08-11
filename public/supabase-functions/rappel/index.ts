// supabase/functions/rappel/index.ts
// GenTrack — Rappels intelligents + alertes autonomie
// v6 — Nouveau système (equipements/rondes/reponses) + heure configurable par site
// Cron : toutes les heures — chaque site reçoit son rappel à son heure_rappel (UTC)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID           = Deno.env.get("TWILIO_SID")!;
const TWILIO_TOKEN         = Deno.env.get("TWILIO_TOKEN")!;
const TWILIO_FROM          = "whatsapp:+14155238886";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendWA(to: string, message: string): Promise<boolean> {
  if (!to) return false;
  const phone = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: phone, Body: message }).toString(),
    }
  );
  if (!res.ok) { console.error(`❌ Twilio [${to}]:`, await res.text()); return false; }
  console.log(`✅ Envoyé → ${to}`);
  return true;
}

function getUTCHour(): number {
  return new Date().getUTCHours();
}

function getToday(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Africa/Dakar" });
}

// Récupère la dernière réponse pour une question contenant un mot-clé
async function getDerniereReponse(equipementId: string, motCle: string): Promise<number | null> {
  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .eq("equipement_id", equipementId)
    .eq("actif", true)
    .ilike("texte", `%${motCle}%`)
    .limit(1);

  if (!questions?.length) return null;
  const qId = questions[0].id;

  const { data: rep } = await supabase
    .from("reponses")
    .select("valeur")
    .eq("question_id", qId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!rep?.length) return null;
  const val = parseFloat(rep[0].valeur?.replace(",", "."));
  return isNaN(val) ? null : val;
}

serve(async (_req) => {
  const heureUTC = getUTCHour();
  const today = getToday();
  console.log(`🕘 Rappel — ${new Date().toISOString()} — Heure UTC : ${heureUTC}h`);

  const stats = { rappels_saisie: 0, alertes_critique: 0, alertes_attention: 0, erreurs: 0 };
  const dejaEnvoyes = new Set<string>();

  // Charger tous les sites actifs avec leur heure de rappel
  const { data: sites } = await supabase
    .from("sites")
    .select("id, nom, client_id, heure_rappel, journalier_actif")
    .eq("journalier_actif", true);

  for (const site of sites ?? []) {
    // Ne traiter que les sites dont c'est l'heure de rappel
    const heureRappel = site.heure_rappel ?? 8;
    if (heureUTC !== heureRappel) continue;

    console.log(`📍 Site : ${site.nom} (heure_rappel=${heureRappel}h UTC)`);

    // Charger le client
    const { data: clientRaw } = await supabase
      .from("clients")
      .select("id, nom, actif")
      .eq("id", site.client_id)
      .eq("actif", true)
      .single();
    if (!clientRaw) continue;

    // Charger les équipements actifs du site
    const { data: equipements } = await supabase
      .from("equipements")
      .select("id, nom, capacite_litres, conso_theorique_lh, type_id")
      .eq("site_id", site.id)
      .eq("actif", true)
      .order("ordre_ronde", { ascending: true });

    if (!equipements?.length) continue;

    // ── 1. ALERTES AUTONOMIE CARBURANT ──────────────────────────
    const cuves = equipements.filter(e => e.capacite_litres != null);
    const ges   = equipements.filter(e => e.capacite_litres == null && e.conso_theorique_lh != null);
    const consoTotaleParHeure = ges.reduce((s, g) => s + (parseFloat(g.conso_theorique_lh) || 0), 0);

    for (const cuve of cuves) {
      const niveauActuel = await getDerniereReponse(cuve.id, "niveau");
      if (niveauActuel === null) continue;

      const capacite = parseFloat(cuve.capacite_litres);
      const pct = Math.round((niveauActuel / capacite) * 100);
      const consoH = cuve.conso_theorique_lh ? parseFloat(cuve.conso_theorique_lh) : consoTotaleParHeure;
      // Autonomie = niveau / (conso_par_heure * 8h_de_marche_par_jour) — aligné avec le dashboard
      const joursAutonomie = consoH > 0 ? Math.round(niveauActuel / (consoH * 8) * 10) / 10 : null;

      let severite: "critique" | "attention" | null = null;
      if (pct <= 20) severite = "critique";
      else if (pct <= 40) severite = "attention";

      if (!severite) continue;

      // Charger les contacts du site (resp_tech + technicien pour critique)
      const rolesAlerte = severite === "critique" ? ["resp_tech", "technicien", "dir_tech"] : ["resp_tech", "dir_tech"];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("whatsapp, nom, role")
        .eq("client_id", site.client_id)
        .eq("site_id", site.id)
        .eq("actif", true)
        .in("role", rolesAlerte)
        .not("whatsapp", "is", null);

      if (!contacts?.length) continue;

      const joursStr = joursAutonomie !== null
        ? `~${joursAutonomie} jour${joursAutonomie > 1 ? "s" : ""}`
        : "inconnu";

      const msg = severite === "critique"
        ? `🚨 *GenTrack — ALERTE CARBURANT CRITIQUE*\n\n*${site.nom}*\n\n⛽ ${cuve.nom} : *${pct}%* (${Math.round(niveauActuel)}L / ${Math.round(capacite)}L)\n⏱️ Autonomie estimée : *${joursStr}*\n\nCommandez le carburant maintenant pour éviter un arrêt !\n\n_Tapez *plein* après le ravitaillement._`
        : `⛽ *GenTrack — Carburant à surveiller*\n\n*${site.nom}*\n\n${cuve.nom} : *${pct}%* (${Math.round(niveauActuel)}L / ${Math.round(capacite)}L)\n⏱️ Autonomie estimée : *${joursStr}*\n\nPlanifiez un ravitaillement prochainement.`;

      for (const c of contacts) {
        if (!c.whatsapp || dejaEnvoyes.has(`alerte-${c.whatsapp}-${cuve.id}`)) continue;
        const ok = await sendWA(c.whatsapp, msg);
        if (ok) {
          dejaEnvoyes.add(`alerte-${c.whatsapp}-${cuve.id}`);
          if (severite === "critique") stats.alertes_critique++;
          else stats.alertes_attention++;
        } else {
          stats.erreurs++;
        }
      }

      // Enregistrer l'alerte en base
      await supabase.from("alertes").insert({
        client_id: site.client_id,
        type: "carburant_bas",
        severite: severite === "critique" ? "danger" : "warning",
        message: `${severite === "critique" ? "Critique" : "Attention"} — ${cuve.nom} — ${pct}% — ${joursStr}`,
        resolue: false,
      });
    }

    // ── 2. ALERTES VIDANGE (heures moteur) ──────────────────────
    for (const ge of ges) {
      if (!ge.conso_theorique_lh) continue;

      // On n'a pas d'accès direct au compteur total, mais on peut récupérer le dernier relevé
      const derniereQuestion = await getDerniereReponse(ge.id, "compteur");
      if (derniereQuestion === null) continue;

      // Pour la vidange on aurait besoin du seuil — récupérer l'équipement complet
      const { data: equipFull } = await supabase
        .from("equipements")
        .select("seuil_vidange_heures")
        .eq("id", ge.id)
        .single();

      if (!equipFull?.seuil_vidange_heures) continue;

      // Calculer le prochain seuil
      const seuil = equipFull.seuil_vidange_heures;
      const prochainSeuil = Math.ceil((derniereQuestion + 0.01) / seuil) * seuil;
      const heuresRestantes = prochainSeuil - derniereQuestion;

      // Alerter si < 20h restantes
      if (heuresRestantes > 20) continue;

      const { data: contacts } = await supabase
        .from("contacts")
        .select("whatsapp")
        .eq("client_id", site.client_id)
        .eq("site_id", site.id)
        .eq("actif", true)
        .in("role", ["resp_tech", "dir_tech"])
        .not("whatsapp", "is", null);

      if (!contacts?.length) continue;

      const msg = `🔧 *GenTrack — Vidange imminente*\n\n*${site.nom}* — ${ge.nom}\n\n🕐 Compteur actuel : *${derniereQuestion}h*\nSeuil vidange : *${prochainSeuil}h*\nRestant : *~${Math.round(heuresRestantes)}h*\n\nPlanifiez la vidange prochainement.\n\n_Tapez *vidange* pour l'enregistrer._`;

      for (const c of contacts) {
        if (!c.whatsapp || dejaEnvoyes.has(`vidange-${c.whatsapp}-${ge.id}`)) continue;
        const ok = await sendWA(c.whatsapp, msg);
        if (ok) dejaEnvoyes.add(`vidange-${c.whatsapp}-${ge.id}`);
      }
    }

    // ── 3. RAPPEL SAISIE AUX TECHNICIENS ────────────────────────
    // Vérifier si la ronde du jour est déjà faite
    const { data: rondesDuJour } = await supabase
      .from("rondes")
      .select("id")
      .eq("site_id", site.id)
      .eq("date_ronde", today)
      .eq("frequence", "journalier");

    let rondeComplete = false;
    if (rondesDuJour?.length) {
      const rondeId = rondesDuJour[0].id;
      const { data: valides } = await supabase
        .from("rondes_equipements")
        .select("id")
        .eq("ronde_id", rondeId)
        .eq("statut", "valide");
      if ((valides?.length || 0) >= equipements.length) rondeComplete = true;
    }

    if (rondeComplete) {
      console.log(`✅ Ronde déjà complète pour ${site.nom} — pas de rappel`);
      continue;
    }

    // Charger les techniciens du site
    const { data: techniciens } = await supabase
      .from("contacts")
      .select("whatsapp, nom")
      .eq("client_id", site.client_id)
      .eq("site_id", site.id)
      .eq("role", "technicien")
      .eq("actif", true)
      .not("whatsapp", "is", null);

    if (!techniciens?.length) continue;

    const listeEquip = equipements
      .filter(e => e.capacite_litres == null) // Exclure cuves du listing principal
      .map(e => `📟 ${e.nom}`)
      .join("\n");

    const cuveListStr = cuves.length > 0 ? `\n⛽ ${cuves.map(c => c.nom).join(", ")}` : "";

    for (const tech of techniciens) {
      if (!tech.whatsapp || dejaEnvoyes.has(`rappel-${tech.whatsapp}`)) continue;

      const msg =
        `☀️ *GenTrack — Ronde du jour*\n\n` +
        `Bonjour ${tech.nom || ""} ! *${site.nom}*\n\n` +
        `${listeEquip}${cuveListStr}\n\n` +
        `• *saisie* — Lancer la ronde\n` +
        `• *plein* — Ravitaillement cuve\n` +
        `• *panne* — Signaler une urgence\n` +
        `• *aide* — Toutes les commandes`;

      const ok = await sendWA(tech.whatsapp, msg);
      if (ok) { dejaEnvoyes.add(`rappel-${tech.whatsapp}`); stats.rappels_saisie++; }
      else stats.erreurs++;
    }
  }

  console.log("📊 Stats rappel :", stats);
  return new Response(JSON.stringify(stats), { headers: { "Content-Type": "application/json" } });
});
