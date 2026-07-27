'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [clients, sites, equipements, alertes] = await Promise.all([
        supabase.from('clients').select('id, actif'),
        supabase.from('sites').select('id, actif, journalier_actif, hebdo_actif, mensuel_actif'),
        supabase.from('equipements').select('id, actif'),
        supabase.from('alertes').select('id, resolue'),
      ]);
      setStats({
        clients: clients.data || [],
        sites: sites.data || [],
        equipements: equipements.data || [],
        alertes: alertes.data || [],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) return <p className="text-gray-500">Chargement...</p>;

  const alertesOuvertes = stats.alertes.filter((a) => !a.resolue).length;

  const cards = [
    {
      label: 'Clients actifs',
      value: stats.clients.filter((c) => c.actif).length,
      total: stats.clients.length,
      href: '/dashboard/clients',
    },
    { label: 'Sites', value: stats.sites.length, href: '/dashboard/clients' },
    {
      label: 'Équipements actifs',
      value: stats.equipements.filter((e) => e.actif).length,
      total: stats.equipements.length,
      href: '/dashboard/clients',
    },
    {
      label: 'Alertes ouvertes',
      value: alertesOuvertes,
      href: '/dashboard/alertes',
      alert: alertesOuvertes > 0,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Vue d'ensemble</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`block rounded-xl border p-5 bg-white hover:shadow-md transition ${
              c.alert ? 'border-red-300' : 'border-gray-200'
            }`}
          >
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${c.alert ? 'text-red-600' : 'text-slate-900'}`}>
              {c.value}
              {c.total !== undefined ? ` / ${c.total}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
