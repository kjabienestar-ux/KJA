-- Ejecutar después de dashboard_54. Documentos privados en asignaciones.
-- Conserva las envolturas de horarios, Facebook y cierre automático.
begin;
alter table public.asis_entrega_archivos drop constraint if exists asis_entrega_archivos_mime_check;
alter table public.asis_entrega_archivos add constraint asis_entrega_archivos_mime_check check(mime in ('image/jpeg','image/webp','video/mp4','video/webm','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'));
alter table public.asis_entrega_archivos drop constraint if exists asis_entrega_archivos_bytes_check;
alter table public.asis_entrega_archivos add constraint asis_entrega_archivos_bytes_check check ((mime in ('image/jpeg','image/webp') and bytes between 1 and 1048576) or (mime in ('video/mp4','video/webm') and bytes between 1 and 8388608) or (mime in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation') and bytes between 1 and 10485760));
update storage.buckets set file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/webp','video/mp4','video/webm','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'] where id='asis-cierre-evidencias';
create or replace function public.dash_documento_mime(p_ext text) returns text language sql immutable set search_path=public as $$ select case lower(p_ext)
 when 'pdf' then 'application/pdf'
 when 'doc' then 'application/msword'
 when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 when 'ppt' then 'application/vnd.ms-powerpoint'
 when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
 end; $$;
revoke all on function public.dash_documento_mime(text) from public,anon,authenticated;
create or replace function public.dash_archivo_asignado_valido(p_requisito text,p_path text,p_mime text,p_bytes bigint)
returns boolean language sql immutable set search_path=public as $$
 select coalesce((p_path ~ '\.(jpg|webp)$' and p_mime in ('image/jpeg','image/webp') and p_bytes between 1 and 1048576)
 or (p_requisito='asignado' and public.dash_documento_mime(substring(p_path from '\.([^.]+)$'))=p_mime and p_bytes between 1 and 10485760),false);
$$;
revoke all on function public.dash_archivo_asignado_valido(text,text,text,bigint) from public,anon,authenticated;

create or replace function public.dash_entrega_permiso_base_26(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_ext text default 'jpg'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_ext text;
  v_path text;
  v_max_permisos integer;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select * into v_persona from public.asis_colaboradores where id = v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id = 1;
  if not coalesce(v_cfg.habilitado, false) or v_hoy < v_cfg.obligatorio_desde then
    return jsonb_build_object('ok', false, 'motivo', 'no_habilitado');
  end if;
  if not exists (
    select 1 from public.asis_registros
     where colaborador_id = v_colab and fecha = v_hoy and salida_at is null
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_entrada_o_cerrada');
  end if;
  if p_requisito not in ('comparticiones','rpe','asignado') then
    return jsonb_build_object('ok', false, 'motivo', 'requisito');
  end if;
  if p_requisito = 'comparticiones'
     and coalesce(p_modalidad, '') not in ('individuales','collage') then
    return jsonb_build_object('ok', false, 'motivo', 'modalidad');
  end if;
  if p_requisito = 'comparticiones' and p_modalidad = 'collage' and not v_cfg.collage_permitido then
    return jsonb_build_object('ok', false, 'motivo', 'collage_no_permitido');
  end if;
  if p_requisito = 'asignado' and not exists (
    select 1 from public.asis_asignaciones_diarias a
     where a.id = p_asignacion and a.fecha = v_hoy and a.activo and a.requerido
       and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id)
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'asignacion');
  end if;
  if p_requisito <> 'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok', false, 'motivo', 'asignacion');
  end if;
  if exists (
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id = v_colab and e.fecha = v_hoy and e.estado = 'completo'
       and ((p_requisito <> 'asignado' and e.requisito = p_requisito)
         or (p_requisito = 'asignado' and e.asignacion_id = p_asignacion))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_completo');
  end if;

  -- Serializa permisos del mismo colaborador para que dos solicitudes
  -- concurrentes no puedan saltarse el límite.
  perform pg_advisory_xact_lock(v_colab);
  select 20 + count(*)::integer * 5
    into v_max_permisos
    from public.asis_asignaciones_diarias a
   where a.fecha = v_hoy and a.activo and a.requerido
     and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id);

  if (select count(*) from public.asis_carga_permisos p
       where p.colaborador_id = v_colab and p.fecha = v_hoy) >= v_max_permisos then
    return jsonb_build_object('ok', false, 'motivo', 'cuota_diaria');
  end if;

  v_ext := case when lower(coalesce(p_ext, '')) in ('jpg','jpeg','webp')
                then case when lower(p_ext) = 'jpeg' then 'jpg' else lower(p_ext) end
                else 'jpg' end;
  if public.dash_documento_mime(p_ext) is not null then
    if p_requisito is distinct from 'asignado' then return jsonb_build_object('ok',false,'motivo','formato_documento'); end if;
    v_ext:=lower(p_ext);
  end if;
  v_path := to_char(v_hoy, 'YYYY/MM/DD') || '/' || v_colab || '/' || gen_random_uuid() || '.' || v_ext;

  insert into public.asis_carga_permisos(path, colaborador_id, fecha)
  values (v_path, v_colab, v_hoy);

  return jsonb_build_object(
    'ok', true,
    'ruta', v_path,
    'servidor_at', now()
  );
end;
$$;

create or replace function public.dash_confirmar_entrega_base_26(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_paths text[] default '{}',
  p_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_entrega bigint;
  v_total integer := coalesce(cardinality(p_paths), 0);
  v_validos integer := 0;
  v_path text;
  v_orden integer := 0;
  v_obj storage.objects;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select * into v_persona from public.asis_colaboradores where id = v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id = 1;
  if not coalesce(v_cfg.habilitado, false) or v_hoy < v_cfg.obligatorio_desde then
    return jsonb_build_object('ok', false, 'motivo', 'no_habilitado');
  end if;
  if not exists (
    select 1 from public.asis_registros
     where colaborador_id = v_colab and fecha = v_hoy and salida_at is null
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_entrada_o_cerrada');
  end if;
  if p_requisito not in ('comparticiones','rpe','asignado') or v_total not between 1 and 5 then
    return jsonb_build_object('ok', false, 'motivo', 'archivos');
  end if;
  if (select count(distinct x) from unnest(p_paths) x) <> v_total then
    return jsonb_build_object('ok', false, 'motivo', 'archivos_duplicados');
  end if;

  if p_requisito = 'comparticiones' then
    if coalesce(p_modalidad, '') = 'collage' then
      if not v_cfg.collage_permitido or v_total <> 1 then
        return jsonb_build_object('ok', false, 'motivo', 'cantidad_comparticiones');
      end if;
    elsif p_modalidad = 'individuales' then
      if v_total < v_cfg.comparticiones_min then
        return jsonb_build_object('ok', false, 'motivo', 'cantidad_comparticiones');
      end if;
    else
      return jsonb_build_object('ok', false, 'motivo', 'modalidad');
    end if;
  end if;

  if p_requisito = 'asignado' and not exists (
    select 1 from public.asis_asignaciones_diarias a
     where a.id = p_asignacion and a.fecha = v_hoy and a.activo and a.requerido
       and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id)
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'asignacion');
  end if;
  if p_requisito <> 'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok', false, 'motivo', 'asignacion');
  end if;
  if exists (
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id = v_colab and e.fecha = v_hoy and e.estado = 'completo'
       and ((p_requisito <> 'asignado' and e.requisito = p_requisito)
         or (p_requisito = 'asignado' and e.asignacion_id = p_asignacion))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_completo');
  end if;

  foreach v_path in array p_paths loop
    if v_path !~ ('^' || to_char(v_hoy, 'YYYY/MM/DD') || '/' || v_colab || '/[0-9a-f-]+\.(jpg|webp|pdf|doc|docx|ppt|pptx)$') then
      return jsonb_build_object('ok', false, 'motivo', 'ruta');
    end if;
    select * into v_obj
      from storage.objects
     where bucket_id = 'asis-cierre-evidencias' and name = v_path;
    if v_obj.id is null
       or not public.dash_archivo_asignado_valido(p_requisito,v_path,v_obj.metadata->>'mimetype',(v_obj.metadata->>'size')::bigint) then
      return jsonb_build_object('ok', false, 'motivo', 'archivo_no_verificado');
    end if;
    v_validos := v_validos + 1;
  end loop;

  if v_validos <> v_total then
    return jsonb_build_object('ok', false, 'motivo', 'archivo_no_verificado');
  end if;

  insert into public.asis_entregas_diarias (
    colaborador_id, fecha, requisito, asignacion_id, modalidad, detalle
  ) values (
    v_colab, v_hoy, p_requisito, p_asignacion,
    case when p_requisito = 'comparticiones' then p_modalidad else null end,
    nullif(left(btrim(coalesce(p_detalle, '')), 700), '')
  ) returning id into v_entrega;

  foreach v_path in array p_paths loop
    v_orden := v_orden + 1;
    select * into v_obj
      from storage.objects
     where bucket_id = 'asis-cierre-evidencias' and name = v_path;
    insert into public.asis_entrega_archivos (entrega_id, path, mime, bytes, orden)
    values (
      v_entrega,
      v_path,
      v_obj.metadata ->> 'mimetype',
      (v_obj.metadata ->> 'size')::integer,
      v_orden
    );
  end loop;

  update public.asis_carga_permisos
     set vinculado_at = now()
   where path = any(p_paths) and colaborador_id = v_colab and fecha = v_hoy;

  return jsonb_build_object(
    'ok', true,
    'entrega', v_entrega,
    'resumen', public.dash_cierre_resumen_colab(v_colab, v_hoy)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ya_completo');
end;
$$;

create or replace function public.dash_reemplazo_permiso_base_35(
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
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_ext text;
  v_path text;
  v_max integer;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  select * into v_persona from public.asis_colaboradores where id=v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_persona.id is null or not coalesce(v_cfg.habilitado,false)
     or v_fecha<v_cfg.obligatorio_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  if not public.dash_evidencia_editable(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_edicion');
  end if;
  if coalesce(p_requisito,'') not in ('comparticiones','rpe','asignado')
     or coalesce(p_tipo_archivo,'') not in ('imagen','video') then
    return jsonb_build_object('ok',false,'motivo','requisito');
  end if;
  if p_requisito='comparticiones' then
    if p_tipo_archivo<>'imagen' or coalesce(p_modalidad,'') not in ('individuales','collage') then
      return jsonb_build_object('ok',false,'motivo','modalidad');
    end if;
    if p_modalidad='collage' and not v_cfg.collage_permitido then
      return jsonb_build_object('ok',false,'motivo','collage_no_permitido');
    end if;
  elsif p_modalidad is not null then
    return jsonb_build_object('ok',false,'motivo','modalidad');
  end if;
  if p_tipo_archivo='video' and p_requisito not in ('rpe','asignado') then
    return jsonb_build_object('ok',false,'motivo','video_no_permitido');
  end if;
  if p_requisito='asignado' and not exists(
    select 1 from public.asis_asignaciones_diarias a
     where a.id=p_asignacion and a.fecha=v_fecha and a.activo and a.requerido
       and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id)
  ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  if p_requisito<>'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok',false,'motivo','asignacion');
  end if;
  if not exists(
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id=v_colab and e.fecha=v_fecha and e.estado='completo'
       and ((p_requisito<>'asignado' and e.requisito=p_requisito)
         or (p_requisito='asignado' and e.asignacion_id=p_asignacion))
  ) then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;

  perform pg_advisory_xact_lock(v_colab);
  select 40+count(*)::integer*12 into v_max
    from public.asis_asignaciones_diarias a
   where a.fecha=v_fecha and a.activo and a.requerido
     and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id);
  if (select count(*) from public.asis_carga_permisos
       where colaborador_id=v_colab and fecha=v_fecha)>=v_max then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;

  if p_tipo_archivo='video' then
    v_ext:=lower(coalesce(p_ext,''));
    if v_ext not in ('mp4','webm') then
      return jsonb_build_object('ok',false,'motivo','formato_video');
    end if;
  else
    v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp')
      then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  end if;
  if public.dash_documento_mime(p_ext) is not null then
    if p_requisito is distinct from 'asignado' then return jsonb_build_object('ok',false,'motivo','formato_documento'); end if;
    v_ext:=lower(p_ext);
  end if;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha)
  values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end $$;

create or replace function public.dash_reemplazar_entrega_base_35(
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
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_anterior public.asis_entregas_diarias;
  v_nueva bigint;
  v_nuevas integer:=coalesce(cardinality(p_paths),0);
  v_conservadas integer:=coalesce(cardinality(p_conservar_paths),0);
  v_imagenes integer:=0;
  v_videos integer:=0;
  v_subidas text[];
  v_path text;
  v_obj storage.objects;
  v_mime text;
  v_bytes bigint;
  v_orden integer:=0;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  select * into v_persona from public.asis_colaboradores where id=v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_persona.id is null or not coalesce(v_cfg.habilitado,false)
     or v_fecha<v_cfg.obligatorio_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  if not public.dash_evidencia_editable(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_edicion');
  end if;
  if coalesce(p_requisito,'') not in ('comparticiones','rpe','asignado')
     or v_nuevas not between 0 and 5 or v_conservadas not between 0 and 6 then
    return jsonb_build_object('ok',false,'motivo','archivos');
  end if;
  if (select count(distinct x) from unnest(p_paths) x)<>v_nuevas
     or (select count(distinct x) from unnest(p_conservar_paths) x)<>v_conservadas then
    return jsonb_build_object('ok',false,'motivo','archivos_duplicados');
  end if;
  if p_requisito='asignado' and not exists(
    select 1 from public.asis_asignaciones_diarias a
     where a.id=p_asignacion and a.fecha=v_fecha and a.activo and a.requerido
       and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id)
  ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  if p_requisito<>'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok',false,'motivo','asignacion');
  end if;

  perform pg_advisory_xact_lock(v_colab);
  if not public.dash_evidencia_editable(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','fuera_horario_edicion');
  end if;
  select * into v_anterior
    from public.asis_entregas_diarias e
   where e.colaborador_id=v_colab and e.fecha=v_fecha and e.estado='completo'
     and ((p_requisito<>'asignado' and e.requisito=p_requisito)
       or (p_requisito='asignado' and e.asignacion_id=p_asignacion))
   for update;
  if v_anterior.id is null then
    return jsonb_build_object('ok',false,'motivo','sin_entrega');
  end if;

  -- Sólo se pueden conservar rutas de la versión que se está editando.
  if (select count(*) from public.asis_entrega_archivos f
       where f.entrega_id=v_anterior.id and f.path=any(p_conservar_paths))<>v_conservadas then
    return jsonb_build_object('ok',false,'motivo','archivo_ajeno');
  end if;
  select count(*) filter(where f.mime in ('image/jpeg','image/webp') or (p_requisito='asignado' and f.mime in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'))),
         count(*) filter(where f.mime in ('video/mp4','video/webm'))
    into v_imagenes,v_videos
    from public.asis_entrega_archivos f
   where f.entrega_id=v_anterior.id and f.path=any(p_conservar_paths);
  v_imagenes:=coalesce(v_imagenes,0)+v_nuevas;
  v_videos:=coalesce(v_videos,0)+(case when p_video_path is null then 0 else 1 end);

  if p_requisito='comparticiones' then
    if v_videos<>0 then return jsonb_build_object('ok',false,'motivo','video_no_permitido'); end if;
    if coalesce(p_modalidad,'')='collage' then
      if not v_cfg.collage_permitido or v_imagenes<>1 then
        return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
      end if;
    elsif p_modalidad='individuales' then
      if v_imagenes<v_cfg.comparticiones_min or v_imagenes>5 then
        return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
      end if;
    else return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  else
    if p_modalidad is not null then return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
    if v_imagenes not between 1 and 5 then
      return jsonb_build_object('ok',false,'motivo','archivos');
    end if;
    if v_videos>1 then return jsonb_build_object('ok',false,'motivo','video_existente'); end if;
  end if;

  v_subidas:=case when p_video_path is null then p_paths else array_append(p_paths,p_video_path) end;
  if (select count(distinct x) from unnest(v_subidas) x)<>cardinality(v_subidas)
     or exists(select 1 from unnest(v_subidas) x where x=any(p_conservar_paths)) then
    return jsonb_build_object('ok',false,'motivo','archivos_duplicados');
  end if;
  if cardinality(v_subidas)>0 and (select count(*) from public.asis_carga_permisos p
       where p.path=any(v_subidas) and p.colaborador_id=v_colab and p.fecha=v_fecha
         and p.vinculado_at is null)<>cardinality(v_subidas) then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;

  foreach v_path in array p_paths loop
    if v_path !~ ('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp|pdf|doc|docx|ppt|pptx)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    v_mime:=coalesce(v_obj.metadata->>'mimetype','');
    v_bytes:=coalesce((v_obj.metadata->>'size')::bigint,0);
    if v_obj.id is null or not public.dash_archivo_asignado_valido(p_requisito,v_path,v_mime,v_bytes) then
      return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
    end if;
  end loop;
  if p_video_path is not null then
    if p_requisito not in ('rpe','asignado')
       or p_video_path !~ ('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(mp4|webm)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=p_video_path;
    v_mime:=coalesce(v_obj.metadata->>'mimetype','');
    v_bytes:=coalesce((v_obj.metadata->>'size')::bigint,0);
    if v_obj.id is null or v_mime not in ('video/mp4','video/webm')
       or v_bytes not between 1 and 8388608 then
      return jsonb_build_object('ok',false,'motivo','video_no_verificado');
    end if;
  end if;

  update public.asis_entregas_diarias set estado='anulado'
   where id=v_anterior.id;
  insert into public.asis_entregas_diarias(
    colaborador_id,fecha,requisito,asignacion_id,modalidad,detalle
  ) values(
    v_colab,v_fecha,p_requisito,p_asignacion,
    case when p_requisito='comparticiones' then p_modalidad else null end,
    coalesce(nullif(left(btrim(coalesce(p_detalle,'')),700),''),v_anterior.detalle)
  ) returning id into v_nueva;

  foreach v_path in array p_conservar_paths loop
    select f.mime,f.bytes into v_mime,v_bytes
      from public.asis_entrega_archivos f
     where f.entrega_id=v_anterior.id and f.path=v_path;
    if public.dash_archivo_asignado_valido(p_requisito,v_path,v_mime,v_bytes) then
      v_orden:=v_orden+1;
      insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
      values(v_nueva,v_path,v_mime,v_bytes::integer,v_orden);
    end if;
  end loop;
  foreach v_path in array p_paths loop
    v_orden:=v_orden+1;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,v_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden);
  end loop;
  foreach v_path in array p_conservar_paths loop
    select f.mime,f.bytes into v_mime,v_bytes
      from public.asis_entrega_archivos f
     where f.entrega_id=v_anterior.id and f.path=v_path;
    if v_mime in ('video/mp4','video/webm') then
      v_orden:=v_orden+1;
      insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
      values(v_nueva,v_path,v_mime,v_bytes::integer,v_orden);
    end if;
  end loop;
  if p_video_path is not null then
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=p_video_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,p_video_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden+1);
  end if;
  update public.asis_carga_permisos set vinculado_at=now()
   where path=any(v_subidas) and colaborador_id=v_colab and fecha=v_fecha;
  insert into public.asis_entrega_reemplazos(
    entrega_anterior_id,entrega_nueva_id,colaborador_id,fecha
  ) values(v_anterior.id,v_nueva,v_colab,v_fecha);

  return jsonb_build_object(
    'ok',true,'entrega',v_nueva,'entrega_anterior',v_anterior.id,
    'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha)
  );
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','cambio_concurrente');
end $$;
drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id='asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp|mp4|webm|pdf|doc|docx|ppt|pptx)$'
    and (
      public.asis_rol()='direccion'
      or (
        public.dash_sesion_vigente()
        and (
          public.dash_colab()=split_part(name,'/',4)::bigint
          or (
            public.dash_nivel() in ('lider','colider')
            and public.puede_ver_colab(split_part(name,'/',4)::bigint)
          )
        )
      )
    )
  );

revoke all on function public.dash_entrega_permiso_base_26(text,bigint,text,text), public.dash_confirmar_entrega_base_26(text,bigint,text,text[],text), public.dash_reemplazo_permiso_base_35(text,bigint,text,text,text), public.dash_reemplazar_entrega_base_35(text,bigint,text,text[],text[],text,text) from public,anon,authenticated;
-- Comprobaciones de formatos antes de confirmar la migración.
do $$
begin
  if not public.dash_archivo_asignado_valido('asignado','test.pdf','application/pdf',10485760)
     or not public.dash_archivo_asignado_valido('asignado','test.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',100)
     or public.dash_archivo_asignado_valido('comparticiones','test.pdf','application/pdf',100)
     or public.dash_archivo_asignado_valido('salida','test.pdf','application/pdf',100)
     or public.dash_archivo_asignado_valido('asignado','test.pdf','application/pdf',10485761)
     or public.dash_archivo_asignado_valido('asignado','test.pdf','text/html',100)
     or public.dash_archivo_asignado_valido('asignado','test.exe','application/pdf',100) then
    raise exception 'La validación de documentos no cumple los límites esperados.';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
