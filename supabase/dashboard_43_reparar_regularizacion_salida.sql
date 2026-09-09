-- DASHBOARD 43 · REPARAR REGULARIZACION DE SALIDA
-- Ejecutar despues de dashboard_42_entrada_y_salida_tardia.sql.
-- Valida las entregas directamente y recupera salidas administrativas que ya
-- fueron cargadas pero no llegaron a actualizar asis_registros.salida_at.

begin;

create or replace function public.dash_admin_regularizar_cierre_impl(
  p_colaborador bigint,
  p_fecha date,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_reg public.asis_registros;
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_fin_at timestamptz;
  v_comparticiones_bloquean boolean:=false;
  v_pendientes integer:=0;
  v_salida_at timestamptz;
  v_horas numeric;
  v_actualizada boolean:=false;
begin
  if p_colaborador is null or p_fecha is null
     or p_fecha<v_hoy-180 or p_fecha>v_hoy then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;

  perform pg_advisory_xact_lock(p_colaborador);
  select * into v_persona from public.asis_colaboradores
   where id=p_colaborador and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  select * into v_reg from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha for update;
  if v_persona.id is null then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  if v_reg.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrada'); end if;
  if v_reg.salida_at is not null then
    return jsonb_build_object(
      'ok',true,'regularizada',false,'motivo','ya_cerrada','salida_at',v_reg.salida_at
    );
  end if;
  if not coalesce(v_cfg.habilitado,false)
     or p_fecha<v_cfg.obligatorio_desde
     or not public.asis_labora(v_persona,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;

  v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
  v_comparticiones_bloquean:=public.asis_compartir_programado(p_colaborador,p_fecha)
    and public.asis_compartir_fin_at(p_colaborador,p_fecha)
        <=coalesce(v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min),
                    public.asis_compartir_fin_at(p_colaborador,p_fecha));

  if not exists(
    select 1 from public.asis_entregas_diarias entrega
     where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
       and entrega.requisito='rpe' and entrega.estado='completo'
       and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
  ) then v_pendientes:=v_pendientes+1; end if;

  if v_comparticiones_bloquean and not exists(
    select 1 from public.asis_entregas_diarias entrega
     where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
       and entrega.requisito='comparticiones' and entrega.estado='completo'
       and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
  ) then v_pendientes:=v_pendientes+1; end if;

  if not exists(
    select 1 from public.asis_entregas_diarias entrega
    join public.asis_entregas_direccion auditoria on auditoria.entrega_id=entrega.id
     where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
       and entrega.requisito='salida' and entrega.estado='completo'
       and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
  ) then v_pendientes:=v_pendientes+1; end if;

  select v_pendientes+count(*)::integer into v_pendientes
    from public.asis_asignaciones_diarias asignacion
   where asignacion.fecha=p_fecha and asignacion.activo and asignacion.requerido
     and (asignacion.colaborador_id=p_colaborador or asignacion.area_id=v_persona.area_id)
     and not exists(
       select 1 from public.asis_entregas_diarias entrega
        where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
          and entrega.asignacion_id=asignacion.id and entrega.estado='completo'
          and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
     );

  if v_pendientes>0 then
    return jsonb_build_object(
      'ok',true,'regularizada',false,'motivo','requisitos_pendientes','pendientes',v_pendientes
    );
  end if;

  select coalesce(auditoria.salida_reportada_at,entrega.completado_at)
    into v_salida_at
    from public.asis_entregas_diarias entrega
    join public.asis_entregas_direccion auditoria on auditoria.entrega_id=entrega.id
   where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
     and entrega.requisito='salida' and entrega.estado='completo'
     and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
   order by entrega.completado_at desc,entrega.id desc
   limit 1;

  if v_salida_at is null then
    return jsonb_build_object('ok',true,'regularizada',false,'motivo','evidencia_salida');
  end if;
  if v_salida_at<v_reg.marcado_at or v_salida_at>now()+interval '5 minutes' then
    return jsonb_build_object('ok',false,'motivo','hora_salida_invalida');
  end if;

  v_horas:=round(greatest(0,extract(epoch from(v_salida_at-v_reg.marcado_at))/3600)::numeric,2);
  update public.asis_registros
     set salida_at=v_salida_at,
         salida_dispositivo='direccion:evidencia_recibida',
         salida_origen='panel',
         salida_por=p_actor,
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_regularizado=true,
         cierre_nota=concat_ws(E'\n',nullif(btrim(cierre_nota),''),
           'Jornada regularizada por Direccion con foto y hora de salida verificadas.'),
         cierre_actualizado_at=now()
   where id=v_reg.id and salida_at is null;
  v_actualizada:=found;

  return jsonb_build_object(
    'ok',true,
    'regularizada',v_actualizada,
    'salida_at',v_salida_at,
    'horas_efectivas',v_horas,
    'resumen',public.dash_cierre_resumen_colab(p_colaborador,p_fecha)
  );
end;
$$;

revoke all on function public.dash_admin_regularizar_cierre_impl(bigint,date,uuid)
  from public,anon,authenticated;

create or replace function public.dash_admin_regularizar_cierre(
  p_colaborador bigint,
  p_fecha date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  return public.dash_admin_regularizar_cierre_impl(p_colaborador,p_fecha,auth.uid());
end;
$$;

revoke all on function public.dash_admin_regularizar_cierre(bigint,date) from public,anon;
grant execute on function public.dash_admin_regularizar_cierre(bigint,date) to authenticated;

-- Reintenta automaticamente las salidas administrativas ya cargadas durante
-- los ultimos 180 dias. Solo modifica jornadas que cumplen todas las reglas.
do $$
declare
  candidata record;
begin
  for candidata in
    select distinct on (entrega.colaborador_id,entrega.fecha)
           entrega.colaborador_id,auditoria.fecha,auditoria.actor_id
      from public.asis_entregas_diarias entrega
      join public.asis_entregas_direccion auditoria on auditoria.entrega_id=entrega.id
      join public.asis_registros registro
        on registro.colaborador_id=entrega.colaborador_id and registro.fecha=entrega.fecha
     where entrega.requisito='salida' and entrega.estado='completo'
       and registro.salida_at is null
       and entrega.fecha>=(now() at time zone 'America/Lima')::date-180
     order by entrega.colaborador_id,entrega.fecha,entrega.completado_at desc
  loop
    perform public.dash_admin_regularizar_cierre_impl(
      candidata.colaborador_id,candidata.fecha,candidata.actor_id
    );
  end loop;
end;
$$;

notify pgrst,'reload schema';
commit;

select colaborador.id,colaborador.nombre,registro.fecha,
       registro.marcado_at as entrada_at,registro.salida_at,
       registro.cierre_regularizado
  from public.asis_registros registro
  join public.asis_colaboradores colaborador on colaborador.id=registro.colaborador_id
 where registro.fecha>=(now() at time zone 'America/Lima')::date-7
   and exists(
     select 1 from public.asis_entregas_diarias entrega
     join public.asis_entregas_direccion auditoria on auditoria.entrega_id=entrega.id
      where entrega.colaborador_id=registro.colaborador_id
        and entrega.fecha=registro.fecha and entrega.requisito='salida'
        and entrega.estado='completo'
   )
 order by registro.fecha desc,colaborador.nombre;
