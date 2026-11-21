-- Migration: Tabel kontak kampanye outreach (klien lama Mesin Kasir Solo)
-- Tanggal: 2026-09-18
-- Tujuan : Manajemen kampanye reaktivasi klien lama (impor CSV, status
--          kirim/bales/minat/beli) dari modul Outreach di Control.
-- Akses  : HANYA service role (server control via /api/rest). RLS enabled
--          tanpa policy publik = browser anon tidak bisa baca/tulis.

-- 1. Tabel kontak outreach — 1 baris per nomor WA (unique)
CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama            TEXT NOT NULL,
  alamat          TEXT,
  kategori        TEXT,
  nomor_wa        TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'belum'
                  CHECK (status IN ('belum','terkirim','bales','minat','beli','mati','optout')),
  catatan         TEXT,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  source          TEXT NOT NULL DEFAULT 'klien_lama',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index query rutin (filter status + urutan kontak terakhir)
CREATE INDEX IF NOT EXISTS idx_outreach_status ON public.outreach_contacts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_last_contact ON public.outreach_contacts(last_contact_at DESC);

-- 3. RLS: aktif TANPA policy → hanya service_role (Control server) yang lolos.
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

-- 4. auto-update kolom updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_touch ON public.outreach_contacts;
CREATE TRIGGER trg_outreach_touch
  BEFORE UPDATE ON public.outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.outreach_contacts IS
  'Kampanye outreach klien lama (2026-09): kontak diimpor dari CSV Excel lama, status mengikuti alur WA manual admin (belum/terkirim/bales/minat/beli/mati/optout).';
