-- Fotos privadas para cuentas del panel sin colaborador vinculado.
-- Nombre visible: metadatos de Auth; nunca se usan para autorizar permisos.
begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('admin-perfil-fotos','admin-perfil-fotos',false,524288,array['image/webp','image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.dash_puede_editar_foto_admin(p_bucket text,p_name text)
returns boolean language sql stable security definer set search_path=public
as $$
  select p_bucket='admin-perfil-fotos'
    and p_name in (auth.uid()::text||'/avatar.webp',auth.uid()::text||'/avatar.jpg')
    and public.dash_sesion_vigente()
    and exists(select 1 from public.asis_perfiles where id=auth.uid() and acceso_panel);
$$;
revoke all on function public.dash_puede_editar_foto_admin(text,text) from public,anon;
grant execute on function public.dash_puede_editar_foto_admin(text,text) to authenticated;

drop policy if exists "admin foto propia" on storage.objects;
create policy "admin foto propia" on storage.objects for all to authenticated
using (public.dash_puede_editar_foto_admin(bucket_id,name))
with check (public.dash_puede_editar_foto_admin(bucket_id,name));

notify pgrst,'reload schema';
commit;
