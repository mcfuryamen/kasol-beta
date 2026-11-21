-- Phone/password auth migration for Minimarket.
-- Existing email-based profiles remain valid; new phone-auth users use phone_e164.
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone_e164 text;

create unique index if not exists uq_profiles_phone_e164
  on public.profiles(phone_e164)
  where phone_e164 is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_phone text;
begin
  profile_phone := nullif(new.phone, '');
  profile_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.email, ''),
    profile_phone,
    'Pengguna'
  );
  insert into public.profiles (id, name, email, phone_e164, role)
  values (new.id, profile_name, nullif(new.email, ''), profile_phone, 'cashier')
  on conflict (id) do update set
    name = excluded.name,
    email = coalesce(excluded.email, profiles.email),
    phone_e164 = coalesce(excluded.phone_e164, profiles.phone_e164);
  return new;
end;
$$;

-- Keep the phone identifier private to authenticated profile readers.
-- Existing profiles SELECT policy already requires auth.uid() is not null.
