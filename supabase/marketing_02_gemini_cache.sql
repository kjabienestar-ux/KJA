-- Aplicar después de marketing_01_publicaciones.sql, incluso si ya se activó el módulo.
begin;
alter table public.marketing_publicaciones
  add column if not exists extraccion jsonb,
  add column if not exists extraccion_modelo text,
  add column if not exists extraccion_at timestamptz,
  add column if not exists lectura_token uuid,
  add column if not exists lectura_inicio timestamptz;
alter table public.marketing_lecturas add column if not exists modelo text;
create index if not exists marketing_lecturas_modelo_fecha on public.marketing_lecturas(modelo,creado_at);

create or replace function public.marketing_iniciar_lectura(p_autor uuid,p_id uuid,p_modelo text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.marketing_publicaciones; v_token uuid;
begin
  select * into v from public.marketing_publicaciones where id=p_id and autor=p_autor for update;
  if not found or v.estado<>'borrador' then return jsonb_build_object('error','No se puede leer este borrador.'); end if;
  -- Reutilizar antes de reservar cuota o comprobar una lectura en curso.
  if v.extraccion is not null then return jsonb_build_object('datos',v.extraccion,'cache',true); end if;
  if v.lectura_inicio>now()-interval '2 minutes' then
    return jsonb_build_object('error','La lectura ya está en curso. Espera y vuelve a abrir el borrador.');
  end if;
  -- Presupuesto compartido de KJA, conservador: 20/24h y 5/minuto por modelo.
  -- No equivale al contador de Google ni incluye llamadas fuera de este sistema.
  perform pg_advisory_xact_lock(hashtextextended('marketing-gemini:'||p_modelo,0));
  if (select count(*) from public.marketing_lecturas where modelo=p_modelo and creado_at>now()-interval '24 hours')>=20 then
    return jsonb_build_object('error','El equipo alcanzó las 20 lecturas nuevas en las últimas 24 horas. Puedes seguir editando los borradores guardados.');
  end if;
  if (select count(*) from public.marketing_lecturas where modelo=p_modelo and creado_at>now()-interval '1 minute')>=5 then
    return jsonb_build_object('error','El equipo alcanzó las 5 lecturas por minuto. Espera un minuto antes de intentarlo nuevamente.');
  end if;
  v_token:=gen_random_uuid();
  insert into public.marketing_lecturas(autor,modelo) values(p_autor,p_modelo);
  update public.marketing_publicaciones set lectura_token=v_token,lectura_inicio=now() where id=p_id;
  return jsonb_build_object('token',v_token);
end;
$$;
revoke all on function public.marketing_iniciar_lectura(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.marketing_iniciar_lectura(uuid,uuid,text) to service_role;
-- El manejador anterior deja de utilizarse; conservar su definición por compatibilidad histórica.
revoke execute on function public.marketing_reservar_lectura(uuid) from service_role;
commit;
