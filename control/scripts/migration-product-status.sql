-- Migration: Product status (landing card live/ready/maintenance/development)
-- Adds a nullable `status` column on public.products.
-- NULL (default) => auto-derive from store_url/vercel_url (see admin & landing).
-- Values: 'live' | 'ready' | 'maintenance' | 'development'

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text;

-- Optional: backfill existing rows that already have a store_url as 'live'.
-- UPDATE public.products SET status = 'live'
--   WHERE status IS NULL AND store_url IS NOT NULL;
