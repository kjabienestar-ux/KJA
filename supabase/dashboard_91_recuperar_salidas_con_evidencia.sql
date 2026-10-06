-- DASHBOARD 91 · SALIDAS CON EVIDENCIA COMPLETA Y REGISTRO PENDIENTE
-- Aplicar después de dashboard_90 y dashboard_84.
-- Repara casos de todo el equipo en los últimos 180 días, incluido 30/09.
-- No duplica evidencias ni sobrescribe salidas. Mantiene pendientes laborales,
-- exenciones y Facebook independiente; solo recupera evidencia aprobada con archivo.
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
  v_resumen jsonb;
  v_actor uuid;
  v_salida_at timestamptz;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
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

  -- Usar la misma política vigente que el panel: exención RPE presencial,
  -- Facebook independiente, asignaciones canceladas y jornadas justificadas.
  v_resumen:=public.dash_cierre_resumen_colab(p_colaborador,p_fecha);
  if not coalesce((v_resumen->>'ok')::boolean,false)
     or not coalesce((v_resumen->>'aplica_jornada')::boolean,false)
     or v_reg.estado is null or v_reg.estado not in ('P','T') then
    return jsonb_build_object('ok',false,'motivo','jornada_no_aplicable');
  end if;
  if coalesce((v_resumen->>'pendientes_salida')::integer,1)>0 then
    return jsonb_build_object('ok',true,'regularizada',false,
      'motivo','requisitos_pendientes','pendientes',v_resumen->'pendientes_salida');
  end if;

  -- El resumen expone salida_desde/hasta como horas sin fecha. Reconstruir la
  -- ventana con la función canónica conserva la fecha y los turnos nocturnos.
  v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
  v_desde_at:=v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min);
  v_hasta_at:=v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min);

  -- Carga administrativa: usar exclusivamente la hora declarada en auditoría.
  -- Carga personal: recuperar la hora de envío solo dentro de la ventana de
  -- salida de esa jornada. Nunca usar la hora de una carga tardía de Dirección.
  select case when exists(select 1 from public.asis_entregas_direccion a where a.entrega_id=entrega.id)
              then auditoria.salida_reportada_at
              when entrega.completado_at between v_desde_at and v_hasta_at
              then entrega.completado_at end,auditoria.actor_id
    into v_salida_at,v_actor
    from public.asis_entregas_diarias entrega
    left join public.asis_entregas_direccion auditoria
      on auditoria.entrega_id=entrega.id
     and auditoria.colaborador_id=entrega.colaborador_id
     and auditoria.fecha=entrega.fecha
   where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
     and entrega.requisito='salida' and entrega.estado='completo'
     and entrega.revision_estado='aprobada'
     and exists(select 1 from public.asis_entrega_archivos archivo where archivo.entrega_id=entrega.id)
   order by entrega.completado_at desc,entrega.id desc
   limit 1;

  if v_salida_at is null then
    return jsonb_build_object('ok',true,'regularizada',false,'motivo','evidencia_salida');
  end if;
  if v_reg.marcado_at is null or v_salida_at<v_reg.marcado_at or v_salida_at>now()+interval '5 minutes' then
    return jsonb_build_object('ok',false,'motivo','hora_salida_invalida');
  end if;

  v_horas:=round(greatest(0,extract(epoch from(v_salida_at-v_reg.marcado_at))/3600)::numeric,2);
  update public.asis_registros
     set salida_at=v_salida_at,
         salida_dispositivo='recuperada:evidencia_aprobada',
         salida_origen='panel',
         salida_por=coalesce(p_actor,v_actor),
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_regularizado=true,
         cierre_nota=concat_ws(E'\n',nullif(btrim(cierre_nota),''),
           'Salida recuperada desde evidencia aprobada (dashboard_91); hora auditada o envío personal dentro de ventana, requisitos laborales verificados.'),
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

-- Aprobar una evidencia también reintenta el cierre: antes solo se reintentaba
-- al cargar archivos, lo que dejaba sin salida las evidencias aprobadas después.
do $$ begin
  if to_regprocedure('public.dash_admin_revisar_entrega_base_91(bigint,text,text)') is null then
    alter function public.dash_admin_revisar_entrega(bigint,text,text)
      rename to dash_admin_revisar_entrega_base_91;
  end if;
end $$;
revoke all on function public.dash_admin_revisar_entrega_base_91(bigint,text,text)
  from public,anon,authenticated;

create or replace function public.dash_admin_revisar_entrega(
  p_entrega bigint,p_estado text,p_nota text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_resultado jsonb; v_entrega public.asis_entregas_diarias; v_cierre jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  -- Mismo orden de bloqueo que las cargas y la recuperación manual.
  select * into v_entrega from public.asis_entregas_diarias where id=p_entrega;
  if v_entrega.colaborador_id is not null then
    perform pg_advisory_xact_lock(v_entrega.colaborador_id);
  end if;
  v_resultado:=public.dash_admin_revisar_entrega_base_91(p_entrega,p_estado,p_nota);
  if not coalesce((v_resultado->>'ok')::boolean,false) or p_estado is distinct from 'aprobada' then
    return v_resultado;
  end if;
  select * into v_entrega from public.asis_entregas_diarias where id=p_entrega;
  v_cierre:=public.dash_admin_regularizar_cierre_impl(v_entrega.colaborador_id,v_entrega.fecha,auth.uid());
  return v_resultado||jsonb_build_object('cierre_regularizado',coalesce((v_cierre->>'regularizada')::boolean,false));
end $$;
revoke all on function public.dash_admin_revisar_entrega(bigint,text,text) from public,anon;
grant execute on function public.dash_admin_revisar_entrega(bigint,text,text) to authenticated;

-- Recuperación idempotente para todos los colaboradores, sin excepciones por nombre.
do $$
declare candidata record;
begin
  for candidata in
    select distinct r.colaborador_id,r.fecha
      from public.asis_registros r
      join public.asis_entregas_diarias e on e.colaborador_id=r.colaborador_id and e.fecha=r.fecha
     where r.salida_at is null and r.estado in ('P','T')
       and r.fecha between (now() at time zone 'America/Lima')::date-180
                       and (now() at time zone 'America/Lima')::date
       and e.requisito='salida' and e.estado='completo' and e.revision_estado='aprobada'
     order by r.colaborador_id,r.fecha
  loop
    perform public.dash_admin_regularizar_cierre_impl(candidata.colaborador_id,candidata.fecha,null);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;

-- Verificación del día reportado. Si quedan pendientes, devuelve el resumen
-- completo para distinguir falta de aprobación, hora o requisitos laborales.
select c.id,c.nombre,r.fecha,r.salida_at at time zone 'America/Lima' salida_lima,
       r.horas_efectivas,r.cierre_regularizado,
       e.revision_estado revision_salida,
       e.completado_at at time zone 'America/Lima' evidencia_enviada_lima,
       a.salida_reportada_at at time zone 'America/Lima' salida_reportada_lima,
       public.dash_cierre_resumen_colab(c.id,r.fecha) resumen
from public.asis_registros r
join public.asis_colaboradores c on c.id=r.colaborador_id
left join lateral (
  select entrega.* from public.asis_entregas_diarias entrega
  where entrega.colaborador_id=r.colaborador_id and entrega.fecha=r.fecha and entrega.requisito='salida'
  order by entrega.completado_at desc,entrega.id desc limit 1
) e on true
left join public.asis_entregas_direccion a on a.entrega_id=e.id
where r.fecha=date '2026-09-30'
order by c.nombre;
