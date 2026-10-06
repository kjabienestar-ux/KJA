-- DASHBOARD 86: aplicar la exención RPE también al resumen de una modalidad corregida.
-- Ejecutar después de dashboard_85. Puede reejecutarse.
-- Conserva la cadena instalada y normaliza su respuesta: no modifica marcas,
-- fechas de política, entregas, archivos, revisiones ni horas.
begin;
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_86(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_86;
  end if;
end;
$$;
revoke all on function public.dash_cierre_resumen_colab_base_86(bigint,date)
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
  v_data:=public.dash_cierre_resumen_colab_base_86(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;

  v_modalidad:=public.asis_modalidad_efectiva(p_colaborador,p_fecha);
  select exists(
    select 1 from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb)) item
     where item->>'tipo'='rpe'
  ) into v_tenia_rpe;
  v_exento:=(v_tenia_rpe or coalesce((v_data->>'rpe_exento_presencial')::boolean,false))
    and public.asis_rpe_exento_presencial(p_colaborador,p_fecha);

  v_data:=v_data||jsonb_build_object(
    'modalidad',v_modalidad,
    'requiere_rpe',v_tenia_rpe and not v_exento,
    'rpe_exento_presencial',v_exento
  );
  -- Si la cadena vigente ya quitó el RPE, conserva su estado y sus excepciones.
  if not v_exento or not v_tenia_rpe then return v_data; end if;

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

  v_aplica_jornada:=coalesce((v_data->>'aplica_jornada')::boolean,
    (v_data->>'aplica')::boolean,false)
    and not coalesce((v_data->>'solo_comparticiones')::boolean,false)
    and not coalesce((v_data->>'justificado')::boolean,false)
    and coalesce(v_data->>'estado','') not in ('justificado','no_aplica');
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
notify pgrst,'reload schema';
commit;
