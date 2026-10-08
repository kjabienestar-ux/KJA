-- Alta administrativa del dashboard: chambeadora69@gmail.com
-- 1. En Supabase > Authentication > Users > Add user, crear el correo
--    chambeadora69@gmail.com con correo confirmado y una contrasena que cumpla
--    la politica del proyecto. Si ya existe, usar esa misma cuenta.
-- 2. Ejecutar este archivo completo en el SQL Editor de Supabase.
-- 3. Comprobar estado OK e ingresar por el acceso administrativo del dashboard.
-- La contrasena se configura en Authentication y no se guarda en Git.
-- Nombre visible provisional: correo de la cuenta; se puede cambiar desde el perfil.
-- Requiere dashboard_01 y dashboard_03 ya aplicados.

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
    select 1 from auth.users
     where id = v_uid and email_confirmed_at is not null
  ) then
    raise exception 'Confirma el correo chambeadora69@gmail.com en Authentication antes de asignar el acceso.';
  end if;

  insert into public.asis_perfiles (
    id, nombre, rol, activo, nivel, acceso_panel
  ) values (
    v_uid, 'chambeadora69@gmail.com', 'direccion', true, 'sistemas', true
  )
  on conflict (id) do update set
    rol = excluded.rol,
    activo = excluded.activo,
    nivel = excluded.nivel,
    acceso_panel = excluded.acceso_panel;
end;
$$;

commit;

-- Debe devolver una sola fila con estado OK.
select
  u.email,
  p.nombre,
  p.rol,
  p.nivel,
  p.acceso_panel,
  p.activo,
  case when p.rol = 'direccion' and p.nivel = 'sistemas'
    and p.acceso_panel and p.activo and u.email_confirmed_at is not null
    then 'OK' else 'REVISAR' end as estado
from public.asis_perfiles p
join auth.users u on u.id = p.id
where lower(btrim(u.email)) = 'chambeadora69@gmail.com';
