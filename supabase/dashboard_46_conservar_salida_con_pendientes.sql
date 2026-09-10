-- DASHBOARD 46 · CONSERVAR LA SALIDA AUN CON EVIDENCIAS PENDIENTES
-- Ejecutar despues de dashboard_45_excluir_05_septiembre.sql.
--
-- La foto de salida confirma la hora de salida. Los demas entregables definen
-- si la jornada esta completa. Son datos distintos: una comparticion pendiente
-- no debe borrar la salida que el colaborador ya registro.

begin;

-- Conserva la implementacion anterior y registra la salida inmediatamente
-- despues de confirmar una evidencia de tipo salida. Si no hay pendientes, la
-- base ya habra cerrado la jornada y este bloque no realiza cambios.
do $$
begin
  if to_regprocedure('public.dash_confirmar_entrega_base_46(text,bigint,text,text[],text)') is null then
    alter function public.dash_confirmar_entrega(text,bigint,text,text[],text)
      rename to dash_confirmar_entrega_base_46;
  end if;
end;
$$;

revoke all on function public.dash_confirmar_entrega_base_46(text,bigint,text,text[],text)
  from public,anon,authenticated;

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
set search_path=public
as $$
declare
  v_resultado jsonb;
  v_colaborador bigint:=public.dash_colab();
  v_fecha date;
  v_registro public.asis_registros;
  v_entrega public.asis_entregas_diarias;
  v_config public.asis_cierre_config;
  v_salida_at timestamptz;
  v_fin_at timestamptz;
  v_desde_at timestamptz;
  v_hasta_at timestamptz;
  v_horas numeric;
begin
  v_resultado:=public.dash_confirmar_entrega_base_46(
    p_requisito,p_asignacion,p_modalidad,p_paths,p_detalle
  );
  if not coalesce((v_resultado->>'ok')::boolean,false)
     or p_requisito is distinct from 'salida'
     or v_colaborador is null then
    return v_resultado;
  end if;

  begin
    v_fecha:=nullif(v_resultado->'resumen'->>'fecha','')::date;
  exception when others then
    v_fecha:=null;
  end;
  v_fecha:=coalesce(v_fecha,public.asis_cierre_fecha_activa(v_colaborador));

  perform pg_advisory_xact_lock(v_colaborador);
  select * into v_registro
    from public.asis_registros
   where colaborador_id=v_colaborador and fecha=v_fecha
   for update;
  if v_registro.id is null then return v_resultado; end if;

  if v_registro.salida_at is not null then
    return (v_resultado-'salida_motivo')||jsonb_build_object(
      'salida_registrada',true,
      'salida_at',v_registro.salida_at,
      'resumen',public.dash_cierre_resumen_colab(v_colaborador,v_fecha)
    );
  end if;

  select entrega.* into v_entrega
    from public.asis_entregas_diarias entrega
   where entrega.colaborador_id=v_colaborador
     and entrega.fecha=v_fecha
     and entrega.requisito='salida'
     and entrega.estado='completo'
     and exists(
       select 1 from public.asis_entrega_archivos archivo
        where archivo.entrega_id=entrega.id
     )
   order by entrega.completado_at desc,entrega.id desc
   limit 1;
  if v_entrega.id is null then return v_resultado; end if;

  select * into v_config from public.asis_cierre_config where id=1;
  v_salida_at:=v_entrega.completado_at;
  v_fin_at:=public.asis_cierre_fin_at(v_colaborador,v_fecha);
  v_desde_at:=v_fin_at-make_interval(mins=>v_config.salida_anticipacion_min);
  v_hasta_at:=v_fin_at+make_interval(mins=>v_config.salida_gracia_min);

  -- La evidencia solo acredita una salida si fue recibida dentro de la ventana
  -- permitida y despues de la entrada. Los casos fuera de plazo siguen pasando
  -- por la regularizacion auditada de Direccion.
  if v_fin_at is null
     or v_salida_at<v_registro.marcado_at
     or v_salida_at not between v_desde_at and v_hasta_at
     or v_salida_at>now()+interval '5 minutes' then
    return v_resultado||jsonb_build_object(
      'salida_registrada',false,
      'salida_motivo','hora_salida_invalida'
    );
  end if;

  v_horas:=round(greatest(0,
    extract(epoch from(v_salida_at-v_registro.marcado_at))/3600)::numeric,2);
  update public.asis_registros
     set salida_at=v_salida_at,
         salida_dispositivo='cierre_automatico_por_evidencia',
         salida_origen='dashboard',
         salida_por=auth.uid(),
         horas_efectivas=v_horas,
         horas=v_horas,
         cierre_actualizado_at=now()
   where id=v_registro.id and salida_at is null;

  return (v_resultado-'salida_motivo')||jsonb_build_object(
    'salida_registrada',true,
    'salida_at',v_salida_at,
    'resumen',public.dash_cierre_resumen_colab(v_colaborador,v_fecha)
  );
end;
$$;

revoke all on function public.dash_confirmar_entrega(text,bigint,text,text[],text)
  from public,anon;
grant execute on function public.dash_confirmar_entrega(text,bigint,text,text[],text)
  to authenticated;

-- Una salida registrada no convierte en completa una jornada que todavia tiene
-- entregables pendientes. Expone ambas verdades: salida_at y estado incompleta.
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_46(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_46;
  end if;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab_base_46(bigint,date)
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
  v_salida_at timestamptz;
begin
  v_resultado:=public.dash_cierre_resumen_colab_base_46(p_colaborador,p_fecha);
  if not coalesce((v_resultado->>'ok')::boolean,false) then return v_resultado; end if;

  select salida_at into v_salida_at
    from public.asis_registros
   where colaborador_id=p_colaborador and fecha=p_fecha;

  if v_salida_at is not null
     and coalesce((v_resultado->>'pendientes')::integer,0)>0 then
    v_resultado:=jsonb_set(v_resultado,'{estado}',to_jsonb('incompleta'::text),true);
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

-- Repara casos historicos equivalentes, incluido el de Mauricio: entrada y foto
-- de salida validas, pero salida_at vacia por existir otro entregable pendiente.
with candidatas as (
  select registro.id as registro_id,
         entrega.id as entrega_salida_id,
         entrega.completado_at as salida_recuperada_at
    from public.asis_registros registro
    join lateral (
      select e.id,e.completado_at
        from public.asis_entregas_diarias e
       where e.colaborador_id=registro.colaborador_id
         and e.fecha=registro.fecha
         and e.requisito='salida'
         and e.estado='completo'
         and exists(
           select 1 from public.asis_entrega_archivos archivo
            where archivo.entrega_id=e.id
         )
       order by e.completado_at desc,e.id desc
       limit 1
    ) entrega on true
    join public.asis_colaboradores colaborador
      on colaborador.id=registro.colaborador_id
    cross join public.asis_cierre_config config
   where config.id=1
     and registro.salida_at is null
     and registro.estado in ('P','T')
     and registro.fecha>=(now() at time zone 'America/Lima')::date-180
     and public.asis_labora(colaborador,registro.fecha)
     and entrega.completado_at>=registro.marcado_at
     and entrega.completado_at between
         public.asis_cierre_fin_at(registro.colaborador_id,registro.fecha)
           -make_interval(mins=>config.salida_anticipacion_min)
       and public.asis_cierre_fin_at(registro.colaborador_id,registro.fecha)
           +make_interval(mins=>config.salida_gracia_min)
), auditadas as (
  insert into public.asis_cierre_regularizaciones_auto(
    registro_id,entrega_salida_id,salida_recuperada_at,motivo
  )
  select registro_id,entrega_salida_id,salida_recuperada_at,
         'Salida recuperada desde su evidencia; la jornada conserva sus entregables pendientes.'
    from candidatas
  on conflict(registro_id) do nothing
  returning registro_id
)
update public.asis_registros registro
   set salida_at=candidata.salida_recuperada_at,
       salida_dispositivo='recuperada:evidencia_salida',
       salida_origen='dashboard',
       salida_por=null,
       horas_efectivas=round(greatest(0,
         extract(epoch from(candidata.salida_recuperada_at-registro.marcado_at))/3600)::numeric,2),
       horas=round(greatest(0,
         extract(epoch from(candidata.salida_recuperada_at-registro.marcado_at))/3600)::numeric,2),
       cierre_regularizado=true,
       cierre_nota=concat_ws(E'\n',nullif(btrim(registro.cierre_nota),''),
         'Salida recuperada desde la evidencia registrada por el colaborador.'),
       cierre_actualizado_at=now()
  from candidatas candidata
 where registro.id=candidata.registro_id
   and registro.salida_at is null;

notify pgrst,'reload schema';
commit;

-- Mauricio debe aparecer con salida y con su comparticion aun pendiente.
select colaborador.id,colaborador.nombre,registro.fecha,
       registro.marcado_at as entrada_at,registro.salida_at,
       public.dash_cierre_resumen_colab(colaborador.id,registro.fecha)->>'estado' as jornada,
       public.dash_cierre_resumen_colab(colaborador.id,registro.fecha)->>'pendientes' as pendientes
  from public.asis_colaboradores colaborador
  join public.asis_registros registro on registro.colaborador_id=colaborador.id
 where colaborador.nombre ilike '%Mauricio%Obregon%'
   and registro.fecha=date '2026-09-09';
