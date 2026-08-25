-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — Paso 1: identidad única, niveles y visibilidad
--
--  QUÉ HACE Y QUÉ NO
--  Solo AÑADE: dos columnas a asis_perfiles, cuatro funciones y un
--  disparador. No borra, no reescribe claves y no mueve ni una fila.
--  `asis_colaboradores.id` —de donde cuelgan registros, contratos,
--  historial, excepciones y solicitudes— no se toca en absoluto.
--
--  Correr `dashboard_00_comprobacion.sql` antes y después: las dos
--  salidas tienen que dar idénticas.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) EL PUENTE DE IDENTIDAD ────────────────────────────────────────
--  Hoy hay dos identidades que no se conocen: `asis_perfiles` (cuentas
--  con correo, ~9 personas) y `asis_colaboradores` (quienes marcan con
--  PIN, ~40). Toda la RLS del sistema cuelga de auth.uid(), que es lo
--  que tiene un perfil; así que el perfil es quien debe saber a qué
--  colaborador corresponde, y no al revés.
alter table public.asis_perfiles
  add column if not exists colaborador_id bigint
    references public.asis_colaboradores(id) on delete set null;

-- Una cuenta por colaborador: dos perfiles apuntando a la misma persona
-- harían que "lo mío" dejara de estar definido.
create unique index if not exists asis_perf_colab_uniq
  on public.asis_perfiles (colaborador_id)
  where colaborador_id is not null;

comment on column public.asis_perfiles.colaborador_id is
  'A qué fila de asis_colaboradores corresponde esta cuenta. Nulo = cuenta sin colaborador asociado (p. ej. un usuario solo administrativo).';


-- ── 2) EL NIVEL DENTRO DEL DASHBOARD ─────────────────────────────────
--  OJO: es un eje DISTINTO de la columna `rol` que ya existe.
--    rol   (direccion/editor/visor) → quién EDITA en el panel de asistencia.
--    nivel (sistemas/lider/miembro) → hasta DÓNDE VE en el dashboard.
--  Se deja `rol` intacto a propósito: hay políticas RLS en producción
--  que dependen de él, y tocarlo ahora sería cambiar dos cosas a la vez.
alter table public.asis_perfiles
  add column if not exists nivel text not null default 'miembro'
    check (nivel in ('sistemas','lider','miembro'));

comment on column public.asis_perfiles.nivel is
  'Alcance en el dashboard: sistemas ve todo, lider ve su área, miembro ve lo suyo. Distinto de `rol`, que gobierna la edición en el panel de asistencia.';

-- Quien hoy es dirección arranca como sistemas; el resto, como miembro.
update public.asis_perfiles set nivel = 'sistemas'
 where rol = 'direccion' and nivel = 'miembro';


-- ── 3) CONTEXTO DE QUIEN ESTÁ CONECTADO ──────────────────────────────
--  security definer porque tienen que poder leer asis_perfiles aunque la
--  política de la propia tabla dependa, indirectamente, de esta respuesta.
create or replace function public.dash_colab()
returns bigint language sql stable security definer set search_path = public as $$
  select colaborador_id from public.asis_perfiles
   where id = auth.uid() and activo = true;
$$;

create or replace function public.dash_nivel()
returns text language sql stable security definer set search_path = public as $$
  select nivel from public.asis_perfiles
   where id = auth.uid() and activo = true;
$$;

create or replace function public.dash_area()
returns bigint language sql stable security definer set search_path = public as $$
  select c.area_id
    from public.asis_perfiles p
    join public.asis_colaboradores c on c.id = p.colaborador_id
   where p.id = auth.uid() and p.activo = true;
$$;


-- ── 4) LA REGLA DE VISIBILIDAD, EN UN SOLO SITIO ─────────────────────
--  Todos los módulos —asistencia, tareas, contratos— responden a la
--  misma pregunta: ¿puedo ver los datos de esta persona? Al vivir en una
--  función, añadir un módulo nuevo consiste en escribir
--      using ( public.puede_ver_colab(colaborador_id) )
--  y no en rediseñar los permisos otra vez.
create or replace function public.puede_ver_colab(p_colab bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_colab is null                       then false
    when public.dash_nivel() = 'sistemas'      then true
    when p_colab = public.dash_colab()         then true          -- lo mío
    when public.dash_nivel() = 'lider'         then exists (      -- mi área
           select 1 from public.asis_colaboradores c
            where c.id = p_colab and c.area_id = public.dash_area())
    else false
  end;
$$;

comment on function public.puede_ver_colab(bigint) is
  'Única regla de visibilidad del dashboard. Sistemas ve todo, el líder su área, cualquiera lo suyo. Reusar en las policies de cada módulo nuevo.';


-- ── 5) UN SOLO LÍDER POR ÁREA ────────────────────────────────────────
--  Se garantiza en la base, no solo en la pantalla. No puede ser un
--  índice único porque el área vive en otra tabla (asis_colaboradores),
--  así que va como disparador.
create or replace function public.dash_un_lider_por_area()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_area bigint;
begin
  if new.nivel <> 'lider' or new.colaborador_id is null then return new; end if;
  select area_id into v_area from public.asis_colaboradores where id = new.colaborador_id;
  if exists (
    select 1 from public.asis_perfiles p
      join public.asis_colaboradores c on c.id = p.colaborador_id
     where p.nivel = 'lider' and c.area_id = v_area and p.id <> new.id
  ) then
    raise exception 'Esa área ya tiene un líder técnico. Usa asignar_lider() para reemplazarlo en un solo paso.';
  end if;
  return new;
end;
$$;

drop trigger if exists asis_perf_un_lider on public.asis_perfiles;
create trigger asis_perf_un_lider
  before insert or update of nivel, colaborador_id on public.asis_perfiles
  for each row execute function public.dash_un_lider_por_area();


-- ── 6) CAMBIAR DE LÍDER, EN UN SOLO PASO ─────────────────────────────
--  El administrador nombra y quita líderes cuando quiera. Si tuviera que
--  degradar al actual y luego promover al nuevo en dos operaciones, entre
--  una y otra el área se queda sin líder, y si se equivoca el orden el
--  disparador se lo rechaza. Va todo en la misma transacción.
--  p_colab nulo = el área se queda sin líder.
create or replace function public.asignar_lider(p_area bigint, p_colab bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.dash_nivel() is distinct from 'sistemas' then
    raise exception 'Solo el administrador de sistemas puede nombrar líderes técnicos.';
  end if;

  -- fuera el líder actual del área (si lo hay)
  update public.asis_perfiles p set nivel = 'miembro'
    from public.asis_colaboradores c
   where c.id = p.colaborador_id and c.area_id = p_area and p.nivel = 'lider';

  if p_colab is null then return; end if;

  if not exists (select 1 from public.asis_colaboradores
                  where id = p_colab and area_id = p_area) then
    raise exception 'Esa persona no pertenece a esa área.';
  end if;

  update public.asis_perfiles set nivel = 'lider' where colaborador_id = p_colab;
  if not found then
    raise exception 'Esa persona todavía no tiene cuenta: primero tiene que entrar una vez con su clave.';
  end if;
end;
$$;

revoke all on function public.asignar_lider(bigint, bigint) from public, anon;
grant execute on function public.asignar_lider(bigint, bigint) to authenticated;

grant execute on function public.dash_colab(), public.dash_nivel(),
                          public.dash_area(), public.puede_ver_colab(bigint)
  to authenticated;


-- ── 7) PostgREST cachea el esquema ───────────────────────────────────
notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════
--  DESPUÉS DE CORRER ESTO
--
--  a) Volver a correr dashboard_00_comprobacion.sql y comparar. Idéntico.
--
--  b) Enlazar las cuentas que ya existen con su colaborador. NO se hace
--     automático por nombre a propósito: un enlace equivocado le daría a
--     alguien el historial de otra persona. Esta consulta PROPONE, no
--     decide — revisar antes de aplicar nada:
--
--     select p.id, p.nombre as cuenta, c.id as colaborador_id,
--            c.nombre as colaborador, a.nombre as area
--     from public.asis_perfiles p
--     left join public.asis_colaboradores c
--            on lower(btrim(c.nombre)) = lower(btrim(p.nombre))
--     left join public.asis_areas a on a.id = c.area_id
--     where p.colaborador_id is null
--     order by p.nombre;
--
--     Y para cada fila que esté bien:
--     update public.asis_perfiles set colaborador_id = <id> where id = '<uuid>';
--
--  c) Nadie es líder todavía. Para nombrarlos, una vez enlazadas las
--     cuentas: select public.asignar_lider(<area_id>, <colaborador_id>);
-- ══════════════════════════════════════════════════════════════════════
