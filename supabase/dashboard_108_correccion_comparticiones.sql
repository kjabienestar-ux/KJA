-- Ejecutar después de dashboard_107_agenda_feriados.sql.
-- Una corrección de Facebook autoriza un nuevo envío para la fecha original,
-- independiente del horario. Conserva la entrega anulada y sus archivos privados.
begin;
alter table public.asis_entregas_diarias add column if not exists correccion_vista_at timestamptz;
alter table public.asis_carga_permisos add column if not exists correccion_entrega_id bigint
  references public.asis_entregas_diarias(id) on delete cascade;
create index if not exists asis_carga_correccion_idx on public.asis_carga_permisos(correccion_entrega_id)
  where correccion_entrega_id is not null;

create or replace function public.dash_admin_revisar_entrega(
  p_entrega bigint,
  p_estado text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.asis_entregas_diarias;
  v_nota text := nullif(left(btrim(coalesce(p_nota, '')), 700), '');
  v_salida timestamptz;
begin
  if not public.dash_sesion_vigente() or public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_entrega is null or p_estado is null or p_estado not in ('aprobada','observada') then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if p_estado = 'observada' and (v_nota is null or char_length(v_nota) < 3) then
    return jsonb_build_object('ok', false, 'motivo', 'nota');
  end if;

  select * into v_entrega
    from public.asis_entregas_diarias
   where id = p_entrega
   for update;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;
  if v_entrega.revision_estado <> 'pendiente' or v_entrega.estado <> 'completo' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_revisada');
  end if;

  select salida_at into v_salida
    from public.asis_registros
   where colaborador_id = v_entrega.colaborador_id and fecha = v_entrega.fecha
   for update;
  if p_estado = 'observada' and v_salida is not null and v_entrega.requisito <> 'comparticiones' then
    return jsonb_build_object('ok', false, 'motivo', 'jornada_cerrada');
  end if;

  update public.asis_entregas_diarias
     set revision_estado = p_estado,
         revision_nota = v_nota,
         revisado_at = now(),
         revisado_por = auth.uid(),
         estado = case when p_estado = 'observada' then 'anulado' else estado end
   where id = v_entrega.id;

  insert into public.asis_entrega_revisiones(
    entrega_id, estado_anterior, estado_nuevo, nota, actor_id
  ) values (
    v_entrega.id, v_entrega.revision_estado, p_estado, v_nota, auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'entrega', v_entrega.id,
    'estado', p_estado,
    'nota', v_nota,
    'colaborador_id', v_entrega.colaborador_id,
    'fecha', v_entrega.fecha
  );
end;
$$;

revoke all on function public.dash_admin_revisar_entrega(bigint, text, text) from public, anon;
grant execute on function public.dash_admin_revisar_entrega(bigint, text, text) to authenticated;


create or replace function public.dash_mis_correcciones()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_items jsonb;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'fecha',e.fecha,
    'nota',e.revision_nota,'vista',e.correccion_vista_at is not null,
    'titulo','Comparticiones de Facebook','requisito','comparticiones') order by e.revisado_at,e.id),'[]'::jsonb)
    into v_items from public.asis_entregas_diarias e
   where e.colaborador_id=v_colab and e.requisito='comparticiones'
     and e.estado='anulado' and e.revision_estado='observada'
     and not exists(select 1 from public.asis_entregas_diarias newer
       where newer.colaborador_id=v_colab and newer.fecha=e.fecha
         and newer.requisito='comparticiones' and newer.id>e.id);
  return jsonb_build_object('ok',true,'correcciones',v_items,
    'comparticiones_min',(select comparticiones_min from public.asis_cierre_config where id=1),
    'collage_permitido',(select collage_permitido from public.asis_cierre_config where id=1));
end; $$;

create or replace function public.dash_marcar_correccion_vista(p_entrega bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.dash_sesion_vigente() or public.dash_colab() is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  update public.asis_entregas_diarias set correccion_vista_at=coalesce(correccion_vista_at,now())
   where id=p_entrega and colaborador_id=public.dash_colab()
     and requisito='comparticiones' and revision_estado='observada' and estado='anulado';
  return jsonb_build_object('ok',found);
end; $$;
revoke all on function public.dash_mis_correcciones() from public,anon;
revoke all on function public.dash_marcar_correccion_vista(bigint) from public,anon;
grant execute on function public.dash_mis_correcciones() to authenticated;
grant execute on function public.dash_marcar_correccion_vista(bigint) to authenticated;

create or replace function public.dash_correccion_permiso(
  p_entrega bigint,
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
  v_original public.asis_entregas_diarias;
  v_cfg public.asis_cierre_config;
  v_ext text;
  v_path text;
  v_pendientes integer:=0;
  v_total_dia integer:=0;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  perform pg_advisory_xact_lock(v_colab);
  select * into v_original from public.asis_entregas_diarias
   where id=p_entrega and colaborador_id=v_colab and requisito='comparticiones' for update;
  if v_original.id is null or v_original.estado<>'anulado' or v_original.revision_estado<>'observada'
     or exists(select 1 from public.asis_entregas_diarias e where e.colaborador_id=v_colab
       and e.fecha=v_original.fecha and e.requisito='comparticiones' and e.id>v_original.id) then
    return jsonb_build_object('ok',false,'motivo','correccion_resuelta');
  end if;
  v_fecha:=v_original.fecha;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if coalesce(p_modalidad,'') not in ('individuales','collage') then
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
   where colaborador_id=v_colab and correccion_entrega_id=p_entrega;
  if v_pendientes>=50 or v_total_dia>=180 then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;

  v_ext:=case when lower(coalesce(p_ext,'')) in ('jpg','jpeg','webp')
    then case when lower(p_ext)='jpeg' then 'jpg' else lower(p_ext) end else 'jpg' end;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha,correccion_entrega_id)
  values(v_path,v_colab,v_fecha,p_entrega);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end;
$$;

revoke all on function public.dash_correccion_permiso(bigint,text,text) from public,anon;
grant execute on function public.dash_correccion_permiso(bigint,text,text) to authenticated;


create or replace function public.dash_confirmar_correccion(
  p_entrega bigint,
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
  v_original public.asis_entregas_diarias;
  v_cfg public.asis_cierre_config;
  v_total integer:=coalesce(cardinality(p_paths),0);
  v_path text;
  v_obj storage.objects;
  v_entrega bigint;
  v_orden integer:=0;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  perform pg_advisory_xact_lock(v_colab);
  select * into v_original from public.asis_entregas_diarias
   where id=p_entrega and colaborador_id=v_colab and requisito='comparticiones' for update;
  if v_original.id is null or v_original.estado<>'anulado' or v_original.revision_estado<>'observada'
     or exists(select 1 from public.asis_entregas_diarias e where e.colaborador_id=v_colab
       and e.fecha=v_original.fecha and e.requisito='comparticiones' and e.id>v_original.id) then
    return jsonb_build_object('ok',false,'motivo','correccion_resuelta');
  end if;
  v_fecha:=v_original.fecha;
  select * into v_cfg from public.asis_cierre_config where id=1;
  if v_total not between 1 and 50
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
         and p.correccion_entrega_id=p_entrega and p.vinculado_at is null)<>v_total then
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
    'fecha',v_fecha,'resumen',public.dash_cierre_hoy());
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','ya_completo');
end;
$$;

revoke all on function public.dash_confirmar_correccion(bigint,text,text[],text) from public,anon;
grant execute on function public.dash_confirmar_correccion(bigint,text,text[],text) to authenticated;


notify pgrst,'reload schema';
commit;
