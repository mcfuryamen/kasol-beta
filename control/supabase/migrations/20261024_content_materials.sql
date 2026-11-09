-- Migration: bank materi konten + rencana jadwal posting manual bulanan
-- Tanggal: 2026-10-24
-- Tujuan: opsi posting MANUAL yang 100% tanpa kredensial Meta.
--   • content_materials = bank materi (42 caption + 14 brief video + template
--     balasan + 79 variasi komentar) — hasil seed dari marketing-kit.
--   • social_posts += status 'planned' + kolom material_id
--     → rencana posting per tanggal; owner tandai "sudah tayang" manual.
--
-- Kenapa 'planned' perlu status sendiri:
--   draft      = naskah, belum dijadwalkan
--   planned    = sudah DIJADWALKAN untuk tanggal tertentu, nunggu owner
--                tayangkan sendiri (tidak pernah menyentuh Graph API)
--   approved   = disetujui, nunggu Control yang menepuk (mode token)
--   terjadwal  = diserahkan ke scheduler Meta (mode token)
--   posted     = sudah tayang (manual atau otomatis)
--   failed     = gagal, lihat last_error
--   Status 'planned' sengaja TIDAK ikut diambil post-due — supaya rencana
--   manual tidak pernah keposting otomatis.
--
-- Akses: RLS aktif tanpa policy (default deny) + grant level-tabel seperti
-- tabel lain di schema public. Semua akses lewat proxy /api/rest (admin-gated).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bank materi
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.content_materials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- kunci idempoten untuk seed (contoh: caption:S1:09:00 · video:S1 · variasi:12)
  source_key  text UNIQUE,
  kategori    text NOT NULL DEFAULT 'caption',  -- caption | brief_video | template | variasi | aset
  judul       text NOT NULL DEFAULT '',
  isi         text NOT NULL DEFAULT '',
  platform    text NOT NULL DEFAULT 'facebook',
  script      text,                            -- S1..S14 (kelompok kalender 14 hari)
  slot        text,                            -- 09:00 | 12:30 | 19:00
  hari        int,                             -- 1..14
  tag         text,                            -- edukasi | promo | interaktif | story | build-in-public
  dipakai     int NOT NULL DEFAULT 0,          -- berapa kali dipakai di rencana
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_materials_kategori ON public.content_materials (kategori);
CREATE INDEX IF NOT EXISTS idx_content_materials_hari    ON public.content_materials (hari, slot);

COMMENT ON TABLE public.content_materials IS
  'Bank materi konten marketing (seed dari marketing-kit). Dipakai manual di Control → Kalender: pilih materi → jadwalkan ke tanggal → tandai tayang sendiri.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Rencana manual di social_posts
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS material_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass AND contype = 'c'
  ) THEN
    ALTER TABLE public.social_posts DROP CONSTRAINT social_posts_status_check;
  END IF;
END $$;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_status_check
  CHECK (status = ANY (ARRAY['draft','planned','approved','terjadwal','posted','failed']));

-- Index untuk ambil rencana satu bulan (tanggal tayang) + filter status.
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON public.social_posts (scheduled_at);

COMMENT ON COLUMN public.social_posts.status IS
  'draft=naskah · planned=rencana tanggal (posting manual) · approved=disetujui nunggu Control menepuk · terjadwal=sudah diserahkan ke scheduler Meta · posted=sudah tayang · failed=gagal (lihat last_error).';
COMMENT ON COLUMN public.social_posts.material_id IS
  'ID material asal dari content_materials (bisa NULL kalau caption ditulis manual).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS + grant (pola sama dengan social_posts & outreach_contacts)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.content_materials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_materials FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_materials TO anon, authenticated;
GRANT ALL ON TABLE public.content_materials TO service_role;

-- Catatan: tabel pakai gen_random_uuid() (bukan serial) → tidak ada sequence
-- yang perlu di-grant.

-- updated_at trigger untuk social_posts (punya kolom updated_at)
DROP TRIGGER IF EXISTS trg_social_posts_touch ON public.social_posts;
CREATE TRIGGER trg_social_posts_touch
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
