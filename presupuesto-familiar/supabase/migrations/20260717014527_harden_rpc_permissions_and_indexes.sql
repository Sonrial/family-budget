begin;

revoke all on function public.is_household_member(uuid) from anon;
revoke all on function public.get_my_household_id() from anon;
revoke all on function public.get_family_profiles() from anon;
revoke all on function public.get_transfer_destinations(uuid) from anon;
revoke all on function public.post_transaction(text,text,text,text,date,uuid,jsonb) from anon;
revoke all on function public.void_transaction(uuid,text) from anon;
revoke all on function public.correct_transaction(uuid,text,date,numeric) from anon;
revoke all on function public.create_liability_account(text,numeric,text,uuid) from anon;
revoke all on function public.archive_account(uuid) from anon;
revoke all on function public.archive_recurring_bill(uuid) from anon;
revoke all on function public.record_bill_payment(uuid,uuid,date) from anon;
revoke all on function public.post_bill_payment(uuid,date,text,text,text,text,date,uuid,jsonb) from anon;

create index if not exists accounts_archived_by_idx on public.accounts (archived_by);
create index if not exists households_owner_id_idx on public.households (owner_id);
create index if not exists recurring_bill_payments_paid_by_idx
  on public.recurring_bill_payments (paid_by);
create index if not exists recurring_bills_archived_by_idx
  on public.recurring_bills (archived_by);
create index if not exists recurring_bills_household_id_idx
  on public.recurring_bills (household_id);
create index if not exists transactions_corrected_from_idx
  on public.transactions (corrected_from);
create index if not exists transactions_replaced_by_idx
  on public.transactions (replaced_by);
create index if not exists transactions_reversal_of_idx
  on public.transactions (reversal_of);
create index if not exists transactions_voided_by_idx
  on public.transactions (voided_by);

drop policy if exists household_members_manage_owner on public.household_members;
drop policy if exists household_members_insert_owner on public.household_members;
drop policy if exists household_members_update_owner on public.household_members;
drop policy if exists household_members_delete_owner on public.household_members;

create policy household_members_insert_owner on public.household_members
for insert to authenticated
with check (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));

create policy household_members_update_owner on public.household_members
for update to authenticated
using (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));

create policy household_members_delete_owner on public.household_members
for delete to authenticated
using (exists (
  select 1 from public.households h
  where h.id = household_id and h.owner_id = (select auth.uid())
));

commit;
