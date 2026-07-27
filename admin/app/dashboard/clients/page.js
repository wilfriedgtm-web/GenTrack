'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

const emptyForm = {
  nom: '',
  type: 'hotel',
  ville: 'Dakar',
  pays: '',
  groupe_hotelier: '',
  nb_chambres: '',
  telephone_patron: '',
  whatsapp_patron: '',
  whatsapp_gardien: '',
  plan: 'business',
  prix_mensuel: 20000,
  prix_litre_fcfa: 695,
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('nom');
    setClients(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createClient(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      nb_chambres: form.nb_chambres ? Number(form.nb_chambres) : null,
      prix_mensuel: Number(form.prix_mensuel),
      prix_litre_fcfa: Number(form.prix_litre_fcfa),
    };
    const { error } = await supabase.from('clients').insert(payload);
    setSaving(false);
    if (!error) {
      setForm(emptyForm);
      setShowForm(false);
      load();
    }
  }

  async function toggleActif(client) {
    await supabase.from('clients').update({ actif: !client.actif }).eq('id', client.id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
        <button onClick={() => setShowForm((s) => !s)} className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
          {showForm ? 'Annuler' : '+ Nouveau client'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createClient} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Nom de l'hôtel"
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm col-span-2"
          />
          <input
            placeholder="Groupe hôtelier"
            value={form.groupe_hotelier}
            onChange={(e) => setForm({ ...form, groupe_hotelier: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Ville"
            value={form.ville}
            onChange={(e) => setForm({ ...form, ville: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Pays"
            value={form.pays}
            onChange={(e) => setForm({ ...form, pays: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Nb chambres"
            type="number"
            value={form.nb_chambres}
            onChange={(e) => setForm({ ...form, nb_chambres: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Téléphone patron"
            value={form.telephone_patron}
            onChange={(e) => setForm({ ...form, telephone_patron: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="WhatsApp patron"
            value={form.whatsapp_patron}
            onChange={(e) => setForm({ ...form, whatsapp_patron: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="WhatsApp gardien"
            value={form.whatsapp_gardien}
            onChange={(e) => setForm({ ...form, whatsapp_gardien: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="business">Business</option>
            <option value="premium">Premium</option>
            <option value="starter">Starter</option>
          </select>
          <input
            placeholder="Prix mensuel (FCFA)"
            type="number"
            value={form.prix_mensuel}
            onChange={(e) => setForm({ ...form, prix_mensuel: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Prix litre (FCFA)"
            type="number"
            value={form.prix_litre_fcfa}
            onChange={(e) => setForm({ ...form, prix_litre_fcfa: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <button disabled={saving} className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">
            {saving ? 'Création...' : 'Créer le client'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/clients/${c.id}`} className="text-slate-900 font-medium hover:underline">
                      {c.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.ville}</td>
                  <td className="px-4 py-3 text-gray-600">{c.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${c.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleActif(c)} className="text-xs text-slate-600 hover:underline">
                      {c.actif ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Aucun client
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
