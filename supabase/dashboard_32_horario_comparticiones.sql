-- DASHBOARD 32 · HORARIO INDEPENDIENTE DE COMPARTICIONES
-- Facebook deja de depender de la jornada laboral. Cada colaborador puede
-- tener días y franjas propias, incluso en días en los que no trabaja.

begin;

alter table public.asis_colaboradores
  add column if not exists comparticiones_horario_configurado boolean not null default false;

create table if not exists public.asis_comparticiones_horarios (
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  hora_fin time not null,
  actualizado_at timestamptz not null default now(),
  actualizado_por uuid,
  primary key (colaborador_id,dia_semana),
  check (hora_inicio<>hora_fin)
);

alter table public.asis_comparticiones_horarios enable row level security;
revoke all on public.asis_comparticiones_horarios from anon,authenticated;

create or replace function public.asis_compartir_programado(p_colab bigint,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when not coalesce((select c.comparticiones_horario_configurado
                         from public.asis_colaboradores c where c.id=p_colab),false)
      then coalesce((select public.asis_labora(c,p_fecha)
                       from public.asis_colaboradores c where c.id=p_colab),false)
    else exists(select 1 from public.asis_comparticiones_horarios h
                 where h.colaborador_id=p_colab
                   and h.dia_semana=extract(isodow from p_fecha)::int)
  end
$$;

create or replace function public.asis_compartir_inicio_at(p_colab bigint,p_fecha date)
returns timestamptz language plpgsql stable security definer set search_path=public as $$
declare v_hora time; v_colab public.asis_colaboradores;
begin
  select * into v_colab from public.asis_colaboradores where id=p_colab;
  if v_colab.id is null or not public.asis_compartir_programado(p_colab,p_fecha) then return null; end if;
  if v_colab.comparticiones_horario_configurado then
    select h.hora_inicio into v_hora from public.asis_comparticiones_horarios h
     where h.colaborador_id=p_colab and h.dia_semana=extract(isodow from p_fecha)::int;
  else
    v_hora:=public.asis_hora_entrada(v_colab,p_fecha);
  end if;
  return (p_fecha+v_hora) at time zone 'America/Lima';
end $$;

create or replace function public.asis_compartir_fin_at(p_colab bigint,p_fecha date)
returns timestamptz language plpgsql stable security definer set search_path=public as $$
declare v_inicio timestamptz; v_hora time; v_fin timestamptz; v_colab public.asis_colaboradores;
begin
  v_inicio:=public.asis_compartir_inicio_at(p_colab,p_fecha);
  if v_inicio is null then return null; end if;
  select * into v_colab from public.asis_colaboradores where id=p_colab;
  if v_colab.comparticiones_horario_configurado then
    select h.hora_fin into v_hora from public.asis_comparticiones_horarios h
     where h.colaborador_id=p_colab and h.dia_semana=extract(isodow from p_fecha)::int;
  else
    v_hora:=public.asis_hora_salida(v_colab,p_fecha);
  end if;
  v_fin:=(p_fecha+v_hora) at time zone 'America/Lima';
  if v_fin<=v_inicio then v_fin:=v_fin+interval '1 day'; end if;
  return v_fin;
end $$;

create or replace function public.asis_compartir_en_ventana(p_colab bigint,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select now() between public.asis_compartir_inicio_at(p_colab,p_fecha)
                   and public.asis_compartir_fin_at(p_colab,p_fecha)
$$;

create or replace function public.asis_compartir_fecha_activa(p_colab bigint)
returns date language plpgsql stable security definer set search_path=public as $$
declare v_hoy date:=(now() at time zone 'America/Lima')::date; v_ayer date:=v_hoy-1;
begin
  if public.asis_compartir_en_ventana(p_colab,v_hoy) then return v_hoy; end if;
  if public.asis_compartir_en_ventana(p_colab,v_ayer) then return v_ayer; end if;
  return v_hoy;
end $$;

revoke all on function public.asis_compartir_programado(bigint,date),
  public.asis_compartir_inicio_at(bigint,date),public.asis_compartir_fin_at(bigint,date),
  public.asis_compartir_en_ventana(bigint,date),public.asis_compartir_fecha_activa(bigint)
  from public,anon,authenticated;

create or replace function public.dash_admin_horario_compartir(p_colab bigint)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_configurado boolean; v_horario jsonb;
begin
  if not public.asis_es_miembro() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  select c.comparticiones_horario_configurado into v_configurado
    from public.asis_colaboradores c where c.id=p_colab;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  select coalesce(jsonb_object_agg(h.dia_semana::text,jsonb_build_object(
           'ini',to_char(h.hora_inicio,'HH24:MI'),'fin',to_char(h.hora_fin,'HH24:MI'))),'{}'::jsonb)
    into v_horario from public.asis_comparticiones_horarios h where h.colaborador_id=p_colab;
  return jsonb_build_object('ok',true,'configurado',v_configurado,'horario',v_horario);
end $$;
revoke all on function public.dash_admin_horario_compartir(bigint) from public,anon;
grant execute on function public.dash_admin_horario_compartir(bigint) to authenticated;

create or replace function public.dash_admin_guardar_horario_compartir(p_colab bigint,p_horario jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_key text; v_day jsonb; v_ini time; v_fin time;
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if not exists(select 1 from public.asis_colaboradores where id=p_colab) or p_horario is null or jsonb_typeof(p_horario)<>'object' then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  for v_key,v_day in select key,value from jsonb_each(p_horario) loop
    if v_key!~'^[1-7]$' or jsonb_typeof(v_day)<>'object' then
      return jsonb_build_object('ok',false,'motivo','dia');
    end if;
    begin
      v_ini:=(v_day->>'ini')::time; v_fin:=(v_day->>'fin')::time;
    exception when others then return jsonb_build_object('ok',false,'motivo','horario'); end;
    if v_ini is null or v_fin is null or v_ini=v_fin then
      return jsonb_build_object('ok',false,'motivo','horario');
    end if;
  end loop;
  perform pg_advisory_xact_lock(p_colab);
  delete from public.asis_comparticiones_horarios where colaborador_id=p_colab;
  insert into public.asis_comparticiones_horarios(colaborador_id,dia_semana,hora_inicio,hora_fin,actualizado_por)
  select p_colab,key::smallint,(value->>'ini')::time,(value->>'fin')::time,auth.uid()
    from jsonb_each(p_horario);
  update public.asis_colaboradores set comparticiones_horario_configurado=true where id=p_colab;
  return jsonb_build_object('ok',true,'dias',(select count(*) from jsonb_object_keys(p_horario)));
end $$;
revoke all on function public.dash_admin_guardar_horario_compartir(bigint,jsonb) from public,anon;
grant execute on function public.dash_admin_guardar_horario_compartir(bigint,jsonb) to authenticated;

-- Conserva todas las capas anteriores y filtra cada requisito según su agenda.
do $$ begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_32(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date) rename to dash_cierre_resumen_colab_base_32;
  end if;
end $$;
revoke all on function public.dash_cierre_resumen_colab_base_32(bigint,date) from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colab bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb; v_cfg public.asis_cierre_config; v_colab public.asis_colaboradores;
  v_reg public.asis_registros; v_req jsonb:='[]'::jsonb; v_item jsonb;
  v_work boolean:=false; v_share boolean:=false; v_share_open boolean:=false;
  v_share_ok boolean:=false; v_share_blocks boolean:=false; v_closed boolean:=false;
  v_assign_pending int:=0; v_pending int:=0; v_exit_pending int:=0;
  v_fin_at timestamptz; v_desde_at timestamptz; v_hasta_at timestamptz; v_state text;
begin
  v_data:=public.dash_cierre_resumen_colab_base_32(p_colab,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select * into v_cfg from public.asis_cierre_config where id=1;
  select * into v_colab from public.asis_colaboradores where id=p_colab and activo;
  select * into v_reg from public.asis_registros where colaborador_id=p_colab and fecha=p_fecha;
  v_work:=coalesce(v_cfg.habilitado,false) and p_fecha>=v_cfg.obligatorio_desde and public.asis_labora(v_colab,p_fecha);
  v_share:=coalesce(v_cfg.habilitado,false) and p_fecha>=v_cfg.obligatorio_desde and public.asis_compartir_programado(p_colab,p_fecha);
  v_share_open:=v_share and public.asis_compartir_en_ventana(p_colab,p_fecha);
  v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
  if v_fin_at is not null then
    v_desde_at:=v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min);
    v_hasta_at:=v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min);
  end if;
  v_share_blocks:=v_work and v_share and public.asis_compartir_fin_at(p_colab,p_fecha)<=coalesce(v_hasta_at,public.asis_compartir_fin_at(p_colab,p_fecha));

  for v_item in select value from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb)) loop
    if v_item->>'tipo'='comparticiones' then
      if v_share then
        v_share_ok:=coalesce((v_item->>'completo')::boolean,false);
        v_item:=v_item||jsonb_build_object(
          'bloqueado',not v_share_ok and not v_share_open,
          'editable',v_share_ok and v_share_open,
          'compartir_desde',public.asis_compartir_inicio_at(p_colab,p_fecha),
          'compartir_hasta',public.asis_compartir_fin_at(p_colab,p_fecha),
          'descripcion',case when v_share_ok then 'Evidencia registrada dentro de su horario de Facebook'
            when v_share_open then v_cfg.comparticiones_min||' capturas o una imagen tipo collage'
            else 'Disponible de '||to_char(public.asis_compartir_inicio_at(p_colab,p_fecha) at time zone 'America/Lima','HH24:MI')||
                 ' a '||to_char(public.asis_compartir_fin_at(p_colab,p_fecha) at time zone 'America/Lima','HH24:MI') end);
        v_req:=v_req||jsonb_build_array(v_item);
        if not v_share_ok then v_pending:=v_pending+1; if v_share_blocks then v_exit_pending:=v_exit_pending+1; end if; end if;
      end if;
    elsif v_work then
      v_req:=v_req||jsonb_build_array(v_item);
      if not coalesce((v_item->>'completo')::boolean,false) then v_pending:=v_pending+1; v_exit_pending:=v_exit_pending+1; end if;
    end if;
  end loop;

  if v_work then
    select count(*) into v_assign_pending from jsonb_array_elements(coalesce(v_data->'asignaciones','[]'::jsonb)) a
     where not coalesce((a->>'completo')::boolean,false);
    v_pending:=v_pending+v_assign_pending; v_exit_pending:=v_exit_pending+v_assign_pending;
    v_closed:=v_reg.salida_at is not null;
    if v_reg.id is null then v_state:='sin_entrada';
    elsif v_closed then v_state:=case when v_reg.cierre_regularizado then 'regularizada' else 'completa' end;
    elsif v_hasta_at is not null and now()>v_hasta_at then v_state:='incompleta';
    elsif v_exit_pending=0 then v_state:='lista_para_salir'; else v_state:='en_curso'; end if;
  elsif v_share then
    v_data:=jsonb_set(v_data,'{asignaciones}','[]'::jsonb,true);
    v_state:=case when v_share_ok then 'completa' else 'en_curso' end;
  else
    v_data:=jsonb_set(v_data,'{asignaciones}','[]'::jsonb,true); v_state:='no_aplica';
  end if;

  v_data:=jsonb_set(v_data,'{requisitos}',v_req,true);
  v_data:=jsonb_set(v_data,'{aplica}',to_jsonb(v_work or v_share),true);
  v_data:=jsonb_set(v_data,'{aplica_jornada}',to_jsonb(v_work),true);
  v_data:=jsonb_set(v_data,'{aplica_comparticiones}',to_jsonb(v_share),true);
  v_data:=jsonb_set(v_data,'{solo_comparticiones}',to_jsonb(v_share and not v_work),true);
  v_data:=jsonb_set(v_data,'{puede_compartir}',to_jsonb(v_share_open),true);
  v_data:=jsonb_set(v_data,'{compartir_desde}',case when not v_share then 'null'::jsonb else to_jsonb(public.asis_compartir_inicio_at(p_colab,p_fecha)) end,true);
  v_data:=jsonb_set(v_data,'{compartir_hasta}',case when not v_share then 'null'::jsonb else to_jsonb(public.asis_compartir_fin_at(p_colab,p_fecha)) end,true);
  v_data:=jsonb_set(v_data,'{estado}',to_jsonb(v_state),true);
  v_data:=jsonb_set(v_data,'{pendientes}',to_jsonb(v_pending),true);
  v_data:=jsonb_set(v_data,'{pendientes_salida}',to_jsonb(v_exit_pending),true);
  v_data:=jsonb_set(v_data,'{puede_editar_evidencias}',to_jsonb(
    public.dash_evidencia_editable(p_colab,p_fecha) or v_share_open),true);
  v_data:=jsonb_set(v_data,'{puede_marcar_salida}',to_jsonb(v_work and v_reg.id is not null and not v_closed
    and v_exit_pending=0 and v_fin_at is not null and now() between v_desde_at and v_hasta_at),true);
  return v_data;
end $$;
revoke all on function public.dash_cierre_resumen_colab(bigint,date) from public,anon,authenticated;

create or replace function public.dash_cierre_hoy()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_hoy date:=(now() at time zone 'America/Lima')::date; v_fecha date; v_work_fecha date;
begin
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_work_fecha:=public.asis_cierre_fecha_activa(v_colab);
  if v_work_fecha<>v_hoy and exists(select 1 from public.asis_registros where colaborador_id=v_colab and fecha=v_work_fecha and salida_at is null) then
    v_fecha:=v_work_fecha;
  else v_fecha:=public.asis_compartir_fecha_activa(v_colab); end if;
  return public.dash_cierre_resumen_colab(v_colab,v_fecha);
end $$;
revoke all on function public.dash_cierre_hoy() from public,anon;
grant execute on function public.dash_cierre_hoy() to authenticated;

-- Facebook firma y confirma archivos sin exigir una entrada laboral.
do $$ begin
  if to_regprocedure('public.dash_entrega_permiso_base_32(text,bigint,text,text)') is null then
    alter function public.dash_entrega_permiso(text,bigint,text,text) rename to dash_entrega_permiso_base_32;
  end if;
end $$;
revoke all on function public.dash_entrega_permiso_base_32(text,bigint,text,text) from public,anon,authenticated;

create or replace function public.dash_entrega_permiso(p_requisito text,p_asignacion bigint default null,p_modalidad text default null,p_ext text default 'jpg')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_fecha date; v_cfg public.asis_cierre_config; v_ext text; v_path text; v_max int;
begin
  if p_requisito<>'comparticiones' then return public.dash_entrega_permiso_base_32(p_requisito,p_asignacion,p_modalidad,p_ext); end if;
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab); select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde or not public.asis_compartir_programado(v_colab,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_programado'); end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha) then return jsonb_build_object('ok',false,'motivo','fuera_horario_compartir'); end if;
  if p_asignacion is not null or coalesce(p_modalidad,'') not in ('individuales','collage') then return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  if p_modalidad='collage' and not v_cfg.collage_permitido then return jsonb_build_object('ok',false,'motivo','collage_no_permitido'); end if;
  if exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='comparticiones' and estado='completo') then
    return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;
  perform pg_advisory_xact_lock(v_colab);
  select 40+count(*)::int*12 into v_max from public.asis_asignaciones_diarias a where a.fecha=v_fecha and a.activo and a.requerido;
  if (select count(*) from public.asis_carga_permisos where colaborador_id=v_colab and fecha=v_fecha)>=v_max then return jsonb_build_object('ok',false,'motivo','cuota_diaria'); end if;
  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp') then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha) values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end $$;
revoke all on function public.dash_entrega_permiso(text,bigint,text,text) from public,anon;
grant execute on function public.dash_entrega_permiso(text,bigint,text,text) to authenticated;

do $$ begin
  if to_regprocedure('public.dash_confirmar_entrega_base_32(text,bigint,text,text[],text)') is null then
    alter function public.dash_confirmar_entrega(text,bigint,text,text[],text) rename to dash_confirmar_entrega_base_32;
  end if;
end $$;
revoke all on function public.dash_confirmar_entrega_base_32(text,bigint,text,text[],text) from public,anon,authenticated;

create or replace function public.dash_confirmar_entrega(p_requisito text,p_asignacion bigint default null,p_modalidad text default null,p_paths text[] default '{}',p_detalle text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_fecha date; v_cfg public.asis_cierre_config; v_total int:=coalesce(cardinality(p_paths),0); v_path text; v_obj storage.objects; v_entrega bigint; v_orden int:=0;
begin
  if p_requisito<>'comparticiones' then return public.dash_confirmar_entrega_base_32(p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle); end if;
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab); select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde then return jsonb_build_object('ok',false,'motivo','no_habilitado'); end if;
  if not public.asis_compartir_programado(v_colab,v_fecha) then return jsonb_build_object('ok',false,'motivo','no_programado'); end if;
  if not public.asis_compartir_en_ventana(v_colab,v_fecha) then return jsonb_build_object('ok',false,'motivo','fuera_horario_compartir'); end if;
  if p_asignacion is not null or v_total not between 1 and 5 or (select count(distinct x) from unnest(p_paths)x)<>v_total then
    return jsonb_build_object('ok',false,'motivo','archivos'); end if;
  if p_modalidad='collage' then
    if not v_cfg.collage_permitido or v_total<>1 then return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones'); end if;
  elsif p_modalidad='individuales' then
    if v_total<v_cfg.comparticiones_min then return jsonb_build_object('ok',false,'motivo','cantidad_comparticiones'); end if;
  else return jsonb_build_object('ok',false,'motivo','modalidad'); end if;
  if (select count(*) from public.asis_carga_permisos p where p.path=any(p_paths) and p.colaborador_id=v_colab and p.fecha=v_fecha and p.vinculado_at is null)<>v_total then
    return jsonb_build_object('ok',false,'motivo','permiso'); end if;
  foreach v_path in array p_paths loop
    if v_path!~('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp)$') then return jsonb_build_object('ok',false,'motivo','ruta'); end if;
    select * into v_obj from storage.objects where bucket_id='asis-cierre-evidencias' and name=v_path;
    if v_obj.id is null or coalesce((v_obj.metadata->>'size')::bigint,0) not between 1 and 1048576 or coalesce(v_obj.metadata->>'mimetype','') not in ('image/jpeg','image/webp') then
      return jsonb_build_object('ok',false,'motivo','archivo_no_verificado'); end if;
  end loop;
  perform pg_advisory_xact_lock(v_colab);
  if exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='comparticiones' and estado='completo') then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;
  insert into public.asis_entregas_diarias(colaborador_id,fecha,requisito,modalidad,detalle)
  values(v_colab,v_fecha,'comparticiones',p_modalidad,nullif(left(btrim(coalesce(p_detalle,'')),700),'')) returning id into v_entrega;
  foreach v_path in array p_paths loop
    v_orden:=v_orden+1; select * into v_obj from storage.objects where bucket_id='asis-cierre-evidencias' and name=v_path;
    insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden) values(v_entrega,v_path,v_obj.metadata->>'mimetype',(v_obj.metadata->>'size')::int,v_orden);
  end loop;
  update public.asis_carga_permisos set vinculado_at=now() where path=any(p_paths) and colaborador_id=v_colab and fecha=v_fecha;
  return jsonb_build_object('ok',true,'entrega',v_entrega,'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha));
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','ya_completo');
end $$;
revoke all on function public.dash_confirmar_entrega(text,bigint,text,text[],text) from public,anon;
grant execute on function public.dash_confirmar_entrega(text,bigint,text,text[],text) to authenticated;

-- La edición acepta la ventana laboral o la ventana independiente de Facebook.
create or replace function public.dash_evidencia_editable(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_reg public.asis_registros; v_fin_at timestamptz; v_laboral boolean:=false;
begin
  if p_colab is null or p_fecha is null then return false; end if;
  select * into v_reg from public.asis_registros where colaborador_id=p_colab and fecha=p_fecha;
  if v_reg.id is not null and v_reg.marcado_at is not null and v_reg.salida_at is null then
    v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
    v_laboral:=v_fin_at is not null and now() between v_reg.marcado_at and v_fin_at;
  end if;
  return v_laboral or public.asis_compartir_en_ventana(p_colab,p_fecha);
end $$;
revoke all on function public.dash_evidencia_editable(bigint,date) from public,anon,authenticated;

-- La salida laboral solo espera Facebook cuando su franja ya vence antes del cierre.
create or replace function public.dash_marcar_salida(p_dispositivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_fecha date; v_now timestamptz:=now(); v_persona public.asis_colaboradores; v_cfg public.asis_cierre_config; v_reg public.asis_registros; v_fin_at timestamptz; v_desde_at timestamptz; v_hasta_at timestamptz; v_pend int:=0; v_horas numeric;
begin
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab); select * into v_persona from public.asis_colaboradores where id=v_colab and activo; select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or v_fecha<v_cfg.obligatorio_desde or not public.asis_labora(v_persona,v_fecha) then return jsonb_build_object('ok',false,'motivo','no_habilitado'); end if;
  select * into v_reg from public.asis_registros where colaborador_id=v_colab and fecha=v_fecha for update;
  if v_reg.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrada'); end if;
  if v_reg.salida_at is not null then return jsonb_build_object('ok',false,'motivo','ya_registrada','salida_at',v_reg.salida_at); end if;
  v_fin_at:=public.asis_cierre_fin_at(v_colab,v_fecha); if v_fin_at is null then return jsonb_build_object('ok',false,'motivo','horario_incompleto'); end if;
  v_desde_at:=v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min); v_hasta_at:=v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min);
  if v_now<v_desde_at then return jsonb_build_object('ok',false,'motivo','salida_aun_no_disponible','desde',(v_desde_at at time zone 'America/Lima')::time); end if;
  if v_now>v_hasta_at then return jsonb_build_object('ok',false,'motivo','salida_fuera_de_plazo','hasta',(v_hasta_at at time zone 'America/Lima')::time); end if;
  if public.asis_compartir_programado(v_colab,v_fecha) and public.asis_compartir_fin_at(v_colab,v_fecha)<=v_hasta_at
     and not exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='comparticiones' and estado='completo') then v_pend:=v_pend+1; end if;
  if not exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='rpe' and estado='completo') then v_pend:=v_pend+1; end if;
  if coalesce(v_cfg.salida_evidencia_habilitada,false) and v_fecha>=v_cfg.salida_evidencia_desde
     and not exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='salida' and estado='completo') then v_pend:=v_pend+1; end if;
  select v_pend+count(*) into v_pend from public.asis_asignaciones_diarias a where a.fecha=v_fecha and a.activo and a.requerido and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id)
    and not exists(select 1 from public.asis_entregas_diarias e where e.colaborador_id=v_colab and e.fecha=v_fecha and e.asignacion_id=a.id and e.estado='completo');
  if v_pend>0 then return jsonb_build_object('ok',false,'motivo','requisitos_pendientes','pendientes',v_pend); end if;
  v_horas:=round(greatest(0,extract(epoch from(v_now-v_reg.marcado_at))/3600)::numeric,2);
  update public.asis_registros set salida_at=v_now,salida_dispositivo=left(coalesce(p_dispositivo,''),120),salida_origen='dashboard',salida_por=auth.uid(),horas_efectivas=v_horas,horas=v_horas,cierre_actualizado_at=v_now where id=v_reg.id;
  return jsonb_build_object('ok',true,'estado','completa','salida_at',v_now,'horas_efectivas',v_horas,'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha));
end $$;
revoke all on function public.dash_marcar_salida(text) from public,anon;
grant execute on function public.dash_marcar_salida(text) to authenticated;

create or replace function public.dash_mi_comprobante_comparticiones()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_colab_id bigint:=public.dash_colab(); v_fecha date; v_colab public.asis_colaboradores; v_entrega public.asis_entregas_diarias; v_area text; v_archivos jsonb; v_dni text;
begin
  if not public.dash_sesion_vigente() or v_colab_id is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_compartir_fecha_activa(v_colab_id); select * into v_colab from public.asis_colaboradores where id=v_colab_id and activo;
  select a.nombre into v_area from public.asis_areas a where a.id=v_colab.area_id;
  select * into v_entrega from public.asis_entregas_diarias e where e.colaborador_id=v_colab_id and e.fecha=v_fecha and e.requisito='comparticiones' and e.estado='completo' order by e.completado_at desc,e.id desc limit 1;
  if v_entrega.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('path',f.path,'mime',f.mime,'bytes',f.bytes,'orden',f.orden) order by f.orden),'[]'::jsonb) into v_archivos from public.asis_entrega_archivos f where f.entrega_id=v_entrega.id and f.mime in ('image/jpeg','image/webp');
  v_dni:=regexp_replace(coalesce(v_colab.dni,''),'[^0-9]','','g');
  return jsonb_build_object('ok',true,'entrega_id',v_entrega.id,'fecha',v_fecha,'colaborador',v_colab.nombre,'dni',case when length(v_dni)>=4 then '••••'||right(v_dni,4) else '—' end,'area',coalesce(v_area,'Sin área'),'tipo_vinculo',v_colab.tipo_vinculo,
    'compartir_inicio',public.asis_compartir_inicio_at(v_colab_id,v_fecha),'compartir_fin',public.asis_compartir_fin_at(v_colab_id,v_fecha),'modalidad',v_entrega.modalidad,'detalle',v_entrega.detalle,'revision_estado',v_entrega.revision_estado,'registrado_at',v_entrega.completado_at,'archivos',v_archivos);
end $$;
revoke all on function public.dash_mi_comprobante_comparticiones() from public,anon;
grant execute on function public.dash_mi_comprobante_comparticiones() to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,pieza,encontrado,esperado from (
  select 'tabla de horarios de Facebook'::text pieza,count(*)::int encontrado,1 esperado from information_schema.tables where table_schema='public' and table_name='asis_comparticiones_horarios'
  union all select 'funciones de agenda independiente',count(*)::int,5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('asis_compartir_programado','asis_compartir_inicio_at','asis_compartir_fin_at','asis_compartir_en_ventana','asis_compartir_fecha_activa')
  union all select 'RPC de administración',count(*)::int,2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dash_admin_horario_compartir','dash_admin_guardar_horario_compartir')
  union all select 'flujo de Facebook independiente',count(*)::int,4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dash_cierre_hoy','dash_cierre_resumen_colab','dash_entrega_permiso','dash_confirmar_entrega')
) q;
