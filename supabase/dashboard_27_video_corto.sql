-- FASE 7 · VIDEO CORTO OPCIONAL EN RPE Y ENTREGABLES
-- Ejecutar después de dashboard_26_evidencia_hora_salida.sql.

begin;

alter table public.asis_entrega_archivos
  drop constraint if exists asis_entrega_archivos_mime_check;
alter table public.asis_entrega_archivos
  add constraint asis_entrega_archivos_mime_check
  check (mime in ('image/jpeg','image/webp','video/mp4','video/webm'));

alter table public.asis_entrega_archivos
  drop constraint if exists asis_entrega_archivos_bytes_check;
alter table public.asis_entrega_archivos
  add constraint asis_entrega_archivos_bytes_check
  check (
    (mime in ('image/jpeg','image/webp') and bytes between 1 and 1048576)
    or (mime in ('video/mp4','video/webm') and bytes between 1 and 8388608)
  );

alter table public.asis_entrega_archivos
  drop constraint if exists asis_entrega_archivos_orden_check;
alter table public.asis_entrega_archivos
  add constraint asis_entrega_archivos_orden_check check (orden between 1 and 6);

create unique index if not exists asis_entrega_un_video_idx
  on public.asis_entrega_archivos(entrega_id)
  where mime in ('video/mp4','video/webm');

update storage.buckets
   set public=false,
       file_size_limit=8388608,
       allowed_mime_types=array['image/jpeg','image/webp','video/mp4','video/webm']
 where id='asis-cierre-evidencias';

create or replace function public.dash_video_permiso(
  p_requisito text,
  p_asignacion bigint default null,
  p_ext text default 'mp4'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_persona public.asis_colaboradores;
  v_ext text;
  v_path text;
  v_max integer;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if p_requisito not in ('rpe','asignado') then
    return jsonb_build_object('ok',false,'motivo','video_no_permitido');
  end if;
  select * into v_persona from public.asis_colaboradores where id=v_colab and activo;
  if v_persona.id is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colab);
  if v_fecha is null or not exists(
    select 1 from public.asis_registros
     where colaborador_id=v_colab and fecha=v_fecha and salida_at is null
  ) then return jsonb_build_object('ok',false,'motivo','sin_entrada_o_cerrada'); end if;
  if p_requisito='asignado' and not exists(
    select 1 from public.asis_asignaciones_diarias a
     where a.id=p_asignacion and a.fecha=v_fecha and a.activo and a.requerido
       and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id)
  ) then return jsonb_build_object('ok',false,'motivo','asignacion'); end if;
  if p_requisito<>'asignado' and p_asignacion is not null then
    return jsonb_build_object('ok',false,'motivo','asignacion');
  end if;
  if exists(
    select 1 from public.asis_entregas_diarias e
     where e.colaborador_id=v_colab and e.fecha=v_fecha and e.estado='completo'
       and ((p_requisito='rpe' and e.requisito='rpe')
         or (p_requisito='asignado' and e.asignacion_id=p_asignacion))
  ) then return jsonb_build_object('ok',false,'motivo','ya_completo'); end if;

  v_ext:=lower(coalesce(p_ext,''));
  if v_ext not in ('mp4','webm') then return jsonb_build_object('ok',false,'motivo','formato_video'); end if;
  perform pg_advisory_xact_lock(v_colab);
  select 22+count(*)::integer*6 into v_max from public.asis_asignaciones_diarias a
   where a.fecha=v_fecha and a.activo and a.requerido
     and (a.colaborador_id=v_colab or a.area_id=v_persona.area_id);
  if (select count(*) from public.asis_carga_permisos where colaborador_id=v_colab and fecha=v_fecha)>=v_max then
    return jsonb_build_object('ok',false,'motivo','cuota_diaria');
  end if;
  v_path:=to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/'||gen_random_uuid()||'.'||v_ext;
  insert into public.asis_carga_permisos(path,colaborador_id,fecha) values(v_path,v_colab,v_fecha);
  return jsonb_build_object('ok',true,'ruta',v_path,'servidor_at',now());
end $$;
revoke all on function public.dash_video_permiso(text,bigint,text) from public,anon;
grant execute on function public.dash_video_permiso(text,bigint,text) to authenticated;

create or replace function public.dash_adjuntar_video(p_entrega bigint,p_path text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_colab bigint:=public.dash_colab();
  v_fecha date;
  v_entrega public.asis_entregas_diarias;
  v_obj storage.objects;
  v_mime text;
  v_bytes bigint;
  v_orden integer;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  perform pg_advisory_xact_lock(v_colab);
  select * into v_entrega from public.asis_entregas_diarias
   where id=p_entrega and colaborador_id=v_colab and estado='completo' for update;
  if v_entrega.id is null or v_entrega.requisito not in ('rpe','asignado') then
    return jsonb_build_object('ok',false,'motivo','entrega');
  end if;
  v_fecha:=v_entrega.fecha;
  if not exists(select 1 from public.asis_registros where colaborador_id=v_colab and fecha=v_fecha and salida_at is null) then
    return jsonb_build_object('ok',false,'motivo','jornada_cerrada');
  end if;
  if p_path !~ ('^'||to_char(v_fecha,'YYYY/MM/DD')||'/'||v_colab||'/[0-9a-f-]+\.(mp4|webm)$') then
    return jsonb_build_object('ok',false,'motivo','ruta');
  end if;
  if not exists(select 1 from public.asis_carga_permisos where path=p_path and colaborador_id=v_colab and fecha=v_fecha and vinculado_at is null) then
    return jsonb_build_object('ok',false,'motivo','permiso');
  end if;
  if exists(select 1 from public.asis_entrega_archivos where entrega_id=p_entrega and mime in ('video/mp4','video/webm')) then
    return jsonb_build_object('ok',false,'motivo','video_existente');
  end if;
  select * into v_obj from storage.objects where bucket_id='asis-cierre-evidencias' and name=p_path;
  v_mime:=coalesce(v_obj.metadata->>'mimetype','');v_bytes:=coalesce((v_obj.metadata->>'size')::bigint,0);
  if v_obj.id is null or v_mime not in ('video/mp4','video/webm') or v_bytes not between 1 and 8388608 then
    return jsonb_build_object('ok',false,'motivo','video_no_verificado');
  end if;
  select coalesce(max(orden),0)+1 into v_orden from public.asis_entrega_archivos where entrega_id=p_entrega;
  if v_orden>6 then return jsonb_build_object('ok',false,'motivo','cantidad'); end if;
  insert into public.asis_entrega_archivos(entrega_id,path,mime,bytes,orden)
  values(p_entrega,p_path,v_mime,v_bytes,v_orden);
  update public.asis_carga_permisos set vinculado_at=now()
   where path=p_path and colaborador_id=v_colab and fecha=v_fecha;
  return jsonb_build_object('ok',true,'entrega',p_entrega);
exception when unique_violation then
  return jsonb_build_object('ok',false,'motivo','video_existente');
end $$;
revoke all on function public.dash_adjuntar_video(bigint,text) from public,anon;
grant execute on function public.dash_adjuntar_video(bigint,text) to authenticated;

drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id='asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp|mp4|webm)$'
    and (
      public.asis_rol()='direccion'
      or (
        public.dash_sesion_vigente()
        and (
          public.dash_colab()=split_part(name,'/',4)::bigint
          or (public.dash_nivel()='lider' and public.puede_ver_colab(split_part(name,'/',4)::bigint))
        )
      )
    )
  );

notify pgrst,'reload schema';
commit;

select case when encontrado=esperado then 'OK' else 'REVISAR' end as estado,pieza,encontrado,esperado
from (
  select 'mime multimedia'::text pieza,count(*)::int encontrado,1 esperado
    from pg_constraint where conname='asis_entrega_archivos_mime_check'
  union all
  select 'RPC de video',count(*)::int,2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('dash_video_permiso','dash_adjuntar_video')
  union all
  select 'bucket multimedia',count(*)::int,1 from storage.buckets
   where id='asis-cierre-evidencias' and not public and file_size_limit=8388608
     and allowed_mime_types @> array['video/mp4','video/webm']
  union all
  select 'lectura privada multimedia',count(*)::int,1 from pg_policies
   where schemaname='storage' and tablename='objects' and policyname='cierre evidencias: lectura autorizada'
) q;
