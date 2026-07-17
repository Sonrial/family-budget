-- Presupuesto Familiar - migración segura y aditiva
-- Aplicar únicamente después de verificar la migración de copia anterior.
-- No elimina movimientos, líneas, cuentas ni pagos existentes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.accounts
  add column if not exists household_id uuid references public.households(id),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

alter table public.transactions
  add column if not exists household_id uuid references public.households(id),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists is_reversal boolean not null default false,
  add column if not exists reversal_of uuid references public.transactions(id),
  add column if not exists corrected_from uuid references public.transactions(id),
  add column if not exists replaced_by uuid references public.transactions(id),
  add column if not exists legacy_incomplete boolean not null default false,
  add column if not exists legacy_difference numeric;

alter table public.recurring_bills
  add column if not exists household_id uuid references public.households(id),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create table if not exists public.recurring_bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.recurring_bills(id),
  transaction_id uuid not null references public.transactions(id),
  period date not null,
  paid_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (bill_id, period)
);

alter table public.recurring_bill_payments
  add column if not exists voided_at timestamptz;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('GASTO', 'INGRESO', 'APORTE', 'AJUSTE')) not valid;
alter table public.transactions validate constraint transactions_type_check;

create index if not exists accounts_scope_owner_type_idx
  on public.accounts (scope, user_id, type) where archived_at is null;
create index if not exists accounts_user_id_idx
  on public.accounts (user_id);
create index if not exists accounts_archived_by_idx
  on public.accounts (archived_by);
create index if not exists accounts_household_type_idx
  on public.accounts (household_id, type) where archived_at is null;
create index if not exists transactions_scope_owner_date_idx
  on public.transactions (scope, created_by, date desc) where is_reversal = false;
create index if not exists transactions_created_by_idx
  on public.transactions (created_by);
create index if not exists transactions_voided_by_idx
  on public.transactions (voided_by);
create index if not exists transactions_reversal_of_idx
  on public.transactions (reversal_of);
create index if not exists transactions_corrected_from_idx
  on public.transactions (corrected_from);
create index if not exists transactions_replaced_by_idx
  on public.transactions (replaced_by);
create index if not exists transactions_household_date_idx
  on public.transactions (household_id, date desc) where is_reversal = false;
create index if not exists transaction_lines_account_idx
  on public.transaction_lines (account_id);
create index if not exists transaction_lines_transaction_idx
  on public.transaction_lines (transaction_id);
create index if not exists recurring_bills_scope_owner_idx
  on public.recurring_bills (scope, created_by) where archived_at is null;
create index if not exists recurring_bills_created_by_idx
  on public.recurring_bills (created_by);
create index if not exists recurring_bills_category_id_idx
  on public.recurring_bills (category_id);
create index if not exists recurring_bills_household_id_idx
  on public.recurring_bills (household_id);
create index if not exists recurring_bills_archived_by_idx
  on public.recurring_bills (archived_by);
create index if not exists household_members_user_id_idx
  on public.household_members (user_id);
create index if not exists households_owner_id_idx
  on public.households (owner_id);
create index if not exists recurring_bill_payments_paid_by_idx
  on public.recurring_bill_payments (paid_by);
create unique index if not exists recurring_bill_payments_transaction_uidx
  on public.recurring_bill_payments (transaction_id);

-- La aplicación actual es de una sola familia. El respaldo agrupa únicamente
-- los usuarios ya existentes; los registros futuros no se incorporan solos.
do $$
declare
  v_owner uuid;
  v_household uuid;
begin
  select id into v_owner from auth.users order by created_at asc limit 1;

  if v_owner is not null then
    select id into v_household from public.households order by created_at asc limit 1;

    if v_household is null then
      insert into public.households (name, owner_id)
      values ('Familia Barrios', v_owner)
      returning id into v_household;
    end if;

    insert into public.household_members (household_id, user_id, role)
    select v_household, u.id,
      case when u.id = v_owner then 'OWNER' else 'MEMBER' end
    from auth.users u
    on conflict (household_id, user_id) do nothing;

    update public.accounts
      set household_id = v_household
      where scope = 'SHARED' and household_id is null;
    update public.transactions
      set household_id = v_household
      where scope = 'SHARED' and household_id is null;
    update public.recurring_bills
      set household_id = v_household
      where scope = 'SHARED' and household_id is null;
  end if;
end
$$;

-- La historia anterior se preserva exactamente como fue registrada. Marcamos
-- los asientos sin dos líneas o cuya suma no es cero para excluirlos de los
-- indicadores y evitar que una corrección automática invente contrapartidas.
with ledger as (
  select
    t.id,
    count(tl.id) as line_count,
    round(coalesce(sum(tl.amount), 0), 2) as difference
  from public.transactions t
  left join public.transaction_lines tl on tl.transaction_id = t.id
  group by t.id
)
update public.transactions t
set legacy_incomplete = true,
    legacy_difference = ledger.difference
from ledger
where ledger.id = t.id
  and (ledger.line_count < 2 or abs(ledger.difference) >= 0.005);

-- Endurecer objetos heredados que ya estaban expuestos por la Data API.
alter view public.account_balances set (security_invoker = true);
alter function public.get_user_involved_transaction_ids(uuid)
  set search_path = public, pg_temp;
alter function public.handle_new_user()
  set search_path = public, pg_temp;
revoke all on function public.get_user_involved_transaction_ids(uuid) from public, anon;
grant execute on function public.get_user_involved_transaction_ids(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.get_my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select hm.household_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  order by hm.created_at asc
  limit 1;
$$;

create or replace function public.get_family_profiles()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.email
  from public.profiles p
  join public.household_members member on member.user_id = p.id
  join public.household_members me
    on me.household_id = member.household_id and me.user_id = auth.uid()
  order by p.email;
$$;

create or replace function public.get_transfer_destinations(p_target_user_id uuid)
returns table (id uuid, name text, icon text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id, a.name, a.icon
  from public.accounts a
  join public.household_members target on target.user_id = a.user_id
  join public.household_members me
    on me.household_id = target.household_id and me.user_id = auth.uid()
  where a.user_id = p_target_user_id
    and a.scope = 'PERSONAL'
    and a.type = 'ASSET'
    and a.archived_at is null
  order by a.name;
$$;

-- Vista nueva: evita alterar la vista histórica account_balances.
create or replace view public.account_balances_v2
with (security_invoker = true)
as
select
  a.id,
  a.name,
  a.icon,
  a.type,
  a.scope,
  a.user_id,
  a.household_id,
  a.archived_at,
  coalesce(sum(tl.amount), 0)::numeric as current_balance
from public.accounts a
left join public.transaction_lines tl on tl.account_id = a.id
group by a.id, a.name, a.icon, a.type, a.scope, a.user_id,
  a.household_id, a.archived_at;

create or replace function public.post_transaction(
  p_description text,
  p_notes text,
  p_type text,
  p_scope text,
  p_date date,
  p_household_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_transaction_id uuid;
  v_line jsonb;
  v_sum numeric;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope not in ('PERSONAL', 'SHARED') then raise exception 'INVALID_SCOPE'; end if;
  if p_type not in ('GASTO', 'INGRESO', 'APORTE', 'AJUSTE') then raise exception 'INVALID_TYPE'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'DESCRIPTION_REQUIRED'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'AT_LEAST_TWO_LINES_REQUIRED';
  end if;

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
        or (p_type = 'APORTE' and a.scope = 'PERSONAL' and exists (
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
$$;

create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_reversal_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_tx from public.transactions
  where id = p_transaction_id for update;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if v_tx.voided_at is not null or v_tx.is_reversal then raise exception 'TRANSACTION_ALREADY_VOIDED'; end if;
  if v_tx.legacy_incomplete then raise exception 'LEGACY_INCOMPLETE'; end if;
  if not (
    (v_tx.scope = 'PERSONAL' and v_tx.created_by = v_user)
    or (v_tx.scope = 'SHARED' and public.is_household_member(v_tx.household_id))
  ) then raise exception 'TRANSACTION_ACCESS_DENIED'; end if;

  insert into public.transactions
    (description, notes, type, scope, date, created_by, household_id,
     is_reversal, reversal_of)
  values
    ('Anulación: ' || v_tx.description, nullif(trim(p_reason), ''), v_tx.type,
     v_tx.scope, (now() at time zone 'America/Bogota')::date,
     v_user, v_tx.household_id, true, v_tx.id)
  returning id into v_reversal_id;

  insert into public.transaction_lines (transaction_id, account_id, amount)
  select v_reversal_id, account_id, -amount
  from public.transaction_lines where transaction_id = v_tx.id;

  update public.transactions
  set voided_at = now(), voided_by = v_user
  where id = v_tx.id;

  update public.recurring_bill_payments
  set voided_at = now()
  where transaction_id = v_tx.id and voided_at is null;

  return v_reversal_id;
end;
$$;

create or replace function public.correct_transaction(
  p_transaction_id uuid,
  p_notes text,
  p_date date,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_positive_account uuid;
  v_negative_account uuid;
  v_replacement_id uuid;
  v_reversal_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

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

  v_reversal_id := public.void_transaction(v_tx.id, 'Corrección contable');

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
  return v_replacement_id;
end;
$$;

create or replace function public.create_liability_account(
  p_name text,
  p_initial_amount numeric,
  p_scope text,
  p_household_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_equity_id uuid;
  v_transaction_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  if p_initial_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_scope not in ('PERSONAL', 'SHARED') then raise exception 'INVALID_SCOPE'; end if;
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
$$;

create or replace function public.archive_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_balance numeric;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if not (
    (v_account.scope = 'PERSONAL' and v_account.user_id = v_user)
    or (v_account.scope = 'SHARED' and public.is_household_member(v_account.household_id))
  ) then raise exception 'ACCOUNT_ACCESS_DENIED'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.transaction_lines where account_id = p_account_id;
  if v_account.type in ('ASSET', 'LIABILITY') and abs(v_balance) > 0.005 then
    raise exception 'ACCOUNT_BALANCE_NOT_ZERO';
  end if;

  update public.accounts set archived_at = now(), archived_by = v_user
  where id = p_account_id;
end;
$$;

create or replace function public.archive_recurring_bill(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.recurring_bills rb
  set archived_at = now(), archived_by = v_user
  where rb.id = p_bill_id and (
    (rb.scope = 'PERSONAL' and rb.created_by = v_user)
    or (rb.scope = 'SHARED' and public.is_household_member(rb.household_id))
  );
  if not found then raise exception 'BILL_ACCESS_DENIED'; end if;
end;
$$;

create or replace function public.record_bill_payment(
  p_bill_id uuid,
  p_transaction_id uuid,
  p_period date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
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
$$;

create or replace function public.post_bill_payment(
  p_bill_id uuid,
  p_period date,
  p_description text,
  p_notes text,
  p_type text,
  p_scope text,
  p_date date,
  p_household_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction_id uuid;
begin
  v_transaction_id := public.post_transaction(
    p_description, p_notes, p_type, p_scope, p_date, p_household_id, p_lines
  );
  perform public.record_bill_payment(p_bill_id, v_transaction_id, p_period);
  return v_transaction_id;
end;
$$;

-- Reemplazar políticas previas: una política permisiva antigua anularía las nuevas.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'households', 'household_members', 'accounts',
        'transactions', 'transaction_lines', 'recurring_bills',
        'recurring_bill_payments'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.recurring_bill_payments enable row level security;

create policy profiles_select_family on public.profiles for select to authenticated
using (
  id = (select auth.uid()) or exists (
    select 1 from public.household_members member
    join public.household_members me on me.household_id = member.household_id
    where member.user_id = profiles.id and me.user_id = (select auth.uid())
  )
);
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy households_select_member on public.households for select to authenticated
using (public.is_household_member(id));
create policy households_update_owner on public.households for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy household_members_select_member on public.household_members for select to authenticated
using (public.is_household_member(household_id));
create policy household_members_insert_owner on public.household_members for insert to authenticated
with check (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));
create policy household_members_update_owner on public.household_members for update to authenticated
using (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));
create policy household_members_delete_owner on public.household_members for delete to authenticated
using (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));

create policy accounts_select_authorized on public.accounts for select to authenticated
using (
  (scope = 'PERSONAL' and user_id = (select auth.uid()))
  or (scope = 'SHARED' and public.is_household_member(household_id))
);
create policy accounts_insert_authorized on public.accounts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'SHARED' and public.is_household_member(household_id))
  )
);

create policy transactions_select_authorized on public.transactions for select to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'SHARED' and public.is_household_member(household_id))
);
-- Compatibilidad durante el despliegue: la versión anterior escribía primero
-- la cabecera y luego las líneas. Esta política se retira tras publicar la UI RPC.
create policy transactions_insert_transition on public.transactions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'SHARED' and public.is_household_member(household_id))
  )
  and coalesce(is_reversal, false) = false
  and coalesce(legacy_incomplete, false) = false
);

create policy transaction_lines_select_authorized on public.transaction_lines for select to authenticated
using (exists (
  select 1 from public.transactions t where t.id = transaction_id and (
    (t.scope = 'PERSONAL' and t.created_by = (select auth.uid()))
    or (t.scope = 'SHARED' and public.is_household_member(t.household_id))
  )
));
create policy transaction_lines_insert_transition on public.transaction_lines for insert to authenticated
with check (exists (
  select 1 from public.transactions t
  where t.id = transaction_id
    and t.created_by = (select auth.uid())
    and t.voided_at is null
    and t.is_reversal = false
    and (
      (t.scope = 'PERSONAL' and t.household_id is null)
      or (t.scope = 'SHARED' and public.is_household_member(t.household_id))
    )
));

create policy recurring_bills_select_authorized on public.recurring_bills for select to authenticated
using (
  (scope = 'PERSONAL' and created_by = (select auth.uid()))
  or (scope = 'SHARED' and public.is_household_member(household_id))
);
create policy recurring_bills_insert_authorized on public.recurring_bills for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (scope = 'PERSONAL' and household_id is null)
    or (scope = 'SHARED' and public.is_household_member(household_id))
  )
);

create policy bill_payments_select_authorized on public.recurring_bill_payments for select to authenticated
using (exists (
  select 1 from public.recurring_bills rb where rb.id = bill_id and (
    (rb.scope = 'PERSONAL' and rb.created_by = (select auth.uid()))
    or (rb.scope = 'SHARED' and public.is_household_member(rb.household_id))
  )
));

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.get_my_household_id() from public, anon;
revoke all on function public.get_family_profiles() from public, anon;
revoke all on function public.get_transfer_destinations(uuid) from public, anon;
revoke all on function public.post_transaction(text,text,text,text,date,uuid,jsonb) from public, anon;
revoke all on function public.void_transaction(uuid,text) from public, anon;
revoke all on function public.correct_transaction(uuid,text,date,numeric) from public, anon;
revoke all on function public.create_liability_account(text,numeric,text,uuid) from public, anon;
revoke all on function public.archive_account(uuid) from public, anon;
revoke all on function public.archive_recurring_bill(uuid) from public, anon;
revoke all on function public.record_bill_payment(uuid,uuid,date) from public, anon;
revoke all on function public.post_bill_payment(uuid,date,text,text,text,text,date,uuid,jsonb) from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.get_my_household_id() to authenticated;
grant execute on function public.get_family_profiles() to authenticated;
grant execute on function public.get_transfer_destinations(uuid) to authenticated;
grant execute on function public.post_transaction(text,text,text,text,date,uuid,jsonb) to authenticated;
grant execute on function public.void_transaction(uuid,text) to authenticated;
grant execute on function public.correct_transaction(uuid,text,date,numeric) to authenticated;
grant execute on function public.create_liability_account(text,numeric,text,uuid) to authenticated;
grant execute on function public.archive_account(uuid) to authenticated;
grant execute on function public.archive_recurring_bill(uuid) to authenticated;
grant execute on function public.record_bill_payment(uuid,uuid,date) to authenticated;
grant execute on function public.post_bill_payment(uuid,date,text,text,text,text,date,uuid,jsonb) to authenticated;

revoke all on table public.profiles, public.households, public.household_members,
  public.accounts, public.transactions, public.transaction_lines,
  public.recurring_bills, public.recurring_bill_payments,
  public.account_balances, public.account_balances_v2 from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert on public.accounts to authenticated;
grant select, insert on public.transactions to authenticated;
grant select, insert on public.transaction_lines to authenticated;
grant select, insert on public.recurring_bills to authenticated;
grant select on public.recurring_bill_payments to authenticated;
grant select on public.account_balances to authenticated;
grant select on public.account_balances_v2 to authenticated;

commit;
