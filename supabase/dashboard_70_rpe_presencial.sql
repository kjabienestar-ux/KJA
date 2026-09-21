-- DASHBOARD 70 · RPE NO APLICABLE EN JORNADAS PRESENCIALES
-- Aplicar despues de dashboard_69_alviery_cierre_mensual.sql.
-- La fecha de instalacion queda guardada una sola vez. No elimina entregas,
-- archivos, revisiones ni marcaciones existentes.

begin;

alter table public.asis_cierre_config
  add column if not exists rpe_presencial_exento_desde date;

update public.asis_cierre_config
   set rpe_presencial_exento_desde=(now() at time zone 'America/Lima')::date
 where id=1 and rpe_presencial_exento_desde is null;

alter table public.asis_cierre_config
  alter column rpe_presencial_exento_desde set not null;

comment on column public.asis_cierre_config.rpe_presencial_exento_desde is
  'Primer dia Lima en que una jornada presencial deja de requerir evidencia RPE.';

-- La modalidad marcada es la evidencia historica principal. Antes de marcar se
-- usa la eleccion diaria y, como ultimo respaldo, el horario semanal.
create or replace function public.asis_modalidad_efectiva(
  p_colaborador bigint,
  p_fecha date
)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_colaborador public.asis_colaboradores;
  v_marcada text;
begin
  if p_colaborador is null or p_fecha is null then return null; end if;
  select * into v_colaborador
    from public.asis_colaboradores
   where id=p_colaborador;
  if v_colaborador.id is null then return null; end if;
  select nullif(modalidad_marcada,'') into v_marcada
    from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha;
  return coalesce(v_marcada,public.asis_modalidad_dia(v_colaborador,p_fecha));
end;
$$;

create or replace function public.asis_rpe_exento_presencial(
  p_colaborador bigint,
  p_fecha date
)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_colaborador public.asis_colaboradores;
  v_desde date;
begin
  if p_colaborador is null or p_fecha is null then return false; end if;
  select * into v_colaborador
    from public.asis_colaboradores
   where id=p_colaborador and activo;
  select rpe_presencial_exento_desde into v_desde
    from public.asis_cierre_config where id=1;
  return v_colaborador.id is not null
    and public.asis_labora(v_colaborador,p_fecha)
    and p_fecha>=v_desde
    and public.asis_modalidad_efectiva(p_colaborador,p_fecha)='presencial';
end;
$$;

revoke all on function public.asis_modalidad_efectiva(bigint,date),
  public.asis_rpe_exento_presencial(bigint,date)
  from public,anon,authenticated;

-- Conserva toda la cadena de cierres anterior y retira exclusivamente el RPE
-- cuando la politica presencial aplica.
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_70(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_70;
  end if;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab_base_70(bigint,date)
  from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(
  p_colaborador bigint,
  p_fecha date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_data jsonb;
  v_requisitos jsonb;
  v_modalidad text;
  v_tenia_rpe boolean:=false;
  v_exento boolean:=false;
  v_pendientes integer:=0;
  v_pendientes_jornada integer:=0;
  v_comparticiones_pendientes boolean:=false;
  v_aplica_jornada boolean:=false;
  v_registro public.asis_registros;
  v_config public.asis_cierre_config;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
  v_estado text;
begin
  v_data:=public.dash_cierre_resumen_colab_base_70(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;

  v_modalidad:=public.asis_modalidad_efectiva(p_colaborador,p_fecha);
  select exists(
    select 1 from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb)) item
     where item->>'tipo'='rpe'
  ) into v_tenia_rpe;
  v_exento:=v_tenia_rpe and public.asis_rpe_exento_presencial(p_colaborador,p_fecha);

  v_data:=v_data||jsonb_build_object(
    'modalidad',v_modalidad,
    'requiere_rpe',v_tenia_rpe and not v_exento,
    'rpe_exento_presencial',v_exento
  );
  if not v_exento then return v_data; end if;

  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb)
    into v_requisitos
    from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
      with ordinality as filas(item,orden)
   where item->>'tipo'<>'rpe';
  v_data:=jsonb_set(v_data,'{requisitos}',v_requisitos,true);

  select count(*)::integer into v_pendientes
    from (
      select item
        from jsonb_array_elements(v_requisitos) item
       where not coalesce((item->>'completo')::boolean,false)
      union all
      select item
        from jsonb_array_elements(coalesce(v_data->'asignaciones','[]'::jsonb)) item
       where not coalesce((item->>'completo')::boolean,false)
         and item->>'estado' is distinct from 'cancelada'
    ) pendientes;

  select count(*)::integer into v_pendientes_jornada
    from (
      select item
        from jsonb_array_elements(v_requisitos) item
       where item->>'tipo'<>'comparticiones'
         and not coalesce((item->>'completo')::boolean,false)
      union all
      select item
        from jsonb_array_elements(coalesce(v_data->'asignaciones','[]'::jsonb)) item
       where not coalesce((item->>'completo')::boolean,false)
         and item->>'estado' is distinct from 'cancelada'
    ) pendientes;

  select exists(
    select 1 from jsonb_array_elements(v_requisitos) item
     where item->>'tipo'='comparticiones'
       and not coalesce((item->>'completo')::boolean,false)
  ) into v_comparticiones_pendientes;

  v_data:=v_data||jsonb_build_object(
    'pendientes',v_pendientes,
    'pendientes_jornada',v_pendientes_jornada,
    'pendientes_salida',v_pendientes_jornada,
    'comparticiones_pendientes',v_comparticiones_pendientes
  );

  v_aplica_jornada:=coalesce((v_data->>'aplica_jornada')::boolean,false);
  if v_aplica_jornada then
    select * into v_registro from public.asis_registros
     where colaborador_id=p_colaborador and fecha=p_fecha;
    select * into v_config from public.asis_cierre_config where id=1;
    v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
    if v_fin_at is not null then
      v_desde_at:=v_fin_at-make_interval(mins=>v_config.salida_anticipacion_min);
      v_hasta_at:=v_fin_at+make_interval(mins=>v_config.salida_gracia_min);
    end if;

    if v_registro.id is null then
      v_estado:='sin_entrada';
    elsif v_registro.salida_at is not null then
      v_estado:=case when v_pendientes_jornada>0 then 'incompleta'
                     when v_registro.cierre_regularizado then 'regularizada'
                     else 'completa' end;
    elsif v_hasta_at is not null and now()>v_hasta_at then
      v_estado:='incompleta';
    elsif v_pendientes_jornada=0 then
      v_estado:='lista_para_salir';
    else
      v_estado:='en_curso';
    end if;
    if v_comparticiones_pendientes
       and coalesce((v_data->>'comparticiones_vencidas')::boolean,false) then
      v_estado:='incompleta';
    end if;

    v_data:=v_data||jsonb_build_object(
      'estado',v_estado,
      'puede_marcar_salida',v_registro.id is not null
        and v_registro.salida_at is null
        and v_pendientes_jornada=0
        and v_desde_at is not null
        and now() between v_desde_at and v_hasta_at
    );
  end if;
  return v_data;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

-- La salida conserva exactamente los demas requisitos; solo omite RPE cuando
-- la funcion central declara la excepcion presencial.
create or replace function public.dash_marcar_salida(p_dispositivo text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_colaborador bigint:=public.dash_colab();
  v_fecha date;
  v_ahora timestamptz:=now();
  v_persona public.asis_colaboradores;
  v_config public.asis_cierre_config;
  v_registro public.asis_registros;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
  v_pendientes integer:=0;
  v_horas numeric;
begin
  if not public.dash_sesion_vigente() or v_colaborador is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  select * into v_persona from public.asis_colaboradores where id=v_colaborador and activo;
  select * into v_config from public.asis_cierre_config where id=1;
  if not coalesce(v_config.habilitado,false)
     or v_fecha<v_config.obligatorio_desde
     or not public.asis_labora(v_persona,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','no_habilitado');
  end if;
  select * into v_registro from public.asis_registros
   where colaborador_id=v_colaborador and fecha=v_fecha for update;
  if v_registro.id is null then return jsonb_build_object('ok',false,'motivo','sin_entrada'); end if;
  if v_registro.salida_at is not null then
    return jsonb_build_object('ok',false,'motivo','ya_registrada','salida_at',v_registro.salida_at);
  end if;
  v_fin_at:=public.asis_cierre_fin_at(v_colaborador,v_fecha);
  if v_fin_at is null then return jsonb_build_object('ok',false,'motivo','horario_incompleto'); end if;
  v_desde_at:=v_fin_at-make_interval(mins=>v_config.salida_anticipacion_min);
  v_hasta_at:=v_fin_at+make_interval(mins=>v_config.salida_gracia_min);
  if v_ahora<v_desde_at then
    return jsonb_build_object('ok',false,'motivo','salida_aun_no_disponible','desde',(v_desde_at at time zone 'America/Lima')::time);
  end if;
  if v_ahora>v_hasta_at then
    return jsonb_build_object('ok',false,'motivo','salida_fuera_de_plazo','hasta',(v_hasta_at at time zone 'America/Lima')::time);
  end if;

  if not public.asis_rpe_exento_presencial(v_colaborador,v_fecha)
     and not exists(
       select 1 from public.asis_entregas_diarias entrega
        where entrega.colaborador_id=v_colaborador and entrega.fecha=v_fecha
          and entrega.requisito='rpe' and entrega.estado='completo'
     ) then v_pendientes:=v_pendientes+1; end if;

  if coalesce(v_config.salida_evidencia_habilitada,false)
     and v_fecha>=v_config.salida_evidencia_desde
     and not exists(
       select 1 from public.asis_entregas_diarias entrega
        where entrega.colaborador_id=v_colaborador and entrega.fecha=v_fecha
          and entrega.requisito='salida' and entrega.estado='completo'
     ) then v_pendientes:=v_pendientes+1; end if;

  select v_pendientes+count(*)::integer into v_pendientes
    from public.asis_asignaciones_diarias asignacion
   where asignacion.fecha=v_fecha and asignacion.activo and asignacion.requerido
     and (asignacion.colaborador_id=v_colaborador or asignacion.area_id=v_persona.area_id)
     and not exists(
       select 1 from public.asis_entregas_diarias entrega
        where entrega.colaborador_id=v_colaborador and entrega.fecha=v_fecha
          and entrega.asignacion_id=asignacion.id and entrega.estado='completo'
     );
  if v_pendientes>0 then
    return jsonb_build_object('ok',false,'motivo','requisitos_pendientes','pendientes',v_pendientes);
  end if;

  v_horas:=round(greatest(0,extract(epoch from(v_ahora-v_registro.marcado_at))/3600)::numeric,2);
  update public.asis_registros
     set salida_at=v_ahora,
         salida_dispositivo=left(coalesce(p_dispositivo,''),120),
         salida_origen='dashboard',
         salida_por=auth.uid(),
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_actualizado_at=v_ahora
   where id=v_registro.id;
  return jsonb_build_object(
    'ok',true,'estado','completa','salida_at',v_ahora,
    'horas_efectivas',v_horas,
    'resumen',public.dash_cierre_resumen_colab(v_colaborador,v_fecha)
  );
end;
$$;

revoke all on function public.dash_marcar_salida(text) from public,anon;
grant execute on function public.dash_marcar_salida(text) to authenticated;

-- Defensas de servidor para todos los caminos de carga del colaborador.
do $$ begin
  if to_regprocedure('public.dash_entrega_permiso_base_70(text,bigint,text,text)') is null then
    alter function public.dash_entrega_permiso(text,bigint,text,text) rename to dash_entrega_permiso_base_70;
  end if;
  if to_regprocedure('public.dash_video_permiso_base_70(text,bigint,text)') is null then
    alter function public.dash_video_permiso(text,bigint,text) rename to dash_video_permiso_base_70;
  end if;
  if to_regprocedure('public.dash_reemplazo_permiso_base_70(text,bigint,text,text,text)') is null then
    alter function public.dash_reemplazo_permiso(text,bigint,text,text,text) rename to dash_reemplazo_permiso_base_70;
  end if;
  if to_regprocedure('public.dash_confirmar_entrega_base_70(text,bigint,text,text[],text)') is null then
    alter function public.dash_confirmar_entrega(text,bigint,text,text[],text) rename to dash_confirmar_entrega_base_70;
  end if;
  if to_regprocedure('public.dash_reemplazar_entrega_base_70(text,bigint,text,text[],text[],text,text)') is null then
    alter function public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text) rename to dash_reemplazar_entrega_base_70;
  end if;
  if to_regprocedure('public.dash_adjuntar_video_base_70(bigint,text)') is null then
    alter function public.dash_adjuntar_video(bigint,text) rename to dash_adjuntar_video_base_70;
  end if;
end $$;

revoke all on function public.dash_entrega_permiso_base_70(text,bigint,text,text),
  public.dash_video_permiso_base_70(text,bigint,text),
  public.dash_reemplazo_permiso_base_70(text,bigint,text,text,text),
  public.dash_confirmar_entrega_base_70(text,bigint,text,text[],text),
  public.dash_reemplazar_entrega_base_70(text,bigint,text,text[],text[],text,text),
  public.dash_adjuntar_video_base_70(bigint,text)
  from public,anon,authenticated;

create or replace function public.dash_entrega_permiso(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,p_ext text default 'jpg'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_entrega_permiso_base_70(p_requisito,p_asignacion,p_modalidad,p_ext);
end $$;

create or replace function public.dash_video_permiso(
  p_requisito text,p_asignacion bigint default null,p_ext text default 'mp4'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_video_permiso_base_70(p_requisito,p_asignacion,p_ext);
end $$;

create or replace function public.dash_reemplazo_permiso(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,
  p_tipo_archivo text default 'imagen',p_ext text default 'jpg'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_reemplazo_permiso_base_70(p_requisito,p_asignacion,p_modalidad,p_tipo_archivo,p_ext);
end $$;

create or replace function public.dash_confirmar_entrega(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,
  p_paths text[] default '{}',p_detalle text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_confirmar_entrega_base_70(p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle);
end $$;

create or replace function public.dash_reemplazar_entrega(
  p_requisito text,p_asignacion bigint default null,p_modalidad text default null,
  p_paths text[] default '{}',p_conservar_paths text[] default '{}',
  p_detalle text default null,p_video_path text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_fecha:=public.asis_cierre_fecha_activa(v_colaborador);
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_reemplazar_entrega_base_70(
    p_requisito,p_asignacion,p_modalidad,p_paths,p_conservar_paths,p_detalle,p_video_path
  );
end $$;

create or replace function public.dash_adjuntar_video(p_entrega bigint,p_path text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colaborador bigint:=public.dash_colab(); v_fecha date; v_requisito text;
begin
  select fecha,requisito into v_fecha,v_requisito
    from public.asis_entregas_diarias
   where id=p_entrega and colaborador_id=v_colaborador;
  if v_requisito='rpe' and public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_adjuntar_video_base_70(p_entrega,p_path);
end $$;

revoke all on function public.dash_entrega_permiso(text,bigint,text,text),
  public.dash_video_permiso(text,bigint,text),
  public.dash_reemplazo_permiso(text,bigint,text,text,text),
  public.dash_confirmar_entrega(text,bigint,text,text[],text),
  public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text),
  public.dash_adjuntar_video(bigint,text)
  from public,anon;
grant execute on function public.dash_entrega_permiso(text,bigint,text,text),
  public.dash_video_permiso(text,bigint,text),
  public.dash_reemplazo_permiso(text,bigint,text,text,text),
  public.dash_confirmar_entrega(text,bigint,text,text[],text),
  public.dash_reemplazar_entrega(text,bigint,text,text[],text[],text,text),
  public.dash_adjuntar_video(bigint,text)
  to authenticated;

-- Si una evidencia RPE se habia cargado antes de instalar la politica durante
-- el mismo dia, tampoco se vuelve a insertar en el checklist desde revisiones.
do $$ begin
  if to_regprocedure('public.dash_mis_revisiones_cierre_base_70()') is null then
    alter function public.dash_mis_revisiones_cierre()
      rename to dash_mis_revisiones_cierre_base_70;
  end if;
end $$;
revoke all on function public.dash_mis_revisiones_cierre_base_70()
  from public,anon,authenticated;

create or replace function public.dash_mis_revisiones_cierre()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_revisiones jsonb; v_colaborador bigint:=public.dash_colab(); v_fecha date;
begin
  v_data:=public.dash_mis_revisiones_cierre_base_70();
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  v_fecha:=(v_data->>'fecha')::date;
  if not public.asis_rpe_exento_presencial(v_colaborador,v_fecha) then return v_data; end if;
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb) into v_revisiones
    from jsonb_array_elements(coalesce(v_data->'revisiones','[]'::jsonb))
      with ordinality as filas(item,orden)
   where item->>'requisito'<>'rpe';
  return jsonb_set(v_data,'{revisiones}',v_revisiones,true);
end $$;
revoke all on function public.dash_mis_revisiones_cierre() from public,anon;
grant execute on function public.dash_mis_revisiones_cierre() to authenticated;

-- Direccion tampoco puede crear RPE que la politica declara no aplicable.
do $$ begin
  if to_regprocedure('public.dash_admin_entrega_permiso_base_70(bigint,date,text,bigint,text,text)') is null then
    alter function public.dash_admin_entrega_permiso(bigint,date,text,bigint,text,text)
      rename to dash_admin_entrega_permiso_base_70;
  end if;
  if to_regprocedure('public.dash_admin_confirmar_entrega_base_70(bigint,date,text,bigint,text,text[],text,time)') is null then
    alter function public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time)
      rename to dash_admin_confirmar_entrega_base_70;
  end if;
  if to_regprocedure('public.dash_admin_revisar_entrega_base_70(bigint,text,text)') is null then
    alter function public.dash_admin_revisar_entrega(bigint,text,text)
      rename to dash_admin_revisar_entrega_base_70;
  end if;
end $$;

revoke all on function public.dash_admin_entrega_permiso_base_70(bigint,date,text,bigint,text,text),
  public.dash_admin_confirmar_entrega_base_70(bigint,date,text,bigint,text,text[],text,time),
  public.dash_admin_revisar_entrega_base_70(bigint,text,text)
  from public,anon,authenticated;

create or replace function public.dash_admin_entrega_permiso(
  p_colaborador bigint,p_fecha date,p_requisito text,p_asignacion bigint default null,
  p_modalidad text default null,p_ext text default 'jpg'
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(p_colaborador,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_admin_entrega_permiso_base_70(
    p_colaborador,p_fecha,p_requisito,p_asignacion,p_modalidad,p_ext
  );
end $$;

create or replace function public.dash_admin_confirmar_entrega(
  p_colaborador bigint,p_fecha date,p_requisito text,p_asignacion bigint default null,
  p_modalidad text default null,p_paths text[] default '{}',p_detalle text default null,
  p_hora_salida time default null
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  if p_requisito='rpe' and public.asis_rpe_exento_presencial(p_colaborador,p_fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_admin_confirmar_entrega_base_70(
    p_colaborador,p_fecha,p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle,p_hora_salida
  );
end $$;

create or replace function public.dash_admin_revisar_entrega(
  p_entrega bigint,p_estado text,p_nota text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_entrega public.asis_entregas_diarias;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok',false,'motivo','sin_permiso');
  end if;
  select * into v_entrega from public.asis_entregas_diarias where id=p_entrega;
  if v_entrega.requisito='rpe'
     and public.asis_rpe_exento_presencial(v_entrega.colaborador_id,v_entrega.fecha) then
    return jsonb_build_object('ok',false,'motivo','rpe_no_requerido_presencial');
  end if;
  return public.dash_admin_revisar_entrega_base_70(p_entrega,p_estado,p_nota);
end $$;

revoke all on function public.dash_admin_entrega_permiso(bigint,date,text,bigint,text,text),
  public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time),
  public.dash_admin_revisar_entrega(bigint,text,text)
  from public,anon;
grant execute on function public.dash_admin_entrega_permiso(bigint,date,text,bigint,text,text),
  public.dash_admin_confirmar_entrega(bigint,date,text,bigint,text,text[],text,time),
  public.dash_admin_revisar_entrega(bigint,text,text)
  to authenticated;

-- Las entregas antiguas se conservan, pero dejan de aparecer como trabajo de
-- revision o como alerta operativa cuando ese RPE ya no aplica.
do $$ begin
  if to_regprocedure('public.dash_admin_revision_entregas_base_70(date)') is null then
    alter function public.dash_admin_revision_entregas(date)
      rename to dash_admin_revision_entregas_base_70;
  end if;
  if to_regprocedure('public.dash_admin_control_diario_base_70(date)') is null then
    alter function public.dash_admin_control_diario(date)
      rename to dash_admin_control_diario_base_70;
  end if;
end $$;

revoke all on function public.dash_admin_revision_entregas_base_70(date),
  public.dash_admin_control_diario_base_70(date)
  from public,anon,authenticated;

create or replace function public.dash_admin_revision_entregas(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_entregas jsonb;
begin
  v_data:=public.dash_admin_revision_entregas_base_70(p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb) into v_entregas
    from jsonb_array_elements(coalesce(v_data->'entregas','[]'::jsonb))
      with ordinality as filas(item,orden)
   where item->>'requisito' is distinct from 'rpe'
      or not public.asis_rpe_exento_presencial(
        (item->>'colaborador_id')::bigint,(item->>'fecha')::date
      );
  return jsonb_set(v_data,'{entregas}',v_entregas,true);
end $$;

create or replace function public.dash_admin_control_diario(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_filas jsonb;
begin
  v_data:=public.dash_admin_control_diario_base_70(p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select coalesce(jsonb_agg(
    fila.item||jsonb_build_object(
      'revision_pendiente',coalesce(revision.pendientes,0),
      'revision_observada',coalesce(revision.observadas,0)
    ) order by fila.orden
  ),'[]'::jsonb) into v_filas
  from jsonb_array_elements(coalesce(v_data->'filas','[]'::jsonb))
    with ordinality as fila(item,orden)
  left join lateral (
    select count(*) filter(where ultima.revision_estado='pendiente' and ultima.estado='completo')::int pendientes,
           count(*) filter(where ultima.revision_estado='observada')::int observadas
      from (
        select distinct on(entrega.requisito,coalesce(entrega.asignacion_id,0))
          entrega.revision_estado,entrega.estado
          from public.asis_entregas_diarias entrega
         where entrega.colaborador_id=(fila.item->>'colaborador_id')::bigint
           and entrega.fecha=p_fecha
           and (entrega.requisito<>'rpe' or not public.asis_rpe_exento_presencial(
             entrega.colaborador_id,entrega.fecha
           ))
         order by entrega.requisito,coalesce(entrega.asignacion_id,0),entrega.creado_at desc,entrega.id desc
      ) ultima
  ) revision on true;
  return jsonb_set(v_data,'{filas}',v_filas,true);
end $$;

revoke all on function public.dash_admin_revision_entregas(date),
  public.dash_admin_control_diario(date) from public,anon;
grant execute on function public.dash_admin_revision_entregas(date),
  public.dash_admin_control_diario(date) to authenticated;

-- Ranking: los dias presenciales no forman parte del denominador RPE. Se
-- informa cuantos fueron exentos para que el cliente otorgue credito neutral
-- solo cuando no existe ningun dia virtual evaluable.
create or replace function public.dash_ranking_mes(p_mes date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_inicio date; v_fin date; v_filas jsonb;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede consultar la evaluación mensual.';
  end if;
  if p_mes is null or p_mes<date '2020-01-01' or p_mes>(now() at time zone 'America/Lima')::date then
    raise exception 'Mes inválido.';
  end if;
  v_inicio:=date_trunc('month',p_mes)::date;
  v_fin:=least((v_inicio+interval '1 month - 1 day')::date,(now() at time zone 'America/Lima')::date-1);
  with calendario as materialized (
    select c.id,c.area_id,c.contrato_inicio,dia::date fecha,
      dia::date>=c.contrato_inicio incorporado,
      public.asis_labora(c,dia::date) and coalesce(r.estado,'') not in ('J','NG') laboral,
      r.estado,r.salida_at,
      (dia::date+public.asis_hora_entrada(c,dia::date)) at time zone 'America/Lima' inicio_at,
      public.asis_cierre_fin_at(c.id,dia::date) fin_at,
      public.dash_cierre_resumen_colab(c.id,dia::date) cierre,
      public.asis_compartir_fin_at(c.id,dia::date) compartir_fin
    from public.asis_colaboradores c
    join public.asis_areas a on a.id=c.area_id
    cross join generate_series(v_inicio::timestamp,v_fin::timestamp,interval '1 day') dia
    left join public.asis_registros r on r.colaborador_id=c.id and r.fecha=dia::date
    where c.activo and a.activo and c.contrato_inicio is not null
  ), agenda as materialized (
    select cal.*,
      laboral and fin_at is not null and now()>fin_at+make_interval(mins=>cfg.salida_gracia_min) trabajo,
      laboral and fin_at is not null and now()>fin_at+make_interval(mins=>cfg.salida_gracia_min)
        and exists(select 1 from jsonb_array_elements(coalesce(cierre->'requisitos','[]')) q where q->>'tipo'='rpe') rpe_requerido,
      coalesce((cierre->>'rpe_exento_presencial')::boolean,false) rpe_exento_presencial,
      coalesce((cierre->>'aplica_comparticiones')::boolean,false) and compartir_fin is not null and now()>compartir_fin compartir,
      cfg.salida_anticipacion_min,cfg.salida_gracia_min
    from calendario cal cross join public.asis_cierre_config cfg where cfg.id=1
  ), evaluado as materialized (
    select d.*,ev.*,
      incorporado and trabajo and estado='P' entrada_ok,
      incorporado and trabajo and not coalesce((cierre->>'solo_asistencia_comparticiones')::boolean,false)
        and fecha>=date '2026-09-07' and estado in ('P','T') and salida_at between
        fin_at-make_interval(mins=>salida_anticipacion_min) and fin_at+make_interval(mins=>salida_gracia_min) salida_ok,
      case when incorporado and trabajo and not coalesce((cierre->>'solo_asistencia_comparticiones')::boolean,false) then (
        select count(*) from public.asis_asignaciones_diarias x
        left join lateral (
          select estado,revision_estado from public.asis_entregas_diarias e
          where e.colaborador_id=d.id and e.asignacion_id=x.id order by e.creado_at desc,e.id desc limit 1
        ) e on true
        where x.fecha=d.fecha and x.activo and x.requerido and (x.colaborador_id=d.id or x.area_id=d.area_id)
          and (e.estado is distinct from 'completo' or e.revision_estado='observada')
      ) else 0 end incumplidas
    from agenda d cross join lateral (
      select
        count(*) filter(where tipo='rpe' and valida and (administracion or completado_at between d.inicio_at and d.fin_at)) rpe_ok,
        count(*) filter(where tipo='rpe' and valida and administracion) rpe_admin,
        count(*) filter(where tipo='rpe' and valida and not administracion and not (completado_at between d.inicio_at and d.fin_at)) rpe_fuera_horario,
        count(*) filter(where tipo='comparticiones' and valida) facebook_ok,
        count(*) filter(where tipo='comparticiones' and valida and not d.laboral) facebook_descanso_ok,
        count(*) requeridas,
        count(*) filter(where subido) subidas,
        count(*) filter(where subido and revision_estado='pendiente') pendientes,
        count(*) filter(where subido and revision_estado='observada') observadas,
        count(*) filter(where valida) aprobadas
      from (
        select req->>'tipo' tipo,e.completado_at,e.revision_estado,
          coalesce(e.estado='completo' and e.con_archivo,false) subido,
          coalesce(e.estado='completo' and e.con_archivo and e.revision_estado='aprobada' and (req->>'completo')::boolean,false) valida,
          coalesce(e.administracion,false) administracion
        from jsonb_array_elements(coalesce(d.cierre->'requisitos','[]')) req
        left join lateral (
          select e.estado,e.revision_estado,e.completado_at,
            exists(select 1 from public.asis_entrega_archivos f where f.entrega_id=e.id) con_archivo,
            exists(select 1 from public.asis_entregas_direccion au where au.entrega_id=e.id and au.colaborador_id=d.id and au.fecha=d.fecha) administracion
          from public.asis_entregas_diarias e where e.colaborador_id=d.id and e.fecha=d.fecha
            and e.requisito=req->>'tipo' and e.asignacion_id is null order by e.creado_at desc,e.id desc limit 1
        ) e on true
        where d.incorporado and ((req->>'tipo'='rpe' and d.rpe_requerido) or (req->>'tipo'='comparticiones' and d.compartir))
      ) evidencia
    ) ev
  ), resumen as (
    select id,
      count(*) filter(where trabajo) dias_mes,
      count(*) filter(where trabajo and incorporado) dias,
      count(*) filter(where incorporado and (trabajo or compartir)) dias_participacion,
      count(*) filter(where trabajo and incorporado and estado in ('P','T')) presentes,
      count(*) filter(where entrada_ok) entradas_puntuales,
      count(*) filter(where trabajo and not coalesce((cierre->>'solo_asistencia_comparticiones')::boolean,false) and fecha>=date '2026-09-07') salidas_mes,
      count(*) filter(where salida_ok) salidas_puntuales,
      count(*) filter(where rpe_requerido) rpe_mes,
      count(*) filter(where trabajo and incorporado and rpe_exento_presencial) rpe_exentos_presencial,
      count(*) filter(where compartir) facebook_mes,
      count(*) filter(where compartir and incorporado) facebook_asignados,
      count(*) filter(where compartir and incorporado and not laboral) facebook_descanso,
      sum(rpe_ok) rpe_cumplidos,sum(rpe_admin) rpe_administracion,sum(rpe_fuera_horario) rpe_fuera_horario,
      sum(facebook_ok) facebook_cumplidos,sum(facebook_descanso_ok) facebook_descanso_cumplidos,
      sum(requeridas) evidencias_requeridas,sum(subidas) evidencias_subidas,sum(aprobadas) evidencias_aprobadas,
      sum(pendientes) revisiones_pendientes,sum(observadas) evidencias_observadas,sum(incumplidas) asignaciones_incumplidas
    from evaluado group by id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'area_id',c.area_id,'area',a.nombre,
    'inicio_conocido',c.contrato_inicio is not null,'inicio',c.contrato_inicio,'metricas',coalesce(to_jsonb(r)-'id','{}')) order by a.orden,c.nombre,c.id),'[]')
  into v_filas from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id
  left join resumen r on r.id=c.id where c.activo and a.activo;
  return jsonb_build_object('version',4,'salidas_desde',date '2026-09-07','mes',v_inicio,'hasta',v_fin,'filas',v_filas,
    'salida_anticipacion_min',(select salida_anticipacion_min from public.asis_cierre_config where id=1),
    'salida_gracia_min',(select salida_gracia_min from public.asis_cierre_config where id=1));
end;
$$;

revoke all on function public.dash_ranking_mes(date) from public,anon,authenticated;
grant execute on function public.dash_ranking_mes(date) to authenticated;

notify pgrst,'reload schema';
commit;

-- Diagnostico posterior: no borra datos y compara el requisito final por modo.
select colaborador.id,colaborador.nombre,registro.fecha,
       public.asis_modalidad_efectiva(colaborador.id,registro.fecha) modalidad,
       public.dash_cierre_resumen_colab(colaborador.id,registro.fecha)->>'requiere_rpe' requiere_rpe,
       public.dash_cierre_resumen_colab(colaborador.id,registro.fecha)->>'estado' estado
  from public.asis_colaboradores colaborador
  join public.asis_registros registro on registro.colaborador_id=colaborador.id
 where registro.fecha>=(select rpe_presencial_exento_desde from public.asis_cierre_config where id=1)
 order by registro.fecha desc,colaborador.nombre
 limit 100;
