-- DASHBOARD 42 · ENTRADA VISIBLE Y REGULARIZACION DE SALIDA TARDIA
-- Ejecutar despues de dashboard_41_centro_notificaciones.sql.
-- La entrada siempre proviene de asis_registros. El colaborador conserva al
-- menos una hora posterior a su salida programada y Direccion puede registrar
-- una salida tardia cuando cuenta con foto, hora visible y una observacion.

begin;

update public.asis_cierre_config
   set salida_gracia_min=greatest(salida_gracia_min,60),
       actualizado_at=now()
 where id=1;

-- Evita que un resumen parcial o antiguo oculte una entrada que si existe.
create or replace function public.dash_admin_cierres(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_personas jsonb;
  v_areas jsonb;
  v_asignaciones jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>v_hoy+90 then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('id',area.id,'nombre',area.nombre)
           order by area.orden,area.nombre
         ),'[]'::jsonb)
    into v_areas
    from public.asis_areas area;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',colaborador.id,
           'nombre',colaborador.nombre,
           'area_id',colaborador.area_id,
           'area',area.nombre,
           'labora',public.asis_labora(colaborador,p_fecha),
           'cierre',coalesce(cierre.data,'{}'::jsonb)||jsonb_build_object(
             'registro_id',registro.id,
             'entrada_at',registro.marcado_at,
             'salida_at',registro.salida_at,
             'registro_encontrado',registro.id is not null
           )
         ) order by area.orden,colaborador.orden,colaborador.nombre),'[]'::jsonb)
    into v_personas
    from public.asis_colaboradores colaborador
    join public.asis_areas area on area.id=colaborador.area_id
    left join public.asis_registros registro
      on registro.colaborador_id=colaborador.id and registro.fecha=p_fecha
    left join lateral (
      select public.dash_cierre_resumen_colab(colaborador.id,p_fecha) as data
    ) cierre on true
   where colaborador.activo;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',asignacion.id,
           'fecha',asignacion.fecha,
           'colaborador_id',asignacion.colaborador_id,
           'area_id',asignacion.area_id,
           'destino',coalesce(colaborador.nombre,area.nombre),
           'tipo',asignacion.tipo,
           'titulo',asignacion.titulo,
           'instrucciones',asignacion.instrucciones,
           'activo',asignacion.activo
         ) order by asignacion.creado_at desc),'[]'::jsonb)
    into v_asignaciones
    from public.asis_asignaciones_diarias asignacion
    left join public.asis_colaboradores colaborador on colaborador.id=asignacion.colaborador_id
    left join public.asis_areas area on area.id=asignacion.area_id
   where asignacion.fecha=p_fecha and asignacion.activo;

  return jsonb_build_object(
    'ok',true,
    'fecha',p_fecha,
    'puede_editar',public.asis_puede_editar(),
    'areas',v_areas,
    'personas',v_personas,
    'asignaciones',v_asignaciones
  );
end;
$$;

revoke all on function public.dash_admin_cierres(date) from public,anon;
grant execute on function public.dash_admin_cierres(date) to authenticated;

-- Cierra una jornada solo si ya estan todas las evidencias, existe entrada y
-- hay una foto de salida auditada por Direccion. No inventa horas.
create or replace function public.dash_admin_regularizar_cierre(
  p_colaborador bigint,
  p_fecha date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_reg public.asis_registros;
  v_resumen jsonb;
  v_salida_at timestamptz;
  v_horas numeric;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colaborador is null or p_fecha is null
     or p_fecha<v_hoy-180 or p_fecha>v_hoy then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;

  perform pg_advisory_xact_lock(p_colaborador);
  select * into v_reg
    from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha
   for update;
  if v_reg.id is null then
    return jsonb_build_object('ok',false,'motivo','sin_entrada');
  end if;
  if v_reg.salida_at is not null then
    return jsonb_build_object(
      'ok',true,'regularizada',false,'motivo','ya_cerrada','salida_at',v_reg.salida_at
    );
  end if;

  v_resumen:=public.dash_cierre_resumen_colab(p_colaborador,p_fecha);
  if not coalesce((v_resumen->>'aplica_jornada')::boolean,false) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;
  if coalesce((v_resumen->>'pendientes_salida')::integer,1)>0 then
    return jsonb_build_object(
      'ok',true,'regularizada',false,'motivo','requisitos_pendientes',
      'pendientes',coalesce((v_resumen->>'pendientes_salida')::integer,1)
    );
  end if;

  select coalesce(auditoria.salida_reportada_at,entrega.completado_at)
    into v_salida_at
    from public.asis_entregas_diarias entrega
    join public.asis_entregas_direccion auditoria on auditoria.entrega_id=entrega.id
   where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
     and entrega.requisito='salida' and entrega.estado='completo'
     and exists(
       select 1 from public.asis_entrega_archivos archivo
        where archivo.entrega_id=entrega.id
     )
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
         salida_por=auth.uid(),
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_regularizado=true,
         cierre_nota=concat_ws(E'\n',nullif(btrim(cierre_nota),''),
           'Jornada regularizada por Direccion con foto y hora de salida verificadas.'),
         cierre_actualizado_at=now()
   where id=v_reg.id and salida_at is null;

  return jsonb_build_object(
    'ok',true,
    'regularizada',found,
    'salida_at',v_salida_at,
    'horas_efectivas',v_horas,
    'resumen',public.dash_cierre_resumen_colab(p_colaborador,p_fecha)
  );
end;
$$;

revoke all on function public.dash_admin_regularizar_cierre(bigint,date) from public,anon;
grant execute on function public.dash_admin_regularizar_cierre(bigint,date) to authenticated;

-- Variante exclusiva para la foto de salida recibida tarde. La ventana horaria
-- limita el autoservicio; Direccion conserva esta via auditada de regularizacion.
create or replace function public.dash_admin_confirmar_salida_tardia(
  p_colaborador bigint,
  p_fecha date,
  p_paths text[] default '{}',
  p_detalle text default null,
  p_hora_salida time default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_reg public.asis_registros;
  v_obj storage.objects;
  v_path text;
  v_entrega bigint;
  v_detalle text:=nullif(left(btrim(coalesce(p_detalle,'')),700),'');
  v_fin_at timestamptz;
  v_base_salida timestamptz;
  v_next_salida timestamptz;
  v_salida_at timestamptz;
  v_regularizacion jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colaborador is null or p_fecha is null or p_hora_salida is null
     or p_fecha<v_hoy-180 or p_fecha>v_hoy
     or coalesce(cardinality(p_paths),0)<>1 then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  if length(coalesce(v_detalle,''))<3 then
    return jsonb_build_object('ok',false,'motivo','detalle_salida');
  end if;

  select * into v_persona from public.asis_colaboradores
   where id=p_colaborador and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_persona.id is null then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  if not coalesce(v_cfg.habilitado,false)
     or not coalesce(v_cfg.salida_evidencia_habilitada,false)
     or p_fecha<v_cfg.obligatorio_desde
     or p_fecha<v_cfg.salida_evidencia_desde
     or not public.asis_labora(v_persona,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;

  perform pg_advisory_xact_lock(p_colaborador);
  select * into v_reg from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha for update;
  if v_reg.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrada'); end if;
  if v_reg.salida_at is not null then return jsonb_build_object('ok',false,'motivo','ya_cerrada'); end if;
  if exists(
    select 1 from public.asis_entregas_diarias entrega
     where entrega.colaborador_id=p_colaborador and entrega.fecha=p_fecha
       and entrega.requisito='salida' and entrega.estado='completo'
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;

  v_path:=p_paths[1];
  if not exists(
    select 1 from public.asis_carga_permisos permiso
     where permiso.path=v_path and permiso.colaborador_id=p_colaborador
       and permiso.fecha=p_fecha and permiso.vinculado_at is null
  ) then return jsonb_build_object('ok',false,'motivo','permiso'); end if;
  if v_path!~('^'||to_char(p_fecha,'YYYY/MM/DD')||'/'||p_colaborador||'/[0-9a-f-]+\.(jpg|webp)$') then
    return jsonb_build_object('ok',false,'motivo','ruta');
  end if;
  select * into v_obj from storage.objects
   where bucket_id='asis-cierre-evidencias' and name=v_path;
  if v_obj.id is null
     or coalesce((v_obj.metadata->>'size')::bigint,0) not between 1 and 1048576
     or coalesce(v_obj.metadata->>'mimetype','') not in ('image/jpeg','image/webp') then
    return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
  end if;

  v_base_salida:=((p_fecha::text||' '||p_hora_salida::text)::timestamp at time zone 'America/Lima');
  v_next_salida:=(((p_fecha+1)::text||' '||p_hora_salida::text)::timestamp at time zone 'America/Lima');
  v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
  v_salida_at:=case when v_fin_at is not null
    and abs(extract(epoch from(v_next_salida-v_fin_at)))<abs(extract(epoch from(v_base_salida-v_fin_at)))
    then v_next_salida else v_base_salida end;
  if v_salida_at<v_reg.marcado_at or v_salida_at>now()+interval '5 minutes' then
    return jsonb_build_object('ok',false,'motivo','hora_salida_invalida');
  end if;

  insert into public.asis_entregas_diarias(
    colaborador_id,fecha,requisito,detalle,revision_estado,revisado_at,revisado_por
  ) values(
    p_colaborador,p_fecha,'salida',v_detalle,'aprobada',now(),auth.uid()
  ) returning id into v_entrega;
  insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
  values(v_entrega,v_path,v_obj.metadata->>'mimetype',(v_obj.metadata->>'size')::integer,1);
  update public.asis_carga_permisos set vinculado_at=now() where path=v_path;
  insert into public.asis_entregas_direccion(
    entrega_id,colaborador_id,fecha,actor_id,salida_reportada_at,motivo
  ) values(v_entrega,p_colaborador,p_fecha,auth.uid(),v_salida_at,v_detalle);
  insert into public.asis_entrega_revisiones(
    entrega_id,estado_anterior,estado_nuevo,nota,actor_id
  ) values(
    v_entrega,'pendiente','aprobada',
    'Direccion registro la salida tardia con evidencia recibida.',auth.uid()
  );

  v_regularizacion:=public.dash_admin_regularizar_cierre(p_colaborador,p_fecha);
  return jsonb_build_object(
    'ok',true,
    'entrega',v_entrega,
    'cierre_regularizado',coalesce((v_regularizacion->>'regularizada')::boolean,false),
    'regularizacion',v_regularizacion,
    'resumen',public.dash_cierre_resumen_colab(p_colaborador,p_fecha)
  );
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','ya_completo');
end;
$$;

revoke all on function public.dash_admin_confirmar_salida_tardia(bigint,date,text[],text,time)
  from public,anon;
grant execute on function public.dash_admin_confirmar_salida_tardia(bigint,date,text[],text,time)
  to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end as estado,
       pieza,encontrado,esperado
from (
  select 'tolerancia minima de salida'::text as pieza,
         count(*)::integer as encontrado,1 as esperado
    from public.asis_cierre_config
   where id=1 and salida_gracia_min>=60
  union all
  select 'RPC de cierre con entrada directa',count(*)::integer,1
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid=procedimiento.pronamespace
   where esquema.nspname='public' and procedimiento.proname='dash_admin_cierres'
     and procedimiento.pronargs=1
  union all
  select 'RPC de regularizacion tardia',count(*)::integer,2
    from pg_proc procedimiento
    join pg_namespace esquema on esquema.oid=procedimiento.pronamespace
   where esquema.nspname='public'
     and procedimiento.proname in (
       'dash_admin_regularizar_cierre','dash_admin_confirmar_salida_tardia'
     )
) revision;

-- Diagnostico: Comparticiones puede existir sin jornada laboral. Solo reporta
-- entregas que realmente requieren una entrada (RPE, salida o asignaciones).
select colaborador.id,colaborador.nombre,entrega.fecha,
       count(*) filter(where entrega.estado='completo') as entregas_completas,
       min(entrega.completado_at) as primera_entrega
  from public.asis_entregas_diarias entrega
  join public.asis_colaboradores colaborador on colaborador.id=entrega.colaborador_id
 left join public.asis_registros registro
    on registro.colaborador_id=entrega.colaborador_id and registro.fecha=entrega.fecha
 where registro.id is null
   and entrega.requisito<>'comparticiones'
   and entrega.fecha>=(now() at time zone 'America/Lima')::date-7
 group by colaborador.id,colaborador.nombre,entrega.fecha
 order by entrega.fecha desc,colaborador.nombre;
