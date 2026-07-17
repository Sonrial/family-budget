-- Ejecutar después de publicar la interfaz que usa post_transaction.
-- Desde este punto, ningún cliente puede crear asientos parciales por REST.

begin;

drop policy if exists transactions_insert_transition on public.transactions;
drop policy if exists transaction_lines_insert_transition on public.transaction_lines;

revoke insert on public.transactions from authenticated;
revoke insert on public.transaction_lines from authenticated;

commit;
