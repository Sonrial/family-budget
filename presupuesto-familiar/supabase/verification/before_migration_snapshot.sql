-- Ejecutar en producción antes de la migración y guardar el resultado con el backup.
-- Solo lectura: no modifica datos.

select 'accounts' as table_name, count(*) as row_count from public.accounts
union all select 'transactions', count(*) from public.transactions
union all select 'transaction_lines', count(*) from public.transaction_lines
union all select 'recurring_bills', count(*) from public.recurring_bills
union all select 'profiles', count(*) from public.profiles
order by table_name;

select
  t.id,
  t.date,
  t.description,
  round(coalesce(sum(tl.amount), 0), 2) as difference
from public.transactions t
left join public.transaction_lines tl on tl.transaction_id = t.id
group by t.id, t.date, t.description
having round(coalesce(sum(tl.amount), 0), 2) <> 0
order by t.date;

select a.id, a.name, a.type, a.scope,
  round(coalesce(sum(tl.amount), 0), 2) as current_balance
from public.accounts a
left join public.transaction_lines tl on tl.account_id = a.id
group by a.id, a.name, a.type, a.scope
order by a.scope, a.type, a.name;
