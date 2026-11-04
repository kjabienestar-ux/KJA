-- KJA-026/028. Aplicar DESPUES de dashboard_128_documento_contrato.sql.
-- Preparada y probada localmente; no aplicar sin revisar dependencias y respaldo.
-- No reescribe colaboradores, registros, horas, evidencias, metas ni saldos.
begin;

create table if not exists public.asis_jornadas_base (
  colaborador_id bigint primary key references public.asis_colaboradores(id) on delete cascade,
  ficha jsonb not null,
  creado_at timestamptz not null default now()
);
create table if not exists public.asis_jornadas_vigencias (
  id bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  tipo text not null check(tipo in ('principal','temporal')),
  desde date not null,
  hasta date,
  semana jsonb not null check(jsonb_typeof(semana)='object'),
  motivo text not null check(char_length(motivo) between 3 and 180),
  creado_por uuid references public.asis_perfiles(id),
  creado_at timestamptz not null default now(),
  check(hasta is null or hasta>=desde),
  check(tipo='principal' or hasta is not null),
  unique(colaborador_id,tipo,desde)
);
create index if not exists asis_jornadas_fecha_idx on public.asis_jornadas_vigencias(colaborador_id,tipo,desde desc);
alter table public.asis_jornadas_base enable row level security;
alter table public.asis_jornadas_vigencias enable row level security;
revoke all on public.asis_jornadas_base,public.asis_jornadas_vigencias from public,anon,authenticated;
revoke all on sequence public.asis_jornadas_vigencias_id_seq from public,anon,authenticated;

-- Proyecta SOLO la configuración semanal a una fecha. La ficha original permanece intacta.
-- El snapshot se crea al primer cambio, no inventa las vigencias previas a esta función.
create or replace function public.asis_jornada_ficha(p_colab public.asis_colaboradores,p_fecha date)
returns public.asis_colaboradores language plpgsql stable security definer set search_path=public as $$
declare v public.asis_colaboradores:=p_colab; b jsonb; j public.asis_jornadas_vigencias; s jsonb;
begin
  select ficha into b from public.asis_jornadas_base where colaborador_id=p_colab.id;
  if b is null then return v; end if;
  v:=jsonb_populate_record(v,b);
  select * into j from public.asis_jornadas_vigencias
    where colaborador_id=v.id and tipo='temporal' and p_fecha>=desde and p_fecha<=hasta;
  if j.id is null then
    select * into j from public.asis_jornadas_vigencias
      where colaborador_id=v.id and tipo='principal' and desde<=p_fecha order by desde desc limit 1;
  end if;
  if j.id is null then return v; end if;
  s:=case when j.hasta is not null and p_fecha>j.hasta then '{}'::jsonb else j.semana end;
  -- Completar los 7 días: ausencia de una clave significa sin gestión, nunca horario general.
  select jsonb_object_agg(d::text,coalesce(s->d::text,jsonb_build_object('mod','no_gestiona')))
    into v.horario_semanal from generate_series(1,7) d;
  select coalesce(array_agg(d order by d),'{}'::integer[]) into v.dias_laborables
    from generate_series(1,7) d where v.horario_semanal->d::text->>'mod'<>'no_gestiona';
  return v;
end $$;
revoke all on function public.asis_jornada_ficha(public.asis_colaboradores,date) from public,anon,authenticated;

create or replace function public.asis_jornada_finalizada(p_colab bigint,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select hasta is not null and p_fecha>hasta from public.asis_jornadas_vigencias
    where colaborador_id=p_colab and tipo='principal' and desde<=p_fecha order by desde desc limit 1),false)
  and not exists(select 1 from public.asis_jornadas_vigencias where colaborador_id=p_colab and tipo='temporal'
    and p_fecha between desde and hasta)
$$;
revoke all on function public.asis_jornada_finalizada(bigint,date) from public,anon,authenticated;

create or replace function public.dash_admin_guardar_jornada(
  p_colab bigint,p_tipo text,p_desde date,p_hasta date,p_semana jsonb,p_motivo text,p_version bigint default 0
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.asis_colaboradores; v_id bigint; version bigint; d integer; item jsonb; s jsonb:='{}';
  ini time; fin time; v_mod text; v_vinc text; activos integer:=0;
  hoy date:=(now() at time zone 'America/Lima')::date;
begin
  if not public.dash_sesion_vigente() or not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if p_tipo is null or p_tipo not in ('principal','temporal') then return jsonb_build_object('ok',false,'motivo','tipo'); end if;
  if p_desde is null or p_desde<=hoy or p_desde>hoy+3660
    or (p_hasta is not null and (p_hasta<p_desde or p_hasta>p_desde+3660))
    or (p_tipo='temporal' and (p_hasta is null or p_hasta>p_desde+365)) then
    return jsonb_build_object('ok',false,'motivo','fechas'); end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 180 then
    return jsonb_build_object('ok',false,'motivo','motivo'); end if;
  if p_semana is null or jsonb_typeof(p_semana)<>'object' or exists(
    select 1 from jsonb_object_keys(p_semana) k where k !~ '^[1-7]$') then
    return jsonb_build_object('ok',false,'motivo','horario'); end if;
  select * into c from public.asis_colaboradores where id=p_colab and activo for update;
  if c.id is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  perform pg_advisory_xact_lock(p_colab);
  select coalesce(max(id),0) into version from public.asis_jornadas_vigencias where colaborador_id=p_colab;
  if p_version is distinct from version then return jsonb_build_object('ok',false,'motivo','desactualizado'); end if;
  if c.contrato_inicio is not null and p_desde<c.contrato_inicio then return jsonb_build_object('ok',false,'motivo','antes_contrato'); end if;
  for d in 1..7 loop
    item:=coalesce(p_semana->d::text,'{}');
    if jsonb_typeof(item)<>'object' then return jsonb_build_object('ok',false,'motivo','horario'); end if;
    v_mod:=coalesce(item->>'mod','no_gestiona');
    if v_mod not in ('virtual','presencial','opcional','no_gestiona') then return jsonb_build_object('ok',false,'motivo','horario'); end if;
    if v_mod='no_gestiona' then s:=s||jsonb_build_object(d::text,jsonb_build_object('mod',v_mod)); continue; end if;
    if coalesce(item->>'ini','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(item->>'fin','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return jsonb_build_object('ok',false,'motivo','horario'); end if;
    ini:=(item->>'ini')::time; fin:=(item->>'fin')::time;
    if fin<=ini then return jsonb_build_object('ok',false,'motivo','horario'); end if;
    v_vinc:=case when c.tipo_vinculo='ambos' then coalesce(item->>'vinc','practicas') else c.tipo_vinculo end;
    if v_vinc not in ('practicas','voluntariado') then return jsonb_build_object('ok',false,'motivo','vinculo'); end if;
    s:=s||jsonb_build_object(d::text,jsonb_build_object('mod',v_mod,'ini',to_char(ini,'HH24:MI'),'fin',to_char(fin,'HH24:MI'),'vinc',v_vinc));
    activos:=activos+1;
  end loop;
  if activos=0 then return jsonb_build_object('ok',false,'motivo','sin_dias'); end if;
  -- No retocar jornadas con marcas, ni reemplazar acuerdos puntuales hechos por SQL.
  if exists(select 1 from public.asis_registros where colaborador_id=p_colab and fecha>=p_desde and (p_tipo='principal' or fecha<=p_hasta)) then
    return jsonb_build_object('ok',false,'motivo','registros_existentes'); end if;
  if exists(select 1 from public.asis_horarios_puntuales where colaborador_id=p_colab and fecha>=p_desde and (p_tipo='principal' or fecha<=p_hasta)) then
    return jsonb_build_object('ok',false,'motivo','ajuste_puntual'); end if;
  if p_tipo='principal' and p_hasta is not null and exists(select 1 from public.asis_excepciones
    where colaborador_id=p_colab and ambito='colaborador' and tipo='laborable_extra' and fecha>p_hasta) then
    return jsonb_build_object('ok',false,'motivo','ajuste_puntual'); end if;
  if p_tipo='principal' then
    if p_hasta is not null and exists(select 1 from public.asis_jornadas_vigencias
      where colaborador_id=p_colab and tipo='temporal' and hasta>p_hasta and hasta>=p_desde) then
      return jsonb_build_object('ok',false,'motivo','temporal_fuera_contrato'); end if;
    if exists(select 1 from public.asis_jornadas_vigencias where colaborador_id=p_colab and tipo='principal' and desde>=p_desde) then
      return jsonb_build_object('ok',false,'motivo','conflicto'); end if;
  else
    if exists(select 1 from public.asis_jornadas_vigencias where colaborador_id=p_colab and tipo='temporal'
      and desde<=p_hasta and hasta>=p_desde) then return jsonb_build_object('ok',false,'motivo','conflicto'); end if;
    if exists(select 1 from generate_series(p_desde,p_hasta,interval '1 day') f
      where public.asis_jornada_finalizada(p_colab,f::date)) then return jsonb_build_object('ok',false,'motivo','principal_finalizada'); end if;
  end if;
  insert into public.asis_jornadas_base(colaborador_id,ficha)
    values(p_colab,jsonb_build_object('horario_semanal',c.horario_semanal,'dias_laborables',c.dias_laborables,
      'hora_inicio',c.hora_inicio,'hora_fin',c.hora_fin,'tipo_vinculo',c.tipo_vinculo,'contrato_inicio',c.contrato_inicio))
    on conflict(colaborador_id) do nothing;
  if p_tipo='principal' then
    -- Solo acotar la parte futura del principal precedente. No modificar su pasado.
    update public.asis_jornadas_vigencias set hasta=p_desde-1 where colaborador_id=p_colab and tipo='principal'
      and desde<p_desde and (hasta is null or hasta>=p_desde);
  end if;
  insert into public.asis_jornadas_vigencias(colaborador_id,tipo,desde,hasta,semana,motivo,creado_por)
    values(p_colab,p_tipo,p_desde,p_hasta,s,btrim(p_motivo),auth.uid()) returning id into v_id;
  insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(p_colab,'horario',jsonb_build_object('version',version),
      jsonb_build_object('vigencia_id',v_id,'tipo',p_tipo,'desde',p_desde,'hasta',p_hasta,'semana',s),btrim(p_motivo),auth.uid());
  return jsonb_build_object('ok',true,'id',v_id,'version',v_id);
end $$;
revoke all on function public.dash_admin_guardar_jornada(bigint,text,date,date,jsonb,text,bigint) from public,anon;
grant execute on function public.dash_admin_guardar_jornada(bigint,text,date,date,jsonb,text,bigint) to authenticated;

-- El formulario anterior sigue editando identidad/metas, pero no puede sobrescribir horarios históricos.
create or replace function public.asis_proteger_jornada()
returns trigger language plpgsql security definer set search_path=public as $$
declare d integer; a jsonb; b jsonb; ma text; mb text;
begin
  if (new.horario_semanal,new.dias_laborables,new.hora_inicio,new.hora_fin,new.tipo_vinculo,new.contrato_inicio)
    is distinct from (old.horario_semanal,old.dias_laborables,old.hora_inicio,old.hora_fin,old.tipo_vinculo,old.contrato_inicio) then
    if (new.tipo_vinculo,new.contrato_inicio) is distinct from (old.tipo_vinculo,old.contrato_inicio) then
      raise exception using errcode='P0001',message='jornada_requiere_vigencia'; end if;
    for d in 1..7 loop
      a:=coalesce(old.horario_semanal->d::text,'{}'); b:=coalesce(new.horario_semanal->d::text,'{}');
      ma:=coalesce(a->>'mod',case when d=any(old.dias_laborables) then 'virtual' else 'no_gestiona' end);
      mb:=coalesce(b->>'mod',case when d=any(new.dias_laborables) then 'virtual' else 'no_gestiona' end);
      if ma is distinct from mb or (ma<>'no_gestiona' and (
        coalesce(nullif(a->>'ini','')::time,old.hora_inicio),coalesce(nullif(a->>'fin','')::time,old.hora_fin),coalesce(a->>'vinc','practicas'))
        is distinct from (coalesce(nullif(b->>'ini','')::time,new.hora_inicio),coalesce(nullif(b->>'fin','')::time,new.hora_fin),coalesce(b->>'vinc','practicas'))) then
        raise exception using errcode='P0001',message='jornada_requiere_vigencia'; end if;
    end loop;
    -- El guardado anterior normaliza horas y claves. Si no cambia el horario efectivo,
    -- conservar su representación exacta para no registrar una falsa modificación.
    new.horario_semanal:=old.horario_semanal;new.dias_laborables:=old.dias_laborables;
    new.hora_inicio:=old.hora_inicio;new.hora_fin:=old.hora_fin;
  end if;
  return new;
end $$;
revoke all on function public.asis_proteger_jornada() from public,anon,authenticated;
drop trigger if exists asis_proteger_jornada on public.asis_colaboradores;
create trigger asis_proteger_jornada before update on public.asis_colaboradores
  for each row execute function public.asis_proteger_jornada();

-- Adaptadores de lectura, definidos a continuación: mantienen las excepciones heredadas.

do $$ begin
  if to_regprocedure('public.asis_labora_base_132(public.asis_colaboradores,date)') is null then
    alter function public.asis_labora(public.asis_colaboradores,date) rename to asis_labora_base_132;
  end if;
end $$;
revoke all on function public.asis_labora_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.asis_labora(p_colab public.asis_colaboradores,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select not public.asis_jornada_finalizada(p_colab.id,p_fecha) and public.asis_labora_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.asis_labora(public.asis_colaboradores,date) from public,anon,authenticated;
grant execute on function public.asis_labora(public.asis_colaboradores,date) to authenticated;

do $$ begin
  if to_regprocedure('public.asis_hora_entrada_base_132(public.asis_colaboradores,date)') is null then
    alter function public.asis_hora_entrada(public.asis_colaboradores,date) rename to asis_hora_entrada_base_132;
  end if;
end $$;
revoke all on function public.asis_hora_entrada_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.asis_hora_entrada(p_colab public.asis_colaboradores,p_fecha date)
returns time language sql stable security definer set search_path=public as $$
  select public.asis_hora_entrada_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.asis_hora_entrada(public.asis_colaboradores,date) from public,anon,authenticated;
grant execute on function public.asis_hora_entrada(public.asis_colaboradores,date) to authenticated;

do $$ begin
  if to_regprocedure('public.asis_hora_salida_base_132(public.asis_colaboradores,date)') is null then
    alter function public.asis_hora_salida(public.asis_colaboradores,date) rename to asis_hora_salida_base_132;
  end if;
end $$;
revoke all on function public.asis_hora_salida_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.asis_hora_salida(p_colab public.asis_colaboradores,p_fecha date)
returns time language sql stable security definer set search_path=public as $$
  select public.asis_hora_salida_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.asis_hora_salida(public.asis_colaboradores,date) from public,anon,authenticated;
grant execute on function public.asis_hora_salida(public.asis_colaboradores,date) to authenticated;

do $$ begin
  if to_regprocedure('public.asis_modalidad_base_base_132(public.asis_colaboradores,date)') is null then
    alter function public.asis_modalidad_base(public.asis_colaboradores,date) rename to asis_modalidad_base_base_132;
  end if;
end $$;
revoke all on function public.asis_modalidad_base_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.asis_modalidad_base(p_colab public.asis_colaboradores,p_fecha date)
returns text language sql stable security definer set search_path=public as $$
  select public.asis_modalidad_base_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.asis_modalidad_base(public.asis_colaboradores,date) from public,anon,authenticated;
grant execute on function public.asis_modalidad_base(public.asis_colaboradores,date) to authenticated;

do $$ begin
  if to_regprocedure('public.asis_vinc_dia_base_132(public.asis_colaboradores,date)') is null then
    alter function public.asis_vinc_dia(public.asis_colaboradores,date) rename to asis_vinc_dia_base_132;
  end if;
end $$;
revoke all on function public.asis_vinc_dia_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.asis_vinc_dia(p_colab public.asis_colaboradores,p_fecha date)
returns text language sql stable security definer set search_path=public as $$
  select public.asis_vinc_dia_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.asis_vinc_dia(public.asis_colaboradores,date) from public,anon,authenticated;
grant execute on function public.asis_vinc_dia(public.asis_colaboradores,date) to authenticated;

do $$ begin
  if to_regprocedure('public.dash_admin_horas_programadas_dia_base_132(public.asis_colaboradores,date)') is null then
    alter function public.dash_admin_horas_programadas_dia(public.asis_colaboradores,date) rename to dash_admin_horas_programadas_dia_base_132;
  end if;
end $$;
revoke all on function public.dash_admin_horas_programadas_dia_base_132(public.asis_colaboradores,date) from public,anon,authenticated;
create or replace function public.dash_admin_horas_programadas_dia(p_colab public.asis_colaboradores,p_fecha date)
returns numeric language sql stable security definer set search_path=public as $$
  select public.dash_admin_horas_programadas_dia_base_132(public.asis_jornada_ficha(p_colab,p_fecha),p_fecha)
$$;
revoke all on function public.dash_admin_horas_programadas_dia(public.asis_colaboradores,date) from public,anon,authenticated;

do $$ begin
 if to_regprocedure('public.dash_admin_horas_semana_base_132(public.asis_colaboradores,text)') is null then
   alter function public.dash_admin_horas_semana(public.asis_colaboradores,text) rename to dash_admin_horas_semana_base_132;
 end if;
end $$;
revoke all on function public.dash_admin_horas_semana_base_132(public.asis_colaboradores,text) from public,anon,authenticated;
create or replace function public.dash_admin_horas_semana(p_colab public.asis_colaboradores,p_vinculo text default null)
returns numeric language sql stable security definer set search_path=public as $$
 select public.dash_admin_horas_semana_base_132(public.asis_jornada_ficha(p_colab,(now() at time zone 'America/Lima')::date),p_vinculo)
$$;
revoke all on function public.dash_admin_horas_semana(public.asis_colaboradores,text) from public,anon,authenticated;

-- Base mensual de fase 4: la cadena 72/88/107 sigue aportando datos y permisos.
create or replace function public.dash_admin_mes_base_72(
  p_anio integer,
  p_mes integer,
  p_incluir_inactivos boolean default false
)
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
  v_resultado jsonb;
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_anio is null or p_anio not between 2020 and 2100
     or p_mes is null or p_mes not between 1 and 12 then
    return jsonb_build_object('ok',false,'motivo','periodo');
  end if;

  v_inicio := make_date(p_anio,p_mes,1);
  v_fin := (v_inicio + interval '1 month - 1 day')::date;

  with
  fechas as (
    select d::date fecha
    from generate_series(v_inicio,v_fin,interval '1 day') d
  ),
  colaboradores as (
    select c.*,a.nombre area,a.orden area_orden
    from public.asis_colaboradores c
    join public.asis_areas a on a.id=c.area_id
    where p_incluir_inactivos or c.activo
  ),
  base as (
    select
      c.id,c.nombre,c.area_id,c.area,c.area_orden,c.orden,c.activo,
      c.contrato_inicio,f.fecha,
      exists(select 1 from public.asis_jornadas_vigencias j where j.colaborador_id=c.id and j.desde<=f.fecha) jornada_aplica,
      public.asis_labora(jsonb_populate_record(null::public.asis_colaboradores,to_jsonb(c)),f.fecha) jornada_laborable,
      coalesce(
        nullif((public.asis_jornada_ficha(jsonb_populate_record(null::public.asis_colaboradores,to_jsonb(c)),f.fecha)).horario_semanal -> extract(isodow from f.fecha)::text ->> 'mod',''),
        case when extract(isodow from f.fecha)::integer=any((public.asis_jornada_ficha(jsonb_populate_record(null::public.asis_colaboradores,to_jsonb(c)),f.fecha)).dias_laborables)
             then 'virtual' else 'no_gestiona' end
      ) base_modalidad,
      px.tipo excepcion_tipo,px.nota excepcion_nota,
      ex.id feriado_id,ex.nota feriado_nota,
      r.estado,r.nota registro_nota,r.marcado_at,r.origen,r.horas,
      r.evidencia_path
    from colaboradores c
    cross join fechas f
    left join public.asis_registros r
      on r.colaborador_id=c.id and r.fecha=f.fecha
    left join lateral (
      select e.tipo,e.nota
      from public.asis_excepciones e
      where e.fecha=f.fecha and e.ambito='colaborador'
        and e.colaborador_id=c.id
      order by e.id desc limit 1
    ) px on true
    left join lateral (
      select e.id,e.nota
      from public.asis_excepciones e
      where e.fecha=f.fecha and e.ambito='empresa'
      order by e.id desc limit 1
    ) ex on true
  ),
  celdas as (
    select b.*,
      case
        when b.jornada_aplica then b.jornada_laborable
        when b.contrato_inicio is not null and b.fecha<b.contrato_inicio then false
        when b.excepcion_tipo='laborable_extra' then true
        when b.feriado_id is not null then false
        when b.excepcion_tipo='no_laborable' then false
        else b.base_modalidad<>'no_gestiona'
      end laborable,
      case
        when b.contrato_inicio is not null and b.fecha<b.contrato_inicio then 'preinicio'
        when b.excepcion_tipo='laborable_extra' then 'extra'
        when b.feriado_id is not null then 'feriado'
        when b.excepcion_tipo='no_laborable' then 'permiso'
        else 'horario'
      end motivo,
      case when b.excepcion_tipo='laborable_extra' and b.base_modalidad='no_gestiona'
           then 'presencial' else b.base_modalidad end modalidad
    from base b
  ),
  personas as (
    select
      c.id,c.nombre,c.area_id,c.area,c.area_orden,c.orden,c.activo,
      jsonb_agg(jsonb_build_object(
        'fecha',c.fecha,
        'laborable',c.laborable,
        'motivo',c.motivo,
        'modalidad',c.modalidad,
        'estado',c.estado,
        'nota',c.registro_nota,
        'marcado_at',c.marcado_at,
        'origen',c.origen,
        'horas',c.horas,
        'evidencia',c.evidencia_path is not null,
        'evidencia_path',c.evidencia_path,
        'excepcion_tipo',c.excepcion_tipo,
        'excepcion_nota',c.excepcion_nota,
        'feriado_nota',c.feriado_nota,
        'futura',c.fecha>v_hoy
      ) order by c.fecha) dias,
      count(*) filter(where c.laborable) programados,
      count(*) filter(where c.laborable and c.fecha<=v_hoy) programados_transcurridos,
      count(*) filter(where c.laborable and c.estado='P') presentes,
      count(*) filter(where c.laborable and c.estado='T') tardanzas,
      count(*) filter(where c.laborable and c.estado='J') justificados,
      count(*) filter(where c.laborable and c.estado='NG') no_gestiona,
      count(*) filter(where c.laborable and c.fecha<=v_hoy and c.estado is null) pendientes,
      coalesce(sum(c.horas) filter(where c.laborable and c.estado in ('P','T','J')),0) horas
    from celdas c
    group by c.id,c.nombre,c.area_id,c.area,c.area_orden,c.orden,c.activo
  ),
  feriados as (
    select distinct on (e.fecha) e.fecha,e.nota
    from public.asis_excepciones e
    where e.ambito='empresa' and e.fecha between v_inicio and v_fin
    order by e.fecha,e.id desc
  )
  select jsonb_build_object(
    'ok',true,
    'anio',p_anio,
    'mes',p_mes,
    'inicio',v_inicio,
    'fin',v_fin,
    'hoy',v_hoy,
    'rol',public.asis_rol(),
    'puede_editar',public.asis_puede_editar(),
    'areas',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'nombre',a.nombre,'orden',a.orden,'activo',a.activo
      ) order by a.orden,a.nombre)
      from public.asis_areas a
    ),'[]'::jsonb),
    'feriados',coalesce((
      select jsonb_agg(jsonb_build_object('fecha',f.fecha,'nota',f.nota)
                       order by f.fecha) from feriados f
    ),'[]'::jsonb),
    'personas',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'nombre',p.nombre,'area_id',p.area_id,'area',p.area,
        'activo',p.activo,'dias',p.dias,
        'resumen',jsonb_build_object(
          'P',p.presentes,'T',p.tardanzas,'J',p.justificados,'NG',p.no_gestiona,
          'programados',p.programados,
          'programados_transcurridos',p.programados_transcurridos,
          'pendientes',p.pendientes,
          'horas',p.horas,
          'porcentaje',case when p.presentes+p.tardanzas+p.justificados>0
            then round((p.presentes+p.tardanzas)::numeric*100/
                       (p.presentes+p.tardanzas+p.justificados)) else null end
        )
      ) order by p.area_orden,p.orden,p.nombre)
      from personas p
    ),'[]'::jsonb),
    'resumen',(
      select jsonb_build_object(
        'personas',count(distinct c.id),
        'programados',count(*) filter(where c.laborable),
        'programados_transcurridos',count(*) filter(where c.laborable and c.fecha<=v_hoy),
        'P',count(*) filter(where c.laborable and c.estado='P'),
        'T',count(*) filter(where c.laborable and c.estado='T'),
        'J',count(*) filter(where c.laborable and c.estado='J'),
        'NG',count(*) filter(where c.laborable and c.estado='NG'),
        'pendientes',count(*) filter(where c.laborable and c.fecha<=v_hoy and c.estado is null),
        'horas',coalesce(sum(c.horas) filter(where c.laborable and c.estado in ('P','T','J')),0)
      ) from celdas c
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function public.dash_admin_mes_base_72(integer,integer,boolean) from public,anon,authenticated;

-- Directorio: capacidad y datos fechados en la misma consulta autorizada.
do $$ begin
 if to_regprocedure('public.dash_admin_equipo_base_132(boolean)') is null then
   alter function public.dash_admin_equipo(boolean) rename to dash_admin_equipo_base_132;
 end if;
end $$;
revoke all on function public.dash_admin_equipo_base_132(boolean) from public,anon,authenticated;
create or replace function public.dash_admin_equipo(p_incluir_inactivos boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare data jsonb; people jsonb; hoy date:=(now() at time zone 'America/Lima')::date;
begin
 data:=public.dash_admin_equipo_base_132(p_incluir_inactivos);
 if not coalesce((data->>'ok')::boolean,false) then return data; end if;
 select coalesce(jsonb_agg(p.item||jsonb_build_object(
   'horario_vigente',(public.asis_jornada_ficha(c,hoy)).horario_semanal,
   'jornada_finalizada',public.asis_jornada_finalizada(c.id,hoy),
   'jornadas',coalesce((select jsonb_agg(to_jsonb(j) order by j.desde,j.id) from public.asis_jornadas_vigencias j where j.colaborador_id=c.id),'[]'::jsonb),
   'jornadas_version',coalesce((select max(id) from public.asis_jornadas_vigencias where colaborador_id=c.id),0)
 ) order by p.ord),'[]'::jsonb) into people
 from jsonb_array_elements(data->'personas') with ordinality p(item,ord)
 join public.asis_colaboradores c on c.id=(p.item->>'id')::bigint;
 return data||jsonb_build_object('hoy',hoy,'jornadas_disponibles',true,'personas',people);
end $$;
revoke all on function public.dash_admin_equipo(boolean) from public,anon;
grant execute on function public.dash_admin_equipo(boolean) to authenticated;


-- Comparticiones heredadas: conservar su agenda original, independientemente de las nuevas jornadas.
create or replace function public.asis_compartir_programado_base_87(p_colab bigint,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select case
    when not coalesce((select c.comparticiones_horario_configurado
                         from public.asis_colaboradores c where c.id=p_colab),false)
      then coalesce((select public.asis_labora_base_132(c,p_fecha)
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
    v_hora:=public.asis_hora_entrada_base_132(v_colab,p_fecha);
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
    v_hora:=public.asis_hora_salida_base_132(v_colab,p_fecha);
  end if;
  v_fin:=(p_fecha+v_hora) at time zone 'America/Lima';
  if v_fin<=v_inicio then v_fin:=v_fin+interval '1 day'; end if;
  return v_fin;
end $$;
revoke all on function public.asis_compartir_programado_base_87(bigint,date) from public,anon,authenticated;


-- Inicio personal: mostrar la semana vigente y distinguir una excepción temporal.
do $$ begin
 if to_regprocedure('public.dash_inicio_base_132(bigint)') is null then
   alter function public.dash_inicio(bigint) rename to dash_inicio_base_132;
 end if;
end $$;
revoke all on function public.dash_inicio_base_132(bigint) from public,anon,authenticated;
create or replace function public.dash_inicio(p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare data jsonb; c public.asis_colaboradores; v public.asis_colaboradores; j public.asis_jornadas_vigencias;
 hoy date:=(now() at time zone 'America/Lima')::date;
begin
 data:=public.dash_inicio_base_132(p_colab);
 if not coalesce((data->>'ok')::boolean,false) or data->'colaborador' is null or data->'colaborador'='null'::jsonb then return data; end if;
 select * into c from public.asis_colaboradores where id=(data->'colaborador'->>'id')::bigint;
 v:=public.asis_jornada_ficha(c,hoy);
 select * into j from public.asis_jornadas_vigencias where colaborador_id=c.id and desde<=hoy
   and (tipo='principal' or hasta>=hoy) order by (tipo='temporal') desc,desde desc limit 1;
 return jsonb_set(data,'{colaborador}',data->'colaborador'||jsonb_build_object(
   'horario_semanal',v.horario_semanal,'dias_laborables',v.dias_laborables,
   'jornada_vigencia',case when j.id is null then null else jsonb_build_object('tipo',j.tipo,'desde',j.desde,'hasta',j.hasta,
     'finalizada',public.asis_jornada_finalizada(c.id,hoy)) end));
end $$;
revoke all on function public.dash_inicio(bigint) from public,anon;
grant execute on function public.dash_inicio(bigint) to authenticated;


-- Calendario de compañeros: conservar alcance del RPC y devolver solo horarios, sin motivos ni actores.
do $$ begin
 if to_regprocedure('public.dash_horarios_companeros_base_132()') is null then
   alter function public.dash_horarios_companeros() rename to dash_horarios_companeros_base_132;
 end if;
end $$;
revoke all on function public.dash_horarios_companeros_base_132() from public,anon,authenticated;
create or replace function public.dash_horarios_companeros()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare data jsonb; people jsonb; hoy date:=(now() at time zone 'America/Lima')::date;
begin
 data:=public.dash_horarios_companeros_base_132();
 if not coalesce((data->>'ok')::boolean,false) then return data; end if;
 select coalesce(jsonb_agg(p.item||jsonb_build_object(
   'horario_vigente',(public.asis_jornada_ficha(c,hoy)).horario_semanal,
   'jornadas',coalesce((select jsonb_agg(jsonb_build_object('tipo',j.tipo,'desde',j.desde,'hasta',j.hasta,'semana',j.semana) order by j.desde,j.id)
     from public.asis_jornadas_vigencias j where j.colaborador_id=c.id),'[]'::jsonb)
 ) order by p.ord),'[]'::jsonb) into people
 from jsonb_array_elements(data->'personas') with ordinality p(item,ord)
 join public.asis_colaboradores c on c.id=(p.item->>'id')::bigint;
 return data||jsonb_build_object('personas',people);
end $$;
revoke all on function public.dash_horarios_companeros() from public,anon;
grant execute on function public.dash_horarios_companeros() to authenticated;


-- Historial personal: marcar qué fechas ya resuelve el modelo de vigencias.
-- Un fin documental referencial no recorta una jornada nueva de fin indeterminado.
do $$ begin
 if to_regprocedure('public.dash_historial_base_132(integer,integer,bigint)') is null then
   alter function public.dash_historial(integer,integer,bigint) rename to dash_historial_base_132;
 end if;
end $$;
revoke all on function public.dash_historial_base_132(integer,integer,bigint) from public,anon,authenticated;
create or replace function public.dash_historial(p_anio integer,p_mes integer,p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare data jsonb; days jsonb; first_date date;
begin
 data:=public.dash_historial_base_132(p_anio,p_mes,p_colab);
 if not coalesce((data->>'ok')::boolean,false) then return data; end if;
 select min(desde) into first_date from public.asis_jornadas_vigencias where colaborador_id=coalesce(p_colab,public.dash_colab());
 if first_date is null then return data; end if;
 select coalesce(jsonb_agg(d.item||jsonb_build_object('jornada_versionada',(d.item->>'fecha')::date>=first_date) order by d.ord),'[]'::jsonb)
   into days from jsonb_array_elements(data->'dias') with ordinality d(item,ord);
 return data||jsonb_build_object('dias',days);
end $$;
revoke all on function public.dash_historial(integer,integer,bigint) from public,anon;
grant execute on function public.dash_historial(integer,integer,bigint) to authenticated;


-- Mi equipo: el horario que acompaña el cierre debe ser el de esa fecha, no la ficha histórica.
do $$ begin
 if to_regprocedure('public.dash_equipo_cierres_hoy_base_132()') is null then
   alter function public.dash_equipo_cierres_hoy() rename to dash_equipo_cierres_hoy_base_132;
 end if;
end $$;
revoke all on function public.dash_equipo_cierres_hoy_base_132() from public,anon,authenticated;
create or replace function public.dash_equipo_cierres_hoy()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare data jsonb; people jsonb; day date;
begin
 data:=public.dash_equipo_cierres_hoy_base_132();
 if not coalesce((data->>'ok')::boolean,false) then return data; end if;
 day:=coalesce((data->>'fecha')::date,(now() at time zone 'America/Lima')::date);
 select coalesce(jsonb_agg(p.item||jsonb_build_object(
   'horario_semanal',(public.asis_jornada_ficha(c,day)).horario_semanal,
   'dias_laborables',(public.asis_jornada_ficha(c,day)).dias_laborables
 ) order by p.ord),'[]'::jsonb) into people
 from jsonb_array_elements(data->'personas') with ordinality p(item,ord)
 join public.asis_colaboradores c on c.id=(p.item->>'id')::bigint;
 return data||jsonb_build_object('personas',people);
end $$;
revoke all on function public.dash_equipo_cierres_hoy() from public,anon;
grant execute on function public.dash_equipo_cierres_hoy() to authenticated;

notify pgrst,'reload schema';
commit;
