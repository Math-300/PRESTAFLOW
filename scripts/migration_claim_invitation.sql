-- Función para reclamar una invitación por token. NO aplicada aún.
-- Verifica que el email del JWT coincide con invited_email, inserta en organization_members
-- y marca/elimina la invitación. Todo ocurre en la misma transacción implícita.
create or replace function public.claim_invitation(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invite record;
begin
  -- Buscar invitación pendiente, no expirada, por token
  select *
    into v_invite
    from public.organization_invitations
   where token = p_token
     and status = 'pending'
     and (expires_at is null or expires_at > now())
   limit 1;

  if not found then
    raise exception 'Invitación no válida o expirada';
  end if;

  -- Validar que el email del JWT coincide con el email invitado (case-insensitive)
  if lower(v_invite.invited_email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'El email de la sesión no coincide con la invitación';
  end if;

  -- Insertar en organization_members si no existe ya
  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, auth.uid(), v_invite.role)
  on conflict (organization_id, user_id) do nothing;

  -- Marcar la invitación como aceptada. NOTA: organization_invitations NO tiene
  -- columnas accepted_at/accepted_by; solo se actualiza status (alta de columnas
  -- de auditoría = migración aparte si se desea).
  update public.organization_invitations
     set status = 'accepted'
   where token = p_token;
end $$;

revoke all on function public.claim_invitation(text) from public, anon;
grant execute on function public.claim_invitation(text) to authenticated;
