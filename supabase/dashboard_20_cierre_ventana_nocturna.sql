-- DASHBOARD 20 — Corrige ventanas de salida que cruzan la medianoche.
-- Ejecutar despues de dashboard_19_cierre_jornada.sql.
-- No modifica marcaciones ni evidencias existentes.

begin;

create or replace function public.asis_cierre_fin_at(p_colab bigint, p_fecha date)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_persona public.asis_colaboradores;
  v_fin time;
begin
  select * into v_persona
    from public.asis_colaboradores
   where id = p_colab;
  if v_persona is null or p_fecha is null then
    return null;
  end if;

  v_fin := public.asis_hora_salida(v_persona, p_fecha);
  if v_fin is null then
    return null;
  end if;

  return (p_fecha + v_fin) at time zone 'America/Lima';
end;
$$;

revoke all on function public.asis_cierre_fin_at(bigint, date) from public, anon, authenticated;

create or replace function public.asis_cierre_fecha_activa(p_colab bigint)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_ayer date := ((now() at time zone 'America/Lima')::date - 1);
  v_gracia integer := 0;
  v_hasta timestamptz;
begin
  select salida_gracia_min into v_gracia
    from public.asis_cierre_config
   where id = 1;

  if exists (
    select 1
      from public.asis_registros r
     where r.colaborador_id = p_colab
       and r.fecha = v_ayer
       and r.salida_at is null
  ) then
    v_hasta := public.asis_cierre_fin_at(p_colab, v_ayer)
               + make_interval(mins => coalesce(v_gracia, 0));
    if v_hasta is not null and now() <= v_hasta then
      return v_ayer;
    end if;
  end if;

  return v_hoy;
end;
$$;

revoke all on function public.asis_cierre_fecha_activa(bigint) from public, anon, authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colab bigint, p_fecha date)
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
  v_now       timestamptz := now();
  v_fin       time;
  v_desde     time;
  v_hasta     time;
  v_fin_at    timestamptz;
  v_desde_at  timestamptz;
  v_hasta_at  timestamptz;
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
  v_fin_at := public.asis_cierre_fin_at(p_colab, p_fecha);
  if v_fin_at is not null then
    v_desde_at := v_fin_at - make_interval(mins => v_cfg.salida_anticipacion_min);
    v_hasta_at := v_fin_at + make_interval(mins => v_cfg.salida_gracia_min);
    v_desde := (v_desde_at at time zone 'America/Lima')::time;
    v_hasta := (v_hasta_at at time zone 'America/Lima')::time;
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
  elsif v_hasta_at is not null and v_now > v_hasta_at then
    v_estado := 'incompleta';
  elsif v_comp_ok and v_rpe_ok and v_asig_ok then
    v_estado := 'lista_para_salir';
  else
    v_estado := 'en_curso';
  end if;

  v_puede := v_aplica
              and v_reg.id is not null
              and v_reg.salida_at is null
              and v_comp_ok and v_rpe_ok and v_asig_ok
              and v_fin_at is not null
              and v_now between v_desde_at and v_hasta_at;

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
        'tipo', 'rpe', 'titulo', 'RPE y evidencias del dia',
        'completo', v_rpe_ok, 'archivos', v_rpe_n,
        'descripcion', 'Adjunta el reporte de actividades del dia'
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
  v_fecha date;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  v_fecha := public.asis_cierre_fecha_activa(v_colab);
  return public.dash_cierre_resumen_colab(v_colab, v_fecha);
end;
$$;

revoke all on function public.dash_cierre_hoy() from public, anon;
grant execute on function public.dash_cierre_hoy() to authenticated;

create or replace function public.dash_marcar_salida(p_dispositivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_colab bigint := public.dash_colab();
  v_fecha date;
  v_now timestamptz := now();
  v_persona public.asis_colaboradores;
  v_cfg public.asis_cierre_config;
  v_reg public.asis_registros;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
  v_pendientes integer := 0;
  v_horas numeric;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;

  v_fecha := public.asis_cierre_fecha_activa(v_colab);
  select * into v_persona from public.asis_colaboradores where id = v_colab and activo;
  select * into v_cfg from public.asis_cierre_config where id = 1;
  if not coalesce(v_cfg.habilitado, false) or v_fecha < v_cfg.obligatorio_desde then
    return jsonb_build_object('ok', false, 'motivo', 'no_habilitado');
  end if;

  select * into v_reg
    from public.asis_registros
   where colaborador_id = v_colab and fecha = v_fecha
   for update;
  if v_reg.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_entrada');
  end if;
  if v_reg.salida_at is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_registrada', 'salida_at', v_reg.salida_at);
  end if;

  v_fin_at := public.asis_cierre_fin_at(v_colab, v_fecha);
  if v_fin_at is null then
    return jsonb_build_object('ok', false, 'motivo', 'horario_incompleto');
  end if;
  v_desde_at := v_fin_at - make_interval(mins => v_cfg.salida_anticipacion_min);
  v_hasta_at := v_fin_at + make_interval(mins => v_cfg.salida_gracia_min);
  if v_now < v_desde_at then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'salida_aun_no_disponible',
      'desde', (v_desde_at at time zone 'America/Lima')::time
    );
  end if;
  if v_now > v_hasta_at then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'salida_fuera_de_plazo',
      'hasta', (v_hasta_at at time zone 'America/Lima')::time
    );
  end if;

  if not exists (
    select 1 from public.asis_entregas_diarias
     where colaborador_id = v_colab and fecha = v_fecha
       and requisito = 'comparticiones' and estado = 'completo'
  ) then v_pendientes := v_pendientes + 1; end if;

  if not exists (
    select 1 from public.asis_entregas_diarias
     where colaborador_id = v_colab and fecha = v_fecha
       and requisito = 'rpe' and estado = 'completo'
  ) then v_pendientes := v_pendientes + 1; end if;

  select v_pendientes + count(*)
    into v_pendientes
    from public.asis_asignaciones_diarias a
   where a.fecha = v_fecha and a.activo and a.requerido
     and (a.colaborador_id = v_colab or a.area_id = v_persona.area_id)
     and not exists (
       select 1 from public.asis_entregas_diarias e
        where e.colaborador_id = v_colab and e.fecha = v_fecha
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
    'resumen', public.dash_cierre_resumen_colab(v_colab, v_fecha)
  );
end;
$$;

revoke all on function public.dash_marcar_salida(text) from public, anon;
grant execute on function public.dash_marcar_salida(text) to authenticated;

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
             when public.asis_cierre_fin_at(r.colaborador_id, r.fecha) is not null
                  and now() > public.asis_cierre_fin_at(r.colaborador_id, r.fecha)
                              + make_interval(mins => v_cfg.salida_gracia_min)
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

notify pgrst, 'reload schema';

commit;

select 'OK' as estado,
       'ventana nocturna instalada' as pieza,
       count(*) as encontrado,
       5 as esperado
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'asis_cierre_fin_at',
     'asis_cierre_fecha_activa',
     'dash_cierre_resumen_colab',
     'dash_cierre_hoy',
     'dash_marcar_salida'
   );
