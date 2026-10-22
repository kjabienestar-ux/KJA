-- Ejecutar después de reclutamiento_01_solicitudes.sql.
begin;

create or replace function public.rec_eliminar(p_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.rec_es_admin() then
    raise exception 'Acceso reservado a administración' using errcode='42501';
  end if;
  -- La revisión evita eliminar un expediente modificado desde que se abrió.
  -- rec_curriculos se elimina en la misma transacción mediante ON DELETE CASCADE.
  delete from public.rec_postulaciones
    where id=p_id and revision=p_revision returning id into v_id;
  if not found then
    raise exception 'El expediente cambió o ya fue eliminado. Actualiza la bandeja antes de eliminar';
  end if;
  return jsonb_build_object('id',v_id,'eliminado',true);
end;
$$;
revoke all on function public.rec_eliminar(uuid,integer) from public,anon;
grant execute on function public.rec_eliminar(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
