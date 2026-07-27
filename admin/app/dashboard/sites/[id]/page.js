'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function SiteDetailPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [equipements, setEquipements] = useState([]);
  const [types, setTypes] = useState([]);
  const [cuves, setCuves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', type_id: '', ordre_ronde: 0, photo_requise: false });
  const [editingCuve, setEditingCuve] = useState(null);
  const [showCuveForm, setShowCuveForm] = useState(false);
  const [cuveForm, setCuveForm] = useState({ nom: '', capacite_litres: '', seuil_alerte_litres: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: siteData }, { data: equipData }, { data: typesData }, { data: cuvesData }] = await Promise.all([
      supabase.from('sites').select('*, clients(nom)').eq('id', id).single(),
      supabase.from('equipements').select('*, types_equipements(nom)').eq('site_id', id).order('ordre_ronde'),
      supabase.from('types_equipements').select('*'),
      supabase.from('cuves').select('*').eq('site_id', id),
    ]);
    setSite(siteData);
    setEquipements(equipData || []);
    setTypes(typesData || []);
    setCuves(cuvesData || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function createEquipement(e) {
    e.preventDefault();
    const { data: eq } = await supabase
      .from('equipements')
      .insert({ ...form, site_id: id, type_id: form.type_id || null })
      .select()
      .single();

    if (eq && form.type_id) {
      const { data: modele } = await supabase
        .from('modeles_questions')
        .select('*, modeles_questions_items(*)')
        .eq('type_id', form.type_id)
        .single();
      if (modele?.modeles_questions_items?.length) {
        const rows = modele.modeles_questions_items.map((item) => ({
          equipement_id: eq.id,
          texte: item.texte,
          type_reponse: item.type_reponse,
          unite: item.unite,
          ordre: item.ordre,
          frequences: item.frequences,
          seuil_min: item.seuil_min,
          seuil_max: item.seuil_max,
        }));
        await supabase.from('questions').insert(rows);
      }
    }

    setForm({ nom: '', type_id: '', ordre_ronde: 0, photo_requise: false });
    setShowForm(false);
    load();
  }

  async function toggleEquipActif(eq) {
    await supabase.from('equipements').update({ actif: !eq.actif }).eq('id', eq.id);
    load();
  }

  async function saveCuve(e) {
    e.preventDefault();
    const payload = {
      nom: cuveForm.nom,
      capacite_litres: Number(cuveForm.capacite_litres),
      seuil_alerte_litres: Number(cuveForm.seuil_alerte_litres),
    };
    if (editingCuve) {
      await supabase.from('cuves').update(payload).eq('id', editingCuve.id);
    } else {
      await supabase.from('cuves').insert({ ...payload, site_id: id });
    }
    setEditingCuve(null);
    setShowCuveForm(false);
    setCuveForm({ nom: '', capacite_litres: '', seuil_alerte_litres: '' });
    load();
  }

  function startEditCuve(c) {
    setEditingCuve(c);
    setCuveForm({ nom: c.nom, capacite_litres: c.capacite_litres, seuil_alerte_litres: c.seuil_alerte_litres });
    setShowCuveForm(true);
  }

  function cancelCuve() {
    setEditingCuve(null);
    setShowCuveForm(false);
    setCuveForm({ nom: '', capacite_litres: '', seuil_alerte_litres: '' });
  }

  if (loading || !site) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/clients/${site.client_id}`} className="text-sm text-slate-500 hover:underline">
          &larr; {site.clients?.nom}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">{site.nom}</h1>
      </div>

      {/* ── Équipements ─────────────────────────────────────────────────── */}
      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Équipements ({equipements.length})</h2>
          <button
            onClick={() => setShowForm((s) => !s)}
            className={`text-sm px-4 py-2 rounded-md font-medium ${showForm ? 'bg-gray-200 text-gray-700' : 'bg-slate-900 text-white'}`}
          >
            {showForm ? 'Annuler' : '+ Ajouter un équipement'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createEquipement} className="grid grid-cols-2 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Nom de l'équipement (ex: GE Principal)"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm col-span-2"
            />
            <select
              value={form.type_id}
              onChange={(e) => setForm({ ...form, type_id: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Type d'équipement</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
            <input
              placeholder="Ordre dans la ronde"
              type="number"
              value={form.ordre_ronde}
              onChange={(e) => setForm({ ...form, ordre_ronde: Number(e.target.value) })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm col-span-2">
              <input
                type="checkbox"
                checked={form.photo_requise}
                onChange={(e) => setForm({ ...form, photo_requise: e.target.checked })}
              /> Photo requise
            </label>
            {form.type_id && (
              <p className="col-span-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                ✓ Les questions du modèle seront ajoutées automatiquement à la création.
              </p>
            )}
            <button className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
              Créer l'équipement
            </button>
          </form>
        )}

        <div className="divide-y">
          {equipements.map((eq) => (
            <div key={eq.id} className="py-3 flex items-center justify-between">
              <div>
                <Link href={`/dashboard/equipements/${eq.id}`} className="font-medium text-blue-600 hover:underline">
                  {eq.nom} <span className="text-xs">→ questions</span>
                </Link>
                <p className="text-xs text-gray-500">{eq.types_equipements?.nom || 'Sans type'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${eq.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {eq.actif ? 'Actif' : 'Inactif'}
                </span>
                <button onClick={() => toggleEquipActif(eq)} className="text-xs text-slate-600 hover:underline">
                  {eq.actif ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>
          ))}
          {equipements.length === 0 && (
            <p className="text-gray-400 text-sm py-4">Aucun équipement. Clique sur le bouton pour en ajouter.</p>
          )}
        </div>
      </section>

      {/* ── Cuves ───────────────────────────────────────────────────────── */}
      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Cuves ({cuves.length})</h2>
          <button
            onClick={() => { cancelCuve(); setShowCuveForm((s) => !s); }}
            className={`text-sm px-4 py-2 rounded-md font-medium ${showCuveForm && !editingCuve ? 'bg-gray-200 text-gray-700' : 'bg-slate-900 text-white'}`}
          >
            {showCuveForm && !editingCuve ? 'Annuler' : '+ Ajouter une cuve'}
          </button>
        </div>

        {showCuveForm && (
          <form onSubmit={saveCuve} className="grid grid-cols-3 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Nom (ex: Cuve principale)"
              value={cuveForm.nom}
              onChange={(e) => setCuveForm({ ...cuveForm, nom: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Capacité (L)"
              type="number"
              value={cuveForm.capacite_litres}
              onChange={(e) => setCuveForm({ ...cuveForm, capacite_litres: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Seuil alerte (L)"
              type="number"
              value={cuveForm.seuil_alerte_litres}
              onChange={(e) => setCuveForm({ ...cuveForm, seuil_alerte_litres: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <div className="col-span-3 flex gap-2">
              <button className="flex-1 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
                {editingCuve ? 'Enregistrer' : 'Créer la cuve'}
              </button>
              {editingCuve && (
                <button type="button" onClick={cancelCuve} className="px-4 py-2 text-sm border rounded-md text-gray-600">
                  Annuler
                </button>
              )}
            </div>
          </form>
        )}

        <div className="divide-y">
          {cuves.map((c) => (
            <div key={c.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-slate-900">{c.nom}</span>
                <span className="text-gray-500 ml-3">{c.capacite_litres} L · seuil alerte {c.seuil_alerte_litres} L</span>
              </div>
              <button onClick={() => startEditCuve(c)} className="text-xs text-blue-600 hover:underline">
                Modifier
              </button>
            </div>
          ))}
          {cuves.length === 0 && <p className="text-gray-400 text-sm py-4">Aucune cuve pour ce site.</p>}
        </div>
      </section>
    </div>
  );
}
