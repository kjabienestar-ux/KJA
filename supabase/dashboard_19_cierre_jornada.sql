-- ================================================================
-- DASHBOARD 19 · CIERRE DE JORNADA Y EVIDENCIAS DIARIAS
-- Aplicar después de dashboard_18_dias_libres.sql.
--
-- Conserva marcado_at como entrada para no romper el historial.
-- Desde la fecha de activación, las horas solo se acreditan al cerrar.
-- ================================================================

-- ── 1) CONFIGURACIÓN ─────────────────────────────────────────────
create table if not exists public.asis_cierre_config (
  id                       smallint primary key default 1 check (id = 1),
  habilitado               boolean not null default true,
  obligatorio_desde        date not null default date '2026-09-07',
  salida_anticipacion_min  integer not null default 15
    check (salida_anticipacion_min between 0 and 120),
  salida_gracia_min        integer not null default 120
    check (salida_gracia_min between 0 and 720),
  comparticiones_min       integer not null default 5
    check (comparticiones_min between 1 and 5),
  collage_permitido        boolean not null default true,
  actualizado_at           timestamptz not null default now(),
  actualizado_por          uuid references public.asis_perfiles(id)
);

insert into public.asis_cierre_config (id)
values (1)
on conflict (id) do nothing;

alter table public.asis_cierre_config enable row level security;
drop policy if exists asis_cierre_config_sel on public.asis_cierre_config;
drop policy if exists asis_cierre_config_upd on public.asis_cierre_config;
create policy asis_cierre_config_sel on public.asis_cierre_config
  for select using (public.asis_es_miembro());
create policy asis_cierre_config_upd on public.asis_cierre_config
  for update using (public.asis_rol() = 'direccion')
  with check (public.asis_rol() = 'direccion');

grant select, update on public.asis_cierre_config to authenticated;


-- ── 2) LA MARCA EXISTENTE PASA A TENER CIERRE ────────────────────
alter table public.asis_registros
  add column if not exists salida_at timestamptz,
  add column if not exists salida_dispositivo text,
  add column if not exists salida_origen text,
  add column if not exists salida_por uuid references public.asis_perfiles(id),
  add column if not exists horas_programadas numeric,
  add column if not exists horas_efectivas numeric,
  add column if not exists cierre_regularizado boolean not null default false,
  add column if not exists cierre_nota text,
  add column if not exists cierre_actualizado_at timestamptz;

alter table public.asis_registros
  drop constraint if exists asis_registros_salida_origen_check;
alter table public.asis_registros
  add constraint asis_registros_salida_origen_check
  check (salida_origen is null or salida_origen in ('dashboard','panel'));

update public.asis_registros
   set horas_programadas = horas
 where horas_programadas is null;

-- Si la migración se aplica después de que alguien marcó entrada el mismo
-- día de activación, esa jornada también espera su salida antes de acreditar.
update public.asis_registros r
   set horas = 0,
       horas_efectivas = null
  from public.asis_cierre_config cfg
 where cfg.id = 1
   and cfg.habilitado
   and r.fecha >= cfg.obligatorio_desde
   and r.estado in ('P','T')
   and r.salida_at is null;

create or replace function public.asis_cierre_preparar_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.asis_cierre_config;
begin
  select * into v_cfg from public.asis_cierre_config where id = 1;

  if new.horas_programadas is null then
    new.horas_programadas := new.horas;
  end if;

  if tg_op = 'INSERT'
     and coalesce(v_cfg.habilitado, false)
     and new.fecha >= v_cfg.obligatorio_desde
     and new.estado in ('P','T')
     and new.salida_at is null then
    new.horas := 0;
    new.horas_efectivas := null;
  end if;

  return new;
end;
$$;

drop trigger if exists asis_cierre_preparar_registro_trg on public.asis_registros;
create trigger asis_cierre_preparar_registro_trg
before insert on public.asis_registros
for each row execute function public.asis_cierre_preparar_registro();


-- ── 3) ASIGNACIONES, ENTREGAS Y ARCHIVOS ─────────────────────────
create table if not exists public.asis_asignaciones_diarias (
  id              bigint generated always as identity primary key,
  fecha           date not null,
  colaborador_id  bigint references public.asis_colaboradores(id) on delete cascade,
  area_id         bigint references public.asis_areas(id) on delete cascade,
  tipo            text not null check (tipo in ('ppt','gpt','induccion','otro')),
  titulo          text not null check (char_length(btrim(titulo)) between 2 and 120),
  instrucciones   text,
  requerido       boolean not null default true,
  activo          boolean not null default true,
  creado_por      uuid references public.asis_perfiles(id),
  creado_at       timestamptz not null default now(),
  actualizado_at  timestamptz not null default now(),
  check (num_nonnulls(colaborador_id, area_id) = 1)
);

create index if not exists asis_asignaciones_fecha_colab_idx
  on public.asis_asignaciones_diarias(fecha, colaborador_id)
  where activo;
create index if not exists asis_asignaciones_fecha_area_idx
  on public.asis_asignaciones_diarias(fecha, area_id)
  where activo;

create table if not exists public.asis_entregas_diarias (
  id              bigint generated always as identity primary key,
  colaborador_id  bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha           date not null,
  requisito       text not null check (requisito in ('comparticiones','rpe','asignado')),
  asignacion_id   bigint references public.asis_asignaciones_diarias(id) on delete cascade,
  modalidad       text check (modalidad is null or modalidad in ('individuales','collage')),
  detalle         text,
  estado          text not null default 'completo' check (estado in ('completo','anulado')),
  completado_at   timestamptz not null default now(),
  creado_at       timestamptz not null default now(),
  check (
    (requisito = 'asignado' and asignacion_id is not null) or
    (requisito <> 'asignado' and asignacion_id is null)
  )
);

create unique index if not exists asis_entrega_global_unica_idx
  on public.asis_entregas_diarias(colaborador_id, fecha, requisito)
  where asignacion_id is null and estado = 'completo';
create unique index if not exists asis_entrega_asignada_unica_idx
  on public.asis_entregas_diarias(colaborador_id, fecha, asignacion_id)
  where asignacion_id is not null and estado = 'completo';

create table if not exists public.asis_entrega_archivos (
  id          bigint generated always as identity primary key,
  entrega_id  bigint not null references public.asis_entregas_diarias(id) on delete cascade,
  path        text not null unique,
  mime        text not null check (mime in ('image/jpeg','image/webp')),
  bytes       integer not null check (bytes between 1 and 1048576),
  orden       smallint not null check (orden between 1 and 5),
  creado_at   timestamptz not null default now(),
  unique (entrega_id, orden)
);

create table if not exists public.asis_carga_permisos (
  path            text primary key,
  colaborador_id  bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha           date not null,
  creado_at       timestamptz not null default now(),
  vinculado_at    timestamptz
);

create index if not exists asis_carga_permisos_pendientes_idx
  on public.asis_carga_permisos(creado_at)
  where vinculado_at is null;

alter table public.asis_asignaciones_diarias enable row level security;
alter table public.asis_entregas_diarias enable row level security;
alter table public.asis_entrega_archivos enable row level security;
alter table public.asis_carga_permisos enable row level security;

-- Estas tablas se consultan y modifican mediante RPC con validación de rol.
revoke all on public.asis_asignaciones_diarias from anon, authenticated;
revoke all on public.asis_entregas_diarias from anon, authenticated;
revoke all on public.asis_entrega_archivos from anon, authenticated;
revoke all on public.asis_carga_permisos from anon, authenticated;


-- ── 4) STORAGE PRIVADO ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asis-cierre-evidencias',
  'asis-cierre-evidencias',
  false,
  1048576,
  array['image/jpeg','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg','image/webp'];

drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp)$'
    and (
      public.asis_es_miembro()
      or (
        public.dash_sesion_vigente()
        and public.puede_ver_colab(split_part(name, '/', 4)::bigint)
      )
    )
  );


-- ── 5) RESUMEN SEGURO DE CIERRE ──────────────────────────────────
create or replace function public.dash_cierre_resumen_colab(
  p_colab bigint,
  p_fecha date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg       public.asis_cierre_config;
  v_colab     public.asis_colaboradores;
  v_reg       public.asis_registros;
  v_hoy       date := (now() at time zone 'America/Lima')::date;
  v_ahora     time := (now() at time zone 'America/Lima')::time;
  v_fin       time;
  v_desde     time;
  v_hasta     time;
  v_aplica    boolean := false;
  v_comp_ok   boolean := false;
  v_rpe_ok    boolean := false;
  v_asig_ok   boolean := false;
  v_comp_n    integer := 0;
  v_rpe_n     integer := 0;
  v_pend      integer := 0;
  v_asig      jsonb := '[]'::jsonb;
  v_estado    text;
  v_puede     boolean := false;
begin
  select * into v_cfg from public.asis_cierre_config where id = 1;
  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  if v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  select * into v_reg
    from public.asis_registros
   where colaborador_id = p_colab and fecha = p_fecha;

  v_aplica := coalesce(v_cfg.habilitado, false)
              and p_fecha >= v_cfg.obligatorio_desde
              and public.asis_labora(v_colab, p_fecha);
  v_fin := public.asis_hora_salida(v_colab, p_fecha);
  if v_fin is not null then
    v_desde := v_fin - make_interval(mins => v_cfg.salida_anticipacion_min);
    v_hasta := v_fin + make_interval(mins => v_cfg.salida_gracia_min);
  end if;

  select exists (
           select 1 from public.asis_entregas_diarias e
            where e.colaborador_id = p_colab and e.fecha = p_fecha
              and e.requisito = 'comparticiones' and e.estado = 'completo'
         ),
         coalesce((
           select count(*) from public.asis_entrega_archivos f
           join public.asis_entregas_diarias e on e.id = f.entrega_id
            where e.colaborador_id = p_colab and e.fecha = p_fecha
              and e.requisito = 'comparticiones' and e.estado = 'completo'
         ), 0)
    into v_comp_ok, v_comp_n;

  select exists (
           select 1 from public.asis_entregas_diarias e
            where e.colaborador_id = p_colab and e.fecha = p_fecha
              and e.requisito = 'rpe' and e.estado = 'completo'
         ),
         coalesce((
           select count(*) from public.asis_entrega_archivos f
           join public.asis_entregas_diarias e on e.id = f.entrega_id
            where e.colaborador_id = p_colab and e.fecha = p_fecha
              and e.requisito = 'rpe' and e.estado = 'completo'
         ), 0)
    into v_rpe_ok, v_rpe_n;

  with asignadas as (
    select a.*
      from public.asis_asignaciones_diarias a
     where a.fecha = p_fecha and a.activo and a.requerido
       and (a.colaborador_id = p_colab or a.area_id = v_colab.area_id)
  )
  select count(*) filter (where not completo),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'tipo', tipo,
           'titulo', titulo,
           'instrucciones', instrucciones,
           'completo', completo,
           'archivos', archivos
         ) order by id), '[]'::jsonb)
    into v_pend, v_asig
    from (
      select a.id, a.tipo, a.titulo, a.instrucciones,
             exists (
               select 1 from public.asis_entregas_diarias e
                where e.colaborador_id = p_colab and e.fecha = p_fecha
                  and e.asignacion_id = a.id and e.estado = 'completo'
             ) as completo,
             coalesce((
               select count(*) from public.asis_entrega_archivos f
               join public.asis_entregas_diarias e on e.id = f.entrega_id
                where e.colaborador_id = p_colab and e.fecha = p_fecha
                  and e.asignacion_id = a.id and e.estado = 'completo'
             ), 0) as archivos
        from asignadas a
    ) q;

  v_asig_ok := coalesce(v_pend, 0) = 0;

  if not v_aplica then
    v_estado := 'no_aplica';
  elsif v_reg.id is null then
    v_estado := 'sin_entrada';
  elsif v_reg.salida_at is not null then
    v_estado := case when v_reg.cierre_regularizado then 'regularizada' else 'completa' end;
  elsif p_fecha < v_hoy or (p_fecha = v_hoy and v_hasta is not null and v_ahora > v_hasta) then
    v_estado := 'incompleta';
  elsif v_comp_ok and v_rpe_ok and v_asig_ok then
    v_estado := 'lista_para_salir';
  else
    v_estado := 'en_curso';
  end if;

  v_puede := v_aplica
              and p_fecha = v_hoy
              and v_reg.id is not null
              and v_reg.salida_at is null
              and v_comp_ok and v_rpe_ok and v_asig_ok
              and v_fin is not null
              and v_ahora between v_desde and v_hasta;

  return jsonb_build_object(
    'ok', true,
    'aplica', v_aplica,
    'fecha', p_fecha,
    'estado', v_estado,
    'entrada_at', v_reg.marcado_at,
    'salida_at', v_reg.salida_at,
    'hora_salida_programada', v_fin,
    'salida_desde', v_desde,
    'salida_hasta', v_hasta,
    'puede_marcar_salida', v_puede,
    'comparticiones_min', v_cfg.comparticiones_min,
    'collage_permitido', v_cfg.collage_permitido,
    'requisitos', jsonb_build_array(
      jsonb_build_object(
        'tipo', 'comparticiones', 'titulo', 'Comparticiones de Facebook',
        'completo', v_comp_ok, 'archivos', v_comp_n,
        'descripcion', case when v_cfg.collage_permitido
          then v_cfg.comparticiones_min || ' capturas o una imagen tipo collage'
          else v_cfg.comparticiones_min || ' capturas' end
      ),
      jsonb_build_object(
        'tipo', 'rpe', 'titulo', 'RPE y evidencias del día',
        'completo', v_rpe_ok, 'archivos', v_rpe_n,
        'descripcion', 'Adjunta el reporte de actividades del día'
      )
    ),
    'asignaciones', v_asig,
    'pendientes', (case when v_comp_ok then 0 else 1 end)
                  + (case when v_rpe_ok then 0 else 1 end)
                  + coalesce(v_pend, 0)
  );
end;
$$;

revoke all on function public.dash_cierre_resumen_colab(bigint, date) from public, anon, authenticated;

create or replace function public.dash_cierre_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  return public.dash_cierre_resumen_colab(v_colab, v_hoy);
end;
$$;

revoke all on function public.dash_cierre_hoy() from public, anon;
grant execute on function public.dash_cierre_hoy() to authenticated;

create or replace function public.dash_equipo_cierres_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_personas jsonb;
begin
  if not public.dash_sesion_vigente() or public.dash_nivel() not in ('lider','sistemas') then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'cierre', public.dash_cierre_resumen_colab(c.id, v_hoy)
         ) order by c.orden, c.nombre), '[]'::jsonb)
    into v_personas
    from public.asis_colaboradores c
   where c.activo and public.puede_ver_colab(c.id);

  return jsonb_build_object('ok', true, 'fecha', v_hoy, 'personas', v_personas);
end;
$$;

revoke all on function public.dash_equipo_cierres_hoy() from public, anon;
grant execute on function public.dash_equipo_cierres_hoy() to authenticated;


-- ── 6) PERMISOS DE SUBIDA Y CONFIRMACIÓN ─────────────────────────
create or replace function public.dash_entrega_permiso(
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

revoke all on function public.dash_entrega_permiso(text, bigint, text, text) from public, anon;
grant execute on function public.dash_entrega_permiso(text, bigint, text, text) to authenticated;

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
    if v_path !~ ('^' || to_char(v_hoy, 'YYYY/MM/DD') || '/' || v_colab || '/[0-9a-f-]+\.(jpg|webp)$') then
      return jsonb_build_object('ok', false, 'motivo', 'ruta');
    end if;
    select * into v_obj
      from storage.objects
     where bucket_id = 'asis-cierre-evidencias' and name = v_path;
    if v_obj.id is null
       or coalesce((v_obj.metadata ->> 'size')::bigint, 0) not between 1 and 1048576
       or coalesce(v_obj.metadata ->> 'mimetype', '') not in ('image/jpeg','image/webp') then
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

revoke all on function public.dash_confirmar_entrega(text, bigint, text, text[], text) from public, anon;
grant execute on function public.dash_confirmar_entrega(text, bigint, text, text[], text) to authenticated;


-- ── 7) MARCADO DE SALIDA ─────────────────────────────────────────
create or replace function public.dash_marcar_salida(p_dispositivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_now timestamptz := now();
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_reg public.asis_registros;
  v_fin time;
  v_desde time;
  v_hasta time;
  v_pendientes integer := 0;
  v_horas numeric;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  select * into v_persona from public.asis_colaboradores where id = v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id = 1;
  if not coalesce(v_cfg.habilitado, false) or v_hoy < v_cfg.obligatorio_desde then
    return jsonb_build_object('ok', false, 'motivo', 'no_habilitado');
  end if;

  select * into v_reg
    from public.asis_registros
   where colaborador_id = v_colab and fecha = v_hoy
   for update;
  if v_reg.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_entrada');
  end if;
  if v_reg.salida_at is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_registrada', 'salida_at', v_reg.salida_at);
  end if;

  v_fin := public.asis_hora_salida(v_persona, v_hoy);
  if v_fin is null then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;
  v_desde := v_fin - make_interval(mins => v_cfg.salida_anticipacion_min);
  v_hasta := v_fin + make_interval(mins => v_cfg.salida_gracia_min);
  if v_ahora < v_desde then
    return jsonb_build_object('ok', false, 'motivo', 'salida_aun_no_disponible', 'desde', v_desde);
  end if;
  if v_ahora > v_hasta then
    return jsonb_build_object('ok', false, 'motivo', 'salida_fuera_de_plazo', 'hasta', v_hasta);
  end if;

  if not exists (
    select 1 from public.asis_entregas_diarias
     where colaborador_id = v_colab and fecha = v_hoy
       and requisito = 'comparticiones' and estado = 'completo'
  ) then v_pendientes := v_pendientes + 1; end if;

  if not exists (
    select 1 from public.asis_entregas_diarias
     where colaborador_id = v_colab and fecha = v_hoy
       and requisito = 'rpe' and estado = 'completo'
  ) then v_pendientes := v_pendientes + 1; end if;

  select v_pendientes + count(*)
    into v_pendientes
    from public.asis_asignaciones_diarias a
   where a.fecha = v_hoy and a.activo and a.requerido
     and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id)
     and not exists (
       select 1 from public.asis_entregas_diarias e
        where e.colaborador_id = v_colab and e.fecha = v_hoy
          and e.asignacion_id = a.id and e.estado = 'completo'
     );

  if v_pendientes > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'requisitos_pendientes', 'pendientes', v_pendientes);
  end if;

  v_horas := round(greatest(0, extract(epoch from (v_now - v_reg.marcado_at)) / 3600)::numeric, 2);
  update public.asis_registros
     set salida_at = v_now,
         salida_dispositivo = left(coalesce(p_dispositivo, ''), 120),
         salida_origen = 'dashboard',
         salida_por = auth.uid(),
         horas_efectivas = v_horas,
         horas = v_horas,
         cierre_actualizado_at = v_now
   where id = v_reg.id;

  return jsonb_build_object(
    'ok', true,
    'estado', 'completa',
    'salida_at', v_now,
    'horas_efectivas', v_horas,
    'resumen', public.dash_cierre_resumen_colab(v_colab, v_hoy)
  );
end;
$$;

revoke all on function public.dash_marcar_salida(text) from public, anon;
grant execute on function public.dash_marcar_salida(text) to authenticated;


-- ── 8) ASIGNACIÓN ADMINISTRATIVA (BASE PARA LA SIGUIENTE VISTA) ───
create or replace function public.dash_admin_asignar_entregable(
  p_fecha date,
  p_colaborador bigint,
  p_area bigint,
  p_tipo text,
  p_titulo text,
  p_instrucciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_fecha is null or p_fecha < (now() at time zone 'America/Lima')::date
     or num_nonnulls(p_colaborador, p_area) <> 1
     or p_tipo not in ('ppt','gpt','induccion','otro')
     or char_length(btrim(coalesce(p_titulo, ''))) not between 2 and 120 then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;
  if p_colaborador is not null and not exists (
    select 1 from public.asis_colaboradores where id = p_colaborador and activo
  ) then return jsonb_build_object('ok', false, 'motivo', 'colaborador'); end if;
  if p_area is not null and not exists (
    select 1 from public.asis_areas where id = p_area
  ) then return jsonb_build_object('ok', false, 'motivo', 'area'); end if;

  insert into public.asis_asignaciones_diarias (
    fecha, colaborador_id, area_id, tipo, titulo, instrucciones, creado_por
  ) values (
    p_fecha, p_colaborador, p_area, p_tipo, btrim(p_titulo),
    nullif(left(btrim(coalesce(p_instrucciones, '')), 700), ''), auth.uid()
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.dash_admin_asignar_entregable(date, bigint, bigint, text, text, text) from public, anon;
grant execute on function public.dash_admin_asignar_entregable(date, bigint, bigint, text, text, text) to authenticated;

create or replace function public.dash_admin_cierres(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_personas jsonb;
  v_areas jsonb;
  v_asignaciones jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_fecha is null or p_fecha < date '2020-01-01' or p_fecha > v_hoy + 90 then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) order by a.orden, a.nombre), '[]'::jsonb)
    into v_areas from public.asis_areas a;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'nombre', c.nombre,
           'area_id', c.area_id,
           'area', a.nombre,
           'labora', public.asis_labora(c, p_fecha),
           'cierre', public.dash_cierre_resumen_colab(c.id, p_fecha)
         ) order by a.orden, c.orden, c.nombre), '[]'::jsonb)
    into v_personas
    from public.asis_colaboradores c
    join public.asis_areas a on a.id = c.area_id
   where c.activo;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           'fecha', x.fecha,
           'colaborador_id', x.colaborador_id,
           'area_id', x.area_id,
           'destino', coalesce(c.nombre, a.nombre),
           'tipo', x.tipo,
           'titulo', x.titulo,
           'instrucciones', x.instrucciones,
           'activo', x.activo
         ) order by x.creado_at desc), '[]'::jsonb)
    into v_asignaciones
    from public.asis_asignaciones_diarias x
    left join public.asis_colaboradores c on c.id = x.colaborador_id
    left join public.asis_areas a on a.id = x.area_id
   where x.fecha = p_fecha and x.activo;

  return jsonb_build_object(
    'ok', true,
    'fecha', p_fecha,
    'puede_editar', public.asis_puede_editar(),
    'areas', v_areas,
    'personas', v_personas,
    'asignaciones', v_asignaciones
  );
end;
$$;

revoke all on function public.dash_admin_cierres(date) from public, anon;
grant execute on function public.dash_admin_cierres(date) to authenticated;

create or replace function public.dash_admin_cierres_mes(p_anio int, p_mes int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_fin date;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_cfg public.asis_cierre_config;
  v_cierres jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_mes is null or p_anio is null
     or p_mes not between 1 and 12 or p_anio not between 2020 and 2100 then
    return jsonb_build_object('ok', false, 'motivo', 'periodo');
  end if;

  v_inicio := make_date(p_anio, p_mes, 1);
  v_fin := (v_inicio + interval '1 month - 1 day')::date;
  select * into v_cfg from public.asis_cierre_config where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'colaborador_id', r.colaborador_id,
           'fecha', r.fecha,
           'salida_at', r.salida_at,
           'estado', case
             when not coalesce(v_cfg.habilitado, false)
                  or r.fecha < v_cfg.obligatorio_desde
                  or not public.asis_labora(c, r.fecha) then 'no_aplica'
             when r.salida_at is not null then case when r.cierre_regularizado then 'regularizada' else 'completa' end
             when r.fecha < v_hoy then 'incompleta'
             when r.fecha = v_hoy
                  and public.asis_hora_salida(c, r.fecha) is not null
                  and v_ahora > (public.asis_hora_salida(c, r.fecha) + make_interval(mins => v_cfg.salida_gracia_min))::time
               then 'incompleta'
             else 'en_curso'
           end
         ) order by r.colaborador_id, r.fecha), '[]'::jsonb)
    into v_cierres
    from public.asis_registros r
    join public.asis_colaboradores c on c.id = r.colaborador_id
   where r.fecha between v_inicio and v_fin and r.estado in ('P','T');

  return jsonb_build_object('ok', true, 'cierres', v_cierres);
end;
$$;

revoke all on function public.dash_admin_cierres_mes(int, int) from public, anon;
grant execute on function public.dash_admin_cierres_mes(int, int) to authenticated;

create or replace function public.dash_admin_cancelar_entregable(p_asignacion bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  update public.asis_asignaciones_diarias
     set activo = false, actualizado_at = now()
   where id = p_asignacion and activo
     and not exists (
       select 1 from public.asis_entregas_diarias e
        where e.asignacion_id = p_asignacion and e.estado = 'completo'
     );
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_cancelable');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.dash_admin_cancelar_entregable(bigint) from public, anon;
grant execute on function public.dash_admin_cancelar_entregable(bigint) to authenticated;


-- ── 9) HISTORIAL: INCOMPLETAS NO CUENTAN ──────────────────────────
create or replace function public.dash_historial(p_anio int, p_mes int, p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_objetivo bigint := coalesce(p_colab, public.dash_colab());
  v_colab    public.asis_colaboradores;
  v_cfg      public.asis_cierre_config;
  v_ini      date;
  v_fin      date;
  v_hoy      date := (now() at time zone 'America/Lima')::date;
  v_dias     jsonb;
  v_p int; v_t int; v_j int; v_ng int; v_inc int; v_lab int;
  v_horas numeric; v_meta numeric;
begin
  if not public.dash_sesion_vigente() or not public.puede_ver_colab(v_objetivo) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if p_mes not between 1 and 12 or p_anio not between 2020 and extract(year from v_hoy)::int then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;
  select * into v_colab from public.asis_colaboradores where id = v_objetivo;
  select * into v_cfg from public.asis_cierre_config where id = 1;
  if v_colab is null then return jsonb_build_object('ok', false, 'motivo', 'no_existe'); end if;

  v_ini := make_date(p_anio, p_mes, 1);
  if v_ini > date_trunc('month', v_hoy)::date then v_ini := date_trunc('month', v_hoy)::date; end if;
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;

  select jsonb_agg(jsonb_build_object(
           'd', extract(day from g.d)::int,
           'fecha', g.d::date,
           'dow', extract(isodow from g.d)::int,
           'lab', public.asis_labora(v_colab, g.d::date),
           'estado', r.estado,
           'marcado_at', r.marcado_at,
           'salida_at', r.salida_at,
           'cierre_estado', case when r.id is null then null
             else public.dash_cierre_resumen_colab(v_objetivo, g.d::date) ->> 'estado' end,
           'futuro', g.d::date > v_hoy
         ) order by g.d)
    into v_dias
    from generate_series(v_ini, v_fin, interval '1 day') g(d)
    left join public.asis_registros r
      on r.colaborador_id = v_objetivo and r.fecha = g.d::date;

  select count(*) filter (where estado='P' and valido),
         count(*) filter (where estado='T' and valido),
         count(*) filter (where estado='J'),
         count(*) filter (where estado='NG'),
         count(*) filter (where estado in ('P','T') and cierre_estado='incompleta')
    into v_p, v_t, v_j, v_ng, v_inc
    from (
       select r.*,
              (r.fecha < v_cfg.obligatorio_desde or not v_cfg.habilitado or r.salida_at is not null) as valido,
              public.dash_cierre_resumen_colab(v_objetivo, r.fecha) ->> 'estado' as cierre_estado
        from public.asis_registros r
       where r.colaborador_id = v_objetivo and r.fecha between v_ini and v_fin
    ) x;

  select count(*) into v_lab
    from generate_series(v_ini, least(v_fin, v_hoy), interval '1 day') g(d)
   where public.asis_labora(v_colab, g.d::date);

  select coalesce(v_colab.horas_previas,0) + coalesce(sum(horas),0)
    into v_horas from public.asis_registros
   where colaborador_id = v_objetivo and estado in ('P','T','J');

  v_meta := coalesce(v_colab.contrato_horas,0) +
    case when v_colab.tipo_vinculo='ambos'
         then coalesce(v_colab.contrato_horas_voluntariado,0) else 0 end;

  return jsonb_build_object(
    'ok', true, 'anio', extract(year from v_ini)::int, 'mes', extract(month from v_ini)::int,
    'hoy', v_hoy, 'dias', coalesce(v_dias,'[]'::jsonb),
    'totales', jsonb_build_object(
      'P',v_p,'T',v_t,'J',v_j,'NG',v_ng,'incompletas',v_inc,'laborables',v_lab
    ),
    'horas', round(v_horas,1), 'meta', nullif(v_meta,0), 'vinculo', v_colab.tipo_vinculo
  );
end;
$$;

grant execute on function public.dash_historial(int, int, bigint) to authenticated;


-- ── 10) COMPROBACIONES ────────────────────────────────────────────
select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'tablas de cierre'::text pieza,
         (select count(*)::int from information_schema.tables
           where table_schema = 'public'
             and table_name in ('asis_cierre_config','asis_asignaciones_diarias','asis_entregas_diarias','asis_entrega_archivos','asis_carga_permisos')) encontrado,
         5 esperado
  union all
  select 'columnas de salida',
         (select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'asis_registros'
             and column_name in ('salida_at','salida_dispositivo','salida_origen','horas_programadas','horas_efectivas')),
         5
  union all
  select 'RPC personales',
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
              and p.proname in ('dash_cierre_hoy','dash_equipo_cierres_hoy','dash_entrega_permiso','dash_confirmar_entrega','dash_marcar_salida','dash_admin_cierres','dash_admin_cierres_mes','dash_admin_asignar_entregable','dash_admin_cancelar_entregable')),
         9
  union all
  select 'bucket privado',
         (select count(*)::int from storage.buckets
           where id = 'asis-cierre-evidencias' and public = false and file_size_limit = 1048576),
         1
) q;
