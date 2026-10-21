-- Aplicar después de reclutamiento_01_solicitudes.sql.
-- Consulta pública limitada al estado más reciente, sin datos del expediente.
begin;
create index if not exists rec_postulaciones_dni_fecha
  on public.rec_postulaciones ((datos->>'dni'), created_at desc, id desc);

create or replace function public.rec_consultar_estado(p_dni text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then
    raise exception 'Ingresa un DNI de 8 dígitos' using errcode='22023';
  end if;
  select jsonb_build_object('estado', estado, 'created_at', created_at, 'updated_at', updated_at)
    into v_resultado
    from public.rec_postulaciones
    where datos->>'dni' = p_dni
    order by created_at desc, id desc limit 1;
  return v_resultado;
end;
$$;
revoke all on function public.rec_consultar_estado(text) from public;
grant execute on function public.rec_consultar_estado(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
