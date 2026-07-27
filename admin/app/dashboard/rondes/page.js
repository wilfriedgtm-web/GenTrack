'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function RondesPage() {
  const [rondes, setRondes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rondes')
      .select('*, sites(nom, clients(nom)), contacts(nom)')
      .order('date_ronde', { ascending: false })
      .limit(100);
    setRondes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openRonde(id) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id]) {
      const { data } = await supabase
        .from('rondes_equipements')
        .select('*, equipements(nom), reponses(*, questions(texte, unite))')
        .eq('ronde_id', id);
      setDetails((d) => ({ ...d, [id]: data || [] }));
    }
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Rondes</h1>
      <div className="bg-white border rounded-xl divide-y">
        {rondes.map((r) => (
          <div key={r.id} className="p-4">
            <button onClick={() => openRonde(r.id)} className="w-full flex items-center justify-between text-left">
              <div>
                <span className="font-medium text-slate-900">
                  {r.sites?.clients?.nom} · {r.sites?.nom}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {r.date_ronde} · {r.frequence}
                </span>
              </div>
              <span className="text-xs text-gray-500">{r.contacts?.nom || 'Technicien non assigné'}</span>
            </button>
            {openId === r.id && (
              <div className="mt-3 border-t pt-3 space-y-3">
                {(details[r.id] || []).map((re) => (
                  <div key={re.id}>
                    <p className="text-sm font-medium text-slate-800">
                      {re.equipements?.nom} <span className="text-xs text-gray-400">({re.statut})</span>
                    </p>
                    <ul className="text-xs text-gray-600 ml-4 list-disc">
                      {(re.reponses || []).map((rep) => (
                        <li key={rep.id}>
                          {rep.questions?.texte}: {rep.valeur}
                          {rep.questions?.unite ? ` ${rep.questions.unite}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {(details[r.id] || []).length === 0 && <p className="text-xs text-gray-400">Aucun équipement enregistré.</p>}
              </div>
            )}
          </div>
        ))}
        {rondes.length === 0 && <p className="p-6 text-center text-gray-400">Aucune ronde pour l'instant.</p>}
      </div>
    </div>
  );
}
