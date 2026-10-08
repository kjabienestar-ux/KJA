-- Aplicar despues de dashboard_104. Feriado del 08/10/2026 para todo el equipo.
-- Solo conserva Facebook para quienes tienen comparticiones programadas.
-- No elimina marcaciones, entregas, archivos ni asignaciones existentes.
begin;

update public.asis_excepciones
   set tipo='feriado',nota='Feriado 08/10/2026: solo comparticiones programadas'
 where fecha=date '2026-10-08' and ambito='empresa';
insert into public.asis_excepciones(fecha,ambito,tipo,nota)
select date '2026-10-08','empresa','feriado',
       'Feriado 08/10/2026: solo comparticiones programadas'
where not exists(select 1 from public.asis_excepciones
  where fecha=date '2026-10-08' and ambito='empresa');

-- El calendario da prioridad a las excepciones personales de jornada extra.
update public.asis_excepciones
   set tipo='no_laborable',nota=concat_ws(' / ',nullif(nota,''),'Feriado 08/10/2026')
 where fecha=date '2026-10-08' and ambito='colaborador' and tipo='laborable_extra';

do $$ begin
  if to_regprocedure('public.asis_labora_base_106(public.asis_colaboradores,date)') is null then
    alter function public.asis_labora(public.asis_colaboradores,date) rename to asis_labora_base_106;
  end if;
  if to_regprocedure('public.asis_compartir_programado_base_106(bigint,date)') is null then
    alter function public.asis_compartir_programado(bigint,date) rename to asis_compartir_programado_base_106;
  end if;
  if to_regprocedure('public.dash_cierre_resumen_colab_base_106(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date) rename to dash_cierre_resumen_colab_base_106;
  end if;
end $$;

create or replace function public.asis_labora(p_colab public.asis_colaboradores,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select case when p_fecha=date '2026-10-08' then false
    else public.asis_labora_base_106(p_colab,p_fecha) end
$$;

create or replace function public.asis_compartir_programado(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_colab public.asis_colaboradores; v_dow integer:=extract(isodow from p_fecha)::integer;
begin
  if p_fecha is distinct from date '2026-10-08' then
    return public.asis_compartir_programado_base_106(p_colab,p_fecha);
  end if;
  select * into v_colab from public.asis_colaboradores where id=p_colab and activo;
  if not found or (v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio) then
    return false;
  end if;
  if coalesce(v_colab.comparticiones_horario_configurado,false) then
    return exists(select 1 from public.asis_comparticiones_horarios
      where colaborador_id=p_colab and dia_semana=v_dow);
  end if;
  -- La agenda heredada usa el horario habitual, sin volver a exigir jornada.
  return coalesce(v_colab.horario_semanal->v_dow::text->>'mod',
    case when v_dow=any(v_colab.dias_laborables) then 'virtual' else 'no_gestiona' end)<>'no_gestiona';
end $$;

create or replace function public.dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_req jsonb; v_pending integer; v_share boolean;
begin
  v_data:=public.dash_cierre_resumen_colab_base_106(p_colaborador,p_fecha);
  if p_fecha is distinct from date '2026-10-08'
    or not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  v_share:=coalesce((v_data->>'aplica_comparticiones')::boolean,false);
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb),
    count(*) filter(where not coalesce((item->>'completo')::boolean,false))
    into v_req,v_pending
    from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
      with ordinality filas(item,orden)
    where v_share and item->>'tipo'='comparticiones';
  return v_data||jsonb_build_object(
    'feriado',true,'aplica',v_share,'aplica_jornada',false,'solo_comparticiones',v_share,
    'requiere_rpe',false,'requiere_salida',false,'puede_marcar_salida',false,
    'salida_ventana_vencida',false,
    'requisitos',v_req,'asignaciones','[]'::jsonb,
    'pendientes',v_pending,'pendientes_jornada',0,'pendientes_salida',0,
    'comparticiones_pendientes',v_pending>0,
    'comparticiones_vencidas',v_pending>0 and coalesce((v_data->>'comparticiones_vencidas')::boolean,false),
    'estado',case when not v_share then 'no_aplica' when v_pending=0 then 'completa'
      when coalesce((v_data->>'comparticiones_vencidas')::boolean,false) then 'incompleta' else 'en_curso' end);
end $$;

revoke all on function public.asis_labora_base_106(public.asis_colaboradores,date),
  public.asis_compartir_programado_base_106(bigint,date),
  public.dash_cierre_resumen_colab_base_106(bigint,date),
  public.asis_labora(public.asis_colaboradores,date),
  public.asis_compartir_programado(bigint,date),
  public.dash_cierre_resumen_colab(bigint,date) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

-- Todos deben tener labora=false, pendientes_jornada=0 y pendientes_salida=0.
-- Sin Facebook programado, requisitos y asignaciones deben estar vacios.
select c.id,c.nombre,public.asis_labora(c,date '2026-10-08') as labora,
  public.dash_cierre_resumen_colab(c.id,date '2026-10-08') as cierre
from public.asis_colaboradores c where c.activo order by c.nombre;
