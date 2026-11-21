-- Migration 001: Users, roles & shared schema helpers
-- - profiles mirrors the app user model. Roles are EXACTLY: owner | manager | cashier | stock.
-- - Defines shared helpers used by all later migrations:
--     public.has_role(text[])      -> RLS-safe role check (SECURITY DEFINER, avoids recursion)
--     public.set_updated_at()      -> generic updated_at maintenance trigger function
-- - Signups always get role 'cashier' (safe default).
--
-- BOOTSTRAP: the first owner cannot self-promote (escalation is blocked by trigger).
-- After the first signup, promote them manually via SQL editor:
--   update profiles set role = 'owner' where email = 'owner@example.com';

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'cashier'
    check (role in ('owner','manager','cashier','stock')),
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on profiles(role);

-- ---------------------------------------------------------------------------
-- Shared helper: role check for RLS.
-- SECURITY DEFINER so policies on profiles (and other tables) never recurse.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = any (roles)
  );
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared helper: maintain updated_at. Applied via trigger to every table
-- that carries an updated_at column (see migrations 001-007).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auto-create a profile on signup with the SAFE DEFAULT role 'cashier'.
-- Runs as definer so it bypasses RLS on profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    'cashier'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Anti-escalation guard: nobody may change role (or is_active) unless they
-- are an active owner. Guards even the "update own row" path.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_escalation()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role then
    if not public.has_role(array['owner']) then
      raise exception 'role changes require an active owner';
    end if;
  end if;
  if old.is_active is distinct from new.is_active then
    if not public.has_role(array['owner']) then
      raise exception 'activating/deactivating accounts requires an active owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_escalation on profiles;
create trigger trg_profiles_guard_escalation
  before update on profiles
  for each row execute function public.guard_profile_escalation();

drop trigger if exists trg_profiles_set_updated_at on profiles;
create trigger trg_profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS on profiles (explicit per-operation policies):
--   select  -> any authenticated user
--   update  -> own row only (role/is_active guarded by trigger above)
--   insert  -> owner + manager (staff onboarding)
--   delete  -> owner + manager
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

drop policy if exists "Authenticated users can view profiles" on profiles;
create policy "Authenticated users can view profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Owners and managers can insert profiles" on profiles;
create policy "Owners and managers can insert profiles"
  on profiles for insert
  with check (public.has_role(array['owner','manager']));

drop policy if exists "Owners and managers can delete profiles" on profiles;
create policy "Owners and managers can delete profiles"
  on profiles for delete
  using (public.has_role(array['owner','manager']));
