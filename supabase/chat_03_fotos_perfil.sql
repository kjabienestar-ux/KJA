-- Ejecutar después de chat_02_direccion_contactos.sql y dashboard_10_fotos_perfil.sql.
-- Fotos existentes del directorio: lectura privada para cuentas activas del chat.
begin;

create or replace function public.chat_fotos()
returns table(id uuid, foto_path text, foto_actualizada_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
    select p.id,c.foto_path,c.foto_actualizada_at
    from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where p.activo and c.activo and p.id<>auth.uid()
      and c.foto_path in (c.id::text||'/avatar.webp',c.id::text||'/avatar.jpg');
end;
$$;

create or replace function public.chat_puede_ver_foto(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.chat_activo() and exists (
    select 1 from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where p.activo and c.activo and c.foto_path=p_path
      and c.foto_path in (c.id::text||'/avatar.webp',c.id::text||'/avatar.jpg')
  );
$$;

revoke all on function public.chat_fotos(), public.chat_puede_ver_foto(text) from public, anon, authenticated;
grant execute on function public.chat_fotos(), public.chat_puede_ver_foto(text) to authenticated;
drop policy if exists "perfil fotos: directorio chat" on storage.objects;
create policy "perfil fotos: directorio chat" on storage.objects
  for select to authenticated using (
    bucket_id='perfil-fotos' and public.chat_puede_ver_foto(name)
  );

-- No hace público el bucket ni cambia las reglas de subida/borrado.
notify pgrst, 'reload schema';
commit;
