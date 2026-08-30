begin;

-- Phase 9 communications + customer payment history.
-- These tables are server/admin managed. Customer reads go through authenticated
-- API routes so payment and communication records can survive account deletion
-- where financial/legal retention requires it.

create table if not exists public.communication_templates (
  template_key text primary key,
  subject text,
  preheader text,
  eyebrow text,
  title text,
  body text,
  cta_label text,
  enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_sends (
  id uuid primary key default gen_random_uuid(),
  event_key text unique not null,
  user_id uuid,
  recipient_email text not null,
  template_key text not null,
  subject text not null,
  channel text not null default 'email' check (channel in ('email','in_app')),
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  related_type text,
  related_id text,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communication_sends_recipient_created_idx
  on public.communication_sends(recipient_email, created_at desc);
create index if not exists communication_sends_template_created_idx
  on public.communication_sends(template_key, created_at desc);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  payment_key text unique not null,
  user_id uuid,
  external_payment_id text,
  external_invoice_id text,
  payment_type text not null check (payment_type in ('subscription','credit_pack','production','other')),
  description text not null,
  amount_total integer not null check (amount_total >= 0),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'paid',
  invoice_number text unique not null,
  billing_name text,
  billing_email text,
  related_id text,
  paid_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_records_user_paid_idx
  on public.payment_records(user_id, paid_at desc);
create index if not exists payment_records_email_paid_idx
  on public.payment_records(billing_email, paid_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id, created_at desc);

-- Exactly-once email claim. A failed/stale send may be reclaimed; an already
-- sent or actively sending event may not be duplicated.
create or replace function public.heyy_claim_communication_send(
  p_event_key text,
  p_user_id uuid,
  p_recipient_email text,
  p_template_key text,
  p_subject text,
  p_related_type text default null,
  p_related_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  row public.communication_sends%rowtype;
  claimed_id uuid;
begin
  if coalesce(trim(p_event_key), '') = ''
    or coalesce(trim(p_recipient_email), '') = ''
    or coalesce(trim(p_template_key), '') = ''
    or coalesce(trim(p_subject), '') = '' then
    raise exception 'Invalid communication send claim';
  end if;

  insert into public.communication_sends(
    event_key,user_id,recipient_email,template_key,subject,status,
    related_type,related_id,metadata
  ) values (
    trim(p_event_key),p_user_id,lower(trim(p_recipient_email)),trim(p_template_key),p_subject,'sending',
    p_related_type,p_related_id,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (event_key) do nothing
  returning id into claimed_id;

  if claimed_id is not null then
    return claimed_id;
  end if;

  select * into row
  from public.communication_sends
  where event_key = trim(p_event_key)
  for update;

  if row.status = 'sent' then
    return null;
  end if;

  if row.status = 'sending' and row.updated_at > now() - interval '10 minutes' then
    return null;
  end if;

  update public.communication_sends
  set status='sending',
      error_message=null,
      subject=p_subject,
      recipient_email=lower(trim(p_recipient_email)),
      updated_at=now()
  where id=row.id
  returning id into claimed_id;

  return claimed_id;
end;
$function$;

revoke all on function public.heyy_claim_communication_send(text,uuid,text,text,text,text,text,jsonb) from public;
grant execute on function public.heyy_claim_communication_send(text,uuid,text,text,text,text,text,jsonb) to service_role;

grant usage on schema public to service_role;
grant select,insert,update on table public.communication_templates to service_role;
grant select,insert,update on table public.communication_sends to service_role;
grant select,insert,update on table public.payment_records to service_role;
grant select,insert on table public.admin_audit_log to service_role;

commit;
