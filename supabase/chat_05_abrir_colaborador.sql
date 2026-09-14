-- Ejecutar después de chat_04. Resuelve el colaborador del panel a su cuenta de chat.
begin;
create or replace function public.chat_cuenta_colaborador(p_colaborador bigint)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare v_cuenta uuid;
begin
  if not exists(select 1 from public.asis_perfiles where id=auth.uid() and activo and rol='direccion') then
    raise exception 'Solo Dirección puede abrir conversaciones desde este panel.';
  end if;
  select p.id into v_cuenta from public.asis_perfiles p
    join public.asis_colaboradores c on c.id=p.colaborador_id
    where c.id=p_colaborador and c.activo and p.activo;
  if v_cuenta is null then raise exception 'Este colaborador todavía no tiene una cuenta activa vinculada al chat.'; end if;
  if v_cuenta=auth.uid() then raise exception 'No puedes abrir una conversación contigo mismo.'; end if;
  return v_cuenta;
end;
$$;
revoke all on function public.chat_cuenta_colaborador(bigint) from public,anon,authenticated;
grant execute on function public.chat_cuenta_colaborador(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
