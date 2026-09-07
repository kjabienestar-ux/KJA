-- DASHBOARD 26 — EVIDENCIA FOTOGRÁFICA DE LA HORA DE SALIDA
-- Añade una tercera evidencia obligatoria. Debe cargarse dentro de la ventana
-- de salida y contener exactamente una imagen. No altera jornadas ya cerradas.

begin;

alter table public.asis_cierre_config
  add column if not exists salida_evidencia_habilitada boolean not null default true,
  add column if not exists salida_evidencia_desde date;
update public.asis_cierre_config
   set salida_evidencia_desde = (now() at time zone 'America/Lima')::date
 where salida_evidencia_desde is null;
alter table public.asis_cierre_config alter column salida_evidencia_desde set not null;

alter table public.asis_entregas_diarias
  drop constraint if exists asis_entregas_diarias_requisito_check;
alter table public.asis_entregas_diarias
  add constraint asis_entregas_diarias_requisito_check
  check (requisito in ('comparticiones','rpe','salida','asignado'));

-- Conserva la lógica nocturna de dashboard_20 como base y agrega la foto.
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_26(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_26;
  end if;
end $$;
revoke all on function public.dash_cierre_resumen_colab_base_26(bigint,date)
  from public, anon, authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colab bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb;
  v_cfg public.asis_cierre_config;
  v_ok boolean := false;
  v_archivos integer := 0;
  v_pendientes integer := 0;
  v_fin_at timestamptz;
  v_disponible boolean := false;
begin
  v_data := public.dash_cierre_resumen_colab_base_26(p_colab,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.salida_evidencia_habilitada,false)
     or p_fecha<v_cfg.salida_evidencia_desde then return v_data; end if;

  select exists(
           select 1 from public.asis_entregas_diarias e
            where e.colaborador_id=p_colab and e.fecha=p_fecha
              and e.requisito='salida' and e.estado='completo'
         ),coalesce((
           select count(*) from public.asis_entrega_archivos f
           join public.asis_entregas_diarias e on e.id=f.entrega_id
            where e.colaborador_id=p_colab and e.fecha=p_fecha
              and e.requisito='salida' and e.estado='completo'
         ),0)
    into v_ok,v_archivos;

  v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
  v_disponible:=v_fin_at is not null and now() between
    v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min) and
    v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min);

  v_data:=jsonb_set(v_data,'{requisitos}',
    coalesce(v_data->'requisitos','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'tipo','salida','titulo','Evidencia de hora de salida','completo',v_ok,
      'archivos',v_archivos,'bloqueado',not v_ok and not v_disponible,
      'descripcion',case when v_ok then 'Foto de cierre registrada'
        when v_disponible then 'Adjunta 1 foto donde se vea claramente la hora de salida'
        else 'Se habilitará al llegar la ventana de salida; deberás adjuntar 1 foto con la hora' end
    )),true);
  v_pendientes:=coalesce((v_data->>'pendientes')::integer,0)+(case when v_ok then 0 else 1 end);
  v_data:=jsonb_set(v_data,'{pendientes}',to_jsonb(v_pendientes),true);
  if not v_ok then
    v_data:=jsonb_set(v_data,'{puede_marcar_salida}','false'::jsonb,true);
    if v_data->>'estado'='lista_para_salir' then
      v_data:=jsonb_set(v_data,'{estado}',to_jsonb('en_curso'::text),true);
    end if;
  end if;
  return v_data;
end $$;
revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

-- Mantiene los requisitos anteriores en su implementación probada y firma
-- una ruta propia únicamente para la foto de salida.
do $$
begin
  if to_regprocedure('public.dash_entrega_permiso_base_26(text,bigint,text,text)') is null then
    alter function public.dash_entrega_permiso(text,bigint,text,text)
      rename to dash_entrega_permiso_base_26;
  end if;
end $$;
revoke all on function public.dash_entrega_permiso_base_26(text,bigint,text,text)
  from public,anon,authenticated;

create or replace function public.dash_entrega_permiso(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,p_ext text default 'jpg'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_fin_at timestamptz;
  v_ext text;
  v_path text;
  v_max integer;
begin
  if p_requisito<>'salida' then
    return public.dash_entrega_permiso_base_26(p_requisito,p_asignacion,p_modalidad,p_ext);
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or not coalesce(v_cfg.salida_evidencia_habilitada,false)
     or v_fecha<v_cfg.obligatorio_desde or v_fecha<v_cfg.salida_evidencia_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  if p_asignacion is not null or p_modalidad is not null then
    return jsonb_build_object('ok',false,'motivo','datos');
  end if;
  if not exists(select 1 from public.asis_registros where colaborador_id=v_colab and fecha=v_fecha and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','sin_entrada_o_cerrada');
  end if;
  v_fin_at:=public.asis_cierre_fin_at(v_colab,v_fecha);
  if v_fin_at is null or now()<v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min) then
    return jsonb_build_object('ok',false,'motivo','salida_aun_no_disponible');
  end if;
  if now()>v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min) then
    return jsonb_build_object('ok',false,'motivo','salida_fuera_de_plazo');
  end if;
  if exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='salida' and estado='completo') then
    return jsonb_build_object('ok',false,'motivo','ya_completo');
  end if;
  perform pg_advisory_xact_lock(v_colab);
  select 20+count(*)::integer*5 into v_max from public.asis_asignaciones_diarias a
   where a.fecha=v_fecha and a.activo and a.requerido
     and (a.colaborador_id=v_colab or a.area_id=(select area_id from public.asis_colaboradores where id=v_colab));
  if (select count(*) from public.asis_carga_permisos where colaborador_id=v_colab and fecha=v_fecha)>=v_max then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;
  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp') then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha) values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end $$;
revoke all on function public.dash_entrega_permiso(text,bigint,text,text) from public,anon;
grant execute on function public.dash_entrega_permiso(text,bigint,text,text) to authenticated;

do $$
begin
  if to_regprocedure('public.dash_confirmar_entrega_base_26(text,bigint,text,text[],text)') is null then
    alter function public.dash_confirmar_entrega(text,bigint,text,text[],text)
      rename to dash_confirmar_entrega_base_26;
  end if;
end $$;
revoke all on function public.dash_confirmar_entrega_base_26(text,bigint,text,text[],text)
  from public,anon,authenticated;

create or replace function public.dash_confirmar_entrega(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,
  p_paths text[] default '{}',p_detalle text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
  v_fin_at timestamptz;
  v_path text;
  v_obj storage.objects;
  v_entrega bigint;
begin
  if p_requisito<>'salida' then
    return public.dash_confirmar_entrega_base_26(p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle);
  end if;
  if not public.dash_sesion_vigente() or v_colab is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if not coalesce(v_cfg.habilitado,false) or not coalesce(v_cfg.salida_evidencia_habilitada,false)
     or v_fecha<v_cfg.obligatorio_desde or v_fecha<v_cfg.salida_evidencia_desde then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  if p_asignacion is not null or p_modalidad is not null or coalesce(cardinality(p_paths),0)<>1 then
    return jsonb_build_object('ok',false,'motivo','foto_salida');
  end if;
  if not exists(select 1 from public.asis_registros where colaborador_id=v_colab and fecha=v_fecha and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','sin_entrada_o_cerrada');
  end if;
  v_fin_at:=public.asis_cierre_fin_at(v_colab,v_fecha);
  if v_fin_at is null or now()<v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min) then
    return jsonb_build_object('ok',false,'motivo','salida_aun_no_disponible');
  end if;
  if now()>v_fin_at+make_interval(mins=>v_cfg.salida_gracia_min) then
    return jsonb_build_object('ok',false,'motivo','salida_fuera_de_plazo');
  end if;
  v_path:=p_paths[1];
  if v_path !~ ('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(jpg|webp)$') then
    return jsonb_build_object('ok',false,'motivo','ruta');
  end if;
  select * into v_obj from storage.objects where bucket_id='asis-cierre-evidencias' and name=v_path;
  if v_obj.id is null or coalesce((v_obj.metadata->>'size')::bigint,0) not between 1 and 1048576
     or coalesce(v_obj.metadata->>'mimetype','') not in ('image/jpeg','image/webp') then
    return jsonb_build_object('ok',false,'motivo','archivo_no_verificado');
  end if;
  perform pg_advisory_xact_lock(v_colab);
  if exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='salida' and estado='completo') then
    return jsonb_build_object('ok',false,'motivo','ya_completo');
  end if;
  insert into public.asis_entregas_diarias(colaborador_id,fecha,requisito,detalle)
  values(v_colab,v_fecha,'salida',nullif(left(btrim(coalesce(p_detalle,'')),700),'')) returning id into v_entrega;
  insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
  values(v_entrega,v_path,v_obj.metadata->>'mimetype',(v_obj.metadata->>'size')::integer,1);
  update public.asis_carga_permisos set vinculado_at=now()
   where path=v_path and colaborador_id=v_colab and fecha=v_fecha;
  return jsonb_build_object('ok',true,'entrega',v_entrega,'resumen',public.dash_cierre_resumen_colab(v_colab,v_fecha));
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','ya_completo');
end $$;
revoke all on function public.dash_confirmar_entrega(text,bigint,text,text[],text) from public,anon;
grant execute on function public.dash_confirmar_entrega(text,bigint,text,text[],text) to authenticated;

-- La última barrera se comprueba otra vez en SQL justo antes de marcar salida.
do $$
begin
  if to_regprocedure('public.dash_marcar_salida_base_26(text)') is null then
    alter function public.dash_marcar_salida(text) rename to dash_marcar_salida_base_26;
  end if;
end $$;
revoke all on function public.dash_marcar_salida_base_26(text) from public,anon,authenticated;

create or replace function public.dash_marcar_salida(p_dispositivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_cfg public.asis_cierre_config;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  select * into v_cfg from public.asis_cierre_config where id=1;
  if coalesce(v_cfg.salida_evidencia_habilitada,false) and v_fecha>=v_cfg.salida_evidencia_desde
     and exists(select 1 from public.asis_registros where colaborador_id=v_colab and fecha=v_fecha and salida_at is null)
     and not exists(select 1 from public.asis_entregas_diarias where colaborador_id=v_colab and fecha=v_fecha and requisito='salida' and estado='completo') then
    return jsonb_build_object('ok',false,'motivo','requisitos_pendientes','pendientes',1);
  end if;
  return public.dash_marcar_salida_base_26(p_dispositivo);
end $$;
revoke all on function public.dash_marcar_salida(text) from public,anon;
grant execute on function public.dash_marcar_salida(text) to authenticated;

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,pieza,encontrado,esperado from (
  select 'configuración de foto de salida'::text pieza,count(*)::int encontrado,2 esperado
    from information_schema.columns where table_schema='public' and table_name='asis_cierre_config'
      and column_name in ('salida_evidencia_habilitada','salida_evidencia_desde')
  union all select 'requisito salida permitido',count(*)::int,1 from pg_constraint
    where conrelid='public.asis_entregas_diarias'::regclass and conname='asis_entregas_diarias_requisito_check'
      and pg_get_constraintdef(oid) like '%salida%'
  union all select 'RPC protegidas',count(*)::int,4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('dash_cierre_resumen_colab','dash_entrega_permiso','dash_confirmar_entrega','dash_marcar_salida')
) q;
