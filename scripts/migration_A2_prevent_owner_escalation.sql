-- ============================================================================
-- A2: impedir la escalada de privilegios admin -> owner.
-- Dos vectores existentes:
--   1) organizations.owner_id: orgs_update_admin deja a cualquier admin
--      actualizar la org sin proteger owner_id => un admin podía ponerse de dueño.
--   2) organization_members.role: members_update_admin deja a un admin poner
--      role='owner' (a sí mismo u otros).
-- RLS no puede comparar OLD/NEW, así que usamos triggers SECURITY DEFINER.
-- Solo el DUEÑO REAL (organizations.owner_id) puede transferir la propiedad o
-- asignar/modificar el rol 'owner'.
-- ============================================================================

-- 1. Proteger organizations.owner_id (solo el dueño actual puede transferir).
create or replace function private.guard_org_owner()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and old.owner_id is distinct from (select auth.uid()) then
    raise exception 'Solo el dueño puede transferir la propiedad de la organización';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_org_owner on public.organizations;
create trigger trg_guard_org_owner
  before update on public.organizations
  for each row execute function private.guard_org_owner();

-- 2. Proteger el rol 'owner' en organization_members.
create or replace function private.guard_member_owner_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.organizations where id = new.organization_id;

  -- Nadie salvo el dueño real puede crear/asignar el rol 'owner'.
  if new.role = 'owner' and (select auth.uid()) is distinct from v_owner then
    raise exception 'Solo el dueño puede asignar el rol de propietario';
  end if;

  -- Nadie salvo el dueño real puede modificar una fila que YA es 'owner'.
  if tg_op = 'UPDATE' and old.role = 'owner'
     and (select auth.uid()) is distinct from v_owner then
    raise exception 'Solo el dueño puede modificar al propietario';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_member_owner_role on public.organization_members;
create trigger trg_guard_member_owner_role
  before insert or update on public.organization_members
  for each row execute function private.guard_member_owner_role();
