-- Aplicar después de dashboard_103. Conserva la agenda y los descansos de la 87.
-- Las comparticiones no se exigen antes del inicio del contrato.
begin;
create or replace function public.asis_compartir_programado(p_colab bigint,p_fecha date)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_colab public.asis_colaboradores;
begin
  select * into v_colab from public.asis_colaboradores where id=p_colab;
  if not found or p_fecha is null then return false; end if;
  if v_colab.contrato_inicio is not null and p_fecha<v_colab.contrato_inicio then
    return false;
  end if;
  if not coalesce(v_colab.comparticiones_horario_configurado,false)
    and exists(select 1 from public.asis_descansos_presenciales where colaborador_id=p_colab and fecha=p_fecha) then
    return coalesce(public.asis_labora_base_87(v_colab,p_fecha),false);
  end if;
  return public.asis_compartir_programado_base_87(p_colab,p_fecha);
end $$;
notify pgrst,'reload schema';
commit;
