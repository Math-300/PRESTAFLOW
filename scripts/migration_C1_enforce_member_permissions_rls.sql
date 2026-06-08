-- ============================================================================
-- C1: Aplicar permisos granulares (member_permissions) a nivel de RLS.
-- Antes, las políticas eran FOR ALL con solo is_org_member => cualquier miembro
-- podía crear/editar/borrar todo vía API directa, saltándose la UI.
-- Modelo opt-out: admin/owner siempre pasan; un miembro tiene el permiso salvo
-- que exista una fila member_permissions con is_enabled=false (igual que el front).
--
-- SEGURO PARA LOS MIEMBROS ACTUALES: ambos son owner/admin => is_org_admin=true
-- => has_perm devuelve true para todo. No se rompe nada existente.
-- ============================================================================

create or replace function private.has_perm(org_id uuid, perm_slug text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_org_admin(org_id)
      or exists (
        select 1
        from public.organization_members m
        left join public.member_permissions mp
          on mp.member_id = m.id and mp.permission_slug = perm_slug
        where m.organization_id = org_id
          and m.user_id = auth.uid()
          and coalesce(mp.is_enabled, true)
      );
$$;

-- ----------------------------------------------------------------------------
-- CLIENTS
-- ----------------------------------------------------------------------------
drop policy if exists "clients_member_all" on public.clients;

create policy "clients_select" on public.clients
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (private.has_perm(organization_id, 'create_clients'));

create policy "clients_update" on public.clients
  for update to authenticated
  using (private.has_perm(organization_id, 'edit_clients'))
  with check (private.has_perm(organization_id, 'edit_clients'));

create policy "clients_delete" on public.clients
  for delete to authenticated
  using (private.has_perm(organization_id, 'delete_clients'));

-- ----------------------------------------------------------------------------
-- TRANSACTIONS  (UPDATE permitido a create/delete por el recalculo de balances)
-- ----------------------------------------------------------------------------
drop policy if exists "transactions_member_all" on public.transactions;

create policy "transactions_select" on public.transactions
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy "transactions_insert" on public.transactions
  for insert to authenticated
  with check (private.has_perm(organization_id, 'create_transactions'));

create policy "transactions_update" on public.transactions
  for update to authenticated
  using (private.has_perm(organization_id, 'create_transactions')
      or private.has_perm(organization_id, 'delete_transactions'))
  with check (private.has_perm(organization_id, 'create_transactions')
      or private.has_perm(organization_id, 'delete_transactions'));

create policy "transactions_delete" on public.transactions
  for delete to authenticated
  using (private.has_perm(organization_id, 'delete_transactions'));

-- ----------------------------------------------------------------------------
-- BANK ACCOUNTS  (UPDATE de saldo ocurre al registrar/eliminar transacciones)
-- ----------------------------------------------------------------------------
drop policy if exists "banks_member_all" on public.bank_accounts;

create policy "banks_select" on public.bank_accounts
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy "banks_insert" on public.bank_accounts
  for insert to authenticated
  with check (private.has_perm(organization_id, 'manage_banks'));

create policy "banks_update" on public.bank_accounts
  for update to authenticated
  using (private.has_perm(organization_id, 'manage_banks')
      or private.has_perm(organization_id, 'create_transactions')
      or private.has_perm(organization_id, 'delete_transactions'))
  with check (private.has_perm(organization_id, 'manage_banks')
      or private.has_perm(organization_id, 'create_transactions')
      or private.has_perm(organization_id, 'delete_transactions'));

create policy "banks_delete" on public.bank_accounts
  for delete to authenticated
  using (private.has_perm(organization_id, 'manage_banks'));

-- ----------------------------------------------------------------------------
-- SETTINGS  (SELECT sigue abierto a miembros para que cargue la app)
-- ----------------------------------------------------------------------------
drop policy if exists "settings_member_all" on public.settings;

create policy "settings_select" on public.settings
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy "settings_insert" on public.settings
  for insert to authenticated
  with check (private.has_perm(organization_id, 'manage_settings'));

create policy "settings_update" on public.settings
  for update to authenticated
  using (private.has_perm(organization_id, 'manage_settings'))
  with check (private.has_perm(organization_id, 'manage_settings'));

-- ----------------------------------------------------------------------------
-- AUDIT LOGS  (lectura restringida a view_audit_logs; insert sigue abierto)
-- ----------------------------------------------------------------------------
drop policy if exists "audit_member_select" on public.audit_logs;

create policy "audit_select" on public.audit_logs
  for select to authenticated
  using (private.has_perm(organization_id, 'view_audit_logs'));
