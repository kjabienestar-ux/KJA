-- Ejecutar después de dashboard_58. Requiere dashboard_55 y actualizar dash-entrega.
begin;
create or replace function public.dash_admin_entrega_permiso(
  p_colaborador bigint,
  p_fecha date,
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_ext text default 'jpg'
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
  v_ext text;
  v_path text;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colaborador is null or p_fecha is null
     or p_fecha<v_hoy-180 or p_fecha>v_hoy
     or coalesce(p_requisito,'') not in ('comparticiones','rpe','salida','asignado') then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;

  select * into v_persona from public.asis_colaboradores
   where id=p_colaborador and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_persona.id is null then
    return jsonb_build_object('ok',false,'motivo','colaborador');
  end if;
  if not coalesce(v_cfg.habilitado,false) or p_fecha<v_cfg.obligatorio_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;

  if p_requisito='comparticiones' then
    if p_asignacion is not null
       or coalesce(p_modalidad,'') not in ('individuales','collage')
       or not public.asis_compartir_programado(p_colaborador,p_fecha) then
      return jsonb_build_object('ok',false,'motivo','no_programado');
    end if;
    if p_modalidad='collage' and not v_cfg.collage_permitido then
      return jsonb_build_object('ok',false,'motivo','collage_no_permitido');
    end if;
  elsif p_requisito='asignado' then
    if p_asignacion is null or p_modalidad is not null or not exists(
      select 1 from public.asis_asignaciones_diarias a
       where a.id=p_asignacion and a.fecha=p_fecha and a.activo and a.requerido
         and (a.colaborador_id=p_colaborador or a.area_id=v_persona.area_id)
    ) or not exists(
      select 1 from public.asis_registros r
       where r.colaborador_id=p_colaborador and r.fecha=p_fecha
    ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  else
    if p_asignacion is not null or p_modalidad is not null
       or not public.asis_labora(v_persona,p_fecha)
       or not exists(
         select 1 from public.asis_registros r
          where r.colaborador_id=p_colaborador and r.fecha=p_fecha
       ) then
      return jsonb_build_object('ok',false,'motivo','no_programado');
    end if;
    if p_requisito='salida' and (
      not coalesce(v_cfg.salida_evidencia_habilitada,false)
      or p_fecha<v_cfg.salida_evidencia_desde
    ) then return jsonb_build_object('ok',false,'motivo','no_habilitado'); end if;
  end if;

  if exists(
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id=p_colaborador and e.fecha=p_fecha
       and e.estado='completo'
       and ((p_requisito='asignado' and e.asignacion_id=p_asignacion)
         or (p_requisito<>'asignado' and e.requisito=p_requisito and e.asignacion_id is null))
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;

  perform pg_advisory_xact_lock(p_colaborador);
  if (select count(*) from public.asis_carga_permisos
       where colaborador_id=p_colaborador and fecha=p_fecha and vinculado_at is null)>=50 then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;
  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp')
    then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  if public.dash_documento_mime(p_ext) is not null then
    if p_requisito is distinct from 'asignado' then return jsonb_build_object('ok',false,'motivo','formato_documento'); end if;
    v_ext:=lower(p_ext);
  end if;
  v_path:=to_char(p_fecha,'YYYY/MM/DD')||'/'||p_colaborador||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha)
  values(v_path,p_colaborador,p_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end;
$$;

revoke all on function public.dash_admin_entrega_permiso(bigint,date,text,bigint,text,text)
  from public,anon;
grant execute on function public.dash_admin_entrega_permiso(bigint,date,text,bigint,text,text)
  to authenticated;

create or replace function public.dash_admin_confirmar_entrega(
  p_colaborador bigint,
  p_fecha date,
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
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
  v_total integer:=coalesce(cardinality(p_paths),0);
  v_orden integer:=0;
  v_detalle text:=nullif(left(btrim(coalesce(p_detalle,'')),700),'');
  v_fin_at timestamptz;
  v_base_salida timestamptz;
  v_next_salida timestamptz;
  v_salida_at timestamptz;
  v_resumen jsonb;
  v_regularizada boolean:=false;
  v_horas numeric;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_colaborador is null or p_fecha is null
     or p_fecha<v_hoy-180 or p_fecha>v_hoy
     or coalesce(p_requisito,'') not in ('comparticiones','rpe','salida','asignado') then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  select * into v_persona from public.asis_colaboradores
   where id=p_colaborador and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_persona.id is null then return jsonb_build_object('ok',false,'motivo','colaborador'); end if;
  if not coalesce(v_cfg.habilitado,false) or p_fecha<v_cfg.obligatorio_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;

  if p_requisito='comparticiones' then
    if p_asignacion is not null or coalesce(p_modalidad,'') not in ('individuales','collage')
       or not public.asis_compartir_programado(p_colaborador,p_fecha) then
      return jsonb_build_object('ok',false,'motivo','no_programado');
    end if;
    if p_modalidad='collage' and (not v_cfg.collage_permitido or v_total<>1) then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
    if p_modalidad='individuales' and v_total not between v_cfg.comparticiones_min and 50 then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
  elsif p_requisito='asignado' then
    if p_asignacion is null or p_modalidad is not null or v_total not between 1 and 5
       or not exists(
         select 1 from public.asis_asignaciones_diarias a
          where a.id=p_asignacion and a.fecha=p_fecha and a.activo and a.requerido
            and (a.colaborador_id=p_colaborador or a.area_id=v_persona.area_id)
       ) or not exists(
         select 1 from public.asis_registros r
          where r.colaborador_id=p_colaborador and r.fecha=p_fecha
       ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  else
    if p_asignacion is not null or p_modalidad is not null
       or not public.asis_labora(v_persona,p_fecha)
       or not exists(
         select 1 from public.asis_registros r
          where r.colaborador_id=p_colaborador and r.fecha=p_fecha
       ) then
      return jsonb_build_object('ok',false,'motivo','no_programado');
    end if;
    if p_requisito='salida' then
      if v_total<>1 or p_hora_salida is null then
        return jsonb_build_object('ok',false,'motivo','hora_salida');
      end if;
      if length(coalesce(v_detalle,''))<3 then
        return jsonb_build_object('ok',false,'motivo','detalle_salida');
      end if;
      if not coalesce(v_cfg.salida_evidencia_habilitada,false)
         or p_fecha<v_cfg.salida_evidencia_desde then
        return jsonb_build_object('ok',false,'motivo','no_habilitado');
      end if;
    elsif v_total not between 1 and 5 then
      return jsonb_build_object('ok',false,'motivo','archivos');
    end if;
  end if;

  if v_total<1 or (select count(distinct path) from unnest(p_paths) path)<>v_total then
    return jsonb_build_object('ok',false,'motivo','archivos');
  end if;
  if (select count(*) from public.asis_carga_permisos permiso
       where permiso.path=any(p_paths) and permiso.colaborador_id=p_colaborador
         and permiso.fecha=p_fecha and permiso.vinculado_at is null)<>v_total then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;

  foreach v_path in array p_paths loop
    if v_path!~('^'||to_char(p_fecha,'YYYY/MM/DD')||'/'||p_colaborador||'/[0-9a-f-]+\.(jpg|webp|pdf|doc|docx|ppt|pptx)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    if v_obj.id is null or not public.dash_archivo_asignado_valido(p_requisito,v_path,v_obj.metadata->>'mimetype',(v_obj.metadata->>'size')::bigint) then
      return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
    end if;
  end loop;

  perform pg_advisory_xact_lock(p_colaborador);
  if exists(
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id=p_colaborador and e.fecha=p_fecha and e.estado='completo'
       and ((p_requisito='asignado' and e.asignacion_id=p_asignacion)
         or (p_requisito<>'asignado' and e.requisito=p_requisito and e.asignacion_id is null))
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;

  if p_requisito='salida' then
    select * into v_reg from public.asis_registros
     where colaborador_id=p_colaborador and fecha=p_fecha for update;
    if v_reg.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrada'); end if;
    v_base_salida:=((p_fecha::text||' '||p_hora_salida::text)::timestamp at time zone 'America/Lima');
    v_next_salida:=(((p_fecha+1)::text||' '||p_hora_salida::text)::timestamp at time zone 'America/Lima');
    v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
    v_salida_at:=case when v_fin_at is not null
      and abs(extract(epoch from(v_next_salida-v_fin_at)))<abs(extract(epoch from(v_base_salida-v_fin_at)))
      then v_next_salida else v_base_salida end;
    if v_salida_at<v_reg.marcado_at or v_salida_at>now()+interval '5 minutes' then
      return jsonb_build_object('ok',false,'motivo','hora_salida_invalida');
    end if;
    if p_fecha=v_hoy and v_fin_at is not null and not (
      v_salida_at between
        v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min) and
        v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min)
    ) then return jsonb_build_object('ok',false,'motivo','hora_fuera_horario'); end if;
  end if;

  insert into public.asis_entregas_diarias(
    colaborador_id,fecha,requisito,asignacion_id,modalidad,detalle,
    revision_estado,revisado_at,revisado_por
  ) values(
    p_colaborador,p_fecha,p_requisito,p_asignacion,p_modalidad,v_detalle,
    'aprobada',now(),auth.uid()
  ) returning id into v_entrega;

  foreach v_path in array p_paths loop
    v_orden:=v_orden+1;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_entrega,v_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden);
  end loop;
  update public.asis_carga_permisos set vinculado_at=now()
   where path=any(p_paths) and colaborador_id=p_colaborador and fecha=p_fecha;

  insert into public.asis_entregas_direccion(
    entrega_id,colaborador_id,fecha,actor_id,salida_reportada_at,motivo
  ) values(
    v_entrega,p_colaborador,p_fecha,auth.uid(),v_salida_at,
    coalesce(v_detalle,'Evidencia recibida por un canal interno y cargada por Direccion.')
  );
  insert into public.asis_entrega_revisiones(
    entrega_id,estado_anterior,estado_nuevo,nota,actor_id
  ) values(
    v_entrega,'pendiente','aprobada',
    'Direccion registro esta evidencia en nombre del colaborador.',auth.uid()
  );

  v_resumen:=public.dash_cierre_resumen_colab(p_colaborador,p_fecha);
  if coalesce((v_resumen->>'aplica_jornada')::boolean,false)
     and coalesce((v_resumen->>'pendientes_salida')::integer,1)=0 then
    select * into v_reg from public.asis_registros
     where colaborador_id=p_colaborador and fecha=p_fecha for update;
    if v_reg.id is not null and v_reg.salida_at is null then
      if v_salida_at is null then
        select coalesce(a.salida_reportada_at,e.completado_at)
          into v_salida_at
          from public.asis_entregas_diarias e
          left join public.asis_entregas_direccion a on a.entrega_id=e.id
         where e.colaborador_id=p_colaborador and e.fecha=p_fecha
           and e.requisito='salida' and e.estado='completo'
           and exists(select 1 from public.asis_entrega_archivos f where f.entrega_id=e.id)
         order by e.completado_at desc limit 1;
      end if;
      if v_salida_at is not null and v_salida_at>=v_reg.marcado_at
         and v_salida_at<=now()+interval '5 minutes' then
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
                 'Jornada completada por Direccion con evidencia recibida por interno.'),
               cierre_actualizado_at=now()
         where id=v_reg.id;
        v_regularizada:=true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,
    'entrega',v_entrega,
    'cierre_regularizado',v_regularizada,
    'resumen',public.dash_cierre_resumen_colab(p_colaborador,p_fecha)
  );
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','ya_completo');
end;
$$;

revoke all on function public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time)
  from public,anon;
grant execute on function public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time)
  to authenticated;
notify pgrst,'reload schema';
commit;

