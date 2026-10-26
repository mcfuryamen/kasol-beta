-- MVP-2 follow-up: avoid recursive businesses <-> outlets <-> memberships RLS.
-- Security-definer helpers evaluate membership with row_security disabled; callers
-- still receive only rows allowed by the policy predicates.

CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.outlets o
    JOIN public.outlet_memberships m ON m.outlet_id = o.id
    WHERE o.business_id = p_business_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_outlet(p_outlet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlets o
    JOIN public.businesses b ON b.id = o.business_id
    WHERE o.id = p_outlet_id AND b.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.outlet_memberships m
    WHERE m.outlet_id = p_outlet_id AND m.user_id = auth.uid()
  );
$$;

drop policy if exists "Members can view businesses" on public.businesses;
create policy "Members can view businesses" on public.businesses
  for select using (public.can_access_business(id));

drop policy if exists "Members can view outlets" on public.outlets;
create policy "Members can view outlets" on public.outlets
  for select using (public.can_view_outlet(id));

drop policy if exists "Owners manage outlets" on public.outlets;
create policy "Owners manage outlets" on public.outlets
  for all using (
    public.can_access_business(business_id)
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    public.can_access_business(business_id)
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Users view outlet memberships" on public.outlet_memberships;
create policy "Users view outlet memberships" on public.outlet_memberships
  for select using (user_id = auth.uid() or public.can_view_outlet(outlet_id));
