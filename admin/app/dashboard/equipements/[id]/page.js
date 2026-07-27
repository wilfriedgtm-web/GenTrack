'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

const freqOptions = ['journalier', 'hebdo', 'mensuel'];
const typeOptions = ['numerique', 'texte', 'oui_non', 'photo'];

export default function EquipementDetailPage() {
  const { id } = useParams();
  const [equipement, setEquipement] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    texte: '',
    type_reponse: 'numerique',
    unite: '',
    ordre: 0,
    frequences: ['journalier'],
    seuil_min: '',
    seuil_max: '',
  });
  const [applyingTemplateId, setApplyingTemplateId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: eqData }, { data: qData }] = await Promise.all([
      supabase
        .from('equipements')
        .select('*, sites(nom, client_id, clients(nom)), types_equipements(id, nom)')
        .eq('id', id)
        .single(),
      supabase.from('questions').select('*').eq('equipement_id', id).order('ordre'),
    ]);
    setEquipement(eqData);
    setQuestions(qData || []);
    if (eqData?.types_equipements?.id) {
      const { data: tData } = await supabase
        .from('modeles_questions')
        .select('*, modeles_questions_items(*)')
        .eq('type_id', eqData.types_equipements.id);
      setTemplates(tData || []);
    } else {
      setTemplates([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFreq(f) {
    setForm((prev) => ({
      ...prev,
      frequences: prev.frequences.includes(f) ? prev.frequences.filter((x) => x !== f) : [...prev.frequences, f],
    }));
  }

  async function createQuestion(e) {
    e.preventDefault();
    await supabase.from('questions').insert({
      ...form,
      equipement_id: id,
      seuil_min: form.seuil_min === '' ? null : Number(form.seuil_min),
      seuil_max: form.seuil_max === '' ? null : Number(form.seuil_max),
    });
    setForm({ texte: '', type_reponse: 'numerique', unite: '', ordre: 0, frequences: ['journalier'], seuil_min: '', seuil_max: '' });
    setShowForm(false);
    load();
  }

  async function updateQuestionFreq(q, f) {
    const newFreqs = q.frequences.includes(f) ? q.frequences.filter((x) => x !== f) : [...q.frequences, f];
    await supabase.from('questions').update({ frequences: newFreqs }).eq('id', q.id);
    load();
  }

  async function toggleQuestionActif(q) {
    await supabase.from('questions').update({ actif: !q.actif }).eq('id', q.id);
    load();
  }

  async function deleteQuestion(q) {
    if (!confirm('Supprimer cette question ?')) return;
    await supabase.from('questions').delete().eq('id', q.id);
    load();
  }

  async function applyTemplate() {
    if (!applyingTemplateId) return;
    const tpl = templates.find((t) => t.id === applyingTemplateId);
    if (!tpl || !tpl.modeles_questions_items?.length) return;
    const rows = tpl.modeles_questions_items.map((item) => ({
      equipement_id: id,
      texte: item.texte,
      type_reponse: item.type_reponse,
      unite: item.unite,
      ordre: item.ordre,
      frequences: item.frequences,
      seuil_min: item.seuil_min,
      seuil_max: item.seuil_max,
    }));
    await supabase.from('questions').insert(rows);
    setApplyingTemplateId('');
    load();
  }

  if (loading || !equipement) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/sites/${equipement.site_id}`} className="text-sm text-slate-500 hover:underline">
          &larr; {equipement.sites?.nom}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">{equipement.nom}</h1>
        <p className="text-sm text-gray-500">
          {equipement.sites?.clients?.nom} · {equipement.types_equipements?.nom || 'Sans type'}
        </p>
      </div>

      {templates.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-amber-800">Appliquer un modèle de questions ({equipement.types_equipements?.nom}) :</span>
          <select
            value={applyingTemplateId}
            onChange={(e) => setApplyingTemplateId(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Choisir un modèle</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom} ({t.modeles_questions_items?.length || 0} questions)
              </option>
            ))}
          </select>
          <button
            onClick={applyTemplate}
            disabled={!applyingTemplateId}
            className="bg-amber-600 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-40"
          >
            Appliquer
          </button>
        </section>
      )}

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Questions ({questions.length})</h2>
          <button onClick={() => setShowForm((s) => !s)} className="text-sm text-slate-600 hover:underline">
            {showForm ? 'Annuler' : '+ Ajouter une question'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createQuestion} className="grid grid-cols-2 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Texte de la question"
              value={form.texte}
              onChange={(e) => setForm({ ...form, texte: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm col-span-2"
            />
            <select
              value={form.type_reponse}
              onChange={(e) => setForm({ ...form, type_reponse: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="Unité (L, h, °C...)"
              value={form.unite}
              onChange={(e) => setForm({ ...form, unite: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Seuil min"
              type="number"
              value={form.seuil_min}
              onChange={(e) => setForm({ ...form, seuil_min: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Seuil max"
              type="number"
              value={form.seuil_max}
              onChange={(e) => setForm({ ...form, seuil_max: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <div className="col-span-2 flex gap-4 text-sm">
              {freqOptions.map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input type="checkbox" checked={form.frequences.includes(f)} onChange={() => toggleFreq(f)} /> {f}
                </label>
              ))}
            </div>
            <button className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Créer la question</button>
          </form>
        )}

        <div className="divide-y">
          {questions.map((q) => (
            <div key={q.id} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900 text-sm">{q.texte}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {q.type_reponse}
                    {q.unite ? ` · ${q.unite}` : ''}
                    {q.seuil_min !== null || q.seuil_max !== null ? ` · seuils ${q.seuil_min ?? '–'} / ${q.seuil_max ?? '–'}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${q.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {q.actif ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => toggleQuestionActif(q)} className="text-xs text-slate-600 hover:underline">
                    {q.actif ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => deleteQuestion(q)} className="text-xs text-red-600 hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {freqOptions.map((f) => (
                  <button
                    key={f}
                    onClick={() => updateQuestionFreq(q, f)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      q.frequences.includes(f) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="text-gray-400 text-sm py-4">Aucune question pour cet équipement.</p>}
        </div>
      </section>
    </div>
  );
}
