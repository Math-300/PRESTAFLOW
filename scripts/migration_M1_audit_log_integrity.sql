-- ============================================================================
-- M1: integridad de audit_logs.
-- El cliente inserta los logs con actor/created_at arbitrarios => un miembro
-- podía suplantar a otro (actor falso) o alterar la fecha. No se puede eliminar
-- la escritura client-side sin reescribir el logging, pero sí endurecerla:
-- forzar actor = email del usuario autenticado y created_at = now() en el server.
-- (Las inserciones con service_role —sin JWT de usuario— conservan lo enviado.)
-- ============================================================================
create or replace function private.stamp_audit_log()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.actor := coalesce((select auth.jwt() ->> 'email'), new.actor);
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_audit_log on public.audit_logs;
create trigger trg_stamp_audit_log
  before insert on public.audit_logs
  for each row execute function private.stamp_audit_log();
