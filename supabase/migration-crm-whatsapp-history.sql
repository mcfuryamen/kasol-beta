-- CRM WhatsApp history — one row per message opened from Control.
-- This records the Control action, not delivery/read confirmation in WhatsApp.
create table if not exists public.crm_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  partner_id uuid references public.referral_partners(id) on delete set null,
  contact_type text not null check (contact_type in ('klien', 'mitra')),
  phone_e164 text not null,
  message_text text not null check (char_length(message_text) between 1 and 4000),
  source text not null default 'crm_composer' check (source = 'crm_composer'),
  opened_whatsapp boolean not null default true,
  created_at timestamptz not null default now(),
  constraint crm_whatsapp_messages_one_contact check (
    (client_id is not null and partner_id is null)
    or (client_id is null and partner_id is not null)
  )
);

create index if not exists crm_whatsapp_messages_client_idx
  on public.crm_whatsapp_messages (client_id, created_at desc);
create index if not exists crm_whatsapp_messages_partner_idx
  on public.crm_whatsapp_messages (partner_id, created_at desc);

alter table public.crm_whatsapp_messages enable row level security;
revoke all on public.crm_whatsapp_messages from anon, authenticated;
