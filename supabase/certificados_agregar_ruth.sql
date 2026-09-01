-- KJA · Alta de acceso al módulo de certificados
-- Persona: Ruth Velarde
-- Serie: 12000 (rango 12000–12999)
--
-- IMPORTANTE:
-- 1. Crear primero la cuenta ruthvelarde@kja.com desde Supabase
--    Authentication > Users > Add user.
-- 2. Configurar allí una contraseña nueva y marcar el correo como confirmado.
-- 3. Ejecutar después este archivo completo en el SQL Editor.
--
-- La contraseña nunca debe guardarse en una migración ni en el repositorio.

begin;

do $$
declare
  v_uid uuid;
  v_serie_nombre text;
begin
  select id into v_uid
    from auth.users
   where lower(email) = 'ruthvelarde@kja.com'
   limit 1;

  if v_uid is null then
    raise exception 'Primero crea ruthvelarde@kja.com en Authentication > Users';
  end if;

  select nombre into v_serie_nombre
    from public.perfiles
   where serie = 12000
     and id <> v_uid
   limit 1;

  if v_serie_nombre is not null then
    raise exception 'La serie 12000 ya pertenece a %', v_serie_nombre;
  end if;

  insert into public.perfiles (id, nombre, rol, serie)
  values (v_uid, 'Ruth Velarde', 'colaborador', 12000)
  on conflict (id) do update
    set nombre = excluded.nombre,
        rol = excluded.rol,
        serie = excluded.serie;
end;
$$;

commit;

-- Debe devolver una sola fila con Ruth Velarde y la serie 12000.
select
  p.nombre,
  u.email,
  p.rol,
  p.serie,
  case when p.serie = 12000 then 'OK' else 'REVISAR' end as estado
from public.perfiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'ruthvelarde@kja.com';
