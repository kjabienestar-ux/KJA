-- Aplicar despues de dashboard_82_justificacion_cierre_personal.sql.
-- Expone las fechas del contrato para delimitar el calendario del colaborador.
-- El fin es referencial: esta migracion no cambia obligaciones ni registros.
begin;
do $$
begin
  if to_regprocedure('public.dash_historial_base_83(integer,integer,bigint)') is null then
    alter function public.dash_historial(integer,integer,bigint)
      rename to dash_historial_base_83;
  end if;
end;
$$;
revoke all on function public.dash_historial_base_83(integer,integer,bigint)
  from public,anon,authenticated;

create or replace function public.dash_historial(p_anio int,p_mes int,p_colab bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_data jsonb;
  v_contrato jsonb;
begin
  -- El historial original valida sesion, acceso al colaborador y periodo.
  v_data:=public.dash_historial_base_83(p_anio,p_mes,p_colab);
  if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
  select jsonb_build_object(
    'contrato_inicio',c.contrato_inicio,
    'contrato_fin_referencia',c.contrato_fin_referencia
  ) into v_contrato
  from public.asis_colaboradores c
  where c.id=coalesce(p_colab,public.dash_colab());
  return v_data||jsonb_build_object('calendario_contrato',v_contrato);
end;
$$;
revoke all on function public.dash_historial(integer,integer,bigint)
  from public,anon,authenticated;
grant execute on function public.dash_historial(integer,integer,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
