-- ============================================================================
-- M2: rate limiting del proxy de IA (ai-chat) por usuario/minuto.
-- El endpoint llama a APIs de pago; aunque exige auth + membresía + permiso
-- use_ai, conviene limitar el abuso/costos. Contador atómico en BD; la Edge
-- Function lo consulta con service_role pasando el user id explícito.
-- ============================================================================
create table if not exists public.ai_usage (
  user_id uuid not null,
  window_minute timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_minute)
);

-- Sin políticas RLS => ningún cliente (anon/authenticated) puede leer/escribir.
-- La función security definer y el service_role son los únicos que la tocan.
alter table public.ai_usage enable row level security;

create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_count int;
begin
  insert into public.ai_usage (user_id, window_minute, count)
  values (p_user, v_minute, 1)
  on conflict (user_id, window_minute)
  do update set count = public.ai_usage.count + 1
  returning count into v_count;

  -- limpieza oportunista de ventanas viejas del usuario
  delete from public.ai_usage
   where user_id = p_user and window_minute < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

-- Solo el service_role (Edge Function) puede ejecutarla.
revoke execute on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
