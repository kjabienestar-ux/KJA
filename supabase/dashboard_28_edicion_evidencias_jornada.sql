-- DASHBOARD 28 · CORRECCIÓN DE EVIDENCIAS DURANTE LA JORNADA
-- Permite reemplazar una entrega propia ya completada, únicamente desde la
-- marcación de entrada hasta la hora programada de salida. La versión anterior
-- se conserva anulada para auditoría y la nueva vuelve a revisión pendiente.

begin;

create table if not exists public.asis_entrega_reemplazos (
  id                   bigint generated always as identity primary key,
  entrega_anterior_id  bigint not null references public.asis_entregas_diarias(id),
  entrega_nueva_id     bigint not null references public.asis_entregas_diarias(id),
  colaborador_id       bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha                date not null,
  creado_at            timestamptz not null default now(),
  unique (entrega_anterior_id),
  unique (entrega_nueva_id)
);

create index if not exists asis_entrega_reemplazos_colab_fecha_idx
  on public.asis_entrega_reemplazos(colaborador_id, fecha, creado_at desc);

alter table public.asis_entrega_reemplazos enable row level security;
revoke all on public.asis_entrega_reemplazos from anon, authenticated;

-- Una sola regla reutilizable para la interfaz y para las dos barreras SQL.
create or replace function public.dash_evidencia_editable(p_colab bigint, p_fecha date)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_reg public.asis_registros;
  v_fin_at timestamptz;
begin
  if p_colab is null or p_fecha is null then return false; end if;
  select * into v_reg
    from public.asis_registros
   where colaborador_id=p_colab and fecha=p_fecha;
  if v_reg.id is null or v_reg.marcado_at is null or v_reg.salida_at is not null then
    return false;
  end if;
  v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
  return v_fin_at is not null and now() between v_reg.marcado_at and v_fin_at;
end $$;

revoke all on function public.dash_evidencia_editable(bigint,date)
  from public,anon,authenticated;

-- Conserva el resumen actual y añade un dato informativo. La autorización
-- real se vuelve a comprobar al firmar cada archivo y al confirmar el cambio.
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_28(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_28;
  end if;
end $$;

revoke all on function public.dash_cierre_resumen_colab_base_28(bigint,date)
  from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colab bigint,p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_data jsonb;
  v_fin_at timestamptz;
begin
  v_data:=public.dash_cierre_resumen_colab_base_28(p_colab,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
  v_data:=jsonb_set(v_data,'{puede_editar_evidencias}',
    to_jsonb(public.dash_evidencia_editable(p_colab,p_fecha)),true);
  v_data:=jsonb_set(v_data,'{edicion_hasta_at}',
    case when v_fin_at is null then 'null'::jsonb else to_jsonb(v_fin_at) end,true);
  return v_data;
end $$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

-- Crea una ruta privada nueva sólo cuando ya existe una entrega activa que el
-- propio colaborador está autorizado a corregir.
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
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha)
  values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end $$;

revoke all on function public.dash_reemplazo_permiso(text,bigint,text,text,text)
  from public,anon;
grant execute on function public.dash_reemplazo_permiso(text,bigint,text,text,text)
  to authenticated;

create or replace function public.dash_reemplazar_entrega(
  p_requisito text,
  p_asignacion bigint default null,
  p_modalidad text default null,
  p_paths text[] default '{}',
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
  v_total integer:=coalesce(cardinality(p_paths),0);
  v_todos text[];
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
  if coalesce(p_requisito,'') not in ('comparticiones','rpe','asignado') or v_total not between 1 and 5 then
    return jsonb_build_object('ok',false,'motivo','archivos');
  end if;
  if (select count(distinct x) from unnest(p_paths) x)<>v_total then
    return jsonb_build_object('ok',false,'motivo','archivos_duplicados');
  end if;
  if p_requisito='comparticiones' then
    if p_video_path is not null then return jsonb_build_object('ok',false,'motivo','video_no_permitido'); end if;
    if coalesce(p_modalidad,'')='collage' then
      if not v_cfg.collage_permitido or v_total<>1 then
        return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
      end if;
    elsif p_modalidad='individuales' then
      if v_total<v_cfg.comparticiones_min then
        return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones');
      end if;
    else return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  elsif p_modalidad is not null then
    return jsonb_build_object('ok',false,'motivo','modalidad');
  end if;
  if p_requisito='asignado' and not exists(
    select 1 from public.asis_asignaciones_diarias a
     where a.id=p_asignacion and a.fecha=v_fecha and a.activo and a.requerido
       and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id)
  ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  if p_requisito<>'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok',false,'motivo','asignacion');
  end if;

  v_todos:=case when p_video_path is null then p_paths else array_append(p_paths,p_video_path) end;
  if (select count(distinct x) from unnest(v_todos) x)<>cardinality(v_todos) then
    return jsonb_build_object('ok',false,'motivo','archivos_duplicados');
  end if;
  if (select count(*) from public.asis_carga_permisos p
       where p.path=any(v_todos) and p.colaborador_id=v_colab and p.fecha=v_fecha
         and p.vinculado_at is null)<>cardinality(v_todos) then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;

  foreach v_path in array p_paths loop
    if v_path !~ ('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp)$') then
      return jsonb_build_object('ok',false,'motivo','ruta');
    end if;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    v_mime:=coalesce(v_obj.metadata->>'mimetype','');
    v_bytes:=coalesce((v_obj.metadata->>'size')::bigint,0);
    if v_obj.id is null or v_mime not in ('image/jpeg','image/webp')
       or v_bytes not between 1 and 1048576 then
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

  update public.asis_entregas_diarias set estado='anulado'
   where id=v_anterior.id;
  insert into public.asis_entregas_diarias(
    colaborador_id,fecha,requisito,asignacion_id,modalidad,detalle
  ) values(
    v_colab,v_fecha,p_requisito,p_asignacion,
    case when p_requisito='comparticiones' then p_modalidad else null end,
    nullif(left(btrim(coalesce(p_detalle,'')),700),'')
  ) returning id into v_nueva;

  foreach v_path in array p_paths loop
    v_orden:=v_orden+1;
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=v_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,v_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden);
  end loop;
  if p_video_path is not null then
    select * into v_obj from storage.objects
     where bucket_id='asis-cierre-evidencias' and name=p_video_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
    values(v_nueva,p_video_path,v_obj.metadata->>'mimetype',
      (v_obj.metadata->>'size')::integer,v_orden+1);
  end if;
  update public.asis_carga_permisos set vinculado_at=now()
   where path=any(v_todos) and colaborador_id=v_colab and fecha=v_fecha;
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

revoke all on function public.dash_reemplazar_entrega(text,bigint,text,text[],text,text)
  from public,anon;
grant execute on function public.dash_reemplazar_entrega(text,bigint,text,text[],text,text)
  to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select 'auditoría de reemplazos'::text pieza,count(*)::int encontrado,1 esperado
    from information_schema.tables
   where table_schema='public' and table_name='asis_entrega_reemplazos'
  union all
  select 'RPC de edición',count(*)::int,3
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'dash_evidencia_editable','dash_reemplazo_permiso','dash_reemplazar_entrega'
   )
  union all
  select 'resumen con ventana editable',count(*)::int,1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='dash_cierre_resumen_colab'
) q;
