-- ══════════════════════════════════════════════════════════════════════
--  KJA · Dashboard — ¿el paso 1 quedó bien? (SOLO LECTURA)
--
--  Dos cosas a la vez: que lo nuevo esté, y que lo viejo siga entero.
--  Todo en una consulta, porque el editor de Supabase solo muestra el
--  resultado de la última sentencia.
--
--  Todas las filas deben decir OK.
-- ══════════════════════════════════════════════════════════════════════

with piezas as (
  -- ── lo que la migración tenía que crear ──
  select 1 as ord, 'columna asis_perfiles.colaborador_id' as pieza,
         count(*) as n, 1 as esperado
    from information_schema.columns
   where table_schema='public' and table_name='asis_perfiles' and column_name='colaborador_id'
  union all
  select 1, 'columna asis_perfiles.nivel', count(*), 1
    from information_schema.columns
   where table_schema='public' and table_name='asis_perfiles' and column_name='nivel'
  union all
  select 1, 'funciones dash_* y puede_ver_colab', count(*), 4
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname in ('dash_colab','dash_nivel','dash_area','puede_ver_colab')
  union all
  select 1, 'funcion asignar_lider', count(*), 1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='asignar_lider'
  union all
  select 1, 'disparador un lider por area', count(*), 1
    from pg_trigger where tgname='asis_perf_un_lider' and not tgisinternal

  -- ── que nada haya quedado huérfano ──
  --  Si la migración hubiera roto algo, aquí aparecerían registros
  --  apuntando a colaboradores que ya no existen. Deben dar 0.
  union all
  select 2, 'registros huerfanos', count(*), 0
    from public.asis_registros r
   where not exists (select 1 from public.asis_colaboradores c where c.id=r.colaborador_id)
  union all
  select 2, 'historial_contrato huerfano', count(*), 0
    from public.asis_historial_contrato h
   where not exists (select 1 from public.asis_colaboradores c where c.id=h.colaborador_id)
  union all
  select 2, 'claves huerfanas', count(*), 0
    from public.asis_claves k
   where not exists (select 1 from public.asis_colaboradores c where c.id=k.colaborador_id)
  union all
  select 2, 'excepciones huerfanas', count(*), 0
    from public.asis_excepciones e
   where e.colaborador_id is not null
     and not exists (select 1 from public.asis_colaboradores c where c.id=e.colaborador_id)

  -- ── coherencia de los niveles ──
  union all
  select 3, 'perfiles con nivel invalido', count(*), 0
    from public.asis_perfiles where nivel not in ('sistemas','lider','miembro')
)
select case when n = esperado then 'OK' else '*** REVISAR ***' end as estado,
       pieza, n as encontrado, esperado
from piezas
order by ord, pieza;
