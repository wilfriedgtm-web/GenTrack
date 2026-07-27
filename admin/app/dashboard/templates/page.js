'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const freqOptions = ['journalier', 'hebdo', 'mensuel'];
const typeOptions = ['numerique', 'texte', 'oui_non', 'photo'];

export default function TemplatesPage() {
  const [types, setTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTplForm, setShowTplForm] = useState(false);
  const [tplForm, setTplForm] = useState({ nom: '', type_id: '', description: '' });
  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [itemForm, setItemForm] = useState({
    texte: '',
    type_reponse: 'numerique',
    unite: '',
    ordre: 0,
    frequences: ['journalier'],
    seuil_min: '',
    seuil_max: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: typesData }, { data: tplData }] = await Promise.all([
      supabase.from('types_equipements').select('*'),
      supabase.from('modeles_questions').select('*, modeles_questions_items(*), types_equipements(nom)').order('nom'),
    ]);
    setTypes(typesData || []);
    setTemplates(tplData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTemplate(e) {
    e.preventDefault();
    await supabase.from('modeles_questions').insert({ ...tplForm, type_id: tplForm.type_id || null });
    setTplForm({ nom: '', type_id: '', description: '' });
    setShowTplForm(false);
    load();
  }

  async function deleteTemplate(t) {
    if (!confirm(`Supprimer le modèle "${t.nom}" ?`)) return;
    await supabase.from('modeles_questions').delete().eq('id', t.id);
    load();
  }

  function toggleItemFreq(f) {
    setItemForm((prev) => ({
      ...prev,
      frequences: prev.frequences.includes(f) ? prev.frequences.filter((x) => x !== f) : [...prev.frequences, f],
    }));
  }

  async function addItem(templateId) {
    if (!itemForm.texte) return;
    await supabase.from('modeles_questions_items').insert({
      modele_id: templateId,
      ...itemForm,
      seuil_min: itemForm.seuil_min === '' ? null : Number(itemForm.seuil_min),
      seuil_max: itemForm.seuil_max === '' ? null : Number(itemForm.seuil_max),
    });
    setItemForm({ texte: '', type_reponse: 'numerique', unite: '', ordre: 0, frequences: ['journalier'], seuil_min: '', seuil_max: '' });
    load();
  }

  async function deleteItem(itemId) {
    await supabase.from('modeles_questions_items').delete().eq('id', itemId);
    load();
  }

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Modèles de questions</h1>
        <button onClick={() => setShowTplForm((s) => !s)} className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
          {showTplForm ? 'Annuler' : '+ Nouveau modèle'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Crée un modèle par type d'équipement (ex: Groupe électrogène) avec une liste de questions standard. Ensuite,
        applique-le en 1 clic depuis la page d'un équipement.
      </p>

      {showTplForm && (
        <form onSubmit={createTemplate} className="bg-white border rounded-xl p-5 grid grid-cols-2 gap-3">
          <input
            required
            placeholder="Nom du modèle"
            value={tplForm.nom}
            onChange={(e) => setTplForm({ ...tplForm, nom: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={tplForm.type_id}
            onChange={(e) => setTplForm({ ...tplForm, type_id: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="">Type d'équipement</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
          <input
            placeholder="Description (optionnel)"
            value={tplForm.description}
            onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm col-span-2"
          />
          <button className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Créer le modèle</button>
        </form>
      )}

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">{t.nom}</h3>
                <p className="text-xs text-gray-500">
                  {t.types_equipements?.nom || 'Tous types'} · {t.modeles_questions_items?.length || 0} questions
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setOpenTemplateId(openTemplateId === t.id ? null : t.id)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  {openTemplateId === t.id ? 'Fermer' : 'Gérer les questions'}
                </button>
                <button onClick={() => deleteTemplate(t)} className="text-sm text-red-600 hover:underline">
                  Supprimer
                </button>
              </div>
            </div>

            {openTemplateId === t.id && (
              <div className="mt-4 border-t pt-4">
                <div className="divide-y mb-4">
                  {t.modeles_questions_items?.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{item.texte}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {item.type_reponse}
                          {item.unite ? ` · ${item.unite}` : ''} · {item.frequences?.join(', ')}
                        </span>
                      </div>
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-red-600 hover:underline">
                        Retirer
                      </button>
                    </div>
                  ))}
                  {(!t.modeles_questions_items || t.modeles_questions_items.length === 0) && (
                    <p className="text-gray-400 text-sm py-2">Aucune question dans ce modèle.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-gray-50">
                  <input
                    placeholder="Texte de la question"
                    value={itemForm.texte}
                    onChange={(e) => setItemForm({ ...itemForm, texte: e.target.value })}
                    className="border rounded-md px-3 py-2 text-sm col-span-2"
                  />
                  <select
                    value={itemForm.type_reponse}
                    onChange={(e) => setItemForm({ ...itemForm, type_reponse: e.target.value })}
                    className="border rounded-md px-3 py-2 text-sm"
                  >
                    {typeOptions.map((ty) => (
                      <option key={ty} value={ty}>
                        {ty}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Unité"
                    value={itemForm.unite}
                    onChange={(e) => setItemForm({ ...itemForm, unite: e.target.value })}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Seuil min"
                    type="number"
                    value={itemForm.seuil_min}
                    onChange={(e) => setItemForm({ ...itemForm, seuil_min: e.target.value })}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Seuil max"
                    type="number"
                    value={itemForm.seuil_max}
                    onChange={(e) => setItemForm({ ...itemForm, seuil_max: e.target.value })}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                  <div className="col-span-2 flex gap-4 text-sm">
                    {freqOptions.map((f) => (
                      <label key={f} className="flex items-center gap-2">
                        <input type="checkbox" checked={itemForm.frequences.includes(f)} onChange={() => toggleItemFreq(f)} /> {f}
                      </label>
                    ))}
                  </div>
                  <button onClick={() => addItem(t.id)} className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
                    Ajouter la question au modèle
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && <p className="text-gray-400 text-sm">Aucun modèle créé pour l'instant.</p>}
      </div>
    </div>
  );
}
