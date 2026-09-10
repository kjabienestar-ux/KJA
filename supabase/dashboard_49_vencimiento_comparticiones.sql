-- DASHBOARD 49 · VENCIMIENTO DE COMPARTICIONES
-- Ejecutar despues de dashboard_48_separar_jornada_y_comparticiones.sql.
--
-- Facebook no bloquea la salida mientras su franja siga pendiente, pero la
-- entrega continúa siendo obligatoria. Si la franja termina sin evidencia, el
-- estado general del día pasa automáticamente a incompleto.

begin;

do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_49(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_49;
  end if;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab_base_49(bigint,date)
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
  v_comparticiones_pendientes boolean:=false;
  v_compartir_hasta timestamptz;
  v_comparticiones_vencidas boolean:=false;
begin
  v_resultado:=public.dash_cierre_resumen_colab_base_49(p_colaborador,p_fecha);
  if not coalesce((v_resultado->>'ok')::boolean,false) then return v_resultado; end if;

  v_comparticiones_pendientes:=coalesce(
    (v_resultado->>'comparticiones_pendientes')::boolean,
    false
  );
  if v_comparticiones_pendientes then
    v_compartir_hasta:=public.asis_compartir_fin_at(p_colaborador,p_fecha);
    v_comparticiones_vencidas:=v_compartir_hasta is not null and now()>v_compartir_hasta;
  end if;

  v_resultado:=jsonb_set(
    v_resultado,'{comparticiones_vencidas}',to_jsonb(v_comparticiones_vencidas),true
  );

  if v_comparticiones_vencidas then
    v_resultado:=jsonb_set(v_resultado,'{estado}',to_jsonb('incompleta'::text),true);
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;

notify pgrst,'reload schema';
commit;

-- Verificación: distingue las comparticiones que aún esperan su franja de las
-- que ya vencieron. Las vencidas deben devolver estado incompleta.
select colaborador.id,colaborador.nombre,registro.fecha,
       resumen.valor->>'estado' as estado,
       resumen.valor->>'comparticiones_pendientes' as facebook_pendiente,
       resumen.valor->>'comparticiones_vencidas' as facebook_vencido
  from public.asis_colaboradores colaborador
  join public.asis_registros registro on registro.colaborador_id=colaborador.id
  cross join lateral (
    select public.dash_cierre_resumen_colab(colaborador.id,registro.fecha) as valor
  ) resumen
 where registro.fecha between (now() at time zone 'America/Lima')::date-7
                          and (now() at time zone 'America/Lima')::date
 order by registro.fecha desc,colaborador.nombre;
