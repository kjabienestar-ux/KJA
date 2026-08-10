-- =====================================================================
--  KJA · Asistencia — Migración 7: cambio de dispositivo
--  Aditiva y segura (no borra datos). Requiere la migración 6.
--
--  Problema que resuelve: el vínculo dispositivo ↔ persona es lo que
--  impide que alguien marque por otro, pero se rompe solo con más
--  frecuencia de la que parece — celular nuevo, "borrar datos de
--  navegación", otro navegador, o Safari descartando el dato tras varios
--  días sin abrir la página. Sin salida, dirección termina destrabando
--  gente a mano todo el tiempo.
--
--  Cómo funciona: la persona pide el cambio desde el equipo nuevo y SU
--  MARCA QUEDA CONGELADA A LA HORA DEL INTENTO. Dirección aprueba cuando
--  puede —una hora después o al día siguiente— y el registro se crea con
--  la hora en que la persona lo intentó, no con la hora de la aprobación.
--  Por eso los turnos de tarde y de noche no necesitan que haya alguien
--  mirando el panel a esa hora.
-- =====================================================================

-- ── 1) SOLICITUDES ───────────────────────────────────────────────────
create table if not exists public.asis_solicitudes_dispositivo (
  id              bigint generated always as identity primary key,
  colaborador_id  bigint not null references public.asis_colaboradores(id) on delete cascade,
  dispositivo     text not null,
  agente          text,
  solicitado_at   timestamptz not null default now(),
  fecha           date not null,   -- día del intento, en hora de Lima
  hora            time not null,   -- hora del intento: esto es lo que se congela
  labora          boolean not null default true,
  estado_previsto text check (estado_previsto in ('P','T')),
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','aprobada','rechazada')),
  resuelto_por    uuid references public.asis_perfiles(id),
  resuelto_at     timestamptz
);

comment on column public.asis_solicitudes_dispositivo.hora is
  'Hora del intento. El registro se crea con ESTA hora, no con la de la aprobación';
comment on column public.asis_solicitudes_dispositivo.estado_previsto is
  'P o T calculado con la hora del intento contra la hora de entrada de esa persona';

-- Un solo pendiente por dispositivo y por persona a la vez
create unique index if not exists asis_sol_disp_pend_idx
  on public.asis_solicitudes_dispositivo(dispositivo) where estado = 'pendiente';
create unique index if not exists asis_sol_colab_pend_idx
  on public.asis_solicitudes_dispositivo(colaborador_id) where estado = 'pendiente';

-- ── 2) HELPERS DE DÍA ────────────────────────────────────────────────
--    Mismas reglas que usa el panel al marcar: horas y vínculo se
--    congelan con el horario vigente el día del intento.
create or replace function public.asis_horas_dia(p_colab public.asis_colaboradores, p_fecha date)
returns numeric language sql stable as $$
  select nullif(extract(epoch from (
      coalesce(nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'fin','')::time, p_colab.hora_fin)
    - coalesce(nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'ini','')::time, p_colab.hora_inicio)
  )) / 3600.0, 0);
$$;

create or replace function public.asis_vinc_dia(p_colab public.asis_colaboradores, p_fecha date)
returns text language sql stable as $$
  select case when p_colab.tipo_vinculo = 'ambos'
              then coalesce(nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'vinc',''), 'practicas')
              else p_colab.tipo_vinculo end;
$$;

--    Estado que corresponde a una hora dada para una persona
create or replace function public.asis_estado_a_las(p_colab public.asis_colaboradores,
                                                    p_fecha date, p_hora time, p_tol int)
returns text language sql stable as $$
  select case
    when public.asis_hora_entrada(p_colab, p_fecha) is null then 'P'
    when p_hora <= public.asis_hora_entrada(p_colab, p_fecha) + make_interval(mins => p_tol) then 'P'
    else 'T' end;
$$;

-- ── 3) RPC: PEDIR EL CAMBIO DE DISPOSITIVO ───────────────────────────
create or replace function public.asis_portal_solicitar(p_clave text, p_disp text,
                                                        p_colab bigint, p_agente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg   public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_lab   boolean;
  v_est   text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  if exists (select 1 from public.asis_vinculos where dispositivo = p_disp) then
    return jsonb_build_object('ok', false, 'motivo', 'dispositivo_ocupado');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  if v_colab is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  v_lab := public.asis_labora(v_colab, v_hoy);
  v_est := case when v_lab then public.asis_estado_a_las(v_colab, v_hoy, v_ahora, v_cfg.tolerancia_min) end;

  insert into public.asis_solicitudes_dispositivo
    (colaborador_id, dispositivo, agente, fecha, hora, labora, estado_previsto)
  values (p_colab, p_disp, left(coalesce(p_agente,''),300), v_hoy, v_ahora, v_lab, v_est);

  return jsonb_build_object('ok', true, 'nombre', v_colab.nombre,
    'hora', v_ahora, 'labora', v_lab, 'estado_previsto', v_est);
exception when unique_violation then
  -- Ya tenía un pendiente: no se duplica, se le confirma el que hay
  return jsonb_build_object('ok', true, 'duplicada', true);
end;
$$;

-- ── 4) RPC: ESTADO, AHORA CON PENDIENTES Y NOMBRES YA TOMADOS ────────
--    Reemplaza a la de la migración 6 (misma firma, se puede reejecutar).
create or replace function public.asis_portal_estado(p_clave text, p_disp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg   public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_sol   public.asis_solicitudes_dispositivo;
  v_ini   time;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select c.* into v_colab
    from public.asis_vinculos v
    join public.asis_colaboradores c on c.id = v.colaborador_id
   where v.dispositivo = p_disp and c.activo;

  if v_colab is null then
    -- ¿Este equipo ya pidió un cambio y está esperando?
    select * into v_sol from public.asis_solicitudes_dispositivo
     where dispositivo = p_disp and estado = 'pendiente' limit 1;
    if v_sol.id is not null then
      return jsonb_build_object('ok', true, 'vinculado', false,
        'pendiente', jsonb_build_object(
          'nombre', (select nombre from public.asis_colaboradores where id = v_sol.colaborador_id),
          'fecha', v_sol.fecha, 'hora', v_sol.hora,
          'labora', v_sol.labora, 'estado_previsto', v_sol.estado_previsto));
    end if;

    return jsonb_build_object(
      'ok', true, 'vinculado', false,
      -- libres: se pueden tomar de una
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'area', a.nombre)
                          order by a.nombre, c.nombre)
          from public.asis_colaboradores c
          join public.asis_areas a on a.id = c.area_id
         where c.activo
           and not exists (select 1 from public.asis_vinculos v where v.colaborador_id = c.id)
      ), '[]'::jsonb),
      -- tomadas: solo se puede pedir el cambio, con aprobación de dirección
      'ocupadas', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'area', a.nombre)
                          order by a.nombre, c.nombre)
          from public.asis_colaboradores c
          join public.asis_areas a on a.id = c.area_id
         where c.activo
           and exists (select 1 from public.asis_vinculos v where v.colaborador_id = c.id)
      ), '[]'::jsonb));
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  v_ini := public.asis_hora_entrada(v_colab, v_hoy);

  return jsonb_build_object(
    'ok', true, 'vinculado', true,
    'nombre', v_colab.nombre, 'fecha', v_hoy,
    'labora', public.asis_labora(v_colab, v_hoy),
    'hora_entrada', v_ini, 'tolerancia', v_cfg.tolerancia_min, 'ahora', v_ahora,
    'marcado', v_reg.id is not null, 'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at, 'origen', v_reg.origen);
end;
$$;

-- ── 5) RPC: RESOLVER LA SOLICITUD (solo dirección) ───────────────────
--    Al aprobar: suelta el vínculo viejo, amarra el nuevo y crea el
--    registro CON LA HORA DEL INTENTO. Si ese día ya tenía marca, no la
--    pisa — el cambio de dispositivo se aplica igual.
create or replace function public.asis_resolver_dispositivo(p_id bigint, p_aprobar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sol   public.asis_solicitudes_dispositivo;
  v_colab public.asis_colaboradores;
  v_creo  boolean := false;
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;

  select * into v_sol from public.asis_solicitudes_dispositivo
   where id = p_id and estado = 'pendiente';
  if v_sol.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_pendiente');
  end if;

  if not p_aprobar then
    update public.asis_solicitudes_dispositivo
       set estado='rechazada', resuelto_por=auth.uid(), resuelto_at=now()
     where id = p_id;
    return jsonb_build_object('ok', true, 'aprobada', false);
  end if;

  select * into v_colab from public.asis_colaboradores where id = v_sol.colaborador_id;

  delete from public.asis_vinculos where colaborador_id = v_sol.colaborador_id;
  delete from public.asis_vinculos where dispositivo    = v_sol.dispositivo;
  insert into public.asis_vinculos (colaborador_id, dispositivo, agente)
  values (v_sol.colaborador_id, v_sol.dispositivo, v_sol.agente);

  -- La marca congelada: se registra con la hora del intento
  if v_sol.labora and v_sol.estado_previsto is not null
     and not exists (select 1 from public.asis_registros
                      where colaborador_id = v_sol.colaborador_id and fecha = v_sol.fecha) then
    insert into public.asis_registros
      (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo, marcado_at)
    values (v_sol.colaborador_id, v_sol.fecha, v_sol.estado_previsto, 'portal', v_sol.dispositivo,
            public.asis_horas_dia(v_colab, v_sol.fecha),
            public.asis_vinc_dia(v_colab, v_sol.fecha),
            v_sol.solicitado_at);
    v_creo := true;
  end if;

  update public.asis_solicitudes_dispositivo
     set estado='aprobada', resuelto_por=auth.uid(), resuelto_at=now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'aprobada', true, 'registro_creado', v_creo);
end;
$$;

-- ── 6) RPC: SOLTAR UN VÍNCULO A MANO (solo dirección) ────────────────
create or replace function public.asis_soltar_vinculo(p_colab bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  delete from public.asis_vinculos where colaborador_id = p_colab;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 7) PERMISOS ──────────────────────────────────────────────────────
alter table public.asis_solicitudes_dispositivo enable row level security;
drop policy if exists asis_sol_sel on public.asis_solicitudes_dispositivo;
create policy asis_sol_sel on public.asis_solicitudes_dispositivo
  for select using (public.asis_es_miembro());

grant execute on function public.asis_portal_solicitar(text, text, bigint, text) to anon, authenticated;
grant execute on function public.asis_portal_estado(text, text)                  to anon, authenticated;
grant execute on function public.asis_resolver_dispositivo(bigint, boolean)      to authenticated;
grant execute on function public.asis_soltar_vinculo(bigint)                     to authenticated;

notify pgrst, 'reload schema';
