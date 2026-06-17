-- Saldo bancario atómico (resuelve race de read-modify-write). NO aplicado aún.
-- SEGURIDAD: es security definer (bypassa RLS), así que valida explícitamente que
-- la cuenta pertenezca a una organización donde el usuario es miembro.
create or replace function public.bump_bank_balance(p_bank_id uuid, p_delta numeric, p_allow_negative boolean default false)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_new numeric;
begin
  -- Aislamiento por organización: solo cuentas de orgs del usuario que llama.
  if not exists (
    select 1 from public.bank_accounts b
     join public.organization_members m on m.organization_id = b.organization_id
    where b.id = p_bank_id and m.user_id = auth.uid()
  ) then
    raise exception 'Acceso denegado a la cuenta';
  end if;

  update public.bank_accounts set balance = balance + p_delta
   where id = p_bank_id returning balance into v_new;
  if v_new is null then raise exception 'cuenta no encontrada'; end if;
  if not p_allow_negative and v_new < 0 then raise exception 'Fondos insuficientes'; end if;
  return v_new;
end $$;
revoke all on function public.bump_bank_balance(uuid,numeric,boolean) from public, anon;
grant execute on function public.bump_bank_balance(uuid,numeric,boolean) to authenticated;
