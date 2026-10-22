-- Ejecutar completo en SQL Editor. Ajuste autorizado de Ronny, octubre/noviembre 2026.
-- 20 y 22 de octubre: sin gestión.
-- 21, 23, 26, 27, 28, 29 de octubre y 2, 3 de noviembre: 10:30-13:00 (Lima).
-- Conserva horario semanal, modalidad, metas, saldos y marcaciones existentes.
begin;

create table if not exists public.asis_horarios_puntuales (
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  motivo text not null,
  creado_por uuid references public.asis_perfiles(id),
  actualizado_at timestamptz not null default now(),
  primary key(colaborador_id,fecha),
  check(hora_fin>hora_inicio)
);
alter table public.asis_horarios_puntuales enable row level security;
revoke all on table public.asis_horarios_puntuales from public,anon,authenticated;

-- Las ventanas de entrada/salida y las horas programadas usan estos helpers.
-- Guardar las funciones previas permite conservar la regla del resto de fechas.
do $$ begin
  if to_regprocedure('public.asis_hora_entrada_base_123(public.asis_colaboradores,date)') is null then
    alter function public.asis_hora_entrada(public.asis_colaboradores,date) rename to asis_hora_entrada_base_123;
  end if;
  if to_regprocedure('public.asis_hora_salida_base_123(public.asis_colaboradores,date)') is null then
    alter function public.asis_hora_salida(public.asis_colaboradores,date) rename to asis_hora_salida_base_123;
  end if;
end $$;
revoke all on function public.asis_hora_entrada_base_123(public.asis_colaboradores,date),
  public.asis_hora_salida_base_123(public.asis_colaboradores,date) from public,anon,authenticated;

create or replace function public.asis_hora_entrada(p_colab public.asis_colaboradores,p_fecha date)
returns time language sql stable security definer set search_path=public as $$
  select coalesce((select h.hora_inicio from public.asis_horarios_puntuales h
    where h.colaborador_id=p_colab.id and h.fecha=p_fecha),
    public.asis_hora_entrada_base_123(p_colab,p_fecha))
$$;
create or replace function public.asis_hora_salida(p_colab public.asis_colaboradores,p_fecha date)
returns time language sql stable security definer set search_path=public as $$
  select coalesce((select h.hora_fin from public.asis_horarios_puntuales h
    where h.colaborador_id=p_colab.id and h.fecha=p_fecha),
    public.asis_hora_salida_base_123(p_colab,p_fecha))
$$;
revoke all on function public.asis_hora_entrada(public.asis_colaboradores,date),
  public.asis_hora_salida(public.asis_colaboradores,date) from public,anon;
grant execute on function public.asis_hora_entrada(public.asis_colaboradores,date),
  public.asis_hora_salida(public.asis_colaboradores,date) to authenticated;

do $$
declare
  v_colab public.asis_colaboradores;
  v_reducidos date[]:=array[date '2026-10-21',date '2026-10-23',date '2026-10-26',
    date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03'];
  v_libres date[]:=array[date '2026-10-20',date '2026-10-22'];
  v_motivo text:='Acuerdo con Dirección: beneficio por remodelaciones y taller; ajuste temporal octubre/noviembre 2026.';
  v_antes jsonb;
  v_cambios integer:=0;
  v_filas integer;
  v_coincidencias integer;
  v_candidatos text;
begin
  -- El documento del archivo histórico no está confirmado en producción.
  -- Identificar por nombre completo, tolerando espacios y mayúsculas.
  select count(*) into v_coincidencias from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo;
  if v_coincidencias<>1 then
    select string_agg(format('ID %s: %s (activo=%s)',id,nombre,activo),'; ' order by id)
      into v_candidatos from public.asis_colaboradores where nombre ilike '%ronny%';
    raise exception 'Se esperaba una sola persona activa llamada Ronny Yural Ruiz Pinillos. Registros encontrados: %. No se aplicó ningún cambio.',
      coalesce(v_candidatos,'ninguno');
  end if;
  select * into v_colab from public.asis_colaboradores
    where regexp_replace(lower(btrim(nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos' and activo for update;
  perform pg_advisory_xact_lock(v_colab.id);

  select jsonb_build_object(
    'horarios_puntuales',coalesce((select jsonb_agg(to_jsonb(h) order by h.fecha)
      from public.asis_horarios_puntuales h where h.colaborador_id=v_colab.id and h.fecha=any(v_reducidos)),'[]'::jsonb),
    'excepciones',coalesce((select jsonb_agg(to_jsonb(e) order by e.fecha,e.id)
      from public.asis_excepciones e where e.ambito='colaborador' and e.colaborador_id=v_colab.id
        and e.fecha=any(v_reducidos||v_libres)),'[]'::jsonb),
    'descansos_completos_sustituidos',coalesce((select jsonb_agg(to_jsonb(d) order by d.fecha)
      from public.asis_descansos_presenciales d where d.colaborador_id=v_colab.id
        and d.fecha=any(v_reducidos)),'[]'::jsonb)) into v_antes;

  -- En estas ocho fechas, el acuerdo sustituye cualquier descanso completo
  -- anterior por la jornada reducida. La bitácora conserva el registro original.
  delete from public.asis_descansos_presenciales
    where colaborador_id=v_colab.id and fecha=any(v_reducidos);
  get diagnostics v_filas=row_count; v_cambios:=v_cambios+v_filas;

  insert into public.asis_horarios_puntuales(colaborador_id,fecha,hora_inicio,hora_fin,motivo,creado_por)
  select v_colab.id,f,time '10:30',time '13:00',v_motivo,auth.uid() from unnest(v_reducidos) f
  on conflict(colaborador_id,fecha) do update set
    hora_inicio=excluded.hora_inicio,hora_fin=excluded.hora_fin,motivo=excluded.motivo,
    creado_por=coalesce(excluded.creado_por,asis_horarios_puntuales.creado_por),actualizado_at=now()
  where (asis_horarios_puntuales.hora_inicio,asis_horarios_puntuales.hora_fin,asis_horarios_puntuales.motivo)
    is distinct from (excluded.hora_inicio,excluded.hora_fin,excluded.motivo);
  get diagnostics v_filas=row_count; v_cambios:=v_cambios+v_filas;

  -- Las excepciones fechadas también alimentan el calendario mensual existente.
  update public.asis_excepciones e set
    tipo=case when e.fecha=any(v_libres) then 'no_laborable' else 'laborable_extra' end,
    nota=v_motivo,creado_por=coalesce(auth.uid(),e.creado_por)
  where e.ambito='colaborador' and e.colaborador_id=v_colab.id and e.fecha=any(v_reducidos||v_libres)
    and (e.tipo,e.nota) is distinct from
      (case when e.fecha=any(v_libres) then 'no_laborable' else 'laborable_extra' end,v_motivo);
  get diagnostics v_filas=row_count; v_cambios:=v_cambios+v_filas;
  insert into public.asis_excepciones(fecha,ambito,colaborador_id,tipo,nota,creado_por)
  select f,'colaborador',v_colab.id,
    case when f=any(v_libres) then 'no_laborable' else 'laborable_extra' end,v_motivo,auth.uid()
  from unnest(v_reducidos||v_libres) f
  where not exists(select 1 from public.asis_excepciones e
    where e.ambito='colaborador' and e.colaborador_id=v_colab.id and e.fecha=f);
  get diagnostics v_filas=row_count; v_cambios:=v_cambios+v_filas;

  if v_cambios>0 then
    insert into public.asis_historial_contrato(colaborador_id,tipo,horario_anterior,horario_nuevo,nota,creado_por)
    values(v_colab.id,'horario',v_antes,jsonb_build_object(
      'fechas_libres',to_jsonb(v_libres),'fechas_reducidas',to_jsonb(v_reducidos),
      'entrada','10:30','salida','13:00','zona_horaria','America/Lima'),v_motivo,auth.uid());
  end if;
end $$;

notify pgrst,'reload schema';
commit;

-- Resultado esperado: 2 fechas sin gestión y 8 jornadas de 2.5 horas.
select c.nombre,f.fecha,public.asis_labora(c,f.fecha) as laborable,
  case when public.asis_labora(c,f.fecha) then public.asis_hora_entrada(c,f.fecha) end as entrada,
  case when public.asis_labora(c,f.fecha) then public.asis_hora_salida(c,f.fecha) end as salida,
  case when public.asis_labora(c,f.fecha) then public.asis_horas_dia(c,f.fecha) else 0 end as horas_programadas
from public.asis_colaboradores c cross join unnest(array[
  date '2026-10-20',date '2026-10-21',date '2026-10-22',date '2026-10-23',date '2026-10-26',
  date '2026-10-27',date '2026-10-28',date '2026-10-29',date '2026-11-02',date '2026-11-03']) f(fecha)
where regexp_replace(lower(btrim(c.nombre)),'[[:space:]]+',' ','g')='ronny yural ruiz pinillos'
  and c.activo order by f.fecha;
