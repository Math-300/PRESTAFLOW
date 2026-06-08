-- ============================================================================
-- PRESTA FLOW - SCHEMA COMPLETO
-- Reconstruido desde el código (el proyecto Supabase anterior fue eliminado).
-- Proyecto nuevo: fzdzyjdryjlfuvaxyuzv
-- NOTA: clients/transactions/bank_accounts usan columnas camelCase (entre
-- comillas) porque el código JS envía los objetos sin mapear. settings y las
-- tablas de organización usan snake_case. NO cambiar sin cambiar el código.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. Schema privado para funciones de seguridad (no expuesto por la Data API)
-- ----------------------------------------------------------------------------
create schema if not exists private;

-- ----------------------------------------------------------------------------
-- 1. PROFILES (espejo de auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Trigger: crear profile automaticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. ORGANIZATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS
-- ----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_org_members_org_user on public.organization_members(organization_id, user_id);
create index if not exists idx_org_members_user on public.organization_members(user_id);

-- ----------------------------------------------------------------------------
-- 4. FUNCIONES DE SEGURIDAD (security definer, en schema privado)
--    Evitan recursion infinita en las politicas RLS de organization_members.
-- ----------------------------------------------------------------------------
create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function private.is_org_admin(org_id uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

create or replace function private.shares_org_with(profile_id uuid)
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m1.organization_id = m2.organization_id
    where m1.user_id = auth.uid() and m2.user_id = profile_id
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. ORGANIZATION INVITATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (organization_id, invited_email)
);

-- ----------------------------------------------------------------------------
-- 6. SETTINGS (snake_case - el codigo mapea explicitamente)
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text,
  default_interest_rate numeric default 5,
  use_openai boolean default false,
  api_key text,
  n8n_webhook_url text,
  max_card_limit numeric default 500,
  ai_provider text default 'GEMINI',
  ai_api_key text,
  ai_agent_name text default 'LuchoBot',
  ai_system_prompt text,
  ui_config jsonb,
  created_at timestamptz default now(),
  unique (organization_id)
);

-- ----------------------------------------------------------------------------
-- 7. CLIENTS (camelCase - el codigo inserta el objeto JS directo)
--    Campos de fecha y referencias son text porque el front envia '' a veces.
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  "cardCode" text,
  cedula text,
  name text not null,
  phone text,
  address text,
  occupation text,
  "workAddress" text,
  "loanLimit" numeric,
  "referrerId" text,
  status text default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','BAD_DEBT')),
  "creditStartDate" text,
  "nextPaymentDate" text,
  "interestRate" numeric,
  "paymentFrequency" text,
  "interestType" text,
  "loanTermMonths" numeric,
  "installmentsCount" numeric,
  "installmentAmount" numeric,
  "pendingRedirectionBalance" numeric,
  "redirectionWaitDays" numeric,
  "guarantorName" text,
  "guarantorPhone" text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_clients_org on public.clients(organization_id);
create index if not exists idx_clients_org_status on public.clients(organization_id, status);

-- ----------------------------------------------------------------------------
-- 8. TRANSACTIONS (camelCase - igual que clients)
--    "clientId" es text porque puede ser un uuid o el literal 'BANK_INTERNAL'.
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  "clientId" text not null,
  date text,
  type text not null,
  amount numeric not null default 0,
  "interestPaid" numeric default 0,
  "capitalPaid" numeric default 0,
  "balanceAfter" numeric default 0,
  notes text,
  "relatedTransactionId" text,
  "relatedClientId" text,
  "bankAccountId" text,
  "receiptUrl" text,
  created_at timestamptz default now()
);

create index if not exists idx_tx_org on public.transactions(organization_id);
create index if not exists idx_tx_client on public.transactions("clientId");
create index if not exists idx_tx_org_date on public.transactions(organization_id, date);

-- ----------------------------------------------------------------------------
-- 9. BANK ACCOUNTS (camelCase)
-- ----------------------------------------------------------------------------
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  "accountNumber" text,
  balance numeric default 0,
  "isCash" boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_banks_org on public.bank_accounts(organization_id);

-- ----------------------------------------------------------------------------
-- 10. AUDIT LOGS
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz default now(),
  level text default 'INFO' check (level in ('INFO','SUCCESS','WARNING','ERROR')),
  message text,
  actor text,
  action text check (action in ('CREATE','UPDATE','DELETE','LOGIN','SYSTEM')),
  entity text check (entity in ('CLIENT','TRANSACTION','SETTINGS','BANK','AUTH','SYSTEM')),
  details text
);

create index if not exists idx_audit_org_created on public.audit_logs(organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 11. PERMISSIONS
-- ----------------------------------------------------------------------------
create table if not exists public.permissions_definition (
  slug text primary key,
  name text not null,
  description text
);

insert into public.permissions_definition (slug, name, description) values
  ('view_clients',        'Ver Clientes',             'Puede ver la lista y el detalle de clientes'),
  ('create_clients',      'Crear Clientes',           'Puede registrar nuevos clientes'),
  ('edit_clients',        'Editar Clientes',          'Puede modificar datos de clientes'),
  ('delete_clients',      'Eliminar Clientes',        'Puede eliminar clientes y su historial'),
  ('create_transactions', 'Crear Transacciones',      'Puede registrar pagos y desembolsos'),
  ('delete_transactions', 'Eliminar Transacciones',   'Puede eliminar transacciones'),
  ('manage_banks',        'Gestionar Bancos',         'Puede crear y ajustar cuentas bancarias'),
  ('manage_team',         'Gestionar Equipo',         'Puede invitar y administrar miembros'),
  ('manage_settings',     'Gestionar Configuración',  'Puede cambiar la configuración de la organización'),
  ('view_audit_logs',     'Ver Auditoría',            'Puede ver el registro de auditoría')
on conflict (slug) do nothing;

create table if not exists public.member_permissions (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  permission_slug text not null references public.permissions_definition(slug) on delete cascade,
  is_enabled boolean not null default true,
  primary key (member_id, permission_slug)
);

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.transactions enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.permissions_definition enable row level security;
alter table public.member_permissions enable row level security;

-- PROFILES
create policy "profiles_select_self_or_comember" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ORGANIZATIONS
create policy "orgs_select_member_or_owner" on public.organizations
  for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_org_member(id));

create policy "orgs_insert_owner" on public.organizations
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "orgs_update_admin" on public.organizations
  for update to authenticated
  using (private.is_org_admin(id))
  with check (private.is_org_admin(id));

create policy "orgs_delete_owner" on public.organizations
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ORGANIZATION MEMBERS
create policy "members_select_comember" on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_member(organization_id));

-- Insert: (a) el dueño se agrega al crear la org, (b) un usuario invitado se
-- agrega a si mismo con el rol de su invitacion pendiente y vigente.
create policy "members_insert_owner_or_invited" on public.organization_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.owner_id = (select auth.uid())
      )
      or exists (
        select 1 from public.organization_invitations i
        where i.organization_id = organization_members.organization_id
          and lower(i.invited_email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
          and i.status = 'pending'
          and i.role = organization_members.role
          and (i.expires_at is null or i.expires_at > now())
      )
    )
  );

create policy "members_update_admin" on public.organization_members
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy "members_delete_admin_or_self" on public.organization_members
  for delete to authenticated
  using (private.is_org_admin(organization_id) or user_id = (select auth.uid()));

-- ORGANIZATION INVITATIONS
create policy "invites_select_admin_or_invited" on public.organization_invitations
  for select to authenticated
  using (
    private.is_org_member(organization_id)
    or lower(invited_email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

create policy "invites_insert_admin" on public.organization_invitations
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy "invites_delete_admin_or_invited" on public.organization_invitations
  for delete to authenticated
  using (
    private.is_org_admin(organization_id)
    or lower(invited_email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

-- ----------------------------------------------------------------------------
-- PERMISOS GRANULARES (member_permissions) APLICADOS EN RLS  [migracion C1]
-- Modelo opt-out: admin/owner siempre pasan; un miembro tiene el permiso salvo
-- que exista una fila member_permissions con is_enabled=false (igual que el front).
-- ----------------------------------------------------------------------------
create or replace function private.has_perm(org_id uuid, perm_slug text)
returns boolean
language sql
security definer set search_path = ''
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

-- SETTINGS (SELECT abierto a miembros para que cargue la app)
create policy "settings_select" on public.settings
  for select to authenticated using (private.is_org_member(organization_id));
create policy "settings_insert" on public.settings
  for insert to authenticated with check (private.has_perm(organization_id, 'manage_settings'));
create policy "settings_update" on public.settings
  for update to authenticated
  using (private.has_perm(organization_id, 'manage_settings'))
  with check (private.has_perm(organization_id, 'manage_settings'));

-- CLIENTS
create policy "clients_select" on public.clients
  for select to authenticated using (private.is_org_member(organization_id));
create policy "clients_insert" on public.clients
  for insert to authenticated with check (private.has_perm(organization_id, 'create_clients'));
create policy "clients_update" on public.clients
  for update to authenticated
  using (private.has_perm(organization_id, 'edit_clients'))
  with check (private.has_perm(organization_id, 'edit_clients'));
create policy "clients_delete" on public.clients
  for delete to authenticated using (private.has_perm(organization_id, 'delete_clients'));

-- TRANSACTIONS (UPDATE permitido a create/delete por el recalculo de balances)
create policy "transactions_select" on public.transactions
  for select to authenticated using (private.is_org_member(organization_id));
create policy "transactions_insert" on public.transactions
  for insert to authenticated with check (private.has_perm(organization_id, 'create_transactions'));
create policy "transactions_update" on public.transactions
  for update to authenticated
  using (private.has_perm(organization_id, 'create_transactions') or private.has_perm(organization_id, 'delete_transactions'))
  with check (private.has_perm(organization_id, 'create_transactions') or private.has_perm(organization_id, 'delete_transactions'));
create policy "transactions_delete" on public.transactions
  for delete to authenticated using (private.has_perm(organization_id, 'delete_transactions'));

-- BANK ACCOUNTS (UPDATE de saldo ocurre al registrar/eliminar transacciones)
create policy "banks_select" on public.bank_accounts
  for select to authenticated using (private.is_org_member(organization_id));
create policy "banks_insert" on public.bank_accounts
  for insert to authenticated with check (private.has_perm(organization_id, 'manage_banks'));
create policy "banks_update" on public.bank_accounts
  for update to authenticated
  using (private.has_perm(organization_id, 'manage_banks') or private.has_perm(organization_id, 'create_transactions') or private.has_perm(organization_id, 'delete_transactions'))
  with check (private.has_perm(organization_id, 'manage_banks') or private.has_perm(organization_id, 'create_transactions') or private.has_perm(organization_id, 'delete_transactions'));
create policy "banks_delete" on public.bank_accounts
  for delete to authenticated using (private.has_perm(organization_id, 'manage_banks'));

-- AUDIT LOGS (lectura restringida a view_audit_logs; insert abierto a miembros)
create policy "audit_select" on public.audit_logs
  for select to authenticated using (private.has_perm(organization_id, 'view_audit_logs'));

create policy "audit_member_insert" on public.audit_logs
  for insert to authenticated
  with check (private.is_org_member(organization_id));

-- [M1] Integridad: forzar actor (email del JWT) y created_at del lado del server.
create or replace function private.stamp_audit_log()
returns trigger language plpgsql security definer set search_path = ''
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

-- PERMISSIONS
create policy "permdef_select_authenticated" on public.permissions_definition
  for select to authenticated
  using (true);

create policy "memberperms_select_self_or_admin" on public.member_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.id = member_permissions.member_id
        and (m.user_id = (select auth.uid()) or private.is_org_admin(m.organization_id))
    )
  );

create policy "memberperms_write_admin" on public.member_permissions
  for all to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.id = member_permissions.member_id
        and private.is_org_admin(m.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.id = member_permissions.member_id
        and private.is_org_admin(m.organization_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 12b. ANTI-ESCALADA DE PRIVILEGIOS [A2]
--      Solo el dueño real (organizations.owner_id) puede transferir la propiedad
--      o asignar/modificar el rol 'owner'. RLS no compara OLD/NEW => triggers.
-- ----------------------------------------------------------------------------
create or replace function private.guard_org_owner()
returns trigger language plpgsql security definer set search_path = ''
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

create or replace function private.guard_member_owner_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.organizations where id = new.organization_id;
  if new.role = 'owner' and (select auth.uid()) is distinct from v_owner then
    raise exception 'Solo el dueño puede asignar el rol de propietario';
  end if;
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

-- ----------------------------------------------------------------------------
-- 13. STORAGE: bucket 'receipts' (PRIVADO; acceso vía signed URLs temporales)
--     Estructura de carpetas: {organization_id}/{year}/{archivo}
--     [A1] Antes era público (lectura sin auth). Ahora privado + lectura solo
--     para miembros. El código guarda el PATH y usa createSignedUrl al mostrar.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

create policy "receipts_member_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.organization_id::text = (storage.foldername(name))[1]
    )
  );

create policy "receipts_member_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.organization_id::text = (storage.foldername(name))[1]
    )
  );
