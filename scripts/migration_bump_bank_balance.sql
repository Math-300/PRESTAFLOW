-- Saldo bancario atómico (resuelve race de read-modify-write). NO aplicado aún.
create or replace function public.bump_bank_balance(p_bank_id uuid, p_delta numeric, p_allow_negative boolean default false)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_new numeric;
begin
  update public.bank_accounts set balance = balance + p_delta
   where id = p_bank_id returning balance into v_new;
  if v_new is null then raise exception 'cuenta no encontrada'; end if;
  if not p_allow_negative and v_new < 0 then raise exception 'Fondos insuficientes'; end if;
  return v_new;
end $$;
revoke all on function public.bump_bank_balance(uuid,numeric,boolean) from public, anon;
grant execute on function public.bump_bank_balance(uuid,numeric,boolean) to authenticated;
