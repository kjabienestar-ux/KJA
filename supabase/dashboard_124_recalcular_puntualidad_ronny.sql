-- Ejecutar después de dashboard_123_horario_temporal_ronny.sql.
-- Corrige T -> P únicamente en las ocho jornadas reducidas de Ronny cuando
-- la marca real es puntual según el horario aprobado y la tolerancia vigente.
-- No altera fotos, horas, entrada, salida ni estados J/NG.
begin;
do $$
declare
  v_colab public.asis_colaboradores;
  v_fechas date[]:=array[date '2026-10-21',date '2026-10-23',date '2026-10-26',
    date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03'];
  v_tol integer;
  v_antes jsonb;
begin
  if (select count(*) from public.asis_colaboradores
      where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo)<>1 then
    raise exception 'Debe existir exactamente un Ronny Yural Ruiz Pinillos activo. No se modificó ningún dato.';
  end if;
  select * into v_colab from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo for update;
  perform pg_advisory_xact_lock(v_colab.id);
  if exists(select 1 from unnest(v_fechas) f where
      public.asis_hora_entrada(v_colab,f) is distinct from time '10:30'
      or public.asis_hora_salida(v_colab,f) is distinct from time '13:00') then
    raise exception 'Primero aplicar el horario temporal 123. No se modificó ningún dato.';
  end if;
  select greatest(coalesce((select tolerancia_min from public.asis_portal_config where id=1),15),0) into v_tol;

  -- Bloquear y registrar las marcas que realmente deben cambiar.
  perform 1 from public.asis_registros r
    where r.colaborador_id=v_colab.id and r.fecha=any(v_fechas) for update;
  select jsonb_agg(jsonb_build_object('fecha',r.fecha,'estado',r.estado,'entrada',r.marcado_at) order by r.fecha)
    into v_antes from public.asis_registros r
    where r.colaborador_id=v_colab.id and r.fecha=any(v_fechas) and r.estado='T'
      and (r.marcado_at at time zone 'America/Lima')::date=r.fecha
      and public.asis_ventana(v_colab,r.fecha,(r.marcado_at at time zone 'America/Lima')::time,v_tol) in('antes','presente');

  if v_antes is not null then
    update public.asis_registros r set estado='P'
      where r.colaborador_id=v_colab.id and r.fecha=any(v_fechas) and r.estado='T'
        and (r.marcado_at at time zone 'America/Lima')::date=r.fecha
        and public.asis_ventana(v_colab,r.fecha,(r.marcado_at at time zone 'America/Lima')::time,v_tol) in('antes','presente');
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
      values(v_colab.id,'otro',v_antes,jsonb_build_object('estado_corregido','P','entrada_programada','10:30','tolerancia_min',v_tol),
        'Corrección de tardanzas previas al ajuste de horario temporal aprobado por Dirección; se conserva la hora real de entrada.',auth.uid());
  end if;
end $$;
commit;

select c.nombre,r.fecha,r.estado,
  (r.marcado_at at time zone 'America/Lima')::time as entrada_registrada,
  public.asis_hora_entrada(c,r.fecha) as entrada_programada
from public.asis_registros r join public.asis_colaboradores c on c.id=r.colaborador_id
where regexp_replace(lower(btrim(c.nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and c.activo
  and r.fecha=any(array[date '2026-10-21',date '2026-10-23',date '2026-10-26',
    date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03'])
order by r.fecha;
