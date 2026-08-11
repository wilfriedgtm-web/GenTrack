// supabase/functions/rapport-hebdo/index.ts
// GenTrack — Rapport hebdomadaire
// v6 — Nouveau système (equipements/rondes/reponses)
// Cron : lundi 8h UTC

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
  console.log(`✅ Rapport → ${to}`);
  return true;
}

async function buildAndSendReport(
  clientNom: string,
  siteNom: string,
  siteId: string,
  dateDebut: string,
  dateFin: string,
  destinataire: string
): Promise<boolean> {
  // Charger toutes les rondes de la semaine pour ce site
  const { data: rondes } = await supabase
    .from("rondes")
    .select("id, date_ronde, frequence, technicien_id")
    .eq("site_id", siteId)
    .gte("date_ronde", dateDebut)
    .lte("date_ronde", dateFin)
    .order("date_ronde", { ascending: true });

  const rondeIds = (rondes ?? []).map(r => r.id);
  const nbRondes = rondes?.length ?? 0;

  // Charger les équipements actifs du site
  const { data: equipements } = await supabase
    .from("equipements")
    .select("id, nom, type_id, capacite_litres, conso_theorique_lh, seuil_vidange_heures")
    .eq("site_id", siteId)
    .eq("actif", true)
    .order("ordre_ronde", { ascending: true });

  const equips = equipements ?? [];

  // Charger les rondes_equipements et questions pour la semaine
  let rondesEq: any[] = [];
  let reponses: any[] = [];

  if (rondeIds.length > 0) {
    const { data: re } = await supabase
      .from("rondes_equipements")
      .select("id, ronde_id, equipement_id, statut, valide_at")
      .in("ronde_id", rondeIds)
      .eq("statut", "valide");
    rondesEq = re ?? [];

    if (rondesEq.length > 0) {
      const reIds = rondesEq.map(r => r.id);
      const { data: reps } = await supabase
        .from("reponses")
        .select("ronde_equipement_id, question_id, valeur, created_at")
        .in("ronde_equipement_id", reIds);
      reponses = reps ?? [];
    }
  }

  // Charger les questions pour les équipements du site
  const equipIds = equips.map(e => e.id);
  let questions: any[] = [];
  if (equipIds.length > 0) {
    const { data: qs } = await supabase
      .from("questions")
      .select("id, equipement_id, texte, type_reponse, unite")
      .in("equipement_id", equipIds)
      .eq("actif", true);
    questions = qs ?? [];
  }

  // Charger les pannes de la semaine
  const { data: pannes } = await supabase
    .from("pannes")
    .select("id, description, type, resolue, cout_reparation, date_panne")
    .eq("client_id", (await supabase.from("sites").select("client_id").eq("id", siteId).single()).data?.client_id)
    .gte("date_panne", dateDebut + "T00:00:00")
    .lte("date_panne", dateFin + "T23:59:59");

  // ── Construire les stats par équipement ──
  const dateDebutFmt = new Date(dateDebut).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const dateFinFmt   = new Date(dateFin).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  let msg = `📊 *Rapport hebdomadaire GenTrack*\n`;
  msg += `*${clientNom} — ${siteNom}*\n`;
  msg += `📅 ${dateDebutFmt} → ${dateFinFmt}\n`;
  msg += `${"─".repeat(28)}\n\n`;

  const ges    = equips.filter(e => e.capacite_litres == null && e.conso_theorique_lh != null);
  const cuves  = equips.filter(e => e.capacite_litres != null);
  const autres = equips.filter(e => e.capacite_litres == null && e.conso_theorique_lh == null);

  let totalPannes = 0, totalCout = 0;

  // ── Groupes électrogènes ──
  if (ges.length > 0) {
    msg += `⚡ *Groupes électrogènes*\n\n`;
    for (const ge of ges) {
      const reIds = rondesEq.filter(re => re.equipement_id === ge.id).map(re => re.id);
      const repsGe = reponses.filter(r => reIds.includes(r.ronde_equipement_id));
      const qCompteur = questions.find(q => q.equipement_id === ge.id && q.texte.toLowerCase().includes("compteur"));
      const qHuile    = questions.find(q => q.equipement_id === ge.id && q.texte.toLowerCase().includes("huile"));

      let heuresMarche = 0;
      let derniereHuile = "—";
      let nbSaisies = reIds.length;

      if (qCompteur) {
        const valsCompteur = repsGe
          .filter(r => r.question_id === qCompteur.id)
          .map(r => parseFloat(r.valeur?.replace(",", ".")))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);
        if (valsCompteur.length >= 2) {
          heuresMarche = valsCompteur[valsCompteur.length - 1] - valsCompteur[0];
        } else if (valsCompteur.length === 1) {
          heuresMarche = 0; // une seule saisie, impossible de calculer le delta
        }
      }

      if (qHuile) {
        const repsHuile = repsGe.filter(r => r.question_id === qHuile.id);
        if (repsHuile.length > 0) {
          derniereHuile = repsHuile[repsHuile.length - 1].valeur;
        }
      }

      const huileEmoji = derniereHuile === "Normal" ? "✅" : derniereHuile !== "—" ? "⚠️" : "";
      const tauxEmoji = nbSaisies >= 5 ? "🟢" : nbSaisies >= 3 ? "🟡" : "🔴";

      msg += `*${ge.nom}*\n`;
      msg += `   🕐 ${heuresMarche.toFixed(1)}h de marche\n`;
      msg += `   ${tauxEmoji} ${nbSaisies}/7 rondes effectuées\n`;
      if (derniereHuile !== "—") msg += `   🛢️ Huile : *${derniereHuile}* ${huileEmoji}\n`;

      // Alerte vidange
      if (ge.seuil_vidange_heures && qCompteur) {
        const derniereValCompteur = repsGe
          .filter(r => r.question_id === qCompteur.id)
          .map(r => parseFloat(r.valeur?.replace(",", ".")))
          .filter(v => !isNaN(v))
          .sort((a, b) => b - a)[0];
        if (derniereValCompteur) {
          const prochainSeuil = Math.ceil((derniereValCompteur + 0.01) / ge.seuil_vidange_heures) * ge.seuil_vidange_heures;
          const restantes = prochainSeuil - derniereValCompteur;
          const em = restantes <= 20 ? "🔴" : restantes <= 50 ? "🟡" : "🟢";
          msg += `   ${em} Vidange dans *${Math.round(restantes)}h* (${derniereValCompteur}h → ${prochainSeuil}h)\n`;
        }
      }
      msg += "\n";
    }
  }

  // ── Cuves carburant ──
  if (cuves.length > 0) {
    msg += `⛽ *Carburant*\n\n`;
    for (const cuve of cuves) {
      const reIds = rondesEq.filter(re => re.equipement_id === cuve.id).map(re => re.id);
      const repsCuve = reponses.filter(r => reIds.includes(r.ronde_equipement_id));
      const qNiveau = questions.find(q => q.equipement_id === cuve.id && q.texte.toLowerCase().includes("niveau"));

      if (qNiveau) {
        const valsNiveau = repsCuve
          .filter(r => r.question_id === qNiveau.id)
          .map(r => parseFloat(r.valeur?.replace(",", ".")))
          .filter(v => !isNaN(v));

        if (valsNiveau.length > 0) {
          const niveauMin  = Math.min(...valsNiveau);
          const niveauMax  = Math.max(...valsNiveau);
          const niveauActuel = valsNiveau[valsNiveau.length - 1];
          const capacite   = parseFloat(cuve.capacite_litres);
          const pct        = Math.round((niveauActuel / capacite) * 100);
          const em         = pct < 20 ? "🔴" : pct < 40 ? "🟡" : "🟢";

          msg += `*${cuve.nom}*\n`;
          msg += `   ${em} Niveau actuel : *${niveauActuel}L / ${capacite}L* (${pct}%)\n`;
          msg += `   📉 Min semaine : ${niveauMin}L — 📈 Max : ${niveauMax}L\n`;

          const consoTotaleH = ges.reduce((s, g) => s + (parseFloat(g.conso_theorique_lh) || 0), 0);
          if (consoTotaleH > 0) {
            const autoJ = Math.round(niveauActuel / (consoTotaleH * 8) * 10) / 10;
            msg += `   ⏱️ Autonomie estimée : *~${autoJ} jour${autoJ > 1 ? "s" : ""}*\n`;
          }
          msg += "\n";
        }
      }
    }
  }

  // ── Autres équipements (CF, GEG…) ──
  if (autres.length > 0) {
    const rondesAutres = rondesEq.filter(re => autres.find(e => e.id === re.equipement_id));
    if (rondesAutres.length > 0) {
      msg += `🔧 *Autres équipements*\n`;
      msg += `   ${rondesAutres.length} vérification${rondesAutres.length > 1 ? "s" : ""} effectuée${rondesAutres.length > 1 ? "s" : ""}\n\n`;
    }
  }

  // ── Pannes ──
  const pannesArr = pannes ?? [];
  if (pannesArr.length > 0) {
    totalPannes = pannesArr.length;
    totalCout = pannesArr.reduce((s, p) => s + (p.cout_reparation || 0), 0);
    msg += `🚨 *Pannes*\n`;
    for (const p of pannesArr) {
      msg += `   • ${p.description || p.type}${p.resolue ? " ✅" : " ⏳"}\n`;
      if (p.cout_reparation) msg += `     💰 ${p.cout_reparation.toLocaleString("fr-FR")} FCFA\n`;
    }
    msg += "\n";
  }

  // ── Résumé ──
  msg += `${"─".repeat(28)}\n`;
  msg += `📈 *Résumé semaine*\n`;
  msg += `   📋 ${nbRondes} ronde${nbRondes > 1 ? "s" : ""} effectuée${nbRondes > 1 ? "s" : ""} / 7 jours\n`;
  const tauxGlobal = Math.round((nbRondes / 7) * 100);
  const tauxGlobalEmoji = tauxGlobal >= 80 ? "🟢" : tauxGlobal >= 50 ? "🟡" : "🔴";
  msg += `   ${tauxGlobalEmoji} Taux de saisie : *${tauxGlobal}%*\n`;
  if (totalPannes > 0) {
    msg += `   🚨 ${totalPannes} panne${totalPannes > 1 ? "s" : ""}`;
    if (totalCout > 0) msg += ` — ${totalCout.toLocaleString("fr-FR")} FCFA`;
    msg += "\n";
  } else {
    msg += `   ✅ Semaine sans panne\n`;
  }
  msg += `\n_Tapez *rapport* pour le bilan du jour_`;

  return sendWA(destinataire, msg);
}

serve(async (_req) => {
  console.log("📊 Rapport hebdo —", new Date().toISOString());

  const aujourd = new Date();
  const il_y_a_7j = new Date(aujourd);
  il_y_a_7j.setDate(aujourd.getDate() - 7);
  const dateDebut = il_y_a_7j.toISOString().split("T")[0];
  const dateFin   = aujourd.toISOString().split("T")[0];

  const stats = { rapports_envoyes: 0, erreurs: 0 };

  // Charger tous les sites actifs
  const { data: sites } = await supabase
    .from("sites")
    .select("id, nom, client_id, journalier_actif");

  for (const site of sites ?? []) {
    // Charger le client
    const { data: client } = await supabase
      .from("clients")
      .select("id, nom, actif")
      .eq("id", site.client_id)
      .eq("actif", true)
      .single();
    if (!client) continue;

    // Charger les resp_tech du site
    const { data: contacts } = await supabase
      .from("contacts")
      .select("whatsapp, nom")
      .eq("client_id", site.client_id)
      .eq("site_id", site.id)
      .in("role", ["resp_tech", "dir_tech"])
      .eq("actif", true)
      .not("whatsapp", "is", null);

    if (!contacts?.length) continue;

    const dejaEnvoyes = new Set<string>();
    for (const contact of contacts) {
      if (!contact.whatsapp || dejaEnvoyes.has(contact.whatsapp)) continue;
      dejaEnvoyes.add(contact.whatsapp);

      const ok = await buildAndSendReport(
        client.nom, site.nom, site.id,
        dateDebut, dateFin,
        contact.whatsapp
      );
      if (ok) stats.rapports_envoyes++; else stats.erreurs++;
    }
  }

  console.log("📊 Stats:", stats);
  return new Response(JSON.stringify(stats), { headers: { "Content-Type": "application/json" } });
});
