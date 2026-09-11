-- Migration: Tambahkan kolom audit trail untuk aktivasi/pencabutan lisensi
-- Tanggal: 2026-08-23
-- Tabel: clients
-- Kolom baru: restored_at, revoked_at

-- 1. Tambah kolom restored_at (waktu klien dipulihkan dari status batal)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

-- 2. Tambah kolom revoked_at (waktu lisensi dicabut)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- 3. Index untuk query audit trail (opsional, tapi membantu performa)
CREATE INDEX IF NOT EXISTS idx_clients_restored_at ON public.clients(restored_at);
CREATE INDEX IF NOT EXISTS idx_clients_revoked_at ON public.clients(revoked_at);
CREATE INDEX IF NOT EXISTS idx_clients_activated_at ON public.clients(activated_at);
CREATE INDEX IF NOT EXISTS idx_clients_verified_at ON public.clients(verified_at);

-- 4. Keterangan kolom (comment)
COMMENT ON COLUMN public.clients.restored_at IS 'Timestamp ketika klien dipulihkan dari status batal ke aktif (restoreClientLicense)';
COMMENT ON COLUMN public.clients.revoked_at IS 'Timestamp ketika lisensi klien dicabut (revokeClientLicense)';
COMMENT ON COLUMN public.clients.activated_at IS 'Timestamp ketika lisensi pertama kali diaktifkan';
COMMENT ON COLUMN public.clients.verified_at IS 'Timestamp ketika lisensi berhasil diverifikasi oleh admin';