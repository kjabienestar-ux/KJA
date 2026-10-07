-- Requiere dashboard_103_perfil_administrador.sql y chat_03_fotos_perfil.sql.
begin;
create or replace function public.chat_contactos()
returns table(id uuid, nombre text, direccion boolean, activo boolean,
  ultimo text, ultimo_at timestamptz, no_leidos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_activo() then raise exception 'Tu cuenta no tiene acceso al chat.'; end if;
  return query
  select p.id,coalesce(case when p.acceso_panel then nullif(left(btrim(u.raw_user_meta_data->>'kja_nombre_visible'),80),'') end,p.nombre),
    (p.activo and p.rol='direccion' and exists(
      select 1 from public.chat_direccion_contactos d where d.perfil_id=p.id
    )),p.activo,m.contenido,m.creado_at,
    (select count(*) from public.chat_mensajes n where n.destinatario=auth.uid() and n.remitente=p.id and n.leido_at is null)
  from public.asis_perfiles p
  left join auth.users u on u.id=p.id
  left join lateral (
    select c.contenido,c.creado_at from public.chat_mensajes c
    where (c.remitente=auth.uid() and c.destinatario=p.id) or (c.destinatario=auth.uid() and c.remitente=p.id)
    order by c.id desc limit 1
  ) m on true
  where p.id<>auth.uid() and (p.activo or m.creado_at is not null)
  order by m.creado_at desc nulls last,p.nombre,p.id;
end;
$$;
revoke all on function public.chat_contactos() from public, anon;
grant execute on function public.chat_contactos() to authenticated;

create or replace function public.chat_fotos_perfiles()
returns table(id uuid,foto_path text,foto_actualizada_at text,bucket text)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_activo() then raise exception 'Sin acceso al chat'; end if;
 return query
 select f.id,f.foto_path,f.foto_actualizada_at::text,'perfil-fotos'::text from public.chat_fotos() f
 union all
 select p.id,u.raw_user_meta_data->>'kja_admin_foto',u.raw_user_meta_data->>'kja_admin_foto_fecha','admin-perfil-fotos'::text
 from public.asis_perfiles p join auth.users u on u.id=p.id
 where p.activo and p.acceso_panel and p.colaborador_id is null and p.id<>auth.uid()
 and u.raw_user_meta_data->>'kja_admin_foto' in (p.id::text||'/avatar.jpg',p.id::text||'/avatar.webp');
end;
$$;
create or replace function public.chat_puede_ver_foto_admin(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.chat_activo() and exists (
 select 1 from public.asis_perfiles p join auth.users u on u.id=p.id
 where p.activo and p.acceso_panel and p.colaborador_id is null
 and p_path in (p.id::text||'/avatar.jpg',p.id::text||'/avatar.webp')
 and u.raw_user_meta_data->>'kja_admin_foto'=p_path);
$$;
revoke all on function public.chat_fotos_perfiles(),public.chat_puede_ver_foto_admin(text) from public,anon;
grant execute on function public.chat_fotos_perfiles(),public.chat_puede_ver_foto_admin(text) to authenticated;
drop policy if exists "admin fotos: directorio chat" on storage.objects;
create policy "admin fotos: directorio chat" on storage.objects for select to authenticated
using (bucket_id='admin-perfil-fotos' and public.chat_puede_ver_foto_admin(name));
notify pgrst,'reload schema';
commit;
