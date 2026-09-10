-- DASHBOARD 48 · SEPARAR LA JORNADA DE LAS COMPARTICIONES
-- Ejecutar despues de dashboard_47_estado_asignaciones.sql.
--
-- El RPE, la evidencia de salida y los entregables asignados pertenecen a la
-- jornada laboral. Facebook conserva su agenda independiente: solo se habilita
-- dentro de la franja configurada, pero nunca bloquea la salida ni convierte
-- una jornada laboral cerrada en incompleta.

begin;

do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_48(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_48;
  end if;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab_base_48(bigint,date)
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
  v_resultado jsonb;
  v_registro public.asis_registros;
  v_pendientes_jornada integer:=0;
  v_comparticiones_pendientes boolean:=false;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
  v_estado text;
begin
  v_resultado:=public.dash_cierre_resumen_colab_base_48(p_colaborador,p_fecha);
  if not coalesce((v_resultado->>'ok')::boolean,false) then return v_resultado; end if;

  select * into v_registro
    from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha;

  select count(*)::integer into v_pendientes_jornada
    from (
      select requisito.item
        from jsonb_array_elements(coalesce(v_resultado->'requisitos','[]'::jsonb)) requisito(item)
       where requisito.item->>'tipo'<>'comparticiones'
         and not coalesce((requisito.item->>'completo')::boolean,false)
      union all
      select asignacion.item
        from jsonb_array_elements(coalesce(v_resultado->'asignaciones','[]'::jsonb)) asignacion(item)
       where not coalesce((asignacion.item->>'completo')::boolean,false)
    ) pendientes;

  select exists(
    select 1
      from jsonb_array_elements(coalesce(v_resultado->'requisitos','[]'::jsonb)) requisito(item)
     where requisito.item->>'tipo'='comparticiones'
       and not coalesce((requisito.item->>'completo')::boolean,false)
  ) into v_comparticiones_pendientes;

  v_resultado:=jsonb_set(v_resultado,'{pendientes_salida}',to_jsonb(v_pendientes_jornada),true);
  v_resultado:=jsonb_set(v_resultado,'{pendientes_jornada}',to_jsonb(v_pendientes_jornada),true);
  v_resultado:=jsonb_set(v_resultado,'{comparticiones_pendientes}',to_jsonb(v_comparticiones_pendientes),true);

  if coalesce((v_resultado->>'aplica_jornada')::boolean,false) then
    v_fin_at:=public.asis_cierre_fin_at(p_colaborador,p_fecha);
    if v_fin_at is not null then
      select v_fin_at-make_interval(mins=>config.salida_anticipacion_min),
             v_fin_at+make_interval(mins=>config.salida_gracia_min)
        into v_desde_at,v_hasta_at
        from public.asis_cierre_config config
       where config.id=1;
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

    v_resultado:=jsonb_set(v_resultado,'{estado}',to_jsonb(v_estado),true);
    v_resultado:=jsonb_set(v_resultado,'{puede_marcar_salida}',to_jsonb(
      v_registro.id is not null
      and v_registro.salida_at is null
      and v_pendientes_jornada=0
      and v_desde_at is not null
      and now() between v_desde_at and v_hasta_at
    ),true);
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

-- Facebook no participa en el conteo que autoriza la salida. Su entrega sigue
-- protegida por asis_compartir_en_ventana() en las RPC de carga y confirmacion.
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

  select * into v_registro
    from public.asis_registros
   where colaborador_id=v_colaborador and fecha=v_fecha
   for update;
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

  if not exists(
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

notify pgrst,'reload schema';
commit;

-- Verificacion: una salida con solo Facebook pendiente debe conservar el estado
-- laboral completo y exponer la comparticion como pendiente independiente.
select colaborador.id,colaborador.nombre,registro.fecha,registro.salida_at,
       resumen.valor->>'estado' as jornada,
       resumen.valor->>'pendientes_jornada' as pendientes_jornada,
       resumen.valor->>'comparticiones_pendientes' as facebook_pendiente
  from public.asis_colaboradores colaborador
  join public.asis_registros registro on registro.colaborador_id=colaborador.id
  cross join lateral (
    select public.dash_cierre_resumen_colab(colaborador.id,registro.fecha) as valor
  ) resumen
 where registro.fecha=(now() at time zone 'America/Lima')::date
 order by colaborador.nombre;
