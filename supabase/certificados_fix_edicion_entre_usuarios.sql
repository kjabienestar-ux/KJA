-- =============================================================================
-- KJA · Certificados — edición compartida y autoría de la última modificación
--
-- Problema: la política RLS histórica de UPDATE solo deja modificar al creador.
-- PostgREST no considera un error que RLS filtre la fila: devuelve éxito con cero
-- filas y el frontend termina mostrando una confirmación falsa.
--
-- Esta migración mantiene intacto `creado_por` y agrega la autoría correcta de
-- cada edición. La RPC solo acepta campos editables y exige una sesión cuyo uid
-- exista en `perfiles`.
-- =============================================================================

alter table public.certificados
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_at timestamptz;

comment on column public.certificados.actualizado_por is
  'Último integrante que modificó el certificado; no reemplaza al creador.';
comment on column public.certificados.actualizado_at is
  'Fecha y hora de la última modificación del certificado.';

create or replace function public.actualizar_certificado_equipo(
  p_cert_id uuid,
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambios jsonb;
  v_nuevo public.certificados;
  v_guardado public.certificados;
begin
  if auth.uid() is null or not exists (
    select 1 from public.perfiles where id = auth.uid()
  ) then
    raise exception 'No tienes permiso para editar certificados'
      using errcode = '42501';
  end if;

  -- Lista blanca: aunque el cliente mande más propiedades, nunca puede alterar
  -- id, creado_por, created_at, oculto ni los datos de auditoría.
  v_cambios := jsonb_strip_nulls(jsonb_build_object(
    'codigo',           p_cambios -> 'codigo',
    'tipo',             p_cambios -> 'tipo',
    'nombre',           p_cambios -> 'nombre',
    'dni',              p_cambios -> 'dni',
    'titulo',           p_cambios -> 'titulo',
    'duracion',         p_cambios -> 'duracion',
    'fecha_inicio',     p_cambios -> 'fecha_inicio',
    'fecha_fin',        p_cambios -> 'fecha_fin',
    'fecha_emision',    p_cambios -> 'fecha_emision',
    'cliente_id',       p_cambios -> 'cliente_id',
    'temario',          p_cambios -> 'temario',
    'font_size_nombre', p_cambios -> 'font_size_nombre',
    'font_nombre',      p_cambios -> 'font_nombre',
    'datos',            p_cambios -> 'datos'
  ));
  v_nuevo := jsonb_populate_record(null::public.certificados, v_cambios);

  update public.certificados
     set codigo           = v_nuevo.codigo,
         tipo             = v_nuevo.tipo,
         nombre           = v_nuevo.nombre,
         dni              = v_nuevo.dni,
         titulo           = v_nuevo.titulo,
         duracion         = v_nuevo.duracion,
         fecha_inicio     = v_nuevo.fecha_inicio,
         fecha_fin        = v_nuevo.fecha_fin,
         fecha_emision    = v_nuevo.fecha_emision,
         cliente_id       = v_nuevo.cliente_id,
         temario          = v_nuevo.temario,
         font_size_nombre = v_nuevo.font_size_nombre,
         font_nombre      = v_nuevo.font_nombre,
         datos            = v_nuevo.datos,
         actualizado_por  = auth.uid(),
         actualizado_at   = now()
   where id = p_cert_id
   returning * into v_guardado;

  if not found then
    raise exception 'El certificado no existe o ya no está disponible'
      using errcode = 'P0002';
  end if;

  -- El registro público agrupa por cliente. Se sincroniza dentro de la misma
  -- transacción para que nombre/DNI no queden en una versión anterior.
  update public.clientes
     set nombre = v_guardado.nombre,
         dni = v_guardado.dni
   where id = v_guardado.cliente_id;

  return to_jsonb(v_guardado);
end;
$$;

revoke all on function public.actualizar_certificado_equipo(uuid, jsonb)
  from public, anon;
grant execute on function public.actualizar_certificado_equipo(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

-- Comprobación rápida después de ejecutar esta migración:
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='certificados'
--    and column_name in ('actualizado_por','actualizado_at');
-- select public.actualizar_certificado_equipo(...); -- probar desde una sesión
