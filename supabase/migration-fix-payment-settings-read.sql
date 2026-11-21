-- KASOL — Perbaikan akses info pembayaran publik untuk klien kaki5
--
-- Kaki5 memakai anonymous sign-in Supabase. Setelah login, JWT ber-role
-- `authenticated`, bukan `anon`. Policy lama hanya memberi akses `anon`,
-- sehingga REST API mengembalikan [] walaupun baris settings ada.
--
-- qris_url dan bank_info adalah info pembayaran publik yang memang harus
-- tampil di layar pembelian lisensi. Key sensitif tetap tidak ikut whitelist.

alter table if exists public.settings enable row level security;

drop policy if exists "settings anon read public keys" on public.settings;
drop policy if exists "settings payment read clients" on public.settings;

create policy "settings payment read clients"
  on public.settings
  for select
  to anon, authenticated
  using (key in ('qris_url', 'bank_info'));

-- Pastikan baris bank_info ada agar Control Center dapat mengisinya via upsert.
insert into public.settings (key, value)
values ('bank_info', '{"bank":"","account_number":"","account_name":""}'::jsonb)
on conflict (key) do nothing;
