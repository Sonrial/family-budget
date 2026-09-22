begin;
select set_config('request.jwt.claim.sub', (select user_id::text from public.accounts where scope='PERSONAL' and type='ASSET' and archived_at is null order by id limit 1), true);
select set_config('test.other_account', (select id::text from public.accounts where scope='PERSONAL' and user_id <> auth.uid() and type='ASSET' and archived_at is null limit 1), true);
set local role authenticated;
do $test$
declare a public.accounts%rowtype; v_id uuid; v_exp uuid; v_before numeric; v_after numeric; v_bill uuid; v_corrected uuid;
begin
  select * into a from public.accounts where user_id=auth.uid() and scope='PERSONAL' and type='ASSET' and archived_at is null order by id limit 1;
  select coalesce(sum(amount),0) into v_before from public.transaction_lines where account_id=a.id;
  perform public.rename_account(a.id, 'Prueba temporal sin guardar', 'TEST', a.name, a.icon);
  if (select name from public.accounts where id=a.id) <> 'Prueba temporal sin guardar' then raise exception 'TEST_RENAME_FAILED'; end if;
  select coalesce(sum(amount),0) into v_after from public.transaction_lines where account_id=a.id;
  if v_before is distinct from v_after then raise exception 'TEST_BALANCE_CHANGED'; end if;
  begin
    perform public.rename_account(a.id,'Conflicto','',a.name,a.icon);
    raise exception 'TEST_CONFLICT_NOT_REJECTED';
  exception when raise_exception then if sqlerrm <> 'ACCOUNT_CHANGED' then raise; end if; end;
  begin
    perform public.rename_account(current_setting('test.other_account')::uuid,'No permitido','',null,null);
    raise exception 'TEST_ACCESS_NOT_REJECTED';
  exception when raise_exception then if sqlerrm <> 'ACCOUNT_ACCESS_DENIED' then raise; end if; end;
  begin
    perform public.rename_account(a.id,'   ','',null,null);
    raise exception 'TEST_EMPTY_NOT_REJECTED';
  exception when raise_exception then if sqlerrm <> 'INVALID_ACCOUNT_LABEL' then raise; end if; end;
  begin
    perform public.post_transaction('Prueba',null,'GASTO','PERSONAL',current_date,null,null);
    raise exception 'TEST_NULL_LINES_NOT_REJECTED';
  exception when raise_exception then if sqlerrm <> 'INVALID_TRANSACTION_LINES' then raise; end if; end;
  select id into v_exp from public.accounts where user_id=auth.uid() and scope='PERSONAL' and type='EXPENSE' and archived_at is null order by id limit 1;
  if v_exp is null then raise exception 'TEST_EXPENSE_MISSING'; end if;
  v_id := public.post_transaction('Prueba temporal',null,'GASTO','PERSONAL',current_date,null,
    jsonb_build_array(jsonb_build_object('account_id',a.id,'amount',-1.25),jsonb_build_object('account_id',v_exp,'amount',1.25)));
  if (select sum(amount) from public.transaction_lines where transaction_id=v_id) <> 0 then raise exception 'TEST_NOT_BALANCED'; end if;
  insert into public.recurring_bills(title,amount,pay_day,category_id,scope,created_by)
    values ('Prueba temporal de obligación',1.25,1,v_exp,'PERSONAL',auth.uid()) returning id into v_bill;
  v_id := public.post_bill_payment(v_bill,current_date,'Prueba pago',null,'GASTO','PERSONAL',current_date,null,
    jsonb_build_array(jsonb_build_object('account_id',a.id,'amount',-1.25),jsonb_build_object('account_id',v_exp,'amount',1.25)));
  v_corrected := public.correct_transaction(v_id,'Prueba corrección',current_date,2.50);
  if not exists(select 1 from public.recurring_bill_payments where bill_id=v_bill and transaction_id=v_corrected and voided_at is null)
    then raise exception 'TEST_CORRECTED_PAYMENT_LOST'; end if;
  begin
    perform public.post_bill_payment(v_bill,current_date,'Duplicado',null,'GASTO','PERSONAL',current_date,null,
      jsonb_build_array(jsonb_build_object('account_id',a.id,'amount',-1.25),jsonb_build_object('account_id',v_exp,'amount',1.25)));
    raise exception 'TEST_DUPLICATE_PAYMENT_NOT_REJECTED';
  exception when raise_exception then if sqlerrm <> 'BILL_ALREADY_PAID' then raise; end if; end;
end;
$test$;
reset role;
select 'PASS: rename, unchanged balance, concurrent edit, access, empty name, null lines, balanced decimal write, bill correction marker, duplicate bill rejection (all rolled back)' as tests;
rollback;
