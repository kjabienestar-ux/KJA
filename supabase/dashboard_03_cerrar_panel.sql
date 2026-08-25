-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — Paso 2a: separar "cuenta del panel" de "cuenta del
--  dashboard". CORRER ANTES de crearle cuenta a ningún colaborador.
--
--  EL PROBLEMA
--  asis_es_miembro() dice true para cualquiera que tenga fila en
--  asis_perfiles, y esa función gobierna el SELECT de asis_areas,
--  asis_colaboradores, asis_registros, asis_excepciones, asis_perfiles,
--  asis_historial_contrato y asis_portal_config.
--
--  En cuanto el dashboard le cree una cuenta a cada colaborador para que
--  pueda entrar, los 40 pasarían a leer los contratos, las horas y la
--  asistencia de todo el mundo. No es lo que se quiere, y es un cambio
--  silencioso: nadie ve un error, simplemente todos ven de más.
--
--  LA SOLUCIÓN
--  Una marca explícita de "esta cuenta entra al panel de asistencia".
--  Las 9 cuentas de hoy la reciben y siguen exactamente igual. Las que
--  nazcan para el dashboard no la tienen, y se gobiernan con
--  puede_ver_colab() en el paso siguiente.
--
--  No borra ni mueve datos. La última sentencia es la comprobación.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1) La marca ──────────────────────────────────────────────────────
alter table public.asis_perfiles
  add column if not exists acceso_panel boolean not null default false;

comment on column public.asis_perfiles.acceso_panel is
  'true = cuenta del panel de asistencia (admin.html / asistencia.html). Las cuentas creadas por el dashboard van en false y se rigen por puede_ver_colab().';

-- ── 2) Las cuentas que existen HOY son las del panel ──────────────────
--  Todas las filas actuales de asis_perfiles son cuentas con correo del
--  equipo: ninguna nació todavía del dashboard. Conservan su acceso tal
--  cual. Correr esto DESPUÉS de crear cuentas de colaborador les daría
--  acceso al panel: por eso este archivo va primero.
update public.asis_perfiles set acceso_panel = true;

-- ── 3) Las funciones del panel responden solo por cuentas del panel ───
--  Mismo cuerpo de antes más la marca. Al ser CREATE OR REPLACE y no
--  cambiar la firma, las policies que ya las usan siguen valiendo sin
--  tocarlas: no hace falta recrear ni una.
create or replace function public.asis_es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.asis_perfiles
                  where id = auth.uid() and activo = true and acceso_panel = true);
$$;

create or replace function public.asis_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.asis_perfiles
   where id = auth.uid() and activo = true and acceso_panel = true;
$$;
--  asis_puede_editar() no se toca: se apoya en asis_rol(), que ahora
--  devuelve null para quien no es del panel, y coalesce(...) lo deja en
--  false. Escribir sigue siendo cosa de editor y dirección.

notify pgrst, 'reload schema';


-- ── COMPROBACIÓN (va última para que el editor la muestre) ───────────
--  Las tres filas deben decir OK.
select case when n = esperado then 'OK' else '*** REVISAR ***' end as estado,
       pieza, n as encontrado, esperado
from (
  -- todas las cuentas de hoy conservan su acceso al panel
  select 'cuentas del panel (deben ser todas)' as pieza,
         (select count(*) from public.asis_perfiles where acceso_panel)::int as n,
         (select count(*) from public.asis_perfiles)::int as esperado
  union all
  -- y ninguna se quedó fuera
  select 'cuentas sin acceso al panel',
         (select count(*) from public.asis_perfiles where not acceso_panel)::int, 0
  union all
  -- las dos funciones del panel ya exigen la marca
  select 'funciones que exigen acceso_panel',
         (select count(*) from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
           where ns.nspname='public' and p.proname in ('asis_es_miembro','asis_rol')
             and pg_get_functiondef(p.oid) like '%acceso_panel%')::int, 2
) t;
