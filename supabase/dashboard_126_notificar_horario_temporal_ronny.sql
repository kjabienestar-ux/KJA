-- Ejecutar después de dashboard_123. Envía un aviso privado a Ronny en la
-- campana del portal. Repetir el script no duplica ni vuelve a marcar el aviso.
begin;
do $$
declare
  c public.asis_colaboradores;
  v_reducidos date[]:=array[date '2026-10-21',date '2026-10-23',date '2026-10-26',
    date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03'];
begin
  if (select count(*) from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo)<>1 then
    raise exception 'No se pudo identificar a un único Ronny Yural Ruiz Pinillos activo. No se envió ningún aviso.';
  end if;
  select * into c from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo for update;
  if exists(select 1 from unnest(v_reducidos) f
    where not coalesce(public.asis_labora(c,f),false)
      or public.asis_hora_entrada(c,f) is distinct from time '10:30'
      or public.asis_hora_salida(c,f) is distinct from time '13:00')
    or public.asis_labora(c,date '2026-10-20') is distinct from false
    or public.asis_labora(c,date '2026-10-22') is distinct from false then
    raise exception 'Primero aplicar el horario temporal de Ronny (dashboard_123). No se envió ningún aviso.';
  end if;
  insert into public.asis_notificaciones(colaborador_id,tipo,titulo,mensaje,fecha,actor_id,datos,dedupe_key)
  values(c.id,'mensaje_direccion','Tu horario temporal está actualizado',
    'Ronny, Dirección actualizó tu horario temporal por el beneficio de remodelaciones y taller. El 20 y 22 de octubre de 2026 son días sin gestión. El 21, 23, 26, 27, 28 y 29 de octubre, y el 2 y 3 de noviembre, tu jornada será de 10:30 a. m. a 1:00 p. m. (hora de Lima). Las demás fechas conservan tu horario habitual. Desde el 4 de noviembre de 2026 volverás automáticamente a tu horario habitual, sin realizar ningún trámite.',
    (now() at time zone 'America/Lima')::date,auth.uid(),
    jsonb_build_object('tipo_aviso','horario_temporal','inicio','2026-10-20','fin','2026-11-03',
      'retorno_habitual','2026-11-04','fechas_reducidas',to_jsonb(v_reducidos),
      'fechas_libres',jsonb_build_array('2026-10-20','2026-10-22'),'entrada','10:30','salida','13:00'),
    'horario-temporal:2026-10-20:2026-11-03:colaborador:'||c.id::text)
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
end $$;
commit;

select n.titulo,n.mensaje,n.creado_at,n.leida_at is not null as leida
from public.asis_notificaciones n
join public.asis_colaboradores c on c.id=n.colaborador_id
where regexp_replace(lower(btrim(c.nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos'
  and n.dedupe_key='horario-temporal:2026-10-20:2026-11-03:colaborador:'||c.id::text;
