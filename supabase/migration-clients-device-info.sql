-- Stage 4 — minimal device metadata for CRM profile.
-- Raw user-agent is intentionally excluded from public.clients.
-- Idempotent for projects that already have these columns/constraints.
alter table public.clients add column if not exists browser text;
alter table public.clients add column if not exists browser_major text;
alter table public.clients add column if not exists os text;
alter table public.clients add column if not exists device_type text;

-- Apply these constraints only once on a fresh schema; the staging migration
-- used equivalent named constraints before this file was recorded.
alter table public.clients drop constraint if exists clients_browser_check;
alter table public.clients drop constraint if exists clients_os_check;
alter table public.clients drop constraint if exists clients_device_type_check;
alter table public.clients drop constraint if exists clients_browser_major_check;
alter table public.clients add constraint clients_browser_check check (browser is null or browser in ('Chrome','Edge','Firefox','Safari','Opera','Samsung Internet','WebView','Lainnya'));
alter table public.clients add constraint clients_os_check check (os is null or os in ('Windows','Android','iOS','macOS','Linux','Lainnya'));
alter table public.clients add constraint clients_device_type_check check (device_type is null or device_type in ('mobile','tablet','desktop'));
alter table public.clients add constraint clients_browser_major_check check (browser_major is null or browser_major ~ '^[0-9]{1,4}$');
