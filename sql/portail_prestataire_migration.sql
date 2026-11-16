-- Migration : portail prestataire externe
-- À exécuter dans Supabase SQL Editor

-- 1. Colonnes sur missions : type + snapshot prestataire + token dédié
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS type              TEXT NOT NULL DEFAULT 'interne'
    CHECK (type IN ('interne','prestataire')),
  ADD COLUMN IF NOT EXISTS prestataire_id    UUID REFERENCES prestataires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nom_prestataire   TEXT,
  ADD COLUMN IF NOT EXISTS contact_prest_tel TEXT,
  ADD COLUMN IF NOT EXISTS contact_prest_email TEXT;

-- 2. Table documents_prestataire (factures, contrats, rapports importés)
CREATE TABLE IF NOT EXISTS documents_prestataire (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestataire_id UUID NOT NULL REFERENCES prestataires(id) ON DELETE CASCADE,
  site_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  nom            TEXT NOT NULL,
  type_doc       TEXT NOT NULL DEFAULT 'autre'
    CHECK (type_doc IN ('facture','contrat','rapport','garantie','autre')),
  storage_path   TEXT,
  url            TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents_prestataire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_prest_read" ON documents_prestataire
  FOR SELECT USING (true);

CREATE POLICY "docs_prest_insert" ON documents_prestataire
  FOR INSERT WITH CHECK (true);

CREATE POLICY "docs_prest_delete" ON documents_prestataire
  FOR DELETE USING (true);

-- 3. Vérification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='missions' AND column_name='type') AS missions_type_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='missions' AND column_name='prestataire_id') AS missions_prest_ok,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name='documents_prestataire') AS docs_table_ok;
