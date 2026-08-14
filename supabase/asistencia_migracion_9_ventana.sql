-- =====================================================================
--  KJA · Asistencia — Migración 9: ventana de marcado y cambios de horario
--  Aditiva y segura (no borra datos). Requiere las migraciones 6 y 8.
--
--  1) VENTANA DE MARCADO
--     Hasta ahora se podía marcar a cualquier hora del día y el estado se
--     decidía solo. Ahora cada persona solo puede marcar dentro de su
--     jornada, según su contrato:
--
--       antes de su hora de entrada  → no puede ("aún no abre")
--       de la entrada al límite      → Presente
--       del límite a su hora de fin  → Tardanza
--       después de su hora de fin    → no puede ("ya cerró")
--
--     Quien no tenga horario cargado puede marcar igual: no hay con qué
--     juzgarlo, y bloquearlo lo dejaría sin registro sin culpa suya.
--
--  2) CAMBIOS DE HORARIO
--     Varios colaboradores cambian de horario cada tanto. Cuando el
--     sistema le cierra la puerta a alguien porque su horario viejo dice
--     otra cosa, puede avisarlo desde el mismo portal en vez de quedarse
--     sin poder marcar. La solicitud le llega a dirección.
-- =====================================================================

-- ── 1) EN QUÉ TRAMO DE SU JORNADA ESTÁ ───────────────────────────────
create or replace function public.asis_ventana(p_colab public.asis_colaboradores,
                                               p_fecha date, p_hora time, p_tol int)
returns text language plpgsql stable as $$
declare
  v_ini time := public.asis_hora_entrada(p_colab, p_fecha);
  v_fin time := public.asis_hora_salida(p_colab, p_fecha);
  v_lim time;
begin
  if v_ini is null then return 'sin_horario'; end if;
  v_lim := v_ini + make_interval(mins => p_tol);

  if p_hora < v_ini then return 'antes'; end if;
  if p_hora <= v_lim then return 'presente'; end if;

  -- Sin hora de salida, o si cruza medianoche, se acepta hasta fin del día
  if v_fin is null or v_fin <= v_ini or p_hora <= v_fin then return 'tardanza'; end if;
  return 'cerrada';
end;
$$;

-- ── 2) RETRATO DEL DÍA, AHORA CON LA VENTANA ─────────────────────────
create or replace function public.asis_mi_dia(p_colab public.asis_colaboradores, p_tol int)
returns jsonb language plpgsql stable as $$
declare
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
  v_ini   time := public.asis_hora_entrada(p_colab, v_hoy);
  v_fin   time := public.asis_hora_salida(p_colab, v_hoy);
  v_vent  text := public.asis_ventana(p_colab, v_hoy, v_ahora, p_tol);
begin
  select * into v_reg from public.asis_registros
   where colaborador_id = p_colab.id and fecha = v_hoy;
  return jsonb_build_object(
    'id', p_colab.id, 'nombre', p_colab.nombre,
    'fecha', v_hoy, 'ahora', v_ahora,
    'labora', public.asis_labora(p_colab, v_hoy),
    'modalidad', coalesce(p_colab.horario_semanal -> extract(isodow from v_hoy)::text ->> 'mod', 'virtual'),
    'hora_entrada', v_ini,
    'hora_salida', v_fin,
    'limite', case when v_ini is null then null else v_ini + make_interval(mins => p_tol) end,
    'tolerancia', p_tol,
    'ventana', v_vent,
    'puede_marcar', v_vent in ('presente','tardanza','sin_horario'),
    'marcado', v_reg.id is not null,
    'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at,
    'origen', v_reg.origen);
end;
$$;

-- ── 3) MARCAR, RESPETANDO LA VENTANA ─────────────────────────────────
create or replace function public.asis_portal_marcar(p_clave text, p_colab bigint,
                                                     p_pin text, p_disp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_ahora  time := (now() at time zone 'America/Lima')::time;
  v_reg    public.asis_registros;
  v_vent   text;
  v_estado text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  if not public.asis_labora(v_colab, v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'no_labora');
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado',
      'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  -- La ventana se decide acá, no en el navegador: es la regla, no un aviso
  v_vent := public.asis_ventana(v_colab, v_hoy, v_ahora, v_cfg.tolerancia_min);
  if v_vent in ('antes','cerrada') then
    return jsonb_build_object('ok', false, 'motivo', 'fuera_ventana', 'ventana', v_vent,
      'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
  end if;

  v_estado := case when v_vent = 'tardanza' then 'T' else 'P' end;

  insert into public.asis_registros
    (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo)
  values (v_colab.id, v_hoy, v_estado, 'portal', left(coalesce(p_disp,''), 80),
          public.asis_horas_dia(v_colab, v_hoy), public.asis_vinc_dia(v_colab, v_hoy));

  return jsonb_build_object('ok', true, 'estado', v_estado, 'hora', v_ahora,
    'dia', public.asis_mi_dia(v_colab, v_cfg.tolerancia_min));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

-- ── 4) SOLICITUDES DE CAMBIO DE HORARIO ──────────────────────────────
create table if not exists public.asis_solicitudes_horario (
  id             bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  horario_nuevo  text not null,
  horario_previo text,
  creado_at      timestamptz not null default now(),
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente','aplicada','rechazada')),
  resuelto_por   uuid references public.asis_perfiles(id),
  resuelto_at    timestamptz
);

comment on table public.asis_solicitudes_horario is
  'Avisos de cambio de horario que manda la propia persona desde el portal. Dirección los aplica a mano en la ficha';

-- Una pendiente por persona: si insiste, se actualiza la que ya tiene
create unique index if not exists asis_sol_hor_pend_idx
  on public.asis_solicitudes_horario(colaborador_id) where estado = 'pendiente';

create or replace function public.asis_portal_pedir_horario(p_clave text, p_colab bigint,
                                                            p_pin text, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_k      public.asis_claves;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_previo text;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  select * into v_colab from public.asis_colaboradores where id = p_colab and activo;
  select * into v_k     from public.asis_claves        where colaborador_id = p_colab;
  if v_colab is null or v_k.colaborador_id is null
     or v_k.huella is distinct from public.asis_huella(v_k.sal, p_pin) then
    return jsonb_build_object('ok', false, 'motivo', 'incorrecta');
  end if;

  if length(coalesce(btrim(p_texto), '')) < 6 then
    return jsonb_build_object('ok', false, 'motivo', 'corto');
  end if;

  -- Se guarda qué decía su ficha, para que dirección compare sin buscarlo
  v_previo := coalesce(
    to_char(public.asis_hora_entrada(v_colab, v_hoy), 'HH24:MI') || ' a ' ||
    to_char(public.asis_hora_salida(v_colab, v_hoy),  'HH24:MI'), 'sin horario cargado');

  insert into public.asis_solicitudes_horario (colaborador_id, horario_nuevo, horario_previo)
  values (p_colab, left(btrim(p_texto), 400), v_previo)
  on conflict (colaborador_id) where estado = 'pendiente'
  do update set horario_nuevo = excluded.horario_nuevo, creado_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 5) PARA EL PANEL ─────────────────────────────────────────────────
create or replace function public.asis_solicitudes_horario_listar()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.asis_es_miembro() then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  return jsonb_build_object('ok', true, 'solicitudes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'colaborador_id', s.colaborador_id, 'nombre', c.nombre,
             'horario_nuevo', s.horario_nuevo, 'horario_previo', s.horario_previo,
             'creado_at', s.creado_at) order by s.creado_at)
      from public.asis_solicitudes_horario s
      join public.asis_colaboradores c on c.id = s.colaborador_id
     where s.estado = 'pendiente'), '[]'::jsonb));
end;
$$;

create or replace function public.asis_resolver_horario(p_id bigint, p_aplicada boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.asis_rol() is distinct from 'direccion' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
  end if;
  update public.asis_solicitudes_horario
     set estado = case when p_aplicada then 'aplicada' else 'rechazada' end,
         resuelto_por = auth.uid(), resuelto_at = now()
   where id = p_id and estado = 'pendiente';
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 6) PERMISOS ──────────────────────────────────────────────────────
alter table public.asis_solicitudes_horario enable row level security;
drop policy if exists asis_solhor_sel on public.asis_solicitudes_horario;
create policy asis_solhor_sel on public.asis_solicitudes_horario
  for select using (public.asis_es_miembro());

grant execute on function public.asis_portal_pedir_horario(text, bigint, text, text) to anon, authenticated;
grant execute on function public.asis_solicitudes_horario_listar()                   to authenticated;
grant execute on function public.asis_resolver_horario(bigint, boolean)              to authenticated;

notify pgrst, 'reload schema';
