-- Additive upgrade: preserve all existing rows and balances.
begin;
create schema backup_20260922;
revoke all on schema backup_20260922 from public, anon, authenticated;
do $backup$
declare table_name text;
begin
  foreach table_name in array array['profiles','households','household_members','accounts','transactions','transaction_lines','recurring_bills','recurring_bill_payments'] loop
    execute format('create table backup_20260922.%I as table public.%I', table_name, table_name);
  end loop;
end;
$backup$;
create table backup_20260922.function_definitions as
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f';
revoke all on all tables in schema backup_20260922 from public, anon, authenticated;

create schema if not exists finance_audit;
revoke all on schema finance_audit from public, anon, authenticated;
create table finance_audit.account_label_changes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  old_name text, new_name text not null,
  old_icon text, new_icon text
);
alter table finance_audit.account_label_changes enable row level security;
revoke all on finance_audit.account_label_changes from public, anon, authenticated;
create index account_label_changes_account_time_idx on finance_audit.account_label_changes(account_id, changed_at desc);

create or replace function public.rename_account(
  p_account_id uuid, p_name text, p_icon text, p_expected_name text, p_expected_icon text
) returns void language plpgsql security definer set search_path = '' as $rename$
declare
  v_user uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_name text := btrim(p_name);
  v_icon text := nullif(btrim(p_icon), '');
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_name is null or char_length(v_name) not between 1 and 80 or coalesce(char_length(v_icon), 0) > 4 then
    raise exception 'INVALID_ACCOUNT_LABEL';
  end if;
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found or not coalesce(
    (v_account.scope = 'PERSONAL' and v_account.user_id = v_user)
    or (v_account.scope = 'SHARED' and public.is_household_member(v_account.household_id)), false
  ) then raise exception 'ACCOUNT_ACCESS_DENIED'; end if;
  if v_account.archived_at is not null then raise exception 'ACCOUNT_ARCHIVED'; end if;
  if v_account.type not in ('ASSET','EXPENSE','INCOME') then raise exception 'ACCOUNT_ACCESS_DENIED'; end if;
  if v_account.name is distinct from p_expected_name or v_account.icon is distinct from p_expected_icon then
    raise exception 'ACCOUNT_CHANGED';
  end if;
  if v_account.name is not distinct from v_name and v_account.icon is not distinct from v_icon then return; end if;
  insert into finance_audit.account_label_changes(account_id,changed_by,old_name,new_name,old_icon,new_icon)
  values (v_account.id,v_user,v_account.name,v_name,v_account.icon,v_icon);
  update public.accounts set name = v_name, icon = v_icon where id = v_account.id;
end;
$rename$;
revoke all on function public.rename_account(uuid,text,text,text,text) from public, anon;
grant execute on function public.rename_account(uuid,text,text,text,text) to authenticated;

CREATE OR REPLACE FUNCTION public.correct_transaction(p_transaction_id uuid, p_notes text, p_date date, p_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_positive_account uuid;
  v_negative_account uuid;
  v_replacement_id uuid;
  v_reversal_id uuid;
  v_payment_ids uuid[];
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or round(p_amount,2) <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  if p_date is null then raise exception 'INVALID_DATE'; end if;

  select * into v_tx from public.transactions
  where id = p_transaction_id for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if v_tx.voided_at is not null or v_tx.is_reversal then raise exception 'TRANSACTION_ALREADY_VOIDED'; end if;
  if v_tx.legacy_incomplete then raise exception 'LEGACY_INCOMPLETE'; end if;
  if not (
    (v_tx.scope = 'PERSONAL' and v_tx.created_by = v_user)
    or (v_tx.scope = 'SHARED' and public.is_household_member(v_tx.household_id))
  ) then raise exception 'TRANSACTION_ACCESS_DENIED'; end if;

  if (select count(*) from public.transaction_lines where transaction_id = v_tx.id) <> 2 then
    raise exception 'ONLY_TWO_LINE_CORRECTIONS_SUPPORTED';
  end if;

  select account_id into v_positive_account from public.transaction_lines
    where transaction_id = v_tx.id and amount > 0 limit 1;
  select account_id into v_negative_account from public.transaction_lines
    where transaction_id = v_tx.id and amount < 0 limit 1;
  if v_positive_account is null or v_negative_account is null then
    raise exception 'INVALID_TRANSACTION_LINES';
  end if;
  if exists (
    select 1 from public.accounts
    where id in (v_positive_account, v_negative_account) and archived_at is not null
  ) then raise exception 'ACCOUNT_ARCHIVED'; end if;

  select array_agg(id) into v_payment_ids from public.recurring_bill_payments
    where transaction_id=v_tx.id and voided_at is null;
  v_reversal_id := public.void_transaction(v_tx.id, 'CorrecciÃ³n contable');

  insert into public.transactions
    (description, notes, type, scope, date, created_by, household_id, corrected_from)
  values
    (v_tx.description, nullif(trim(p_notes), ''), v_tx.type, v_tx.scope, p_date,
     v_user, v_tx.household_id, v_tx.id)
  returning id into v_replacement_id;

  insert into public.transaction_lines (transaction_id, account_id, amount)
  values
    (v_replacement_id, v_positive_account, round(p_amount, 2)),
    (v_replacement_id, v_negative_account, -round(p_amount, 2));

  update public.transactions set replaced_by = v_replacement_id where id = v_tx.id;
  -- Keep the same month's bill marked as paid after a correction.
  update public.recurring_bill_payments set transaction_id=v_replacement_id, voided_at=null
    where id=any(v_payment_ids);
  return v_replacement_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.create_liability_account(p_name text, p_initial_amount numeric, p_scope text, p_household_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_equity_id uuid;
  v_transaction_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if p_initial_amount is null or p_initial_amount::text in ('NaN','Infinity','-Infinity') or p_initial_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_scope is null or p_scope not in ('PERSONAL', 'SHARED') then raise exception 'INVALID_SCOPE'; end if;
  if p_scope = 'SHARED' and not public.is_household_member(p_household_id) then
    raise exception 'HOUSEHOLD_ACCESS_DENIED';
  end if;

  insert into public.accounts (name, icon, type, scope, user_id, household_id)
  values (
    trim(p_name), 'DEU', 'LIABILITY', p_scope::public.account_scope, v_user,
    case when p_scope = 'SHARED' then p_household_id else null end
  ) returning id into v_account_id;

  if p_initial_amount > 0 then
    select id into v_equity_id from public.accounts
    where type = 'EQUITY' and scope = p_scope::public.account_scope and archived_at is null
      and (
        (p_scope = 'PERSONAL' and user_id = v_user)
        or (p_scope = 'SHARED' and household_id = p_household_id)
      )
    order by name limit 1;

    if v_equity_id is null then
      insert into public.accounts (name, icon, type, scope, user_id, household_id)
      values (
        'Patrimonio inicial', 'PAT', 'EQUITY', p_scope::public.account_scope, v_user,
        case when p_scope = 'SHARED' then p_household_id else null end
      ) returning id into v_equity_id;
    end if;

    insert into public.transactions
      (description, notes, type, scope, date, created_by, household_id)
    values (
      'Saldo inicial: ' || trim(p_name), 'Asiento de apertura equilibrado',
      'AJUSTE', p_scope::public.account_scope,
      (now() at time zone 'America/Bogota')::date, v_user,
      case when p_scope = 'SHARED' then p_household_id else null end
    ) returning id into v_transaction_id;

    insert into public.transaction_lines (transaction_id, account_id, amount)
    values
      (v_transaction_id, v_account_id, -round(p_initial_amount, 2)),
      (v_transaction_id, v_equity_id, round(p_initial_amount, 2));
  end if;

  return v_account_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.post_transaction(p_description text, p_notes text, p_type text, p_scope text, p_date date, p_household_id uuid, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_transaction_id uuid;
  v_line jsonb;
  v_sum numeric;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope is null or p_scope not in ('PERSONAL', 'SHARED') then raise exception 'INVALID_SCOPE'; end if;
  if p_type is null or p_type not in ('GASTO', 'INGRESO', 'APORTE', 'AJUSTE') then raise exception 'INVALID_TYPE'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if p_date is null then raise exception 'INVALID_DATE'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'INVALID_TRANSACTION_LINES'; end if;
  if jsonb_array_length(p_lines) < 2 then
    raise exception 'AT_LEAST_TWO_LINES_REQUIRED';
  end if;

  if exists (select 1 from jsonb_array_elements(p_lines) line
    where jsonb_typeof(line) <> 'object' or line->>'account_id' is null
      or line->>'amount' is null or jsonb_typeof(line->'amount') <> 'number'
      or (line->>'amount')::numeric = 0
      or (line->>'amount')::numeric <> round((line->>'amount')::numeric, 2)
  ) or (select count(distinct line->>'account_id') from jsonb_array_elements(p_lines) line) <> jsonb_array_length(p_lines)
  then raise exception 'INVALID_TRANSACTION_LINES'; end if;
  -- Shared accounts and member destinations must never be hidden in a personal transaction.
  if p_scope = 'PERSONAL' and exists (
    select 1 from jsonb_array_elements(p_lines) line join public.accounts a on a.id=(line->>'account_id')::uuid
    where a.scope <> 'PERSONAL' or a.user_id is distinct from v_user
  ) then raise exception 'INVALID_OR_INACCESSIBLE_ACCOUNT'; end if;
  if p_type = 'APORTE' and exists (
    select 1 from jsonb_array_elements(p_lines) line join public.accounts a on a.id=(line->>'account_id')::uuid
    where a.type <> 'ASSET'
  ) then raise exception 'INVALID_TRANSACTION_LINES'; end if;
  -- Serialize with archive/rename so a checked active account cannot be archived mid-write.
  perform 1 from public.accounts a where a.id in
    (select (line->>'account_id')::uuid from jsonb_array_elements(p_lines) line)
    order by a.id for update;

  select coalesce(sum(round((line->>'amount')::numeric, 2)), 0)
    into v_sum from jsonb_array_elements(p_lines) line;
  if abs(v_sum) >= 0.005 then raise exception 'UNBALANCED_TRANSACTION'; end if;

  if p_scope = 'SHARED' and not public.is_household_member(p_household_id) then
    raise exception 'HOUSEHOLD_ACCESS_DENIED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    left join public.accounts a on a.id = (line->>'account_id')::uuid
    where a.id is null
      or a.archived_at is not null
      or abs(round((line->>'amount')::numeric, 2)) < 0.005
      or not (
        (a.scope = 'PERSONAL' and a.user_id = v_user)
        or (a.scope = 'SHARED' and a.household_id = p_household_id
            and public.is_household_member(a.household_id))
        or (p_type = 'APORTE' and p_scope = 'SHARED' and a.type = 'ASSET' and (line->>'amount')::numeric > 0 and a.scope = 'PERSONAL' and exists (
          select 1
          from public.household_members target
          join public.household_members me on me.household_id = target.household_id
          where target.user_id = a.user_id
            and me.user_id = v_user
            and me.household_id = p_household_id
        ))
      )
  ) then
    raise exception 'INVALID_OR_INACCESSIBLE_ACCOUNT';
  end if;

  insert into public.transactions
    (description, notes, type, scope, date, created_by, household_id)
  values
    (trim(p_description), nullif(trim(p_notes), ''), p_type,
     p_scope::public.account_scope, p_date,
     v_user, case when p_scope = 'SHARED' then p_household_id else null end)
  returning id into v_transaction_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.transaction_lines (transaction_id, account_id, amount)
    values (
      v_transaction_id,
      (v_line->>'account_id')::uuid,
      round((v_line->>'amount')::numeric, 2)
    );
  end loop;

  return v_transaction_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_bill_payment(p_bill_id uuid, p_transaction_id uuid, p_period date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_period is null then raise exception 'INVALID_DATE'; end if;
  -- Lock the bill first; duplicate concurrent payments must fail, not overwrite.
  perform 1 from public.recurring_bills where id=p_bill_id for update;
  if exists (
    select 1 from public.recurring_bill_payments payment
    where payment.bill_id = p_bill_id
      and payment.period = date_trunc('month', p_period)::date
      and payment.voided_at is null
    for update
  ) then raise exception 'BILL_ALREADY_PAID'; end if;

  if not exists (
    select 1
    from public.recurring_bills rb
    join public.transactions t on t.id = p_transaction_id
    where rb.id = p_bill_id
      and rb.archived_at is null
      and t.created_by = v_user
      and t.voided_at is null
      and t.scope = rb.scope
      and (t.scope = 'PERSONAL' or t.household_id = rb.household_id)
      and exists (
        select 1 from public.transaction_lines tl
        where tl.transaction_id = t.id
          and tl.account_id = rb.category_id
          and tl.amount > 0
      )
      and (
        (rb.scope = 'PERSONAL' and rb.created_by = v_user)
        or (rb.scope = 'SHARED' and public.is_household_member(rb.household_id))
      )
  ) then raise exception 'BILL_ACCESS_DENIED'; end if;

  insert into public.recurring_bill_payments
    (bill_id, transaction_id, period, paid_by)
  values (p_bill_id, p_transaction_id, date_trunc('month', p_period)::date, v_user)
  on conflict (bill_id, period)
  do update set transaction_id = excluded.transaction_id,
                paid_by = excluded.paid_by,
                created_at = now(),
                voided_at = null;
end;
$function$;


commit;
