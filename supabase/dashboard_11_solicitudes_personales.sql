-- ============================================================================
-- KJA · Dashboard 11 — solicitudes personales y evidencias privadas
--
-- Añade un flujo autenticado para justificaciones, uso de día libre asignado,
-- cambios de horario y cambios de turno. Dirección revisa cada solicitud y,
-- al aprobar una ausencia pasada, el registro queda marcado como Justificado.
-- ============================================================================

begin;

create table if not exists public.asis_solicitudes_personales (
  id              bigint generated always as identity primary key,
  colaborador_id  bigint not null references public.asis_colaboradores(id) on delete cascade,
  tipo            text not null check (tipo in ('justificacion','dia_libre','cambio_horario','cambio_turno')),
  fecha_inicio    date not null,
  fecha_fin       date not null,
  detalle         text not null,
  evidencia_path text,
  estado          text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  respuesta       text,
  creado_at       timestamptz not null default now(),
  resuelto_por    uuid references public.asis_perfiles(id),
  resuelto_at     timestamptz,
  constraint asis_sol_personal_fechas_chk check (fecha_fin >= fecha_inicio),
  constraint asis_sol_personal_detalle_chk check (length(btrim(detalle)) between 8 and 700),
  constraint asis_sol_personal_evidencia_chk check (
    tipo not in ('justificacion','dia_libre') or evidencia_path is not null
  )
);

create index if not exists asis_sol_personal_colab_idx
  on public.asis_solicitudes_personales(colaborador_id, creado_at desc);
create index if not exists asis_sol_personal_pendiente_idx
  on public.asis_solicitudes_personales(creado_at desc) where estado='pendiente';
create unique index if not exists asis_sol_personal_evidencia_idx
  on public.asis_solicitudes_personales(evidencia_path) where evidencia_path is not null;

alter table public.asis_solicitudes_personales enable row level security;
revoke all on table public.asis_solicitudes_personales from public,anon,authenticated;
revoke all on sequence public.asis_solicitudes_personales_id_seq from public,anon,authenticated;

alter table public.asis_admin_eventos
  drop constraint if exists asis_admin_eventos_accion_check;
alter table public.asis_admin_eventos
  add constraint asis_admin_eventos_accion_check check (accion in (
    'config_portal','regenerar_enlace','reiniciar_pin','resolver_horario','resolver_solicitud'
  ));

insert into storage.buckets
  (id,name,public,file_size_limit,allowed_mime_types)
values
  ('solicitud-evidencias','solicitud-evidencias',false,524288,
   array['image/webp','image/jpeg'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.dash_solicitud_evidencia_en_uso(p_path text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.asis_solicitudes_personales
     where evidencia_path=p_path
  );
$$;

revoke all on function public.dash_solicitud_evidencia_en_uso(text) from public,anon,authenticated;
grant execute on function public.dash_solicitud_evidencia_en_uso(text) to authenticated;

drop policy if exists "solicitudes evidencia: lectura autorizada" on storage.objects;
create policy "solicitudes evidencia: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id='solicitud-evidencias'
    and public.dash_sesion_vigente()
    and name ~ '^[0-9]+/[0-9a-f-]+\.(jpg|webp)$'
    and (
      split_part(name,'/',1)::bigint=public.dash_colab()
      or public.asis_rol()='direccion'
    )
  );

drop policy if exists "solicitudes evidencia: crear propia" on storage.objects;
create policy "solicitudes evidencia: crear propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='solicitud-evidencias'
    and public.dash_sesion_vigente()
    and public.dash_colab() is not null
    and split_part(name,'/',1)=public.dash_colab()::text
    and name ~ ('^'||public.dash_colab()::text||'/[0-9a-f-]+\.(jpg|webp)$')
  );

drop policy if exists "solicitudes evidencia: borrar propia" on storage.objects;
create policy "solicitudes evidencia: borrar propia"
  on storage.objects for delete to authenticated
  using (
    bucket_id='solicitud-evidencias'
    and public.dash_sesion_vigente()
    and split_part(name,'/',1)=public.dash_colab()::text
    and not public.dash_solicitud_evidencia_en_uso(name)
  );

create or replace function public.dash_solicitudes_personales()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_id bigint := public.dash_colab();
  v_items jsonb;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',s.id,'tipo',s.tipo,'fecha_inicio',s.fecha_inicio,'fecha_fin',s.fecha_fin,
    'detalle',s.detalle,'evidencia',s.evidencia_path is not null,
    'estado',s.estado,'respuesta',s.respuesta,'creado_at',s.creado_at,
    'resuelto_at',s.resuelto_at
  ) order by s.creado_at desc)
  into v_items
  from (
    select * from public.asis_solicitudes_personales
     where colaborador_id=v_id
     order by creado_at desc limit 20
  ) s;

  return jsonb_build_object('ok',true,'solicitudes',coalesce(v_items,'[]'::jsonb));
end;
$$;

create or replace function public.dash_crear_solicitud(
  p_tipo text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_detalle text,
  p_evidencia text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_tipo text := btrim(coalesce(p_tipo,''));
  v_detalle text := btrim(coalesce(p_detalle,''));
  v_evidencia text := nullif(btrim(coalesce(p_evidencia,'')),'');
  v_id_sol bigint;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if v_tipo not in ('justificacion','dia_libre','cambio_horario','cambio_turno') then
    return jsonb_build_object('ok',false,'motivo','tipo');
  end if;
  if p_fecha_inicio is null or p_fecha_fin is null or p_fecha_fin<p_fecha_inicio
     or p_fecha_fin-p_fecha_inicio>14 then
    return jsonb_build_object('ok',false,'motivo','fechas');
  end if;
  if length(v_detalle) not between 8 and 700 then
    return jsonb_build_object('ok',false,'motivo','detalle');
  end if;

  if v_tipo in ('justificacion','dia_libre') then
    if p_fecha_fin>v_hoy or p_fecha_inicio<v_hoy-90 then
      return jsonb_build_object('ok',false,'motivo','rango_ausencia');
    end if;
    if v_evidencia is null then
      return jsonb_build_object('ok',false,'motivo','evidencia');
    end if;
  elsif p_fecha_inicio<v_hoy-7 or p_fecha_fin>v_hoy+180 then
    return jsonb_build_object('ok',false,'motivo','rango_cambio');
  end if;

  if v_evidencia is not null and
     v_evidencia !~ ('^'||v_id::text||'/[0-9a-f-]+\.(jpg|webp)$') then
    return jsonb_build_object('ok',false,'motivo','ruta');
  end if;
  if v_evidencia is not null and not exists (
    select 1 from storage.objects
     where bucket_id='solicitud-evidencias' and name=v_evidencia
  ) then
    return jsonb_build_object('ok',false,'motivo','evidencia_no_existe');
  end if;

  if exists (
    select 1 from public.asis_solicitudes_personales
     where colaborador_id=v_id and tipo=v_tipo and estado='pendiente'
       and daterange(fecha_inicio,fecha_fin,'[]') && daterange(p_fecha_inicio,p_fecha_fin,'[]')
  ) then
    return jsonb_build_object('ok',false,'motivo','duplicada');
  end if;

  insert into public.asis_solicitudes_personales(
    colaborador_id,tipo,fecha_inicio,fecha_fin,detalle,evidencia_path
  ) values(
    v_id,v_tipo,p_fecha_inicio,p_fecha_fin,left(v_detalle,700),v_evidencia
  ) returning id into v_id_sol;

  return jsonb_build_object('ok',true,'id',v_id_sol);
end;
$$;

create or replace function public.dash_admin_solicitudes_personales()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_items jsonb;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id',s.id,'colaborador_id',s.colaborador_id,'nombre',c.nombre,
    'area',a.nombre,'tipo',s.tipo,'fecha_inicio',s.fecha_inicio,'fecha_fin',s.fecha_fin,
    'detalle',s.detalle,'evidencia_path',s.evidencia_path,'estado',s.estado,
    'creado_at',s.creado_at
  ) order by s.creado_at desc)
  into v_items
  from public.asis_solicitudes_personales s
  join public.asis_colaboradores c on c.id=s.colaborador_id
  join public.asis_areas a on a.id=c.area_id
  where s.estado='pendiente';

  return jsonb_build_object('ok',true,'solicitudes',coalesce(v_items,'[]'::jsonb));
end;
$$;

create or replace function public.dash_admin_resolver_solicitud(
  p_id bigint,
  p_aprobada boolean,
  p_respuesta text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_sol public.asis_solicitudes_personales;
  v_fecha date;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_resultado text;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_aprobada is null then
    return jsonb_build_object('ok',false,'motivo','estado');
  end if;

  select * into v_sol from public.asis_solicitudes_personales
   where id=p_id and estado='pendiente' for update;
  if not found then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  v_resultado := case when p_aprobada then 'aprobada' else 'rechazada' end;
  update public.asis_solicitudes_personales set
    estado=v_resultado,
    respuesta=nullif(left(btrim(coalesce(p_respuesta,'')),500),''),
    resuelto_por=auth.uid(),resuelto_at=now()
  where id=v_sol.id;

  if p_aprobada and v_sol.tipo in ('justificacion','dia_libre') then
    for v_fecha in
      select g::date from generate_series(v_sol.fecha_inicio,least(v_sol.fecha_fin,v_hoy),interval '1 day') g
    loop
      perform public.dash_admin_guardar_estado(v_sol.colaborador_id,v_fecha,'J');
      update public.asis_registros set
        nota=left(case when v_sol.tipo='dia_libre' then 'Día libre asignado: ' else 'Justificación: ' end||v_sol.detalle,500)
      where colaborador_id=v_sol.colaborador_id and fecha=v_fecha and estado='J';
    end loop;
  end if;

  insert into public.asis_admin_eventos(actor_id,accion,colaborador_id,detalle)
  values(auth.uid(),'resolver_solicitud',v_sol.colaborador_id,jsonb_build_object(
    'solicitud_id',v_sol.id,'tipo',v_sol.tipo,'resultado',v_resultado,
    'fecha_inicio',v_sol.fecha_inicio,'fecha_fin',v_sol.fecha_fin
  ));

  return jsonb_build_object('ok',true,'estado',v_resultado);
end;
$$;

-- Detalle privado de un día para la vista mensual del colaborador.
-- Las rutas se entregan con su bucket; el cliente crea URLs firmadas de corta duración.
create or replace function public.dash_dia_detalle(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_id bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_colab public.asis_colaboradores;
  v_reg public.asis_registros;
  v_sol public.asis_solicitudes_personales;
  v_lab boolean;
  v_modalidad text;
  v_evidencias jsonb := '[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if p_fecha is null or p_fecha<date '2020-01-01'
     or p_fecha>(date_trunc('month',v_hoy)+interval '1 month'-interval '1 day')::date then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  select * into v_colab from public.asis_colaboradores where id=v_id;
  if v_colab.id is null then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id=v_id and fecha=p_fecha;

  select * into v_sol from public.asis_solicitudes_personales
   where colaborador_id=v_id and p_fecha between fecha_inicio and fecha_fin
   order by case estado when 'pendiente' then 0 when 'aprobada' then 1 else 2 end,
            creado_at desc
   limit 1;

  v_lab := public.asis_labora(v_colab,p_fecha);
  v_modalidad := coalesce(
    nullif(v_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'mod',''),
    case when v_lab then 'virtual' else 'no_gestiona' end
  );

  if v_reg.evidencia_path is not null then
    v_evidencias := v_evidencias || jsonb_build_array(jsonb_build_object(
      'bucket','asis-evidencias','path',v_reg.evidencia_path,
      'label','Evidencia de marcación','origen',v_reg.evidencia_origen
    ));
  end if;
  if v_sol.evidencia_path is not null then
    v_evidencias := v_evidencias || jsonb_build_array(jsonb_build_object(
      'bucket','solicitud-evidencias','path',v_sol.evidencia_path,
      'label',case when v_sol.tipo='dia_libre' then 'Evidencia de día libre' else 'Evidencia de solicitud' end
    ));
  end if;

  return jsonb_build_object(
    'ok',true,'fecha',p_fecha,'futuro',p_fecha>v_hoy,'labora',v_lab,
    'modalidad',v_modalidad,
    'hora_entrada',public.asis_hora_entrada(v_colab,p_fecha),
    'hora_salida',public.asis_hora_salida(v_colab,p_fecha),
    'estado',v_reg.estado,'marcado_at',v_reg.marcado_at,
    'origen',v_reg.origen,'dispositivo',v_reg.dispositivo,
    'evidencia_origen',v_reg.evidencia_origen,
    'ubicacion_verificada',v_reg.evidencia_lat is not null and v_reg.evidencia_lon is not null,
    'horas',v_reg.horas,'vinculo',v_reg.vinculo,
    'nota',v_reg.nota,
    'solicitud',case when v_sol.id is null then null else jsonb_build_object(
      'id',v_sol.id,'tipo',v_sol.tipo,'estado',v_sol.estado,
      'detalle',v_sol.detalle,'respuesta',v_sol.respuesta,
      'fecha_inicio',v_sol.fecha_inicio,'fecha_fin',v_sol.fecha_fin
    ) end,
    'evidencias',v_evidencias
  );
end;
$$;

revoke all on function public.dash_solicitudes_personales() from public,anon,authenticated;
revoke all on function public.dash_crear_solicitud(text,date,date,text,text) from public,anon,authenticated;
revoke all on function public.dash_admin_solicitudes_personales() from public,anon,authenticated;
revoke all on function public.dash_admin_resolver_solicitud(bigint,boolean,text) from public,anon,authenticated;
revoke all on function public.dash_dia_detalle(date) from public,anon,authenticated;

grant execute on function public.dash_solicitudes_personales() to authenticated;
grant execute on function public.dash_crear_solicitud(text,date,date,text,text) to authenticated;
grant execute on function public.dash_admin_solicitudes_personales() to authenticated;
grant execute on function public.dash_admin_resolver_solicitud(bigint,boolean,text) to authenticated;
grant execute on function public.dash_dia_detalle(date) to authenticated;

notify pgrst,'reload schema';
commit;

-- Comprobación: todas las filas deben decir OK.
select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,pieza,encontrado,esperado
from (
  select 'tabla de solicitudes' pieza,
    (select count(*)::int from information_schema.tables where table_schema='public' and table_name='asis_solicitudes_personales') encontrado,1 esperado
  union all select 'bucket privado',
    (select count(*)::int from storage.buckets where id='solicitud-evidencias' and public=false),1
  union all select 'funciones',
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('dash_solicitudes_personales','dash_crear_solicitud','dash_admin_solicitudes_personales','dash_admin_resolver_solicitud','dash_dia_detalle')),5
  union all select 'políticas privadas',
    (select count(*)::int from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'solicitudes evidencia:%'),3
) q;
