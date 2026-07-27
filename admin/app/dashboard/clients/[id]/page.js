'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

const contactRoles = ['dir_ops', 'dir_tech', 'resp_tech', 'technicien'];

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [sites, setSites] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [gardiens, setGardiens] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteForm, setSiteForm] = useState({
    nom: '',
    ville: '',
    pays: '',
    journalier_actif: true,
    hebdo_actif: false,
    mensuel_actif: false,
  });

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ nom: '', role: 'resp_tech', whatsapp: '', email: '', site_id: '' });

  const [showGardienForm, setShowGardienForm] = useState(false);
  const [gardienForm, setGardienForm] = useState({ nom: '', whatsapp: '', metier: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: clientData }, { data: sitesData }, { data: contactsData }, { data: gardiensData }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('sites').select('*').eq('client_id', id).order('nom'),
      supabase.from('contacts').select('*').eq('client_id', id).order('nom'),
      supabase.from('gardiens').select('*').eq('client_id', id).order('nom'),
    ]);
    setClient(clientData);
    setSites(sitesData || []);
    setContacts(contactsData || []);
    setGardiens(gardiensData || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveClientField(field, value) {
    setClient((c) => ({ ...c, [field]: value }));
    await supabase.from('clients').update({ [field]: value }).eq('id', id);
  }

  async function createSite(e) {
    e.preventDefault();
    await supabase.from('sites').insert({ ...siteForm, client_id: id });
    setSiteForm({ nom: '', ville: '', pays: '', journalier_actif: true, hebdo_actif: false, mensuel_actif: false });
    setShowSiteForm(false);
    load();
  }

  async function toggleSiteFreq(site, field) {
    await supabase.from('sites').update({ [field]: !site[field] }).eq('id', site.id);
    load();
  }

  async function createContact(e) {
    e.preventDefault();
    await supabase.from('contacts').insert({ ...contactForm, client_id: id, site_id: contactForm.site_id || null });
    setContactForm({ nom: '', role: 'resp_tech', whatsapp: '', email: '', site_id: '' });
    setShowContactForm(false);
    load();
  }

  async function createGardien(e) {
    e.preventDefault();
    await supabase.from('gardiens').insert({ ...gardienForm, client_id: id });
    setGardienForm({ nom: '', whatsapp: '', metier: '' });
    setShowGardienForm(false);
    load();
  }

  async function deleteClient() {
    if (!confirm('Supprimer ce client et toutes ses données liées ?')) return;
    await supabase.from('clients').delete().eq('id', id);
    router.replace('/dashboard/clients');
  }

  if (loading || !client) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/clients" className="text-sm text-slate-500 hover:underline">
          &larr; Clients
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-semibold text-slate-900">{client.nom}</h1>
          <button onClick={deleteClient} className="text-xs text-red-600 hover:underline">
            Supprimer le client
          </button>
        </div>
      </div>

      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-medium text-slate-900 mb-4">Informations générales</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Field label="Nom" value={client.nom} onSave={(v) => saveClientField('nom', v)} />
          <Field label="Groupe hôtelier" value={client.groupe_hotelier} onSave={(v) => saveClientField('groupe_hotelier', v)} />
          <Field label="Ville" value={client.ville} onSave={(v) => saveClientField('ville', v)} />
          <Field label="Pays" value={client.pays} onSave={(v) => saveClientField('pays', v)} />
          <Field label="Nb chambres" value={client.nb_chambres} onSave={(v) => saveClientField('nb_chambres', v ? Number(v) : null)} />
          <Field label="Téléphone patron" value={client.telephone_patron} onSave={(v) => saveClientField('telephone_patron', v)} />
          <Field label="WhatsApp patron" value={client.whatsapp_patron} onSave={(v) => saveClientField('whatsapp_patron', v)} />
          <Field label="WhatsApp gardien" value={client.whatsapp_gardien} onSave={(v) => saveClientField('whatsapp_gardien', v)} />
          <Field label="Prix mensuel (FCFA)" value={client.prix_mensuel} onSave={(v) => saveClientField('prix_mensuel', Number(v))} />
        </div>
      </section>

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Sites ({sites.length})</h2>
          <button onClick={() => setShowSiteForm((s) => !s)} className="text-sm text-slate-600 hover:underline">
            {showSiteForm ? 'Annuler' : '+ Ajouter un site'}
          </button>
        </div>

        {showSiteForm && (
          <form onSubmit={createSite} className="grid grid-cols-2 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Nom du site"
              value={siteForm.nom}
              onChange={(e) => setSiteForm({ ...siteForm, nom: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Ville"
              value={siteForm.ville}
              onChange={(e) => setSiteForm({ ...siteForm, ville: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Pays"
              value={siteForm.pays}
              onChange={(e) => setSiteForm({ ...siteForm, pays: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm col-span-2"
            />
            <div className="col-span-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={siteForm.journalier_actif}
                  onChange={(e) => setSiteForm({ ...siteForm, journalier_actif: e.target.checked })}
                />{' '}
                Journalier
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={siteForm.hebdo_actif}
                  onChange={(e) => setSiteForm({ ...siteForm, hebdo_actif: e.target.checked })}
                />{' '}
                Hebdo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={siteForm.mensuel_actif}
                  onChange={(e) => setSiteForm({ ...siteForm, mensuel_actif: e.target.checked })}
                />{' '}
                Mensuel
              </label>
            </div>
            <button className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Créer le site</button>
          </form>
        )}

        <div className="divide-y">
          {sites.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <Link href={`/dashboard/sites/${s.id}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                  {s.nom} <span className="text-xs">→ équipements</span>
                </Link>
                <p className="text-xs text-gray-500">
                  {s.ville}
                  {s.pays ? `, ${s.pays}` : ''}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <FreqPill active={s.journalier_actif} label="Journalier" onClick={() => toggleSiteFreq(s, 'journalier_actif')} />
                <FreqPill active={s.hebdo_actif} label="Hebdo" onClick={() => toggleSiteFreq(s, 'hebdo_actif')} />
                <FreqPill active={s.mensuel_actif} label="Mensuel" onClick={() => toggleSiteFreq(s, 'mensuel_actif')} />
              </div>
            </div>
          ))}
          {sites.length === 0 && <p className="text-gray-400 text-sm py-4">Aucun site pour ce client.</p>}
        </div>
      </section>

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Contacts ({contacts.length})</h2>
          <button onClick={() => setShowContactForm((s) => !s)} className="text-sm text-slate-600 hover:underline">
            {showContactForm ? 'Annuler' : '+ Ajouter un contact'}
          </button>
        </div>
        {showContactForm && (
          <form onSubmit={createContact} className="grid grid-cols-2 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Nom"
              value={contactForm.nom}
              onChange={(e) => setContactForm({ ...contactForm, nom: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <select
              value={contactForm.role}
              onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {contactRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              placeholder="WhatsApp"
              value={contactForm.whatsapp}
              onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <select
              value={contactForm.site_id}
              onChange={(e) => setContactForm({ ...contactForm, site_id: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm col-span-2"
            >
              <option value="">Tous les sites du client</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
            <button className="col-span-2 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Ajouter</button>
          </form>
        )}
        <div className="divide-y">
          {contacts.map((c) => (
            <div key={c.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-slate-900">{c.nom}</span>
                <span className="text-gray-400 ml-2">{c.role}</span>
              </div>
              <span className="text-gray-500">{c.whatsapp || c.email}</span>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-gray-400 text-sm py-4">Aucun contact.</p>}
        </div>
      </section>

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-900">Gardiens ({gardiens.length})</h2>
          <button onClick={() => setShowGardienForm((s) => !s)} className="text-sm text-slate-600 hover:underline">
            {showGardienForm ? 'Annuler' : '+ Ajouter un gardien'}
          </button>
        </div>
        {showGardienForm && (
          <form onSubmit={createGardien} className="grid grid-cols-3 gap-3 mb-5 border rounded-lg p-4 bg-gray-50">
            <input
              required
              placeholder="Nom"
              value={gardienForm.nom}
              onChange={(e) => setGardienForm({ ...gardienForm, nom: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="WhatsApp"
              value={gardienForm.whatsapp}
              onChange={(e) => setGardienForm({ ...gardienForm, whatsapp: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Métier"
              value={gardienForm.metier}
              onChange={(e) => setGardienForm({ ...gardienForm, metier: e.target.value })}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <button className="col-span-3 bg-slate-900 text-white text-sm px-4 py-2 rounded-md">Ajouter</button>
          </form>
        )}
        <div className="divide-y">
          {gardiens.map((g) => (
            <div key={g.id} className="py-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">{g.nom}</span>
              <span className="text-gray-500">
                {g.whatsapp} {g.metier ? `· ${g.metier}` : ''}
              </span>
            </div>
          ))}
          {gardiens.length === 0 && <p className="text-gray-400 text-sm py-4">Aucun gardien.</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onSave }) {
  const [val, setVal] = useState(value ?? '');
  useEffect(() => {
    setVal(value ?? '');
  }, [value]);
  return (
    <div>
      <label className="block text-gray-500 text-xs mb-1">{label}</label>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val !== (value ?? '')) onSave(val);
        }}
        className="w-full border rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}

function FreqPill({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full border ${
        active ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}
    >
      {label}
    </button>
  );
}
