-- Ejecutar después de 110. Directorio de candidatos visible solo para Sistemas.
begin;
create or replace function public.dash_zoom_operaciones()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'admin',public.dash_zoom_gestiona(),
 'candidates',case when public.dash_zoom_gestiona() then coalesce((
 select jsonb_agg(jsonb_build_object('email',u.email,'nombre',coalesce(c.nombre,u.email)) order by coalesce(c.nombre,u.email))
 from public.asis_perfiles p join auth.users u on u.id=p.id
 left join public.asis_colaboradores c on c.id=p.colaborador_id
 where p.activo and p.acceso_panel and u.email is not null
 and (p.colaborador_id is null or c.activo)
 ),'[]'::jsonb) else '[]'::jsonb end,'meetings',
 coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'topic',r.topic,'zoom_id',r.zoom_id,
 'operators',case when public.dash_zoom_gestiona() then
 coalesce((select jsonb_agg(u.email order by u.email) from public.zoom_operadores o join auth.users u on u.id=o.perfil_id where o.reunion_id=r.id),'[]'::jsonb)
 else '[]'::jsonb end) order by r.topic)
 from public.zoom_reuniones r where public.dash_zoom_opera(r.id)),'[]'::jsonb));
$$;
revoke all on function public.dash_zoom_operaciones() from public,anon;
grant execute on function public.dash_zoom_operaciones() to authenticated;
notify pgrst,'reload schema';
commit;
