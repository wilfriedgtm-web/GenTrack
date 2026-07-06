import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPA_URL = 'https://zbpoxjlkqxnqjzxohasq.supabase.co'
const SUPA_KEY = Deno.env.get('SUPA_KEY') || ''
const TWILIO_SID = Deno.env.get('TWILIO_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_TOKEN') || ''
const TWILIO_NUMBER = Deno.env.get('TWILIO_NUMBER') || 'whatsapp:+19843418695'

async function db(table: string, opts: any = {}) {
  const url = `${SUPA_URL}/rest/v1/${table}?${opts.query || ''}`
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.method === 'POST' ? 'return=representation' : ''
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  return res.json()
}

async function sendWA(to: string, body: string) {
  const phone = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ From: TWILIO_NUMBER, To: phone, Body: body }).toString()
    }
  )
  const data = await res.json()
  console.log(`Rappel envoyé à ${to}: ${data.sid || data.message}`)
  return data
}

serve(async (req) => {
  try {
    // Récupérer tous les clients actifs
    const clients = await db('clients', { query: '&actif=eq.true' })
    if (!Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ message: 'Aucun client actif' }), { status: 200 })
    }

    const today = new Date().toISOString().split('T')[0]
    let envoyes = 0

    for (const client of clients) {
      if (!client.whatsapp_gardien) continue

      // Vérifier si une saisie a déjà été faite aujourd'hui
      const saisies = await db('saisies', {
        query: `&client_id=eq.${client.id}&date=eq.${today}`
      })

      // Si pas encore de saisie aujourd'hui → envoyer le rappel
      if (!Array.isArray(saisies) || saisies.length === 0) {
        const phone = client.whatsapp_gardien
        await sendWA(phone,
          `Bonjour ! 👋\n\nN'oubliez pas votre saisie du jour pour *${client.nom}*.\n\nEnvoyez *saisie* pour enregistrer les données de votre groupe. 🔧\n\n_GenTrack — Suivi groupe électrogène_`
        )
        envoyes++
        // Petite pause pour éviter de saturer l'API Twilio
        await new Promise(r => setTimeout(r, 500))
      }
    }

    console.log(`Rappels envoyés : ${envoyes}/${clients.length} clients`)
    return new Response(JSON.stringify({ success: true, envoyes, total: clients.length }), { status: 200 })

  } catch (err) {
    console.error('Erreur rappel:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
