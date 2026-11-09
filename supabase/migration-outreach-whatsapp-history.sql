-- Outreach WhatsApp history — records each message opened from Control.
create table if not exists public.outreach_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  outreach_contact_id uuid references public.outreach_contacts(id) on delete set null,
  phone_e164 text not null,
  message_text text not null check (char_length(message_text) between 1 and 4000),
  source text not null default 'outreach_composer' check (source = 'outreach_composer'),
  opened_whatsapp boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists outreach_whatsapp_messages_contact_idx
  on public.outreach_whatsapp_messages (outreach_contact_id, created_at desc);

alter table public.outreach_whatsapp_messages enable row level security;
revoke all on public.outreach_whatsapp_messages from anon, authenticated;
