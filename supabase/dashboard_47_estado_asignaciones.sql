-- DASHBOARD 47 · ESTADO VIVO DE LAS ASIGNACIONES
-- Ejecutar despues de dashboard_46_conservar_salida_con_pendientes.sql.
-- Expone en el panel el avance real de cada asignacion sin modificar entregas.

begin;

do $$
begin
  if to_regprocedure('public.dash_admin_cierres_base_47(date)') is null then
    alter function public.dash_admin_cierres(date)
      rename to dash_admin_cierres_base_47;
  end if;
end;
$$;

revoke all on function public.dash_admin_cierres_base_47(date)
  from public,anon,authenticated;

create or replace function public.dash_admin_cierres(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_resultado jsonb;
  v_asignaciones jsonb;
begin
  v_resultado:=public.dash_admin_cierres_base_47(p_fecha);
  if not coalesce((v_resultado->>'ok')::boolean,false) then return v_resultado; end if;

  select coalesce(jsonb_agg(
           fila.item||jsonb_build_object(
             'destinatarios',greatest(destino.total,progreso.registrados),
             'entregados',progreso.entregados,
             'aprobados',progreso.aprobados,
             'observados',progreso.observados,
             'pendientes',greatest(greatest(destino.total,progreso.registrados)-progreso.entregados,0),
             'estado_asignacion',case
               when greatest(destino.total,progreso.registrados)=0 then 'sin_destinatarios'
               when progreso.aprobados=greatest(destino.total,progreso.registrados) then 'aprobada'
               when progreso.observados>0 then 'observada'
               when progreso.entregados=greatest(destino.total,progreso.registrados) then 'entregada'
               when progreso.entregados>0 then 'parcial'
               else 'pendiente'
             end,
             'actualizado_at',progreso.actualizado_at,
             'cancelable',progreso.registrados=0
           ) order by fila.orden
         ),'[]'::jsonb)
    into v_asignaciones
    from jsonb_array_elements(coalesce(v_resultado->'asignaciones','[]'::jsonb))
         with ordinality as fila(item,orden)
    join public.asis_asignaciones_diarias asignacion
      on asignacion.id=(fila.item->>'id')::bigint
    cross join lateral (
      select case
        when asignacion.colaborador_id is not null then 1
        else (
          select count(*)::integer
            from public.asis_colaboradores colaborador
           where colaborador.activo
             and colaborador.area_id=asignacion.area_id
             and public.asis_labora(colaborador,asignacion.fecha)
        )
      end as total
    ) destino
    cross join lateral (
      select count(*)::integer as registrados,
             count(*) filter(where ultima.estado='completo')::integer as entregados,
             count(*) filter(where ultima.estado='completo' and ultima.revision_estado='aprobada')::integer as aprobados,
             count(*) filter(where ultima.estado='anulado' or ultima.revision_estado='observada')::integer as observados,
             max(coalesce(ultima.revisado_at,ultima.completado_at)) as actualizado_at
        from (
          select distinct on(entrega.colaborador_id)
                 entrega.colaborador_id,entrega.estado,entrega.revision_estado,
                 entrega.completado_at,entrega.revisado_at
            from public.asis_entregas_diarias entrega
           where entrega.asignacion_id=asignacion.id
           order by entrega.colaborador_id,entrega.creado_at desc,entrega.id desc
        ) ultima
    ) progreso;

  return jsonb_set(v_resultado,'{asignaciones}',v_asignaciones,true);
end;
$$;

revoke all on function public.dash_admin_cierres(date) from public,anon;
grant execute on function public.dash_admin_cierres(date) to authenticated;

notify pgrst,'reload schema';
commit;

-- Verificacion: muestra el estado calculado para las asignaciones de hoy.
select asignacion->>'destino' as destino,
       asignacion->>'titulo' as asignacion,
       asignacion->>'estado_asignacion' as estado,
       asignacion->>'entregados' as entregados,
       asignacion->>'destinatarios' as destinatarios
  from jsonb_array_elements(
    public.dash_admin_cierres((now() at time zone 'America/Lima')::date)->'asignaciones'
  ) asignacion;
