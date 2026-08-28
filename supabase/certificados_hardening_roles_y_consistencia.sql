-- =============================================================================
-- KJA · Certificados — endurecimiento de roles y escrituras confirmables
--
-- Migración aditiva e idempotente. No borra certificados ni cambia códigos,
-- clientes o sesiones existentes. Debe ejecutarse antes de publicar el HTML y
-- las Edge Functions que la consumen.
-- =============================================================================

alter table public.certificados
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_at timestamptz;

create or replace function public.cert_es_miembro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.perfiles where id = auth.uid()
  );
$$;

create or replace function public.cert_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.perfiles
     where id = auth.uid() and rol = 'admin'
  );
$$;

revoke all on function public.cert_es_miembro() from public, anon;
revoke all on function public.cert_es_admin() from public, anon;
grant execute on function public.cert_es_miembro() to authenticated;
grant execute on function public.cert_es_admin() to authenticated;


-- La edición sigue abierta a todo el equipo de certificados, pero el código
-- de un certificado emitido solo puede cambiarlo el administrador.
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
  v_es_admin boolean;
begin
  if not public.cert_es_miembro() then
    raise exception 'No tienes permiso para editar certificados'
      using errcode = '42501';
  end if;
  v_es_admin := public.cert_es_admin();

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

  update public.certificados c
     set codigo           = case when v_es_admin then v_nuevo.codigo else c.codigo end,
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
   where c.id = p_cert_id
   returning c.* into v_guardado;

  if not found then
    raise exception 'El certificado no existe o ya no está disponible'
      using errcode = 'P0002';
  end if;

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


-- Las RPC de correo conservan sus firmas para no interrumpir el HTML actual.
-- Ahora validan pertenencia al equipo y fallan si el registro no existe.
create or replace function public.marcar_certificado_enviado(
  p_cert_id uuid,
  p_ahora timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cert_es_miembro() then
    raise exception 'No tienes permiso para registrar envíos de certificados'
      using errcode = '42501';
  end if;

  update public.certificados
     set correo_enviado_at = coalesce(p_ahora, now())
   where id = p_cert_id;

  if not found then
    raise exception 'El certificado no existe'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.guardar_email_cliente(
  p_cliente_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cert_es_miembro() then
    raise exception 'No tienes permiso para modificar clientes de certificados'
      using errcode = '42501';
  end if;
  if btrim(coalesce(p_email, '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'El correo no es válido'
      using errcode = '22023';
  end if;

  update public.clientes
     set email = lower(btrim(p_email))
   where id = p_cliente_id;

  if not found then
    raise exception 'El cliente no existe'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.marcar_certificado_enviado(uuid, timestamptz)
  from public, anon;
revoke all on function public.guardar_email_cliente(uuid, text)
  from public, anon;
grant execute on function public.marcar_certificado_enviado(uuid, timestamptz)
  to authenticated;
grant execute on function public.guardar_email_cliente(uuid, text)
  to authenticated;


-- Sincronización explícita para certificados nuevos asociados a un cliente
-- existente. Evita ignorar un UPDATE filtrado por RLS.
create or replace function public.sincronizar_cliente_certificados(
  p_cliente_id uuid,
  p_nombre text,
  p_dni text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes;
begin
  if not public.cert_es_miembro() then
    raise exception 'No tienes permiso para modificar clientes de certificados'
      using errcode = '42501';
  end if;

  update public.clientes
     set nombre = btrim(p_nombre),
         dni = nullif(btrim(coalesce(p_dni, '')), '')
   where id = p_cliente_id
   returning * into v_cliente;

  if not found then
    raise exception 'El cliente no existe'
      using errcode = 'P0002';
  end if;
  return to_jsonb(v_cliente);
end;
$$;

revoke all on function public.sincronizar_cliente_certificados(uuid, text, text)
  from public, anon;
grant execute on function public.sincronizar_cliente_certificados(uuid, text, text)
  to authenticated;


-- Operaciones destructivas: solo admin y siempre devuelven una confirmación.
create or replace function public.cambiar_oculto_certificados_admin(
  p_cert_ids uuid[],
  p_oculto boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if not public.cert_es_admin() then
    raise exception 'Solo el administrador puede ocultar o restaurar certificados'
      using errcode = '42501';
  end if;
  if coalesce(cardinality(p_cert_ids), 0) = 0 then
    raise exception 'No se indicaron certificados'
      using errcode = '22023';
  end if;

  update public.certificados
     set oculto = p_oculto
   where id = any(p_cert_ids);
  get diagnostics v_total = row_count;

  if v_total <> cardinality(p_cert_ids) then
    raise exception 'No se encontraron todos los certificados solicitados'
      using errcode = 'P0002';
  end if;
  return v_total;
end;
$$;

create or replace function public.eliminar_certificado_admin(
  p_cert_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.cert_es_admin() then
    raise exception 'Solo el administrador puede eliminar certificados'
      using errcode = '42501';
  end if;

  delete from public.certificados
   where id = p_cert_id
   returning id into v_id;

  if v_id is null then
    raise exception 'El certificado no existe'
      using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

revoke all on function public.cambiar_oculto_certificados_admin(uuid[], boolean)
  from public, anon;
revoke all on function public.eliminar_certificado_admin(uuid)
  from public, anon;
grant execute on function public.cambiar_oculto_certificados_admin(uuid[], boolean)
  to authenticated;
grant execute on function public.eliminar_certificado_admin(uuid)
  to authenticated;

notify pgrst, 'reload schema';
