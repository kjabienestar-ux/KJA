-- Ejecutar después de dashboard_59. Excluye asignaciones retiradas de la revisión operativa.
begin;
do $$ begin
 if to_regprocedure('public.dash_admin_revision_entregas_base_60(date)') is null then
   alter function public.dash_admin_revision_entregas(date) rename to dash_admin_revision_entregas_base_60;
 end if;
end $$;
revoke all on function public.dash_admin_revision_entregas_base_60(date) from public,anon,authenticated;
create or replace function public.dash_admin_revision_entregas(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_data jsonb; v_entregas jsonb;
begin
 v_data:=public.dash_admin_revision_entregas_base_60(p_fecha);
 if not coalesce((v_data->>'ok')::boolean,false) then return v_data; end if;
 select coalesce(jsonb_agg(item order by orden),'[]'::jsonb) into v_entregas
 from jsonb_array_elements(coalesce(v_data->'entregas','[]'::jsonb)) with ordinality as filas(item,orden)
 where item->>'requisito' is distinct from 'asignado'
 or exists(select 1 from public.asis_asignaciones_diarias a
   where a.id=(item->>'asignacion_id')::bigint and a.activo);
 return jsonb_set(v_data,'{entregas}',v_entregas,true);
end $$;
revoke all on function public.dash_admin_revision_entregas(date) from public,anon,authenticated;
grant execute on function public.dash_admin_revision_entregas(date) to authenticated;
notify pgrst,'reload schema';
commit;
