-- =====================================================================
-- KJA · Dashboard 13 — modalidad diaria y geocerca presencial
--
-- REQUIERE: dashboard_12_marcado_blindado.sql
--
-- Reglas:
--   · cada persona puede elegir Virtual o Presencial para el día actual;
--   · la modalidad queda congelada al registrar la asistencia;
--   · Virtual exige evidencia, pero no solicita ni conserva ubicación;
--   · Presencial exige evidencia y ubicación dentro de 1 km de la oficina;
--   · horario, modalidad y distancia se vuelven a validar en Supabase;
--   · el portal anterior conserva la activación de PIN, no el marcado.
--
-- La geocerca nace sin coordenadas. Dirección debe abrir
-- Gestión → Acceso y marcado desde la oficina, capturar su ubicación y
-- guardar las reglas. Hasta entonces el marcado presencial falla cerrado.
-- =====================================================================

begin;

-- 1) CONFIGURACIÓN Y TRAZABILIDAD ------------------------------------
alter table public.asis_portal_config
  add column if not exists oficina_lat numeric(9,6),
  add column if not exists oficina_lon numeric(9,6),
  add column if not exists radio_presencial_m integer not null default 1000;

alter table public.asis_portal_config
  drop constraint if exists asis_portal_config_oficina_lat_chk,
  drop constraint if exists asis_portal_config_oficina_lon_chk,
  drop constraint if exists asis_portal_config_radio_presencial_chk,
  drop constraint if exists asis_portal_config_oficina_par_chk;

alter table public.asis_portal_config
  add constraint asis_portal_config_oficina_lat_chk
    check (oficina_lat is null or oficina_lat between -90 and 90),
  add constraint asis_portal_config_oficina_lon_chk
    check (oficina_lon is null or oficina_lon between -180 and 180),
  add constraint asis_portal_config_radio_presencial_chk
    check (radio_presencial_m = 1000),
  add constraint asis_portal_config_oficina_par_chk
    check ((oficina_lat is null) = (oficina_lon is null));

alter table public.asis_registros
  add column if not exists modalidad_marcada text,
  add column if not exists distancia_oficina_m numeric(10,1),
  add column if not exists ubicacion_precision_m numeric(10,1);

alter table public.asis_registros
  drop constraint if exists asis_registros_modalidad_marcada_chk;
alter table public.asis_registros
  add constraint asis_registros_modalidad_marcada_chk
    check (modalidad_marcada is null or modalidad_marcada in ('virtual','presencial'));

create table if not exists public.asis_modalidades_diarias (
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  modalidad text not null check (modalidad in ('virtual','presencial')),
  modalidad_base text not null check (modalidad_base in ('virtual','presencial','opcional')),
  cambiado_por uuid references public.asis_perfiles(id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  primary key (colaborador_id,fecha)
);

create index if not exists asis_modalidades_diarias_fecha_idx
  on public.asis_modalidades_diarias(fecha,colaborador_id);

alter table public.asis_modalidades_diarias enable row level security;
revoke all on table public.asis_modalidades_diarias from public,anon,authenticated;

comment on table public.asis_modalidades_diarias is
  'Elección efectiva Virtual/Presencial del colaborador para una fecha, antes de marcar.';
comment on column public.asis_registros.distancia_oficina_m is
  'Distancia calculada por Supabase al punto oficial al confirmar un marcado presencial.';


-- 2) MODALIDAD EFECTIVA Y DISTANCIA ----------------------------------
create or replace function public.asis_modalidad_base(
  p_colab public.asis_colaboradores,
  p_fecha date)
returns text language plpgsql stable set search_path=public as $$
declare v_base text;
begin
  if not public.asis_labora(p_colab,p_fecha) then return 'no_gestiona'; end if;
  v_base := nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'mod','');
  if v_base='presencial' then return 'presencial'; end if;
  if v_base='opcional' then return 'opcional'; end if;
  return 'virtual';
end;
$$;

create or replace function public.asis_modalidad_dia(
  p_colab public.asis_colaboradores,
  p_fecha date)
returns text language plpgsql stable set search_path=public as $$
declare v_base text := public.asis_modalidad_base(p_colab,p_fecha); v_elegida text;
begin
  if v_base='no_gestiona' then return v_base; end if;
  select modalidad into v_elegida
    from public.asis_modalidades_diarias
   where colaborador_id=p_colab.id and fecha=p_fecha;
  return coalesce(v_elegida,case when v_base='presencial' then 'presencial' else 'virtual' end);
end;
$$;

create or replace function public.asis_distancia_m(
  p_lat_1 numeric,p_lon_1 numeric,p_lat_2 numeric,p_lon_2 numeric)
returns numeric language sql immutable strict set search_path=public as $$
  select round((6371000::double precision * acos(
    least(1::double precision,greatest(-1::double precision,
      sin(radians(p_lat_1::double precision))*sin(radians(p_lat_2::double precision)) +
      cos(radians(p_lat_1::double precision))*cos(radians(p_lat_2::double precision))*
      cos(radians(p_lon_2::double precision-p_lon_1::double precision))
    ))
  ))::numeric,1);
$$;

revoke all on function public.asis_modalidad_base(public.asis_colaboradores,date) from public,anon,authenticated;
revoke all on function public.asis_modalidad_dia(public.asis_colaboradores,date) from public,anon,authenticated;
revoke all on function public.asis_distancia_m(numeric,numeric,numeric,numeric) from public,anon,authenticated;


-- 3) RETRATO DEL DÍA -------------------------------------------------
create or replace function public.asis_mi_dia(
  p_colab public.asis_colaboradores,
  p_tol int)
returns jsonb language plpgsql stable set search_path=public as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg public.asis_registros;
  v_ini time := public.asis_hora_entrada(p_colab,v_hoy);
  v_fin time := public.asis_hora_salida(p_colab,v_hoy);
  v_vent text := public.asis_ventana(p_colab,v_hoy,v_ahora,p_tol);
  v_sol public.asis_solicitudes_horario;
  v_cfg public.asis_portal_config;
  v_base text := public.asis_modalidad_base(p_colab,v_hoy);
  v_modalidad text;
  v_completo boolean;
  v_elegida boolean;
begin
  v_completo := v_ini is not null and v_fin is not null and v_fin>v_ini;
  select * into v_reg from public.asis_registros
   where colaborador_id=p_colab.id and fecha=v_hoy;
  select * into v_sol from public.asis_solicitudes_horario
   where colaborador_id=p_colab.id and estado='pendiente' limit 1;
  select * into v_cfg from public.asis_portal_config where id=1;
  select exists(select 1 from public.asis_modalidades_diarias
    where colaborador_id=p_colab.id and fecha=v_hoy) into v_elegida;
  v_modalidad := coalesce(v_reg.modalidad_marcada,public.asis_modalidad_dia(p_colab,v_hoy));

  return jsonb_build_object(
    'id',p_colab.id,'nombre',p_colab.nombre,'fecha',v_hoy,'ahora',v_ahora,
    'labora',public.asis_labora(p_colab,v_hoy),
    'modalidad',v_modalidad,'modalidad_base',v_base,'modalidad_elegida',v_elegida,
    'hora_entrada',v_ini,'hora_salida',v_fin,'horario_completo',v_completo,
    'limite',case when v_ini is null then null else v_ini+make_interval(mins=>coalesce(p_tol,15)) end,
    'tolerancia',coalesce(p_tol,15),'ventana',v_vent,
    'puede_marcar',public.asis_labora(p_colab,v_hoy) and v_completo and v_vent in ('presente','tardanza'),
    'geocerca_configurada',v_cfg.oficina_lat is not null and v_cfg.oficina_lon is not null,
    'radio_presencial_m',coalesce(v_cfg.radio_presencial_m,1000),
    'marcado',v_reg.id is not null,'estado',v_reg.estado,'marcado_at',v_reg.marcado_at,
    'origen',v_reg.origen,'evidencia',coalesce(v_reg.evidencia_path,'')<>'',
    'distancia_oficina_m',v_reg.distancia_oficina_m,
    'aviso_horario',case when v_sol.id is null then null else jsonb_build_object(
      'texto',v_sol.horario_nuevo,'creado_at',v_sol.creado_at) end
  );
end;
$$;


-- 4) ELECCIÓN DE MODALIDAD ------------------------------------------
create or replace function public.dash_modalidad_hoy(
  p_protocolo integer,
  p_modalidad text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_protocolo constant integer := 20260902;
  v_id bigint := public.dash_colab();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_colab public.asis_colaboradores;
  v_cfg public.asis_portal_config;
  v_base text;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok',false,'motivo','version_antigua','protocolo',v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if p_modalidad is null or p_modalidad not in ('virtual','presencial') then
    return jsonb_build_object('ok',false,'motivo','modalidad_invalida');
  end if;
  perform pg_advisory_xact_lock(v_id);
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not public.asis_labora(v_colab,v_hoy) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  if exists(select 1 from public.asis_registros where colaborador_id=v_id and fecha=v_hoy) then
    return jsonb_build_object('ok',false,'motivo','modalidad_bloqueada');
  end if;
  v_base := public.asis_modalidad_base(v_colab,v_hoy);
  insert into public.asis_modalidades_diarias
    (colaborador_id,fecha,modalidad,modalidad_base,cambiado_por)
  values(v_id,v_hoy,p_modalidad,v_base,auth.uid())
  on conflict(colaborador_id,fecha) do update set
    modalidad=excluded.modalidad,
    cambiado_por=excluded.cambiado_por,
    actualizado_at=now();
  return jsonb_build_object('ok',true,'modalidad',p_modalidad,
    'dia',public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15)));
end;
$$;

revoke all on function public.dash_modalidad_hoy(integer,text) from public,anon;
grant execute on function public.dash_modalidad_hoy(integer,text) to authenticated;


-- 5) PREVALIDACIÓN CON GEOCERCA -------------------------------------
drop function if exists public.dash_protocolo_marcado(integer);

create or replace function public.dash_protocolo_marcado(
  p_protocolo integer,
  p_lat numeric default null,
  p_lon numeric default null,
  p_precision numeric default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_protocolo constant integer := 20260902;
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_dia jsonb;
  v_modalidad text;
  v_distancia numeric;
  v_motivo text;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok',false,'motivo','version_antigua','protocolo',v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  v_dia := public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15));
  v_modalidad := v_dia->>'modalidad';

  if v_modalidad='presencial' and p_lat is not null and p_lon is not null
     and p_lat between -90 and 90 and p_lon between -180 and 180
     and v_cfg.oficina_lat is not null and v_cfg.oficina_lon is not null then
    v_distancia := public.asis_distancia_m(p_lat,p_lon,v_cfg.oficina_lat,v_cfg.oficina_lon);
  end if;

  v_motivo := case
    when coalesce((v_dia->>'marcado')::boolean,false) then 'ya_marcado'
    when not coalesce((v_dia->>'labora')::boolean,false) then 'no_labora'
    when not coalesce((v_dia->>'horario_completo')::boolean,false) then 'horario_incompleto'
    when v_dia->>'ventana' not in ('presente','tardanza') then 'fuera_ventana'
    when v_modalidad='presencial' and (v_cfg.oficina_lat is null or v_cfg.oficina_lon is null) then 'oficina_no_configurada'
    when v_modalidad='presencial' and (p_lat is null or p_lon is null) then 'ubicacion_requerida'
    when v_modalidad='presencial' and (p_lat not between -90 and 90 or p_lon not between -180 and 180) then 'ubicacion_invalida'
    when v_modalidad='presencial' and (p_precision is null or p_precision<=0 or p_precision>500) then 'ubicacion_imprecisa'
    when v_modalidad='presencial' and v_distancia>v_cfg.radio_presencial_m then 'fuera_radio'
    else null end;

  return jsonb_build_object(
    'ok',true,'protocolo',v_protocolo,'evidencia_obligatoria',true,
    'puede_marcar',v_motivo is null,'motivo',v_motivo,'servidor_at',now(),
    'modalidad',v_modalidad,'distancia_m',v_distancia,
    'radio_presencial_m',coalesce(v_cfg.radio_presencial_m,1000),'dia',v_dia);
end;
$$;

revoke all on function public.dash_protocolo_marcado(integer,numeric,numeric,numeric) from public,anon;
grant execute on function public.dash_protocolo_marcado(integer,numeric,numeric,numeric) to authenticated;


-- 6) MARCADO AUTENTICADO: ÚNICA VÍA DE REGISTRO PERSONAL ------------
drop function if exists public.dash_marcar_seguro(integer,text,text,text,numeric,numeric);

create or replace function public.dash_marcar_seguro(
  p_protocolo integer,
  p_modalidad text,
  p_disp text,
  p_foto text,
  p_foto_org text,
  p_lat numeric,
  p_lon numeric,
  p_precision numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_protocolo constant integer := 20260902;
  v_id bigint := public.dash_colab();
  v_cfg public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_ini time; v_fin time; v_vent text; v_estado text; v_modalidad text;
  v_prefijo text; v_objeto boolean; v_distancia numeric; v_reg public.asis_registros;
begin
  if p_protocolo is distinct from v_protocolo then
    return jsonb_build_object('ok',false,'motivo','version_antigua','protocolo',v_protocolo);
  end if;
  if not public.dash_sesion_vigente() or v_id is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  perform pg_advisory_xact_lock(v_id);
  select * into v_colab from public.asis_colaboradores where id=v_id and activo;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if not public.asis_labora(v_colab,v_hoy) then return jsonb_build_object('ok',false,'motivo','no_labora'); end if;
  select * into v_reg from public.asis_registros where colaborador_id=v_id and fecha=v_hoy;
  if v_reg.id is not null then return jsonb_build_object('ok',false,'motivo','ya_marcado','estado',v_reg.estado,'marcado_at',v_reg.marcado_at); end if;

  v_ini:=public.asis_hora_entrada(v_colab,v_hoy);v_fin:=public.asis_hora_salida(v_colab,v_hoy);
  if v_ini is null or v_fin is null or v_fin<=v_ini then return jsonb_build_object('ok',false,'motivo','horario_incompleto'); end if;
  v_vent:=public.asis_ventana(v_colab,v_hoy,v_ahora,coalesce(v_cfg.tolerancia_min,15));
  if v_vent not in ('presente','tardanza') then return jsonb_build_object('ok',false,'motivo','fuera_ventana','ventana',v_vent); end if;

  v_modalidad:=public.asis_modalidad_dia(v_colab,v_hoy);
  if p_modalidad is null or p_modalidad not in ('virtual','presencial') or p_modalidad is distinct from v_modalidad then
    return jsonb_build_object('ok',false,'motivo','modalidad_cambio','modalidad',v_modalidad);
  end if;
  if v_modalidad='presencial' then
    if v_cfg.oficina_lat is null or v_cfg.oficina_lon is null then return jsonb_build_object('ok',false,'motivo','oficina_no_configurada'); end if;
    if p_lat is null or p_lon is null then return jsonb_build_object('ok',false,'motivo','ubicacion_requerida'); end if;
    if p_lat not between -90 and 90 or p_lon not between -180 and 180 then return jsonb_build_object('ok',false,'motivo','ubicacion_invalida'); end if;
    if p_precision is null or p_precision<=0 or p_precision>500 then return jsonb_build_object('ok',false,'motivo','ubicacion_imprecisa'); end if;
    v_distancia:=public.asis_distancia_m(p_lat,p_lon,v_cfg.oficina_lat,v_cfg.oficina_lon);
    if v_distancia>v_cfg.radio_presencial_m then
      return jsonb_build_object('ok',false,'motivo','fuera_radio','distancia_m',v_distancia,'radio_presencial_m',v_cfg.radio_presencial_m);
    end if;
  else
    p_lat:=null;p_lon:=null;p_precision:=null;
  end if;

  if coalesce(btrim(p_foto),'')='' then return jsonb_build_object('ok',false,'motivo','falta_evidencia'); end if;
  if p_foto_org is null or p_foto_org not in ('camara','archivo') then return jsonb_build_object('ok',false,'motivo','evidencia_invalida'); end if;
  v_prefijo:=to_char(v_hoy,'YYYY/MM')||'/'||v_id||'/'||to_char(v_hoy,'YYYY-MM-DD')||'.';
  if btrim(p_foto) not in (v_prefijo||'webp',v_prefijo||'jpg',v_prefijo||'jpeg') then return jsonb_build_object('ok',false,'motivo','evidencia_invalida'); end if;
  select exists(select 1 from storage.objects o where o.bucket_id='asis-evidencias' and o.name=btrim(p_foto)
    and coalesce(o.updated_at,o.created_at)>=now()-interval '30 minutes') into v_objeto;
  if not v_objeto then return jsonb_build_object('ok',false,'motivo','evidencia_no_verificada'); end if;

  v_estado:=case when v_vent='tardanza' then 'T' else 'P' end;
  insert into public.asis_registros
    (colaborador_id,fecha,estado,origen,dispositivo,marcado_por,horas,vinculo,
     evidencia_path,evidencia_origen,evidencia_lat,evidencia_lon,evidencia_at,
     modalidad_marcada,distancia_oficina_m,ubicacion_precision_m)
  values(v_id,v_hoy,v_estado,'dashboard',left(coalesce(p_disp,''),80),auth.uid(),
    public.asis_horas_dia(v_colab,v_hoy),public.asis_vinc_dia(v_colab,v_hoy),
    btrim(p_foto),p_foto_org,p_lat,p_lon,now(),v_modalidad,v_distancia,p_precision);

  return jsonb_build_object('ok',true,'protocolo',v_protocolo,'estado',v_estado,
    'hora',v_ahora,'modalidad',v_modalidad,'distancia_m',v_distancia,
    'dia',public.asis_mi_dia(v_colab,coalesce(v_cfg.tolerancia_min,15)));
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','ya_marcado');
end;
$$;

revoke all on function public.dash_marcar_seguro(integer,text,text,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.dash_marcar_seguro(integer,text,text,text,text,numeric,numeric,numeric) to authenticated;


-- 7) CONFIGURACIÓN EXCLUSIVA DE DIRECCIÓN ----------------------------
create or replace function public.dash_admin_geocerca()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_cfg public.asis_portal_config;
begin
  if public.asis_rol() is distinct from 'direccion' then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  select * into v_cfg from public.asis_portal_config where id=1;
  if v_cfg.id is null then return jsonb_build_object('ok',false,'motivo','sin_configuracion'); end if;
  return jsonb_build_object('ok',true,'config',jsonb_build_object(
    'oficina_lat',v_cfg.oficina_lat,'oficina_lon',v_cfg.oficina_lon,
    'radio_presencial_m',v_cfg.radio_presencial_m,
    'geocerca_configurada',v_cfg.oficina_lat is not null and v_cfg.oficina_lon is not null));
end;
$$;

create or replace function public.dash_admin_guardar_reglas(
  p_tolerancia integer,p_activo boolean,p_exigir_evidencia boolean,
  p_oficina_lat numeric,p_oficina_lon numeric,p_radio_presencial_m integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_antes public.asis_portal_config; v_despues public.asis_portal_config;
begin
  if public.asis_rol() is distinct from 'direccion' then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if p_tolerancia is null or p_tolerancia not between 0 and 120 or p_activo is null or p_exigir_evidencia is null
     or p_radio_presencial_m is distinct from 1000
     or ((p_oficina_lat is null)<>(p_oficina_lon is null))
     or (p_oficina_lat is not null and p_oficina_lat not between -90 and 90)
     or (p_oficina_lon is not null and p_oficina_lon not between -180 and 180) then
    return jsonb_build_object('ok',false,'motivo','configuracion');
  end if;
  select * into v_antes from public.asis_portal_config where id=1 for update;
  if v_antes.id is null then return jsonb_build_object('ok',false,'motivo','sin_configuracion'); end if;
  update public.asis_portal_config set tolerancia_min=p_tolerancia,activo=p_activo,
    exigir_evidencia=true,oficina_lat=p_oficina_lat,oficina_lon=p_oficina_lon,
    radio_presencial_m=1000,actualizado_at=now() where id=1 returning * into v_despues;
  insert into public.asis_admin_eventos(actor_id,accion,detalle) values(auth.uid(),'config_portal',jsonb_build_object(
    'antes',jsonb_build_object('tolerancia_min',v_antes.tolerancia_min,'activo',v_antes.activo,'oficina_configurada',v_antes.oficina_lat is not null),
    'despues',jsonb_build_object('tolerancia_min',v_despues.tolerancia_min,'activo',v_despues.activo,'oficina_configurada',v_despues.oficina_lat is not null,'radio_presencial_m',1000)));
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.dash_admin_geocerca() from public,anon;
revoke all on function public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer) from public,anon;
grant execute on function public.dash_admin_geocerca() to authenticated;
grant execute on function public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer) to authenticated;


-- 8) DETALLE HISTÓRICO ----------------------------------------------
create or replace function public.dash_dia_detalle(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_id bigint:=public.dash_colab();v_hoy date:=(now() at time zone 'America/Lima')::date;
  v_colab public.asis_colaboradores;v_reg public.asis_registros;v_sol public.asis_solicitudes_personales;
  v_lab boolean;v_modalidad text;v_evidencias jsonb:='[]'::jsonb;
begin
  if not public.dash_sesion_vigente() or v_id is null then return jsonb_build_object('ok',false,'motivo','sesion'); end if;
  if p_fecha is null or p_fecha<date '2020-01-01' or p_fecha>(date_trunc('month',v_hoy)+interval '1 month'-interval '1 day')::date then return jsonb_build_object('ok',false,'motivo','fecha'); end if;
  select * into v_colab from public.asis_colaboradores where id=v_id;
  if v_colab.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  select * into v_reg from public.asis_registros where colaborador_id=v_id and fecha=p_fecha;
  select * into v_sol from public.asis_solicitudes_personales where colaborador_id=v_id and p_fecha between fecha_inicio and fecha_fin
    order by case estado when 'pendiente' then 0 when 'aprobada' then 1 else 2 end,creado_at desc limit 1;
  v_lab:=public.asis_labora(v_colab,p_fecha);
  v_modalidad:=coalesce(v_reg.modalidad_marcada,public.asis_modalidad_dia(v_colab,p_fecha));
  if v_reg.evidencia_path is not null then v_evidencias:=v_evidencias||jsonb_build_array(jsonb_build_object(
    'bucket','asis-evidencias','path',v_reg.evidencia_path,'label','Evidencia de marcación','origen',v_reg.evidencia_origen)); end if;
  if v_sol.evidencia_path is not null then v_evidencias:=v_evidencias||jsonb_build_array(jsonb_build_object(
    'bucket','solicitud-evidencias','path',v_sol.evidencia_path,'label',case when v_sol.tipo='dia_libre' then 'Evidencia de día libre' else 'Evidencia de solicitud' end)); end if;
  return jsonb_build_object('ok',true,'fecha',p_fecha,'futuro',p_fecha>v_hoy,'labora',v_lab,'modalidad',v_modalidad,
    'hora_entrada',public.asis_hora_entrada(v_colab,p_fecha),'hora_salida',public.asis_hora_salida(v_colab,p_fecha),
    'estado',v_reg.estado,'marcado_at',v_reg.marcado_at,'origen',v_reg.origen,'dispositivo',v_reg.dispositivo,
    'evidencia_origen',v_reg.evidencia_origen,
    'ubicacion_verificada',v_reg.modalidad_marcada='presencial' and v_reg.distancia_oficina_m is not null,
    'distancia_oficina_m',v_reg.distancia_oficina_m,'ubicacion_precision_m',v_reg.ubicacion_precision_m,
    'horas',v_reg.horas,'vinculo',v_reg.vinculo,'nota',v_reg.nota,
    'solicitud',case when v_sol.id is null then null else jsonb_build_object('id',v_sol.id,'tipo',v_sol.tipo,'estado',v_sol.estado,
      'detalle',v_sol.detalle,'respuesta',v_sol.respuesta,'fecha_inicio',v_sol.fecha_inicio,'fecha_fin',v_sol.fecha_fin) end,
    'evidencias',v_evidencias);
end;
$$;

revoke all on function public.dash_dia_detalle(date) from public,anon;
grant execute on function public.dash_dia_detalle(date) to authenticated;


-- 9) UNA VERSIÓN ANTIGUA NO PUEDE OMITIR MODALIDAD O GEOCERCA -------
revoke execute on function public.asis_portal_marcar(text,bigint,text,text,text,text,numeric,numeric)
  from anon,authenticated;

commit;

-- Debe devolver seis filas OK. La geocerca puede figurar PENDIENTE hasta
-- que Dirección guarde el punto oficial desde el dashboard.
select estado,pieza,encontrado,esperado from (
  select case when to_regclass('public.asis_modalidades_diarias') is not null then 'OK' else 'FALTA' end,
    'modalidad diaria'::text,1,1
  union all select case when to_regprocedure('public.dash_modalidad_hoy(integer,text)') is not null then 'OK' else 'FALTA' end,'selector seguro',1,1
  union all select case when to_regprocedure('public.dash_protocolo_marcado(integer,numeric,numeric,numeric)') is not null then 'OK' else 'FALTA' end,'protocolo geocerca',1,1
  union all select case when to_regprocedure('public.dash_marcar_seguro(integer,text,text,text,text,numeric,numeric,numeric)') is not null then 'OK' else 'FALTA' end,'marcado seguro',1,1
  union all select case when to_regprocedure('public.dash_admin_guardar_reglas(integer,boolean,boolean,numeric,numeric,integer)') is not null then 'OK' else 'FALTA' end,'configuración Dirección',1,1
  union all select case when (select oficina_lat is not null and oficina_lon is not null from public.asis_portal_config where id=1) then 'OK' else 'PENDIENTE' end,'punto de oficina',1,1
) v(estado,pieza,encontrado,esperado);
