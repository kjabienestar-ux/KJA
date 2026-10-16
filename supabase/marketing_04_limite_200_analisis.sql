-- Aplicar después de marketing_02. Límite compartido por modelo: 200/24h y 5/minuto.
begin;
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
  -- Presupuesto compartido de KJA, conservador: 200/24h y 5/minuto por modelo.
  -- No equivale al contador de Google ni incluye llamadas fuera de este sistema.
  perform pg_advisory_xact_lock(hashtextextended('marketing-gemini:'||p_modelo,0));
  if (select count(*) from public.marketing_lecturas where modelo=p_modelo and creado_at>now()-interval '24 hours')>=200 then
    return jsonb_build_object('error','El equipo alcanzó las 200 lecturas nuevas en las últimas 24 horas. Puedes seguir editando los borradores guardados.');
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
notify pgrst,'reload schema';
commit;
