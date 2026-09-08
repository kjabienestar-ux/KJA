-- DASHBOARD 35 · HASTA 50 CAPTURAS DE FACEBOOK
-- Ejecutar después de dashboard_34_notificaciones_revision.sql.
-- Mantiene el mínimo configurado y amplía únicamente Facebook a 50 imágenes.

begin;

alter table public.asis_entrega_archivos
  drop constraint if exists asis_entrega_archivos_orden_check;
alter table public.asis_entrega_archivos
  add constraint asis_entrega_archivos_orden_check check (orden between 1 and 50);

-- Firma una captura de Facebook dentro de su horario independiente. La cuota
-- protege el servicio, pero permite una entrega completa y correcciones amplias.
create or replace function public.dash_entrega_permiso(
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
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_ext text;
  v_path text;
  v_pendientes integer:=0;
  v_total_dia integer:=0;
begin
  if coalesce(p_requisito,'')<>'comparticiones' then
    return public.dash_entrega_permiso_base_32(p_requisito,p_asignacion,p_modalidad,p_ext);
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde
     or not public.asis_compartir_programado(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_compartir');
  end if;
  if p_asignacion is not null or coalesce(p_modalidad,'') not in ('individuales','collage') then
    return jsonb_build_object('ok',false,'motivo','modalidad');
  end if;
  if p_modalidad='collage' and not v_cfg.collage_permitido then
    return jsonb_build_object('ok',false,'motivo','collage_no_permitido');
  end if;
  if exists(
    select 1 from public.asis_entregas_diarias
     where colaborador_id=v_colab and fecha=v_fecha
       and requisito='comparticiones' and estado='completo'
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;

  perform pg_advisory_xact_lock(v_colab);
  select count(*) filter(where vinculado_at is null),count(*)
    into v_pendientes,v_total_dia
    from public.asis_carga_permisos
   where colaborador_id=v_colab and fecha=v_fecha;
  if v_pendientes>=50 or v_total_dia>=180 then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;

  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp')
    then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha)
  values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end;
$$;

revoke all on function public.dash_entrega_permiso(text,bigint,text,text) from public,anon;
grant execute on function public.dash_entrega_permiso(text,bigint,text,text) to authenticated;

-- Confirma de 1 a 50 capturas individuales, o un único collage.
create or replace function public.dash_confirmar_entrega(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_paths text[] default '{}',
  p_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_total integer:=coalesce(cardinality(p_paths),0);
  v_path text;
  v_obj storage.objects;
  v_entrega bigint;
  v_orden integer:=0;
begin
  if coalesce(p_requisito,'')<>'comparticiones' then
    return public.dash_confirmar_entrega_base_32(p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle);
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  if not public.asis_compartir_programado(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_compartir');
  end if;
  if p_asignacion is not null or v_total not between 1 and 50
     or (select count(distinct x) from unnest(p_paths)x)<>v_total then
    return jsonb_build_object('ok',false,'motivo','archivos');
  end if;
  if p_modalidad='collage' then
    if not v_cfg.collage_permitido or v_total<>1 then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
  elsif p_modalidad='individuales' then
    if v_total<v_cfg.comparticiones_min or v_total>50 then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
  else return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  if (select count(*) from public.asis_carga_permisos p
       where p.path=any(p_paths) and p.colaborador_id=v_colab and p.fecha=v_fecha
         and p.vinculado_at is null)<>v_total then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;
  foreach v_path in array p_paths loop
    if v_path!~('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    if v_obj.id is null or coalesce((v_obj.metadata->>'size')::bigint,0) not between 1 and 1048576
       or coalesce(v_obj.metadata->>'mimetype','') not in ('image/jpeg','image/webp') then
      return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
    end if;
  end loop;

  perform pg_advisory_xact_lock(v_colab);
  if exists(
    select 1 from public.asis_entregas_diarias
     where colaborador_id=v_colab and fecha=v_fecha
       and requisito='comparticiones' and estado='completo'
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;
  insert into public.asis_entregas_diarias(colaborador_id,fecha,requisito,modalidad,detalle)
  values(v_colab,v_fecha,'comparticiones',p_modalidad,
    nullif(left(btrim(coalesce(p_detalle,'')),700),''))
  returning id into v_entrega;
  foreach v_path in array p_paths loop
    v_orden:=v_orden+1;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_entrega,v_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden);
  end loop;
  update public.asis_carga_permisos set vinculado_at=now()
   where path=any(p_paths) and colaborador_id=v_colab and fecha=v_fecha;
  return jsonb_build_object('ok',true,'entrega',v_entrega,
    'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha));
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','ya_completo');
end;
$$;

revoke all on function public.dash_confirmar_entrega(text,bigint,text,text[],text) from public,anon;
grant execute on function public.dash_confirmar_entrega(text,bigint,text,text[],text) to authenticated;

-- Conserva intacta la lógica de reemplazo de RPE y entregables; esta envoltura
-- amplía solamente Facebook y usa también su fecha/ventana independiente.
do $$
begin
  if to_regprocedure('public.dash_reemplazo_permiso_base_35(text,bigint,text,text,text)') is null then
    alter function public.dash_reemplazo_permiso(text,bigint,text,text,text)
      rename to dash_reemplazo_permiso_base_35;
  end if;
end;
$$;
revoke all on function public.dash_reemplazo_permiso_base_35(text,bigint,text,text,text)
  from public,anon,authenticated;

create or replace function public.dash_reemplazo_permiso(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_tipo_archivo text default 'imagen',
  p_ext text default 'jpg'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_ext text;
  v_path text;
  v_pendientes integer:=0;
  v_total_dia integer:=0;
begin
  if coalesce(p_requisito,'')<>'comparticiones' then
    return public.dash_reemplazo_permiso_base_35(
      p_requisito,p_asignacion,p_modalidad,p_tipo_archivo,p_ext
    );
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde
     or not public.asis_compartir_programado(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha)
     or not public.dash_evidencia_editable(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_edicion');
  end if;
  if p_asignacion is not null or p_tipo_archivo<>'imagen'
     or coalesce(p_modalidad,'') not in ('individuales','collage') then
    return jsonb_build_object('ok',false,'motivo','modalidad');
  end if;
  if p_modalidad='collage' and not v_cfg.collage_permitido then
    return jsonb_build_object('ok',false,'motivo','collage_no_permitido');
  end if;
  if not exists(
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id=v_colab and e.fecha=v_fecha
       and e.requisito='comparticiones' and e.estado='completo'
  ) then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;

  perform pg_advisory_xact_lock(v_colab);
  select count(*) filter(where vinculado_at is null),count(*)
    into v_pendientes,v_total_dia
    from public.asis_carga_permisos
   where colaborador_id=v_colab and fecha=v_fecha;
  if v_pendientes>=50 or v_total_dia>=180 then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;
  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp')
    then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha)
  values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end;
$$;

revoke all on function public.dash_reemplazo_permiso(text,bigint,text,text,text)
  from public,anon;
grant execute on function public.dash_reemplazo_permiso(text,bigint,text,text,text)
  to authenticated;

do $$
begin
  if to_regprocedure('public.dash_reemplazar_entrega_base_35(text,bigint,text,text[],text[],text,text)') is null then
    alter function public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text)
      rename to dash_reemplazar_entrega_base_35;
  end if;
end;
$$;
revoke all on function public.dash_reemplazar_entrega_base_35(text,bigint,text,text[],text[],text,text)
  from public,anon,authenticated;

create or replace function public.dash_reemplazar_entrega(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_paths text[] default '{}',
  p_conservar_paths text[] default '{}',
  p_detalle text default null,
  p_video_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_anterior public.asis_entregas_diarias;
  v_nueva bigint;
  v_nuevas integer:=coalesce(cardinality(p_paths),0);
  v_conservadas integer:=coalesce(cardinality(p_conservar_paths),0);
  v_imagenes integer:=0;
  v_path text;
  v_obj storage.objects;
  v_mime text;
  v_bytes bigint;
  v_orden integer:=0;
begin
  if coalesce(p_requisito,'')<>'comparticiones' then
    return public.dash_reemplazar_entrega_base_35(
      p_requisito,p_asignacion,p_modalidad,p_paths,p_conservar_paths,p_detalle,p_video_path
    );
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde
     or not public.asis_compartir_programado(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado');
  end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha)
     or not public.dash_evidencia_editable(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_edicion');
  end if;
  if p_asignacion is not null or p_video_path is not null
     or v_nuevas not between 0 and 50 or v_conservadas not between 0 and 50 then
    return jsonb_build_object('ok',false,'motivo','archivos');
  end if;
  if (select count(distinct x) from unnest(p_paths)x)<>v_nuevas
     or (select count(distinct x) from unnest(p_conservar_paths)x)<>v_conservadas
     or exists(select 1 from unnest(p_paths)x where x=any(p_conservar_paths)) then
    return jsonb_build_object('ok',false,'motivo','archivos_duplicados');
  end if;

  perform pg_advisory_xact_lock(v_colab);
  select * into v_anterior
    from public.asis_entregas_diarias e
   where e.colaborador_id=v_colab and e.fecha=v_fecha
     and e.requisito='comparticiones' and e.estado='completo'
   for update;
  if v_anterior.id is null then
    return jsonb_build_object('ok',false,'motivo','sin_entrega');
  end if;
  if (select count(*) from public.asis_entrega_archivos f
       where f.entrega_id=v_anterior.id and f.path=any(p_conservar_paths))<>v_conservadas then
    return jsonb_build_object('ok',false,'motivo','archivo_ajeno');
  end if;
  select count(*) into v_imagenes
    from public.asis_entrega_archivos f
   where f.entrega_id=v_anterior.id and f.path=any(p_conservar_paths)
     and f.mime in ('image/jpeg','image/webp');
  v_imagenes:=coalesce(v_imagenes,0)+v_nuevas;
  if p_modalidad='collage' then
    if not v_cfg.collage_permitido or v_imagenes<>1 then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
  elsif p_modalidad='individuales' then
    if v_imagenes<v_cfg.comparticiones_min or v_imagenes>50 then
      return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
    end if;
  else return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  if cardinality(p_paths)>0 and (select count(*) from public.asis_carga_permisos p
       where p.path=any(p_paths) and p.colaborador_id=v_colab and p.fecha=v_fecha
         and p.vinculado_at is null)<>v_nuevas then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;
  foreach v_path in array p_paths loop
    if v_path!~('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    if v_obj.id is null or coalesce(v_obj.metadata->>'mimetype','') not in ('image/jpeg','image/webp')
       or coalesce((v_obj.metadata->>'size')::bigint,0) not between 1 and 1048576 then
      return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
    end if;
  end loop;

  update public.asis_entregas_diarias set estado='anulado' where id=v_anterior.id;
  insert into public.asis_entregas_diarias(
    colaborador_id,fecha,requisito,asignacion_id,modalidad,detalle
  ) values(
    v_colab,v_fecha,'comparticiones',null,p_modalidad,
    coalesce(nullif(left(btrim(coalesce(p_detalle,'')),700),''),v_anterior.detalle)
  ) returning id into v_nueva;
  foreach v_path in array p_conservar_paths loop
    select f.mime,f.bytes into v_mime,v_bytes
      from public.asis_entrega_archivos f
     where f.entrega_id=v_anterior.id and f.path=v_path;
    v_orden:=v_orden+1;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,v_path,v_mime,v_bytes::integer,v_orden);
  end loop;
  foreach v_path in array p_paths loop
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    v_orden:=v_orden+1;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,v_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden);
  end loop;
  update public.asis_carga_permisos set vinculado_at=now()
   where path=any(p_paths) and colaborador_id=v_colab and fecha=v_fecha;
  insert into public.asis_entrega_reemplazos(
    entrega_anterior_id,entrega_nueva_id,colaborador_id,fecha
  ) values(v_anterior.id,v_nueva,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'entrega',v_nueva,
    'entrega_anterior',v_anterior.id,
    'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha));
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','cambio_concurrente');
end;
$$;

revoke all on function public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text)
  from public,anon;
grant execute on function public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text)
  to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end as estado,
       pieza,encontrado,esperado
from (
  select 'límite de orden de archivos'::text as pieza,
         count(*)::integer as encontrado,1 as esperado
    from pg_constraint
   where conrelid='public.asis_entrega_archivos'::regclass
     and conname='asis_entrega_archivos_orden_check'
     and pg_get_constraintdef(oid) like '%50%'
  union all
  select 'RPC ampliadas para Facebook',count(*)::integer,4
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'dash_entrega_permiso','dash_confirmar_entrega',
     'dash_reemplazo_permiso','dash_reemplazar_entrega'
   )
) verificacion;
