-- Aplicar despues de dashboard_76_horarios_companeros.sql.
-- El calendario del equipo comienza en la primera entrada registrada (P/T).
-- Solo consulta registros: no altera asistencias, horas ni evidencias.
begin;

create or replace function public.dash_horarios_companeros()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_personas jsonb;
begin
  if not public.dash_sesion_vigente() or not exists (
    select 1 from public.asis_colaboradores actual
    where actual.id = public.dash_colab() and actual.activo = true
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'nombre', c.nombre,
    'area', coalesce(a.nombre, 'Sin área'),
    'dias_laborables', c.dias_laborables,
    'horario_semanal', c.horario_semanal,
    'hora_inicio', c.hora_inicio,
    'hora_fin', c.hora_fin,
    'foto_path', c.foto_path,
    'foto_actualizada_at', c.foto_actualizada_at,
    'primera_asistencia', (
      select min(r.fecha)
      from public.asis_registros r
      where r.colaborador_id = c.id
        and r.estado in ('P','T')
        and r.marcado_at is not null
    )
  ) order by c.nombre), '[]'::jsonb)
  into v_personas
  from public.asis_colaboradores c
  left join public.asis_areas a on a.id = c.area_id
  where c.activo = true
    and c.area_id = (select actual.area_id from public.asis_colaboradores actual where actual.id = public.dash_colab());

  return jsonb_build_object('ok', true, 'personas', v_personas);
end;
$$;

revoke all on function public.dash_horarios_companeros() from public, anon, authenticated;
grant execute on function public.dash_horarios_companeros() to authenticated;
notify pgrst, 'reload schema';
commit;
