-- Ejecutar en el SQL Editor de Supabase después de dashboard_06_admin_equipo.sql.
-- No cambia datos al instalarse. Conserva todas las referencias, incluso CASCADE/SET NULL.
begin;

create or replace function public.dash_admin_editar_area(p_area bigint,p_nombre text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_nombre text:=btrim(coalesce(p_nombre,'')); v_area public.asis_areas;
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  if char_length(v_nombre) not between 2 and 60 then return jsonb_build_object('ok',false,'motivo','nombre'); end if;
  lock table public.asis_areas in share row exclusive mode;
  if not exists(select 1 from public.asis_areas where id=p_area) then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  if exists(select 1 from public.asis_areas where id<>p_area and lower(nombre)=lower(v_nombre)) then
    return jsonb_build_object('ok',false,'motivo','duplicada');
  end if;
  update public.asis_areas set nombre=v_nombre where id=p_area returning * into v_area;
  return jsonb_build_object('ok',true,'area',jsonb_build_object('id',v_area.id,'nombre',v_area.nombre,'activo',v_area.activo,'orden',v_area.orden));
exception when unique_violation then return jsonb_build_object('ok',false,'motivo','duplicada');
end;
$$;

create or replace function public.dash_admin_eliminar_area(p_area bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_ref record; v_used boolean;
begin
  if not public.asis_puede_editar() then return jsonb_build_object('ok',false,'motivo','sin_permiso'); end if;
  -- Bloquea nuevas referencias a esta fila mientras se revisan sus dependencias.
  perform 1 from public.asis_areas where id=p_area for update;
  if not found then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
  -- Incluye colaboradores inactivos, asignaciones e historial de liderazgo.
  for v_ref in
    select ns.nspname,rel.relname,att.attname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class rel on rel.oid=c.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
    join pg_catalog.pg_attribute att on att.attrelid=c.conrelid and att.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.asis_areas'::regclass
  loop
    execute format('select exists(select 1 from %I.%I where %I=$1)',v_ref.nspname,v_ref.relname,v_ref.attname) into v_used using p_area;
    if v_used then return jsonb_build_object('ok',false,'motivo','en_uso'); end if;
  end loop;
  delete from public.asis_areas where id=p_area;
  return jsonb_build_object('ok',true);
exception when foreign_key_violation then return jsonb_build_object('ok',false,'motivo','en_uso');
end;
$$;

revoke all on function public.dash_admin_editar_area(bigint,text) from public,anon;
revoke all on function public.dash_admin_eliminar_area(bigint) from public,anon;
grant execute on function public.dash_admin_editar_area(bigint,text) to authenticated;
grant execute on function public.dash_admin_eliminar_area(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
