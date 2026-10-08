-- Agrega chambeadora69@gmail.com a la pestana Direccion de Mensajes.
-- Ejecutar completo en el SQL Editor de Supabase despues de:
--   dashboard_105_alta_admin_chambeadora.sql
--   chat_08_identidad_administrador.sql (nombre visible y foto del administrador)
-- Conserva los contactos existentes, el nombre visible y la foto configurados.
begin;

do $$
declare
  v_uid uuid;
  v_total integer;
begin
  select count(*)::integer, (array_agg(id))[1]
    into v_total, v_uid
    from auth.users
   where lower(btrim(email)) = 'chambeadora69@gmail.com';

  if v_total <> 1 then
    raise exception 'Debe existir exactamente una cuenta chambeadora69@gmail.com en Authentication; encontrados: %.', v_total;
  end if;

  if not exists (
    select 1 from public.asis_perfiles
     where id = v_uid and activo and acceso_panel and rol = 'direccion'
  ) then
    raise exception 'La cuenta chambeadora69@gmail.com debe tener un perfil administrativo activo con rol direccion.';
  end if;

  if to_regprocedure('public.chat_fotos_perfiles()') is null then
    raise exception 'Ejecuta primero chat_08_identidad_administrador.sql para mostrar el nombre visible y la foto en Mensajes.';
  end if;

  insert into public.chat_direccion_contactos (perfil_id)
  values (v_uid)
  on conflict (perfil_id) do nothing;
end;
$$;

commit;

-- Debe devolver una fila con estado OK y el nombre visible configurado.
select
  u.email,
  coalesce(nullif(left(btrim(u.raw_user_meta_data->>'kja_nombre_visible'),80),''),p.nombre) as nombre_visible,
  u.raw_user_meta_data->>'kja_admin_foto' as foto_perfil,
  case when p.activo and p.acceso_panel and p.rol = 'direccion'
    and d.perfil_id is not null then 'OK' else 'REVISAR' end as estado
from auth.users u
join public.asis_perfiles p on p.id = u.id
left join public.chat_direccion_contactos d on d.perfil_id = p.id
where lower(btrim(u.email)) = 'chambeadora69@gmail.com';
