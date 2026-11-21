-- Migration: status 'terjadwal' di social_posts (mode jadwal-Meta / Business Suite)
-- Tanggal: 2026-10-23
-- Tujuan : dukung Control Center → Sosmed → "🗓️ Jadwalkan di Meta".
--          Post diserahkan ke scheduler Meta (published=false +
--          scheduled_publish_time) → tayang BAWAHAN kita (PC boleh mati) dan
--          muncul di kalender Meta Business Suite, jadi owner bisa tetap
--          manages dari sana.
--          Tanpa status ini, post yang sudah diserahkan ke Meta tidak bisa
--          dibedakan dari post yang masih "nunggu Control yang menepuk" —
--          risiko post dobel.
-- Akses  : tabel sudah RLS tanpa policy publik; migrasi ini tidak mengubah
--          hak akses apa pun.

-- 1. Cek constraint lama (bisa tidak ada kalau tabel dibuat manual)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass AND contype = 'c'
  ) THEN
    ALTER TABLE public.social_posts DROP CONSTRAINT social_posts_status_check;
  END IF;
END $$;

-- 2. Constraint baru — 'terjadwal' = sudah di scheduler Meta, tinggal nunggu
--    Meta menayangkannya.
ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_status_check
  CHECK (status = ANY (ARRAY['draft','approved','terjadwal','posted','failed']));

-- 3. Index untuk query "post yang menunggu tayang di Meta" (dipakai action
--    sync-remote: cari status='terjadwal' lalu bandingkan dengan feed Page).
CREATE INDEX IF NOT EXISTS idx_social_posts_status_scheduled
  ON public.social_posts (status, scheduled_at);

-- 4. auto-update kolom updated_at
--    (social_posts BELUM punya trigger ini — kolom updated_at-nya selalu
--    tertinggal dari now() default, padahal barisnya di-PATCH berkali-kali:
--    draft→approved→terjadwal→posted. Tanpa trigger, urutan "post terbaru"
--    di UI jadi kacau.)
--    Fungsi touch_updated_at() dibuat di migrasi 20260918_outreach_contacts.sql.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_posts_touch ON public.social_posts;
CREATE TRIGGER trg_social_posts_touch
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON COLUMN public.social_posts.status IS
  'draft=naskah · approved=disetujui nunggu Control menepuk · terjadwal=sudah diserahkan ke scheduler Meta (tayang sendiri, kelihatan di Business Suite) · posted=sudah tayang · failed=gagal (lihat last_error).';
