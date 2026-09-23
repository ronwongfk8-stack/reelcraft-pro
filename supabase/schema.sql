-- ReelCraft Pro — credits schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists credit_accounts (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  device_id text unique,
  free_trial_used boolean not null default false,
  paid_credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stripe_processed_sessions (
  session_id text primary key,
  processed_at timestamptz not null default now()
);

-- Row Level Security is enabled with NO policies: the app only ever talks
-- to these tables using the service_role key from serverless functions,
-- which bypasses RLS by design. This just makes sure nothing can read or
-- write these tables directly from the browser with the public anon key.
alter table credit_accounts enable row level security;
alter table stripe_processed_sessions enable row level security;

-- Finds an existing account by email, then by device, or atomically creates
-- one. Centralizing this in SQL (rather than doing separate select/insert
-- calls from the API layer) avoids a race where two simultaneous requests
-- for a brand-new user could each try to create a row.
create or replace function get_or_create_account(p_email text, p_device_id text)
returns credit_accounts
language plpgsql
as $$
declare
  acct credit_accounts;
  clean_email text := nullif(lower(trim(p_email)), '');
  clean_device text := nullif(trim(p_device_id), '');
begin
  if clean_email is not null then
    select * into acct from credit_accounts where email = clean_email limit 1;
    if found then
      if clean_device is not null and acct.device_id is null then
        update credit_accounts set device_id = clean_device, updated_at = now()
          where id = acct.id returning * into acct;
      end if;
      return acct;
    end if;
  end if;

  if clean_device is not null then
    select * into acct from credit_accounts where device_id = clean_device limit 1;
    if found then
      if clean_email is not null and acct.email is null then
        update credit_accounts set email = clean_email, updated_at = now()
          where id = acct.id returning * into acct;
      end if;
      return acct;
    end if;
  end if;

  insert into credit_accounts (email, device_id, free_trial_used, paid_credits)
  values (clean_email, coalesce(clean_device, 'dev_' || substr(md5(random()::text), 1, 10)), false, 0)
  returning * into acct;

  return acct;
end;
$$;

-- Atomically spends one credit (free trial first, then a paid credit).
-- Row-locks the account (implicit within the function's transaction via
-- FOR UPDATE) so two concurrent export requests for the same account can't
-- both read "1 credit available" and both succeed.
create or replace function deduct_credit(p_email text, p_device_id text)
returns table (
  id uuid,
  email text,
  device_id text,
  free_trial_used boolean,
  paid_credits integer,
  deducted boolean
)
language plpgsql
as $$
declare
  acct credit_accounts;
begin
  acct := get_or_create_account(p_email, p_device_id);

  select * into acct from credit_accounts where credit_accounts.id = acct.id for update;

  if not acct.free_trial_used then
    update credit_accounts set free_trial_used = true, updated_at = now()
      where credit_accounts.id = acct.id returning * into acct;
    return query select acct.id, acct.email, acct.device_id, acct.free_trial_used, acct.paid_credits, true;
  elsif acct.paid_credits > 0 then
    update credit_accounts set paid_credits = acct.paid_credits - 1, updated_at = now()
      where credit_accounts.id = acct.id returning * into acct;
    return query select acct.id, acct.email, acct.device_id, acct.free_trial_used, acct.paid_credits, true;
  else
    return query select acct.id, acct.email, acct.device_id, acct.free_trial_used, acct.paid_credits, false;
  end if;
end;
$$;

-- Grants paid credits. Called ONLY from the Stripe webhook handler after
-- signature verification — never from a client-facing route.
create or replace function increment_paid_credits(p_email text, p_device_id text, p_amount integer)
returns credit_accounts
language plpgsql
as $$
declare
  acct credit_accounts;
  clean_email text := nullif(lower(trim(p_email)), '');
  clean_device text := nullif(trim(p_device_id), '');
begin
  acct := get_or_create_account(clean_email, clean_device);

  update credit_accounts
    set paid_credits = paid_credits + p_amount,
        email = coalesce(clean_email, email),
        device_id = coalesce(clean_device, device_id),
        updated_at = now()
    where id = acct.id
    returning * into acct;

  return acct;
end;
$$;
