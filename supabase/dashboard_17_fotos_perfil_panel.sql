-- ============================================================================
-- KJA · Dashboard 17 — fotos de perfil visibles en el panel autorizado
--
-- Corrige la lectura del bucket privado: además del propio usuario y su líder,
-- las cuentas activas del panel pueden leer las fotos que ya están autorizadas
-- a consultar en Administración. No hace público el bucket.
-- ============================================================================

begin;

drop policy if exists "perfil fotos: lectura autorizada" on storage.objects;
create policy "perfil fotos: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and name ~ '^[0-9]+/avatar\.(webp|jpg)$'
    and (
      public.asis_es_miembro()
      or public.puede_ver_colab(split_part(name, '/', 1)::bigint)
    )
  );

notify pgrst, 'reload schema';

commit;

select case when count(*) = 1 then 'OK' else 'REVISAR' end estado,
       'lectura privada de fotos para panel' pieza
  from pg_policies
 where schemaname = 'storage'
   and tablename = 'objects'
   and policyname = 'perfil fotos: lectura autorizada';
