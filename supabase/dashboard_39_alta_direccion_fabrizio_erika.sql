-- DASHBOARD 39 - ALTA SEGURA DE DIRECCION PARA FABRIZIO Y ERIKA
--
-- ANTES DE EJECUTAR:
-- 1. Supabase > Authentication > Users > Add user.
-- 2. Crear fabrizio@kja.com y erika@kja.com con correo confirmado.
-- 3. Definir sus contrasenas desde Authentication; este archivo no las guarda.
--
-- Este bloque valida cada identidad por DNI y crea un perfil administrativo
-- separado con rol Direccion y alcance Sistemas. La cuenta tecnica de DNI/PIN
-- del colaborador no se modifica: ambos conservan su acceso personal para
-- registrar asistencia y usan el correo solamente para entrar como Direccion.

begin;

do $$
declare
  v_fuente record;
  v_uid uuid;
  v_colaborador bigint;
  v_nombre text;
  v_auth_total integer;
  v_colaborador_total integer;
begin
  for v_fuente in
    select * from (values
      ('fabrizio@kja.com'::text,'72026017'::text),
      ('erika@kja.com'::text,'71338491'::text)
    ) as altas(email,dni)
  loop
    select count(*)::integer,(array_agg(usuario.id))[1]
      into v_auth_total,v_uid
      from auth.users usuario
     where lower(btrim(usuario.email))=lower(v_fuente.email);

    if v_auth_total<>1 then
      raise exception 'Debe existir exactamente un usuario confirmado para % en Authentication; encontrados: %.',
        v_fuente.email,v_auth_total;
    end if;

    if not exists(
      select 1 from auth.users usuario
       where usuario.id=v_uid and usuario.email_confirmed_at is not null
    ) then
      raise exception 'El correo % existe, pero todavia no esta confirmado.',v_fuente.email;
    end if;

    select count(*)::integer,(array_agg(colaborador.id))[1],min(colaborador.nombre)
      into v_colaborador_total,v_colaborador,v_nombre
      from public.asis_colaboradores colaborador
     where regexp_replace(coalesce(colaborador.dni,''),'[^0-9]','','g')=v_fuente.dni
       and colaborador.activo;

    if v_colaborador_total<>1 then
      raise exception 'El DNI % debe identificar exactamente un colaborador activo; encontrados: %.',
        v_fuente.dni,v_colaborador_total;
    end if;

    insert into public.asis_perfiles(
      id,nombre,rol,activo,colaborador_id,nivel,acceso_panel
    ) values(
      v_uid,v_nombre,'direccion',true,null,'sistemas',true
    )
    on conflict(id) do update set
      nombre=excluded.nombre,
      rol='direccion',
      activo=true,
      colaborador_id=null,
      nivel='sistemas',
      acceso_panel=true;
  end loop;
end;
$$;

notify pgrst,'reload schema';
commit;

-- Las dos filas deben mostrar estado OK y rol direccion.
select
  case
    when perfil.rol='direccion'
     and perfil.nivel='sistemas'
     and perfil.acceso_panel
     and perfil.activo
    then 'OK' else 'REVISAR'
  end estado,
  usuario.email,
  colaborador.nombre,
  '****'||right(regexp_replace(colaborador.dni,'[^0-9]','','g'),4) dni,
  perfil.rol,
  perfil.nivel,
  perfil.acceso_panel
from (values
  ('fabrizio@kja.com'::text,'72026017'::text),
  ('erika@kja.com'::text,'71338491'::text)
) alta(email,dni)
join auth.users usuario on lower(usuario.email)=alta.email
join public.asis_perfiles perfil on perfil.id=usuario.id
join public.asis_colaboradores colaborador
  on regexp_replace(coalesce(colaborador.dni,''),'[^0-9]','','g')=alta.dni
order by usuario.email;
