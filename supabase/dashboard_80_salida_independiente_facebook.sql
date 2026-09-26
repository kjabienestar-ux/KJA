-- Aplicar despues de dashboard_79_historial_evidencias.sql.
-- El estado general puede ser incompleta por Facebook sin haber vencido la
-- salida laboral. Expone el vencimiento real sin cambiar horarios ni registros.
begin;
do $$
begin
  if to_regprocedure('public.dash_cierre_resumen_colab_base_80(bigint,date)') is null then
    alter function public.dash_cierre_resumen_colab(bigint,date)
      rename to dash_cierre_resumen_colab_base_80;
  end if;
end;
$$;
revoke all on function public.dash_cierre_resumen_colab_base_80(bigint,date)
  from public,anon,authenticated;

create or replace function public.dash_cierre_resumen_colab(p_colaborador bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb;
  v_hasta timestamptz;
begin
  v_data:=public.dash_cierre_resumen_colab_base_80(p_colaborador,p_fecha);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select public.asis_cierre_fin_at(p_colaborador,p_fecha)
         +make_interval(mins=>salida_gracia_min)
    into v_hasta from public.asis_cierre_config where id=1;
  return v_data||jsonb_build_object('salida_ventana_vencida',
    coalesce(now()>v_hasta,false));
end;
$$;
revoke all on function public.dash_cierre_resumen_colab(bigint,date)
  from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
