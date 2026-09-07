-- DASHBOARD 22 — LÍDER TÉCNICO · EVIDENCIAS DE SU ÁREA EN SOLO LECTURA
-- Ejecutar después de dashboard_21_revision_evidencias.sql.
-- No modifica entregas, revisiones, entradas, salidas ni horas.

begin;

-- Dirección conserva acceso global y capacidad de revisión. El líder recibe
-- únicamente las entregas de colaboradores de su propia área.
create or replace function public.dash_admin_revision_entregas(p_fecha date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_es_direccion boolean := coalesce(public.asis_rol() = 'direccion', false);
  v_es_lider boolean := coalesce(
    public.dash_sesion_vigente() and public.dash_nivel() = 'lider', false
  );
  v_area bigint := public.dash_area();
  v_entregas jsonb;
begin
  if not v_es_direccion and not v_es_lider then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  if v_es_lider and v_area is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_area');
  end if;
  if p_fecha is null or p_fecha < date '2020-01-01' or p_fecha > v_hoy + 90 then
    return jsonb_build_object('ok', false, 'motivo', 'fecha');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'colaborador_id', e.colaborador_id,
           'colaborador', c.nombre,
           'area_id', c.area_id,
           'area', a.nombre,
           'fecha', e.fecha,
           'requisito', e.requisito,
           'asignacion_id', e.asignacion_id,
           'titulo', case e.requisito
             when 'comparticiones' then 'Comparticiones de Facebook'
             when 'rpe' then 'RPE y evidencias del día'
             else coalesce(ad.titulo, 'Entregable asignado') end,
           'modalidad', e.modalidad,
           'detalle', e.detalle,
           'estado', e.estado,
           'revision_estado', e.revision_estado,
           'revision_nota', e.revision_nota,
           'completado_at', e.completado_at,
           'revisado_at', e.revisado_at,
           'revisor', rp.nombre,
           'jornada_cerrada', r.salida_at is not null,
           'archivos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'path', f.path, 'mime', f.mime, 'bytes', f.bytes, 'orden', f.orden
                    ) order by f.orden)
               from public.asis_entrega_archivos f
              where f.entrega_id = e.id
           ), '[]'::jsonb)
         ) order by
           case e.revision_estado when 'pendiente' then 0 when 'observada' then 1 else 2 end,
           e.completado_at desc), '[]'::jsonb)
    into v_entregas
    from public.asis_entregas_diarias e
    join public.asis_colaboradores c on c.id = e.colaborador_id
    join public.asis_areas a on a.id = c.area_id
    left join public.asis_asignaciones_diarias ad on ad.id = e.asignacion_id
    left join public.asis_perfiles rp on rp.id = e.revisado_por
    left join public.asis_registros r
      on r.colaborador_id = e.colaborador_id and r.fecha = e.fecha
   where e.fecha = p_fecha
     and (v_es_direccion or c.area_id = v_area);

  return jsonb_build_object(
    'ok', true,
    'fecha', p_fecha,
    'area_id', case when v_es_lider then v_area else null end,
    'puede_revisar', v_es_direccion,
    'solo_lectura', v_es_lider,
    'entregas', v_entregas
  );
end;
$$;

revoke all on function public.dash_admin_revision_entregas(date) from public, anon;
grant execute on function public.dash_admin_revision_entregas(date) to authenticated;

-- La ruta vuelve a comprobar el colaborador del cuarto segmento. El líder solo
-- puede firmar URLs de personas que puede_ver_colab() autoriza en su área.
drop policy if exists "cierre evidencias: lectura autorizada" on storage.objects;
create policy "cierre evidencias: lectura autorizada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'asis-cierre-evidencias'
    and name ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]+/[0-9a-f-]+\.(jpg|webp)$'
    and (
      public.asis_rol() = 'direccion'
      or (
        public.dash_sesion_vigente()
        and (
          public.dash_colab() = split_part(name, '/', 4)::bigint
          or (
            public.dash_nivel() = 'lider'
            and public.puede_ver_colab(split_part(name, '/', 4)::bigint)
          )
        )
      )
    )
  );

notify pgrst, 'reload schema';

commit;

select case when encontrado = esperado then 'OK' else 'REVISAR' end as estado,
       pieza, encontrado, esperado
from (
  select 'RPC líder por área'::text as pieza,
         count(*)::int as encontrado, 1 as esperado
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'dash_admin_revision_entregas'
  union all
  select 'lectura privada líder',
         count(*)::int, 1
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'cierre evidencias: lectura autorizada'
) q;
