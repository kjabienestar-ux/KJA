-- =====================================================================
--  KJA · Asistencia — Migración 8: estado de cada persona en la lista
--  Aditiva y segura (no borra datos). Requiere la migración 6.
--
--  La lista del portal solo distinguía quién tenía clave y quién no.
--  Ahora devuelve además si esa persona labora hoy y si ya marcó, para
--  que en la pantalla se vea de un vistazo quién falta.
--
--  Reemplaza asis_portal_personas() conservando su firma, así que basta
--  con ejecutar este archivo: no hay que borrar la anterior.
-- =====================================================================

create or replace function public.asis_portal_personas(p_clave text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.asis_portal_config;
  v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  return jsonb_build_object(
    'ok', true,
    'hoy', v_hoy,
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',          c.id,
               'nombre',      c.nombre,
               'area',        a.nombre,
               'tiene_clave', k.colaborador_id is not null,
               'labora',      public.asis_labora(c, v_hoy),
               'marcado',     r.id is not null,
               'estado',      r.estado,
               'hora',        to_char(r.marcado_at at time zone 'America/Lima', 'HH24:MI')
             ) order by a.nombre, c.nombre)
        from public.asis_colaboradores c
        join public.asis_areas a         on a.id = c.area_id
        left join public.asis_claves k   on k.colaborador_id = c.id
        left join public.asis_registros r on r.colaborador_id = c.id and r.fecha = v_hoy
       where c.activo), '[]'::jsonb));
end;
$$;

grant execute on function public.asis_portal_personas(text) to anon, authenticated;

notify pgrst, 'reload schema';
