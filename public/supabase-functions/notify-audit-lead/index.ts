// supabase/functions/notify-audit-lead/index.ts
// Appelée par audit.html après soumission du formulaire d'audit
// Envoie un email de notification via Resend (resend.com)
//
// Setup (une seule fois) :
//   1. Créer un compte gratuit sur resend.com
//   2. Obtenir votre API key
//   3. supabase secrets set RESEND_API_KEY=re_xxxxxxx
//   4. supabase functions deploy notify-audit-lead

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_EMAIL  = 'wilfried.gtm@gmail.com';
const FROM_EMAIL    = 'onboarding@resend.dev'; // remplacer par audit@tondomaine.com une fois le DNS configuré

const VERCEL_PREVIEW_RE = /^https:\/\/gen-track(-[a-z0-9]+)*\.vercel\.app$/;

function isAllowedOrigin(origin: string): boolean {
  return (
    origin === 'https://gen-track.vercel.app' ||
    VERCEL_PREVIEW_RE.test(origin) ||
    origin === 'http://localhost:3000'
  );
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin':  allowed || '*',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const SCORE_LABEL: Record<string, string> = {
  bad: '🔴 Maturité faible (< 40)',
  mid: '🟡 Niveau intermédiaire (40–64)',
  good: '🟢 Bonne maturité (65+)',
};

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: cors });
  }

  const {
    hotel_name, hotel_rooms, hotel_cat, hotel_role,
    email, phone, score, score_tier,
    budget_xof, reactive_pct, data_quality,
    trace_method, gmao_status, signalement_mode,
    pains, pertes_xof,
  } = body as Record<string, unknown>;

  const tier = String(score_tier || 'mid');
  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;color:#1a1a1a;">
  <div style="background:#1a1a1a;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:13px;opacity:0.6;">Nouveau lead — Audit maintenance GenTrack</p>
    <h2 style="margin:4px 0 0;font-size:20px;">${hotel_name || 'Hôtel inconnu'}</h2>
  </div>
  <div style="border:1px solid #e8e8e6;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;width:180px;">Score de maturité</td><td style="padding:6px 0;font-weight:600;">${score}/100 — ${SCORE_LABEL[tier] || tier}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Pertes estimées</td><td style="padding:6px 0;font-weight:600;color:#E8841A;">${Number(pertes_xof || 0).toLocaleString('fr-FR')} XOF / an</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Hôtel</td><td style="padding:6px 0;">${hotel_name} · ${hotel_rooms} chambres · ${hotel_cat}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Contact</td><td style="padding:6px 0;">${hotel_role}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}" style="color:#3B82F6;">${email}</a></td></tr>
      <tr><td style="padding:6px 0;color:#666;">Téléphone / WA</td><td style="padding:6px 0;">${phone || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Budget maintenance</td><td style="padding:6px 0;">${budget_xof}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">% réactif</td><td style="padding:6px 0;">${reactive_pct}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Traçage rondes</td><td style="padding:6px 0;">${trace_method}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Signalements via</td><td style="padding:6px 0;">${signalement_mode}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">GMAO</td><td style="padding:6px 0;">${gmao_status}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Données terrain</td><td style="padding:6px 0;">${data_quality}</td></tr>
    </table>
    ${Array.isArray(pains) && pains.length > 0 ? `
    <div style="margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fde8cc;border-radius:6px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#E8841A;">Points de friction identifiés</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;">
        ${(pains as string[]).map(p => `<li style="margin-bottom:3px;">${p}</li>`).join('')}
      </ul>
    </div>` : ''}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e8e8e6;text-align:center;">
      <a href="mailto:${email}?subject=Votre rapport GenTrack - Prochaine étape&body=Bonjour,%0D%0A%0D%0AJ'ai bien reçu votre rapport d'audit maintenance. Je serais ravi de vous présenter GenTrack en 20 min.%0D%0A%0D%0ACordialement" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Répondre au lead →</a>
    </div>
  </div>
</div>`;

  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — email not sent. Lead data:', JSON.stringify({ hotel_name, email, score }));
    return new Response(JSON.stringify({ ok: true, email_sent: false, reason: 'no_key' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `GenTrack Audit <${FROM_EMAIL}>`,
      to: [NOTIFY_EMAIL],
      subject: `🏨 Nouveau lead audit — ${hotel_name} (score ${score}/100)`,
      html,
    }),
  });

  const ok = resendRes.ok;
  return new Response(JSON.stringify({ ok, email_sent: ok }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
