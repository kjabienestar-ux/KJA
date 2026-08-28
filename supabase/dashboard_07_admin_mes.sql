-- =====================================================================
-- KJA · Dashboard — Fase 4: Mes completo y resumen mensual
--
-- REQUIERE
--   · migraciones de asistencia 1–14
--   · dashboard_01, dashboard_03, dashboard_04, dashboard_05 y dashboard_06
--
-- AÑADE
--   · una lectura mensual consolidada en una sola RPC;
--   · gestión controlada de feriados de empresa;
--   · gestión controlada de excepciones personales;
--   · índices de apoyo para el crecimiento del historial.
--
-- NO MODIFICA FILAS EXISTENTES al ejecutar esta migración. Las funciones de
-- escritura solo actúan cuando un editor o Dirección usa los controles.
-- No toca tablas, usuarios ni políticas del módulo de certificados.
-- =====================================================================

begin;

create index if not exists asis_exc_mes_colab_idx
  on public.asis_excepciones(fecha,ambito,colaborador_id);

create index if not exists asis_colab_activo_area_idx
  on public.asis_colaboradores(activo,area_id,orden);


-- 1) LIBRO MENSUAL CONSOLIDADO ---------------------------------------
create or replace function public.dash_admin_mes(
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
      coalesce(
        nullif(c.horario_semanal -> extract(isodow from f.fecha)::text ->> 'mod',''),
        case when extract(isodow from f.fecha)::integer=any(c.dias_laborables)
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

revoke all on function public.dash_admin_mes(integer,integer,boolean)
  from public,anon;
grant execute on function public.dash_admin_mes(integer,integer,boolean)
  to authenticated;


-- 2) FERIADOS DE EMPRESA --------------------------------------------
create or replace function public.dash_admin_guardar_feriado(
  p_fecha date,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_nota text := nullif(btrim(coalesce(p_nota,'')),'');
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or extract(year from p_fecha) not between 2020 and 2100 then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  if v_nota is not null and char_length(v_nota)>60 then
    return jsonb_build_object('ok',false,'motivo','nota');
  end if;

  delete from public.asis_excepciones
   where fecha=p_fecha and ambito='empresa';
  insert into public.asis_excepciones(fecha,ambito,tipo,nota,creado_por)
  values(p_fecha,'empresa','feriado',v_nota,auth.uid());

  return jsonb_build_object('ok',true,'fecha',p_fecha,'nota',v_nota);
end;
$$;

revoke all on function public.dash_admin_guardar_feriado(date,text)
  from public,anon;
grant execute on function public.dash_admin_guardar_feriado(date,text)
  to authenticated;


create or replace function public.dash_admin_quitar_feriado(p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_eliminados integer;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  delete from public.asis_excepciones
   where fecha=p_fecha and ambito='empresa';
  get diagnostics v_eliminados = row_count;

  return jsonb_build_object('ok',true,'eliminados',v_eliminados);
end;
$$;

revoke all on function public.dash_admin_quitar_feriado(date)
  from public,anon;
grant execute on function public.dash_admin_quitar_feriado(date)
  to authenticated;


-- 3) EXCEPCIONES DE UNA PERSONA -------------------------------------
create or replace function public.dash_admin_guardar_excepcion(
  p_colab bigint,
  p_fecha date,
  p_tipo text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab public.asis_colaboradores;
  v_nota text := nullif(btrim(coalesce(p_nota,'')),'');
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null or extract(year from p_fecha) not between 2020 and 2100 then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;
  if p_tipo not in ('laborable_extra','no_laborable') then
    return jsonb_build_object('ok',false,'motivo','tipo');
  end if;
  if v_nota is not null and char_length(v_nota)>120 then
    return jsonb_build_object('ok',false,'motivo','nota');
  end if;

  select * into v_colab from public.asis_colaboradores where id=p_colab;
  if not found then
    return jsonb_build_object('ok',false,'motivo','no_existe');
  end if;
  if v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio then
    return jsonb_build_object('ok',false,'motivo','antes_contrato');
  end if;

  delete from public.asis_excepciones
   where fecha=p_fecha and ambito='colaborador' and colaborador_id=p_colab;
  insert into public.asis_excepciones
    (fecha,ambito,colaborador_id,tipo,nota,creado_por)
  values(p_fecha,'colaborador',p_colab,p_tipo,v_nota,auth.uid());

  return jsonb_build_object('ok',true,'fecha',p_fecha,'tipo',p_tipo);
end;
$$;

revoke all on function public.dash_admin_guardar_excepcion(bigint,date,text,text)
  from public,anon;
grant execute on function public.dash_admin_guardar_excepcion(bigint,date,text,text)
  to authenticated;


create or replace function public.dash_admin_quitar_excepcion(
  p_colab bigint,
  p_fecha date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_eliminados integer;
begin
  if not public.asis_puede_editar() then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_fecha is null then
    return jsonb_build_object('ok',false,'motivo','fecha');
  end if;

  delete from public.asis_excepciones
   where fecha=p_fecha and ambito='colaborador' and colaborador_id=p_colab;
  get diagnostics v_eliminados = row_count;

  return jsonb_build_object('ok',true,'eliminados',v_eliminados);
end;
$$;

revoke all on function public.dash_admin_quitar_excepcion(bigint,date)
  from public,anon;
grant execute on function public.dash_admin_quitar_excepcion(bigint,date)
  to authenticated;


notify pgrst,'reload schema';

-- COMPROBACIÓN: las cinco filas deben decir OK.
select case when encontrado=esperado then 'OK' else 'REVISAR' end estado,
       pieza,encontrado,esperado
from (
  select p.proname pieza,count(*)::integer encontrado,1 esperado
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'dash_admin_mes','dash_admin_guardar_feriado','dash_admin_quitar_feriado',
    'dash_admin_guardar_excepcion','dash_admin_quitar_excepcion'
  )
  group by p.proname
) comprobacion
order by pieza;

commit;
