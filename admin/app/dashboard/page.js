'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const TAB_LIST = [
  { id: 'portfolio', label: 'Portefeuille' },
  { id: 'traiter', label: 'À traiter' },
  { id: 'financier', label: 'Financier' },
  { id: 'rapports', label: 'Rapports' },
];

function scoreColors(score) {
  if (score >= 75) return { text: 'text-emerald-600', bar: 'bg-emerald-500', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  if (score >= 50) return { text: 'text-amber-600', bar: 'bg-amber-500', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
  return { text: 'text-red-600', bar: 'bg-red-500', border: 'border-red-300', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return (Date.now() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000;
}

function relativeDate(dateStr) {
  if (!dateStr) return 'Jamais';
  const d = daysSince(dateStr);
  if (d < 1) return "Auj.";
  if (d < 2) return 'Hier';
  return `J-${Math.floor(d)}`;
}

function waLink(phone) {
  if (!phone) return null;
  const n = phone.replace(/[^0-9]/g, '');
  return n ? `https://wa.me/${n}` : null;
}

// ────────────────────────────────────────────────────────────────────────
//  ClientCard — expandable card with health score bar
// ────────────────────────────────────────────────────────────────────────
function ClientCard({ client, expanded, onToggle }) {
  const col = scoreColors(client.score);
  const isOpen = expanded;
  const wa = waLink(client.whatsapp_patron);

  return (
    <div className={`bg-white border ${col.border} rounded-xl overflow-hidden transition-shadow hover:shadow-sm`}>
      {/* Main row */}
      <button
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
        onClick={onToggle}
      >
        {/* Score */}
        <div className="flex-shrink-0 w-12 text-center">
          <div className={`text-xl font-bold leading-none ${col.text}`}>{client.score}</div>
          <div className="text-xs text-gray-400 mt-0.5">/100</div>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 truncate">{client.nom}</span>
            {!client.actif && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Inactif</span>
            )}
            {client.critiqueOuvertes > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                🚨 {client.critiqueOuvertes} critique{client.critiqueOuvertes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
            <span>{client.ville}</span>
            <span>·</span>
            <span className="capitalize">{client.plan}</span>
            <span>·</span>
            <span>{client.sites.length} site{client.sites.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Stats (hidden on xs) */}
        <div className="hidden sm:flex items-center gap-6 flex-shrink-0 text-center">
          <div>
            <div className="text-sm font-medium text-slate-800">{relativeDate(client.lastRonde)}</div>
            <div className="text-xs text-gray-400">Ronde</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">{client.conformite7j}%</div>
            <div className="text-xs text-gray-400">Conf. 7j</div>
          </div>
          <div>
            <div className={`text-sm font-medium ${client.alertesOuvertes > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {client.alertesOuvertes}
            </div>
            <div className="text-xs text-gray-400">Alertes</div>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Score bar */}
      <div className="h-1 bg-gray-100">
        <div className={`h-1 ${col.bar} transition-all duration-500`} style={{ width: `${client.score}%` }} />
      </div>

      {/* Expanded detail */}
      {isOpen && (
        <div className="px-5 py-4 bg-gray-50/70 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500">Dernière ronde</div>
              <div className="text-sm font-medium mt-0.5">{relativeDate(client.lastRonde)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Conf. 7 jours</div>
              <div className="text-sm font-medium mt-0.5">{client.conformite7j}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Chambres</div>
              <div className="text-sm font-medium mt-0.5">{client.nb_chambres ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Prix mensuel</div>
              <div className="text-sm font-medium mt-0.5">{(client.prix_mensuel || 0).toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>

          {/* Open alertes preview */}
          {client.myAlertes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Alertes ouvertes</div>
              <div className="space-y-1">
                {client.myAlertes.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                      a.severite === 'critique' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.severite}
                    </span>
                    <span className="text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    {a.message && <span className="truncate">{a.message}</span>}
                  </div>
                ))}
                {client.myAlertes.length > 3 && (
                  <div className="text-xs text-gray-400">+ {client.myAlertes.length - 3} autre{client.myAlertes.length - 3 > 1 ? 's' : ''}</div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/dashboard/clients/${client.id}`}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
            >
              Voir le client
            </Link>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs border border-green-600 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors"
              >
                WhatsApp patron
              </a>
            )}
            {client.alertesOuvertes > 0 && (
              <Link
                href="/dashboard/alertes"
                className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                Alertes →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  ClientGroup — section with colored dot + count badge
// ────────────────────────────────────────────────────────────────────────
function ClientGroup({ title, dotClass, clients, expanded, onToggle }) {
  if (clients.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{clients.length}</span>
      </div>
      <div className="space-y-3">
        {clients.map(c => (
          <ClientCard key={c.id} client={c} expanded={!!expanded[c.id]} onToggle={() => onToggle(c.id)} />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Main page
// ────────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [tab, setTab] = useState('portfolio');
  const [clientStats, setClientStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

    const [clientsRes, sitesRes, rondesRes, alertesRes] = await Promise.all([
      supabase.from('clients')
        .select('id,nom,ville,plan,prix_mensuel,whatsapp_patron,actif,nb_chambres')
        .order('nom'),
      supabase.from('sites').select('id,client_id,nom'),
      supabase.from('rondes')
        .select('id,site_id,date_ronde')
        .gte('date_ronde', d30)
        .order('date_ronde', { ascending: false }),
      supabase.from('alertes')
        .select('id,client_id,severite,resolue,created_at,message')
        .eq('resolue', false),
    ]);

    const sites = sitesRes.data || [];
    const rondes = rondesRes.data || [];
    const alertes = alertesRes.data || [];

    // Index: site_id → client_id, and client_id → sites[]
    const siteToClient = {};
    const clientSites = {};
    sites.forEach(s => {
      siteToClient[s.id] = s.client_id;
      if (!clientSites[s.client_id]) clientSites[s.client_id] = [];
      clientSites[s.client_id].push(s);
    });

    // Index: client_id → rondes[]
    const rondesByClient = {};
    rondes.forEach(r => {
      const cid = siteToClient[r.site_id];
      if (!cid) return;
      if (!rondesByClient[cid]) rondesByClient[cid] = [];
      rondesByClient[cid].push(r);
    });

    // Index: client_id → alertes[]
    const alertesByClient = {};
    alertes.forEach(a => {
      if (!alertesByClient[a.client_id]) alertesByClient[a.client_id] = [];
      alertesByClient[a.client_id].push(a);
    });

    const stats = (clientsRes.data || []).map(client => {
      const myRondes = rondesByClient[client.id] || [];
      const myAlertes = alertesByClient[client.id] || [];
      const mySites = clientSites[client.id] || [];

      // Last ronde date
      const lastRonde = myRondes.length ? myRondes[0].date_ronde : null;
      const daysNoActivity = daysSince(lastRonde);

      // Conformité 7j = nb jours distincts avec au moins 1 ronde sur 7
      const activeDays = new Set(myRondes.filter(r => r.date_ronde >= d7).map(r => r.date_ronde));
      const conformite7j = Math.round((activeDays.size / 7) * 100);

      // Alertes critiques ouvertes depuis >48h
      const critiqueOuvertes = myAlertes.filter(a => {
        const ageH = (now - new Date(a.created_at).getTime()) / 3600000;
        return a.severite === 'critique' && ageH > 48;
      }).length;

      // ── Score de santé composite (0–100) ──────────────────────────────
      // +40  activité dans les 24h (ronde)
      // +25  activité entre 24h et 48h
      // +10  activité entre 48h et 72h
      // +30  conformité 7j (pondérée)
      // +20  aucune alerte ouverte du tout
      // +10  aucune alerte critique >48h (mais d'autres alertes ouvertes)
      // +10  client actif
      let score = 0;
      if (daysNoActivity < 1)       score += 40;
      else if (daysNoActivity < 2)  score += 25;
      else if (daysNoActivity < 3)  score += 10;
      score += Math.round(conformite7j * 0.30);
      if (myAlertes.length === 0)         score += 20;
      else if (critiqueOuvertes === 0)    score += 10;
      if (client.actif) score += 10;
      score = Math.min(100, score);

      // Catégorie de tri
      let category = 'ok';
      if (score < 50 || critiqueOuvertes > 0) category = 'urgent';
      else if (score < 75 || daysNoActivity > 2) category = 'attention';

      return {
        ...client,
        sites: mySites,
        lastRonde,
        daysNoActivity,
        conformite7j,
        alertesOuvertes: myAlertes.length,
        critiqueOuvertes,
        myAlertes,
        score,
        category,
      };
    });

    // Tri : urgents d'abord, puis attention, puis ok — par score croissant dans chaque groupe
    stats.sort((a, b) => {
      const order = { urgent: 0, attention: 1, ok: 2 };
      if (order[a.category] !== order[b.category]) return order[a.category] - order[b.category];
      return a.score - b.score;
    });

    setClientStats(stats);
    setLoading(false);
  }

  function toggleExpand(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
  }

  const urgents   = clientStats.filter(c => c.category === 'urgent');
  const attention = clientStats.filter(c => c.category === 'attention');
  const ok        = clientStats.filter(c => c.category === 'ok');

  const actifs = clientStats.filter(c => c.actif);
  const mrr = actifs.reduce((s, c) => s + (c.prix_mensuel || 0), 0);

  const mrrByPlan = {};
  const countByPlan = {};
  actifs.forEach(c => {
    mrrByPlan[c.plan]   = (mrrByPlan[c.plan]   || 0) + (c.prix_mensuel || 0);
    countByPlan[c.plan] = (countByPlan[c.plan]  || 0) + 1;
  });

  const totalAlertes = clientStats.reduce((s, c) => s + c.alertesOuvertes, 0);
  const hasCritique  = clientStats.some(c => c.critiqueOuvertes > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        Chargement du portefeuille…
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Vue d'ensemble</h1>
        <button
          onClick={() => loadData()}
          className="text-sm text-slate-600 border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
        >
          ↻ Actualiser
        </button>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Clients actifs',
            value: `${actifs.length} / ${clientStats.length}`,
            alert: false,
            href: '/dashboard/clients',
          },
          {
            label: 'Urgences',
            value: urgents.length,
            alert: urgents.length > 0,
            href: null,
          },
          {
            label: 'MRR',
            value: mrr.toLocaleString('fr-FR') + ' F',
            alert: false,
            href: null,
          },
          {
            label: 'Alertes ouvertes',
            value: totalAlertes,
            alert: hasCritique,
            href: '/dashboard/alertes',
          },
        ].map(k => {
          const inner = (
            <div className={`bg-white border rounded-xl p-4 ${k.alert ? 'border-red-200' : 'border-gray-200'} ${k.href ? 'hover:shadow-sm transition-shadow' : ''}`}>
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.alert ? 'text-red-600' : 'text-slate-900'}`}>
                {k.value}
              </p>
            </div>
          );
          return k.href ? (
            <Link key={k.label} href={k.href}>{inner}</Link>
          ) : (
            <div key={k.label}>{inner}</div>
          );
        })}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {TAB_LIST.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {t.label}
            {t.id === 'traiter' && urgents.length > 0 && (
              <span className="ml-1.5 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {urgents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PORTEFEUILLE ────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div>
          <ClientGroup
            title="Urgences" dotClass="bg-red-500"
            clients={urgents} expanded={expanded} onToggle={toggleExpand}
          />
          <ClientGroup
            title="À surveiller" dotClass="bg-amber-500"
            clients={attention} expanded={expanded} onToggle={toggleExpand}
          />
          <ClientGroup
            title="OK" dotClass="bg-emerald-500"
            clients={ok} expanded={expanded} onToggle={toggleExpand}
          />
          {clientStats.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-3">🏨</p>
              <p className="text-sm">Aucun client enregistré.</p>
              <Link href="/dashboard/clients" className="text-sm text-slate-600 underline mt-1 inline-block">
                Créer un client →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── À TRAITER ───────────────────────────────────────────────── */}
      {tab === 'traiter' && (
        <div className="space-y-3">
          {/* Alertes critiques */}
          {clientStats.filter(c => c.critiqueOuvertes > 0).map(c => (
            <div key={`crit-${c.id}`} className="bg-white border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">🚨 Critique</span>
                    <span className="font-semibold text-slate-900">{c.nom}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.critiqueOuvertes} alerte{c.critiqueOuvertes > 1 ? 's' : ''} critique{c.critiqueOuvertes > 1 ? 's' : ''} ouverte{c.critiqueOuvertes > 1 ? 's' : ''} · Dernière ronde : {relativeDate(c.lastRonde)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/dashboard/alertes" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700">
                    Voir alertes
                  </Link>
                  {waLink(c.whatsapp_patron) && (
                    <a href={waLink(c.whatsapp_patron)} target="_blank" rel="noopener noreferrer"
                      className="text-xs border border-green-600 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-50">
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Clients actifs sans activité >48h */}
          {clientStats.filter(c => c.actif && c.daysNoActivity > 2 && c.critiqueOuvertes === 0).map(c => (
            <div key={`inactive-${c.id}`} className="bg-white border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Inactif {Math.floor(c.daysNoActivity)}j
                    </span>
                    <span className="font-semibold text-slate-900">{c.nom}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Conformité 7j : {c.conformite7j}% · Score de santé : {c.score}/100
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/clients/${c.id}`}
                    className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50">
                    Voir →
                  </Link>
                  {waLink(c.whatsapp_patron) && (
                    <a href={waLink(c.whatsapp_patron)} target="_blank" rel="noopener noreferrer"
                      className="text-xs border border-green-600 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-50">
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {clientStats.filter(c => c.critiqueOuvertes > 0 || (c.actif && c.daysNoActivity > 2)).length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-sm">Aucune action requise pour le moment.</p>
              <p className="text-xs mt-1 text-gray-300">Tous les clients actifs ont eu une ronde ces 48 dernières heures.</p>
            </div>
          )}
        </div>
      )}

      {/* ── FINANCIER ───────────────────────────────────────────────── */}
      {tab === 'financier' && (
        <div>
          {/* MRR cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">MRR</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{mrr.toLocaleString('fr-FR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">FCFA / mois</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">ARR estimé</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{(mrr * 12).toLocaleString('fr-FR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">FCFA / an</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">Clients actifs</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{actifs.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">sur {clientStats.length} enregistrés</p>
            </div>
          </div>

          {/* Par plan */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Répartition par plan</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-gray-50 text-left">
                <tr>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Clients actifs</th>
                  <th className="px-5 py-3 text-right">MRR</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(mrrByPlan).sort().map(plan => (
                  <tr key={plan} className="border-t hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium capitalize">{plan}</td>
                    <td className="px-5 py-3 text-gray-600">{countByPlan[plan]}</td>
                    <td className="px-5 py-3 text-right">{mrrByPlan[plan].toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                ))}
                {Object.keys(mrrByPlan).length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-6 text-center text-gray-400">Aucun client actif.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Liste clients actifs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Clients actifs</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 bg-gray-50 text-left">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3 text-right">Prix mensuel</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-slate-900 hover:underline">
                        {c.nom}
                      </Link>
                      <span className="text-xs text-gray-400 ml-2">{c.ville}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{c.plan}</td>
                    <td className="px-5 py-3 text-right text-gray-800">
                      {(c.prix_mensuel || 0).toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RAPPORTS ────────────────────────────────────────────────── */}
      {tab === 'rapports' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Clients</h3>
            </div>
            <div className="divide-y">
              {clientStats.map(c => {
                const col = scoreColors(c.score);
                return (
                  <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`flex-shrink-0 w-10 text-center text-sm font-bold ${col.text}`}>{c.score}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{c.nom}</p>
                        <p className="text-xs text-gray-400">
                          {c.ville} · {c.sites.length} site{c.sites.length !== 1 ? 's' : ''} · Conf. 7j : {c.conformite7j}%
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="flex-shrink-0 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
                    >
                      Voir le client →
                    </Link>
                  </div>
                );
              })}
              {clientStats.length === 0 && (
                <p className="p-6 text-center text-gray-400">Aucun client.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
