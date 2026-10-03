-- DASHBOARD 84 · REGULARIZACIÓN ADMINISTRATIVA CON REGLAS VIGENTES
-- Aplicar después de dashboard_83. Corrige la función antigua del SQL 43.
-- Recupera salidas del 02/10/2026 con evidencia aprobada y sin pendientes laborales.
-- Facebook conserva su estado; las salidas existentes no se sobrescriben.
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

  select auditoria.salida_reportada_at,auditoria.actor_id
    into v_salida_at,v_actor
    from public.asis_entregas_diarias entrega
    join public.asis_entregas_direccion auditoria
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
         salida_dispositivo='direccion:evidencia_recibida',
         salida_origen='panel',
         salida_por=coalesce(p_actor,v_actor),
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_regularizado=true,
         cierre_nota=concat_ws(E'\n',nullif(btrim(cierre_nota),''),
           'Salida recuperada desde evidencia aprobada de Direccion (dashboard_84); requisitos laborales verificados.'),
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


-- Mantiene las validaciones de permisos, archivos, RPE presencial y hora
-- de la RPC actual. Reintenta el cierre después de una entrega confirmada.
create or replace function public.dash_admin_confirmar_entrega(
  p_colaborador bigint,p_fecha date,p_requisito text,
  p_asignacion bigint default null,p_modalidad text default null,
  p_paths text[] default '{}',p_detalle text default null,
  p_hora_salida time default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_resultado jsonb; v_cierre jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(p_colaborador,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  v_resultado:=public.dash_admin_confirmar_entrega_base_70(
    p_colaborador,p_fecha,p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle,p_hora_salida);
  if not coalesce((v_resultado->>'ok')::boolean,false) then return v_resultado; end if;
  v_cierre:=public.dash_admin_regularizar_cierre_impl(p_colaborador,p_fecha,auth.uid());
  return v_resultado||jsonb_build_object(
    'cierre_regularizado',coalesce((v_resultado->>'cierre_regularizado')::boolean,false)
      or coalesce((v_cierre->>'regularizada')::boolean,false),
    'resumen',public.dash_cierre_resumen_colab(p_colaborador,p_fecha));
end $$;
revoke all on function public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time)
  from public,anon;
grant execute on function public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time)
  to authenticated;

-- Recuperación acotada al día del diagnóstico. Reejecutar no duplica horas
-- ni altera salidas existentes. Usa la hora reportada, nunca la hora de carga.
do $$
declare candidata record;
begin
  for candidata in
    select distinct e.colaborador_id,e.fecha
      from public.asis_entregas_diarias e
      join public.asis_entregas_direccion a on a.entrega_id=e.id
      join public.asis_registros r on r.colaborador_id=e.colaborador_id and r.fecha=e.fecha
     where e.fecha=date '2026-10-02' and e.requisito='salida'
       and e.estado='completo' and e.revision_estado='aprobada' and r.salida_at is null
     order by e.colaborador_id,e.fecha
  loop
    perform public.dash_admin_regularizar_cierre_impl(candidata.colaborador_id,candidata.fecha,null);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;

-- Comprobar las horas recuperadas y los pendientes que realmente queden.
select c.nombre,r.fecha,r.salida_at at time zone 'America/Lima' salida_lima,
  r.horas_efectivas,r.cierre_regularizado,
  public.dash_cierre_resumen_colab(c.id,r.fecha)->>'estado' estado_cierre
from public.asis_registros r
join public.asis_colaboradores c on c.id=r.colaborador_id
where r.fecha=date '2026-10-02' and exists(
  select 1 from public.asis_entregas_diarias e
  join public.asis_entregas_direccion a on a.entrega_id=e.id
  where e.colaborador_id=r.colaborador_id and e.fecha=r.fecha and e.requisito='salida'
    and e.estado='completo')
order by c.nombre;
