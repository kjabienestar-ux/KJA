-- Aplicar despues de dashboard_81_equipo_dia_detalle.sql.
-- La marca J exime la jornada tambien en el resumen personal e historico.
-- Facebook conserva su agenda, evidencias, revision y ventana de carga.
-- No modifica registros, horas, entregas ni archivos existentes.
begin;
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_82(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_82;
  end if;
end;
$$;
revoke all on function public.dash_cierre_resumen_colab_base_82(bigint,date)
  from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb;
  v_req jsonb;
  v_pending integer;
  v_share boolean;
begin
  v_data:=public.dash_cierre_resumen_colab_base_82(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  if not exists(select 1 from public.asis_registros
    where colaborador_id=p_colaborador and fecha=p_fecha and estado='J')
    then return v_data; end if;

  v_share:=coalesce((v_data->>'aplica_comparticiones')::boolean,false);
  select coalesce(jsonb_agg(item order by orden),'[]'::jsonb),
    count(*) filter(where not coalesce((item->>'completo')::boolean,false))
    into v_req,v_pending
    from jsonb_array_elements(coalesce(v_data->'requisitos','[]'::jsonb))
      with ordinality filas(item,orden)
    where v_share and item->>'tipo'='comparticiones';

  return v_data||jsonb_build_object(
    'justificado',true,'estado','justificado',
    'aplica',v_share,'aplica_jornada',false,'solo_comparticiones',v_share,
    'requiere_rpe',false,'requiere_salida',false,'puede_marcar_salida',false,
    'requisitos',v_req,'asignaciones','[]'::jsonb,
    'pendientes',v_pending,'pendientes_jornada',0,'pendientes_salida',0,
    'comparticiones_pendientes',v_pending>0,
    'comparticiones_vencidas',v_pending>0 and coalesce((v_data->>'comparticiones_vencidas')::boolean,false));
end;
$$;
revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
