-- ============================================================================
-- A1: el bucket 'receipts' contiene PII financiera (cédulas, comprobantes).
-- Estaba PÚBLICO (public=true), por lo que las lecturas pasaban por el endpoint
-- público que IGNORA RLS => cualquiera con la URL podía ver recibos sin login.
--
-- Fix: bucket privado + lectura SOLO a miembros de la organización dueña de la
-- carpeta. El acceso se hace vía signed URLs temporales (createSignedUrl), que
-- requieren este SELECT por RLS.
--
-- Requiere el cambio de código que guarda el PATH (no la URL pública) y resuelve
-- signed URLs al mostrar (utils/receipts.ts, components/ui/ReceiptImage.tsx).
-- ============================================================================

update storage.buckets set public = false where id = 'receipts';

drop policy if exists "receipts_public_read" on storage.objects;

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
