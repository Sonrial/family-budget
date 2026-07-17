-- Ejecutar después de la migración en el proyecto de respaldo.
-- Todas las consultas son de solo lectura.

-- 1. Ningún asiento nuevo o histórico completo debe quedar desbalanceado.
select
  t.id,
  t.date,
  t.description,
  round(coalesce(sum(tl.amount), 0), 2) as difference
from public.transactions t
left join public.transaction_lines tl on tl.transaction_id = t.id
group by t.id, t.date, t.description
having not bool_or(t.legacy_incomplete)
   and round(coalesce(sum(tl.amount), 0), 2) <> 0
order by t.date;

-- 2. Ningún asiento no heredado debe tener menos de dos líneas.
select t.id, t.date, t.description, count(tl.id) as line_count
from public.transactions t
left join public.transaction_lines tl on tl.transaction_id = t.id
group by t.id, t.date, t.description
having not bool_or(t.legacy_incomplete) and count(tl.id) < 2
order by t.date;

-- 3. Las anomalías heredadas deben estar identificadas y conservar su diferencia.
select
  t.id,
  t.date,
  t.scope,
  count(tl.id) as line_count,
  round(coalesce(sum(tl.amount), 0), 2) as calculated_difference,
  t.legacy_difference
from public.transactions t
left join public.transaction_lines tl on tl.transaction_id = t.id
where t.legacy_incomplete
group by t.id, t.date, t.scope, t.legacy_difference
order by t.date;

-- 4. Verificar que todas las filas compartidas tengan hogar.
select 'accounts' as table_name, count(*) as missing_household
from public.accounts where scope = 'SHARED' and household_id is null
union all
select 'transactions', count(*)
from public.transactions where scope = 'SHARED' and household_id is null
union all
select 'recurring_bills', count(*)
from public.recurring_bills where scope = 'SHARED' and household_id is null;

-- 5. Totales y conteos de control para comparar con la copia interna.
select 'accounts' as table_name, count(*) as row_count from public.accounts
union all select 'transactions', count(*) from public.transactions
union all select 'transaction_lines', count(*) from public.transaction_lines
union all select 'recurring_bills', count(*) from public.recurring_bills
union all select 'profiles', count(*) from public.profiles;

select source_table, row_count, captured_at
from backup_20260716.backup_manifest
order by source_table;

-- 6. Saldos calculados sin modificar registros.
select id, name, type, scope, current_balance
from public.account_balances_v2
order by scope, type, name;

-- 7. Cada reversión debe cancelar exactamente, cuenta por cuenta, al original.
select
  reversal.id as reversal_id,
  reversal.reversal_of,
  lines.account_id,
  round(sum(lines.amount), 2) as difference
from public.transactions reversal
join public.transactions original on original.id = reversal.reversal_of
join public.transaction_lines lines
  on lines.transaction_id in (reversal.id, original.id)
where reversal.is_reversal = true
group by reversal.id, reversal.reversal_of, lines.account_id
having round(sum(lines.amount), 2) <> 0;

-- 8. No debe haber reversiones sin original ni originales sin marca de anulación.
select reversal.id, reversal.reversal_of
from public.transactions reversal
left join public.transactions original on original.id = reversal.reversal_of
where reversal.is_reversal = true
  and (original.id is null or original.voided_at is null);

-- 9. Los marcadores de pago deben apuntar a movimientos vigentes.
select payment.id, payment.bill_id, payment.transaction_id
from public.recurring_bill_payments payment
left join public.recurring_bills bill on bill.id = payment.bill_id
left join public.transactions tx on tx.id = payment.transaction_id
where bill.id is null
   or tx.id is null
   or (payment.voided_at is null and tx.voided_at is not null)
   or (payment.voided_at is not null and tx.voided_at is null);
