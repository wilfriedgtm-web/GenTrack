'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AlertesPage() {
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ouvertes');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('alertes')
      .select('*, clients(nom), groupes(nom)')
      .order('created_at', { ascending: false })
      .limit(200);
    setAlertes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(a) {
    await supabase.from('alertes').update({ resolue: true }).eq('id', a.id);
    load();
  }

  const shown = filter === 'ouvertes' ? alertes.filter((a) => !a.resolue) : alertes;

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Alertes</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="ouvertes">Ouvertes</option>
          <option value="toutes">Toutes</option>
        </select>
      </div>
      <div className="bg-white border rounded-xl divide-y">
        {shown.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    a.severite === 'critique' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {a.severite}
                </span>
                <span className="font-medium text-slate-900 text-sm">
                  {a.clients?.nom}
                  {a.groupes?.nom ? ` · ${a.groupes.nom}` : ''}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{a.message}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString('fr-FR')}</p>
            </div>
            {!a.resolue ? (
              <button onClick={() => resolve(a)} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-md">
                Marquer résolue
              </button>
            ) : (
              <span className="text-xs text-green-600">Résolue</span>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="p-6 text-center text-gray-400">Aucune alerte.</p>}
      </div>
    </div>
  );
}
