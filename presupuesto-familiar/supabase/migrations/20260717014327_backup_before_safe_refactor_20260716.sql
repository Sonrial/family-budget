-- Copia interna previa a la refactorización financiera.
-- No incluye auth.users ni credenciales; conserva las tablas funcionales
-- necesarias para reconstruir los siete meses de historia.

begin;

create schema if not exists backup_20260716;
revoke all on schema backup_20260716 from public, anon, authenticated;

create table backup_20260716.profiles
  (like public.profiles including all);
create table backup_20260716.accounts
  (like public.accounts including all);
create table backup_20260716.transactions
  (like public.transactions including all);
create table backup_20260716.transaction_lines
  (like public.transaction_lines including all);
create table backup_20260716.recurring_bills
  (like public.recurring_bills including all);

insert into backup_20260716.profiles select * from public.profiles;
insert into backup_20260716.accounts select * from public.accounts;
insert into backup_20260716.transactions select * from public.transactions;
insert into backup_20260716.transaction_lines select * from public.transaction_lines;
insert into backup_20260716.recurring_bills select * from public.recurring_bills;

create table backup_20260716.backup_manifest (
  source_table text primary key,
  row_count bigint not null,
  captured_at timestamptz not null default now()
);

insert into backup_20260716.backup_manifest (source_table, row_count)
values
  ('profiles', (select count(*) from backup_20260716.profiles)),
  ('accounts', (select count(*) from backup_20260716.accounts)),
  ('transactions', (select count(*) from backup_20260716.transactions)),
  ('transaction_lines', (select count(*) from backup_20260716.transaction_lines)),
  ('recurring_bills', (select count(*) from backup_20260716.recurring_bills));

revoke all on all tables in schema backup_20260716
  from public, anon, authenticated;

commit;
