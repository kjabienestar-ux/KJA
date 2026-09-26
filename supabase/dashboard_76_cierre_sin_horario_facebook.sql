-- Aplicar despues de dashboard_75.
-- Sin horario de Facebook, BETWEEN devolvia NULL. Al propagarse por
-- dash_evidencia_editable y jsonb_set, el resumen completo pasaba a ser NULL.
-- No modifica marcaciones, entregas, archivos ni horarios.
begin;

create or replace function public.asis_compartir_en_ventana(p_colab bigint,p_fecha date)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    now() between public.asis_compartir_inicio_at(p_colab,p_fecha)
                  and public.asis_compartir_fin_at(p_colab,p_fecha),
    false
  )
$$;

create or replace function public.dash_evidencia_editable(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_reg public.asis_registros; v_fin_at timestamptz; v_laboral boolean:=false;
begin
  if p_colab is null or p_fecha is null then return false; end if;
  select * into v_reg from public.asis_registros
   where colaborador_id=p_colab and fecha=p_fecha;
  if v_reg.id is not null and v_reg.marcado_at is not null and v_reg.salida_at is null then
    v_fin_at:=public.asis_cierre_fin_at(p_colab,p_fecha);
    v_laboral:=v_fin_at is not null and now() between v_reg.marcado_at and v_fin_at;
  end if;
  return coalesce(v_laboral,false) or coalesce(public.asis_compartir_en_ventana(p_colab,p_fecha),false);
end $$;

revoke all on function public.asis_compartir_en_ventana(bigint,date),
  public.dash_evidencia_editable(bigint,date) from public,anon,authenticated;

commit;
