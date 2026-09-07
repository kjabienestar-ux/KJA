-- DASHBOARD 24 — ASIGNACIONES POR SORTEO Y ROTACIÓN JUSTA
-- Ejecutar después de dashboard_23_control_diario.sql.
-- Agrega dos RPC. No modifica asignaciones ni jornadas existentes.

begin;

create or replace function public.dash_admin_previsualizar_sorteo(
  p_fecha date,
  p_area bigint,
  p_cantidad integer,
  p_tipo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_disponibles integer;
  v_seleccion jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_fecha is null or p_fecha < v_hoy or p_fecha > v_hoy + 90
     or p_area is null or p_cantidad not between 1 and 20
     or p_tipo not in ('ppt','gpt','induccion','otro') then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if not exists (select 1 from public.asis_areas where id = p_area and activo) then
    return jsonb_build_object('ok', false, 'motivo', 'area');
  end if;

  with elegibles as (
    select c.id, c.nombre,
           count(x.id) filter (
             where x.fecha between p_fecha - 30 and p_fecha - 1
               and x.activo and x.tipo = p_tipo
               and (x.colaborador_id = c.id or x.area_id = c.area_id)
           )::int as carga_30d
      from public.asis_colaboradores c
      left join public.asis_asignaciones_diarias x
        on x.fecha between p_fecha - 30 and p_fecha - 1
       and x.activo and x.tipo = p_tipo
       and (x.colaborador_id = c.id or x.area_id = c.area_id)
     where c.activo and c.area_id = p_area
       and public.asis_labora(c, p_fecha)
       and not exists (
         select 1 from public.asis_asignaciones_diarias d
          where d.fecha = p_fecha and d.activo and d.tipo = p_tipo
            and (d.colaborador_id = c.id or d.area_id = c.area_id)
       )
     group by c.id, c.nombre
  ), ordenados as (
    select *, row_number() over (
      order by carga_30d,
               md5(id::text || '|' || p_fecha::text || '|' || p_area::text || '|' || p_tipo)
    ) as posicion
      from elegibles
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nombre', nombre, 'carga_30d', carga_30d, 'posicion', posicion
         ) order by posicion) filter (where posicion <= p_cantidad), '[]'::jsonb)
    into v_disponibles, v_seleccion
    from ordenados;

  if v_disponibles < p_cantidad then
    return jsonb_build_object('ok', false, 'motivo', 'insuficientes', 'disponibles', v_disponibles);
  end if;

  return jsonb_build_object(
    'ok', true, 'fecha', p_fecha, 'area_id', p_area, 'tipo', p_tipo,
    'cantidad', p_cantidad, 'disponibles', v_disponibles, 'seleccion', v_seleccion
  );
end;
$$;

revoke all on function public.dash_admin_previsualizar_sorteo(date,bigint,integer,text) from public, anon;
grant execute on function public.dash_admin_previsualizar_sorteo(date,bigint,integer,text) to authenticated;

create or replace function public.dash_admin_confirmar_sorteo(
  p_fecha date,
  p_area bigint,
  p_colaboradores bigint[],
  p_tipo text,
  p_titulo text,
  p_instrucciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_total integer;
  v_ids jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  v_total := coalesce(cardinality(p_colaboradores), 0);
  if p_fecha is null or p_fecha < v_hoy or p_fecha > v_hoy + 90
     or p_area is null or v_total not between 1 and 20
     or p_tipo not in ('ppt','gpt','induccion','otro')
     or char_length(btrim(coalesce(p_titulo, ''))) not between 2 and 120
     or (select count(distinct elegido.id) from unnest(p_colaboradores) elegido(id)) <> v_total then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;

  perform pg_advisory_xact_lock(p_area);

  if exists (
    select 1
      from unnest(p_colaboradores) elegido(id)
      left join public.asis_colaboradores c on c.id = elegido.id
     where c.id is null or not c.activo or c.area_id <> p_area
        or not public.asis_labora(c, p_fecha)
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'seleccion_invalida');
  end if;

  if exists (
    select 1
      from unnest(p_colaboradores) elegido(id)
      join public.asis_colaboradores c on c.id = elegido.id
     where exists (
       select 1 from public.asis_asignaciones_diarias d
        where d.fecha = p_fecha and d.activo and d.tipo = p_tipo
          and (d.colaborador_id = c.id or d.area_id = c.area_id)
     )
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_asignado');
  end if;

  with insertadas as (
    insert into public.asis_asignaciones_diarias (
      fecha, colaborador_id, area_id, tipo, titulo, instrucciones, creado_por
    )
    select p_fecha, elegido.id, null, p_tipo, btrim(p_titulo),
           nullif(left(btrim(coalesce(p_instrucciones, '')), 700), ''), auth.uid()
      from unnest(p_colaboradores) elegido(id)
    returning id, colaborador_id
  )
  select jsonb_agg(jsonb_build_object('id', i.id, 'colaborador_id', i.colaborador_id) order by i.id)
    into v_ids from insertadas i;

  return jsonb_build_object('ok', true, 'cantidad', v_total, 'asignaciones', coalesce(v_ids, '[]'::jsonb));
end;
$$;

revoke all on function public.dash_admin_confirmar_sorteo(date,bigint,bigint[],text,text,text) from public, anon;
grant execute on function public.dash_admin_confirmar_sorteo(date,bigint,bigint[],text,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'RPC de sorteo justo'::text as pieza,
         count(*)::int as encontrado, 2 as esperado
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('dash_admin_previsualizar_sorteo','dash_admin_confirmar_sorteo')
) q;
