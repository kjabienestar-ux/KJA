-- DASHBOARD 23 — FASE 3 · CONTROL DIARIO DE EXCEPCIONES
-- Ejecutar después de dashboard_22_lider_revision_solo_lectura.sql.
-- Solo agrega una RPC de lectura para Dirección. No altera asistencias,
-- entregas, revisiones, salidas ni horas.

begin;

create or replace function public.dash_admin_control_diario(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_filas jsonb;
  v_areas jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_fecha is null or p_fecha < date '2020-01-01' or p_fecha > v_hoy then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'nombre', a.nombre
         ) order by a.orden, a.nombre), '[]'::jsonb)
    into v_areas
    from public.asis_areas a
   where a.activo;

  select coalesce(jsonb_agg(jsonb_build_object(
           'colaborador_id', q.colaborador_id,
           'colaborador', q.colaborador,
           'area_id', q.area_id,
           'area', q.area,
           'labora', q.labora,
           'entrada_estado', q.entrada_estado,
           'entrada_at', q.entrada_at,
           'salida_at', q.salida_at,
           'cierre_estado', q.cierre_estado,
           'evidencias_pendientes', q.evidencias_pendientes,
           'revision_pendiente', q.revision_pendiente,
           'revision_observada', q.revision_observada,
           'horas_validas', q.horas_validas
         ) order by q.prioridad, q.area_orden, q.colaborador_orden, q.colaborador), '[]'::jsonb)
    into v_filas
    from (
      select c.id as colaborador_id,
             c.nombre as colaborador,
             c.area_id,
             a.nombre as area,
             a.orden as area_orden,
             c.orden as colaborador_orden,
             public.asis_labora(c, p_fecha) as labora,
             r.estado as entrada_estado,
             r.marcado_at as entrada_at,
             r.salida_at,
             cierre.resumen ->> 'estado' as cierre_estado,
             case when coalesce((cierre.resumen ->> 'aplica')::boolean, false) then
               coalesce((select count(*) from jsonb_array_elements(coalesce(cierre.resumen -> 'requisitos', '[]'::jsonb)) x where not coalesce((x ->> 'completo')::boolean, false)), 0)
               + coalesce((select count(*) from jsonb_array_elements(coalesce(cierre.resumen -> 'asignaciones', '[]'::jsonb)) x where not coalesce((x ->> 'completo')::boolean, false)), 0)
             else 0 end as evidencias_pendientes,
             coalesce(rv.pendientes, 0) as revision_pendiente,
             coalesce(rv.observadas, 0) as revision_observada,
             case
               when r.estado = 'J' then coalesce(r.horas, 0)
               when r.estado in ('P','T') and cierre.resumen ->> 'estado' in ('completa','regularizada')
                 then coalesce(r.horas_efectivas, r.horas, 0)
               else 0
             end as horas_validas,
             case cierre.resumen ->> 'estado'
               when 'incompleta' then 0
               when 'sin_entrada' then 1
               when 'en_curso' then 2
               when 'lista_para_salir' then 3
               when 'completa' then 4
               when 'regularizada' then 5
               else 6
             end as prioridad
        from public.asis_colaboradores c
        join public.asis_areas a on a.id = c.area_id
        left join public.asis_registros r
          on r.colaborador_id = c.id and r.fecha = p_fecha
        cross join lateral (
          select public.dash_cierre_resumen_colab(c.id, p_fecha) as resumen
        ) cierre
        left join lateral (
          select count(*) filter (where latest.revision_estado = 'pendiente' and latest.estado = 'completo')::int as pendientes,
                 count(*) filter (where latest.revision_estado = 'observada')::int as observadas
            from (
              select distinct on (e.requisito, coalesce(e.asignacion_id, 0))
                     e.revision_estado, e.estado
                from public.asis_entregas_diarias e
               where e.colaborador_id = c.id and e.fecha = p_fecha
               order by e.requisito, coalesce(e.asignacion_id, 0), e.creado_at desc, e.id desc
            ) latest
        ) rv on true
       where c.activo
    ) q;

  return jsonb_build_object(
    'ok', true,
    'fecha', p_fecha,
    'solo_direccion', true,
    'areas', v_areas,
    'filas', v_filas
  );
end;
$$;

revoke all on function public.dash_admin_control_diario(date) from public, anon;
grant execute on function public.dash_admin_control_diario(date) to authenticated;

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'RPC control diario Dirección'::text as pieza,
         count(*)::int as encontrado, 1 as esperado
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'dash_admin_control_diario'
) q;
