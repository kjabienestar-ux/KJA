-- Horarios habituales compartidos en Mi asistencia. No entrega registros de asistencia.
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
    'foto_actualizada_at', c.foto_actualizada_at
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

-- Las fotos siguen privadas; un colaborador activo puede leer solo avatares
-- de otros colaboradores activos durante una sesión vigente.
create or replace function public.dash_puede_ver_foto_companero(p_colab bigint)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.asis_colaboradores actual
                 where actual.id = public.dash_colab() and actual.activo = true)
    and exists (select 1 from public.asis_colaboradores c where c.id = p_colab and c.activo = true);
$$;

revoke all on function public.dash_puede_ver_foto_companero(bigint) from public, anon, authenticated;
grant execute on function public.dash_puede_ver_foto_companero(bigint) to authenticated;

drop policy if exists "perfil fotos: lectura autorizada" on storage.objects;
create policy "perfil fotos: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and public.dash_sesion_vigente()
    and name ~ '^[0-9]+/avatar\.(webp|jpg)$'
    and (
      public.asis_es_miembro()
      or public.puede_ver_colab(split_part(name, '/', 1)::bigint)
      or public.dash_puede_ver_foto_companero(split_part(name, '/', 1)::bigint)
    )
  );

notify pgrst, 'reload schema';

commit;
