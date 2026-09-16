-- Cantidad declarada de comparticiones, independiente del número de archivos.
begin;
alter table public.asis_entregas_diarias
  add column if not exists cantidad_compartida integer
  check (cantidad_compartida between 1 and 99999);

-- Sin cantidad: consultar. Con cantidad: guardar únicamente en una entrega propia.
create or replace function public.dash_cantidad_compartida(p_entrega_id bigint, p_cantidad integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_colab bigint:=public.dash_colab(); v_cantidad integer;
begin
  if not public.dash_sesion_vigente() or v_colab is null then
    return jsonb_build_object('ok',false,'motivo','sesion');
  end if;
  if p_cantidad is not null and (p_cantidad<1 or p_cantidad>99999) then
    return jsonb_build_object('ok',false,'motivo','cantidad');
  end if;
  select cantidad_compartida into v_cantidad from public.asis_entregas_diarias
    where id=p_entrega_id and colaborador_id=v_colab
      and requisito='comparticiones' and estado='completo' for update;
  if not found then return jsonb_build_object('ok',false,'motivo','sin_entrega'); end if;
  if p_cantidad is not null then
    update public.asis_entregas_diarias set cantidad_compartida=p_cantidad
      where id=p_entrega_id and colaborador_id=v_colab;
    v_cantidad:=p_cantidad;
  end if;
  return jsonb_build_object('ok',true,'cantidad',v_cantidad);
end $$;
revoke all on function public.dash_cantidad_compartida(bigint,integer) from public,anon;
grant execute on function public.dash_cantidad_compartida(bigint,integer) to authenticated;
notify pgrst,'reload schema';
commit;
