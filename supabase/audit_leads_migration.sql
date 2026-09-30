-- Migration : table audit_leads
-- Exécuter dans l'éditeur SQL Supabase (supabase.com → SQL Editor)

create table if not exists public.audit_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),

  -- Contact
  email         text not null,
  phone         text,

  -- Établissement
  hotel_name    text,
  hotel_rooms   int,
  hotel_cat     text,
  hotel_role    text,

  -- Rondes
  freq_rondes   text,
  nb_agents     int,
  trace_method  text,

  -- Terrain
  terrain_reception  text,
  terrain_detail     text,

  -- Signalements
  signalement_mode  text,

  -- Outils
  gmao_status       text,
  gmao_usage        text,

  -- Budget & coûts (XOF)
  budget_xof        text,
  reactive_pct      text,
  nb_urgences       text,
  data_quality      text,

  -- Friction
  pains             text[],

  -- Résultats calculés
  score             int,
  score_tier        text,   -- 'bad' | 'mid' | 'good'
  pertes_xof        bigint
);

-- RLS : autoriser INSERT public (formulaire anonyme) mais bloquer SELECT/UPDATE/DELETE
alter table public.audit_leads enable row level security;

create policy "insert_audit_lead" on public.audit_leads
  for insert to anon with check (true);

-- Vue admin pour consulter les leads (accessible via dashboard Supabase)
create or replace view public.audit_leads_view as
select
  created_at,
  hotel_name,
  hotel_rooms,
  hotel_cat,
  hotel_role,
  email,
  phone,
  score,
  score_tier,
  pertes_xof,
  budget_xof,
  reactive_pct,
  trace_method,
  gmao_status,
  signalement_mode,
  data_quality,
  pains
from public.audit_leads
order by created_at desc;
