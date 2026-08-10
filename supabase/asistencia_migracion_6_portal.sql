-- =====================================================================
--  KJA · Asistencia — Migración 6: portal de autoservicio
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
--
--  Permite que cada colaborador marque su propia asistencia desde un
--  enlace público, SIN crear una cuenta por persona.
--
--  Cómo se sostiene la identidad, ya que no hay login:
--    · La primera vez que alguien abre el enlace, elige su nombre y ese
--      nombre queda AMARRADO al dispositivo desde el que entró.
--    · Un dispositivo solo puede amarrarse a UNA persona: nadie marca por
--      varios.
--    · Un nombre ya amarrado no lo puede tomar otro dispositivo.
--    · Toda marca guarda de dónde vino (origen + dispositivo), así una
--      anomalía se ve desde el panel.
--
--  La RLS bloquea a los anónimos en todas las tablas asis_*, así que el
--  portal entra SOLO por estas funciones security definer, igual que
--  verificar_codigo() en el sistema de certificados.
-- =====================================================================

-- ── 1) CONFIGURACIÓN DEL PORTAL ──────────────────────────────────────
--    Fila única. La clave viaja en la URL del enlace: sin ella las
--    funciones no responden, para que la lista del equipo no quede
--    expuesta a cualquiera que adivine la dirección de la página.
create table if not exists public.asis_portal_config (
  id             int primary key default 1 check (id = 1),
  clave          text not null,
  tolerancia_min int  not null default 15,
  activo         boolean not null default true,
  actualizado_at timestamptz not null default now()
);

comment on column public.asis_portal_config.clave is
  'Clave del enlace público: marcar.html?k=<clave>. Cambiarla invalida los enlaces repartidos';
comment on column public.asis_portal_config.tolerancia_min is
  'Minutos de gracia desde la hora de entrada de cada persona antes de que la marca cuente como tardanza';

insert into public.asis_portal_config (id, clave, tolerancia_min)
values (1, encode(gen_random_bytes(9), 'hex'), 15)
on conflict (id) do nothing;

-- ── 2) VÍNCULO DISPOSITIVO ↔ PERSONA ─────────────────────────────────
--    Las dos columnas son unique: esa es toda la defensa contra que una
--    persona marque por otras.
create table if not exists public.asis_vinculos (
  colaborador_id bigint primary key references public.asis_colaboradores(id) on delete cascade,
  dispositivo    text not null unique,
  agente         text,
  creado_at      timestamptz not null default now()
);

comment on table public.asis_vinculos is
  'Un dispositivo ↔ un colaborador. Se crea solo, la primera vez que la persona abre el portal';

-- ── 3) RASTRO EN LOS REGISTROS ───────────────────────────────────────
alter table public.asis_registros
  add column if not exists origen text not null default 'panel'
    check (origen in ('panel','portal'));
alter table public.asis_registros
  add column if not exists dispositivo text;

comment on column public.asis_registros.origen is
  'panel = lo marcó dirección/editor; portal = lo marcó la propia persona desde el enlace';

-- ── 4) HELPERS ───────────────────────────────────────────────────────
--    Hora de entrada del día para una persona: primero su horario
--    semanal, y si ese día no la tiene, la hora general de su ficha.
create or replace function public.asis_hora_entrada(p_colab public.asis_colaboradores, p_fecha date)
returns time language sql stable as $$
  select coalesce(
    nullif(p_colab.horario_semanal -> extract(isodow from p_fecha)::text ->> 'ini', ''),
    nullif(p_colab.hora_inicio::text, '')
  )::time;
$$;

--    ¿Labora esa fecha? Réplica en SQL de estadoDia() del front: manda la
--    excepción de la persona, luego el feriado de empresa, luego su horario.
create or replace function public.asis_labora(p_colab public.asis_colaboradores, p_fecha date)
returns boolean language plpgsql stable as $$
declare
  v_dow  text := extract(isodow from p_fecha)::text;
  v_mod  text;
  v_pex  text;
begin
  select tipo into v_pex from public.asis_excepciones
   where fecha = p_fecha and ambito = 'colaborador' and colaborador_id = p_colab.id limit 1;
  if v_pex = 'laborable_extra' then return true;  end if;

  if exists (select 1 from public.asis_excepciones
              where fecha = p_fecha and ambito = 'empresa') then return false; end if;

  if v_pex = 'no_laborable' then return false; end if;

  v_mod := p_colab.horario_semanal -> v_dow ->> 'mod';
  if v_mod is null then
    v_mod := case when extract(isodow from p_fecha)::int = any(p_colab.dias_laborables)
                  then 'virtual' else 'no_gestiona' end;
  end if;
  return v_mod <> 'no_gestiona';
end;
$$;

-- ── 5) RPC: ESTADO DEL PORTAL PARA UN DISPOSITIVO ────────────────────
--    Una sola llamada resuelve la pantalla completa. Si el dispositivo no
--    está amarrado devuelve la lista de nombres libres para elegir; si ya
--    lo está, devuelve a quién pertenece y cómo va su día.
create or replace function public.asis_portal_estado(p_clave text, p_disp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg   public.asis_portal_config;
  v_colab public.asis_colaboradores;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
  v_ahora time := (now() at time zone 'America/Lima')::time;
  v_reg   public.asis_registros;
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

  -- Dispositivo nuevo: ofrecer los nombres que nadie ha tomado todavía
  if v_colab is null then
    return jsonb_build_object(
      'ok', true, 'vinculado', false,
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'area', a.nombre)
                          order by a.nombre, c.nombre)
          from public.asis_colaboradores c
          join public.asis_areas a on a.id = c.area_id
         where c.activo
           and not exists (select 1 from public.asis_vinculos v where v.colaborador_id = c.id)
      ), '[]'::jsonb));
  end if;

  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  v_ini := public.asis_hora_entrada(v_colab, v_hoy);

  return jsonb_build_object(
    'ok', true, 'vinculado', true,
    'nombre', v_colab.nombre,
    'fecha', v_hoy,
    'labora', public.asis_labora(v_colab, v_hoy),
    'hora_entrada', v_ini,
    'tolerancia', v_cfg.tolerancia_min,
    'ahora', v_ahora,
    'marcado', v_reg.id is not null,
    'estado', v_reg.estado,
    'marcado_at', v_reg.marcado_at,
    'origen', v_reg.origen);
end;
$$;

-- ── 6) RPC: AMARRAR EL DISPOSITIVO A UNA PERSONA ─────────────────────
create or replace function public.asis_portal_vincular(p_clave text, p_disp text,
                                                       p_colab bigint, p_agente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.asis_portal_config;
begin
  select * into v_cfg from public.asis_portal_config where id = 1;
  if v_cfg is null or not v_cfg.activo or v_cfg.clave is distinct from p_clave then
    return jsonb_build_object('ok', false, 'motivo', 'clave');
  end if;

  if exists (select 1 from public.asis_vinculos where dispositivo = p_disp) then
    return jsonb_build_object('ok', false, 'motivo', 'dispositivo_ocupado');
  end if;
  if exists (select 1 from public.asis_vinculos where colaborador_id = p_colab) then
    return jsonb_build_object('ok', false, 'motivo', 'nombre_ocupado');
  end if;
  if not exists (select 1 from public.asis_colaboradores where id = p_colab and activo) then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe');
  end if;

  insert into public.asis_vinculos (colaborador_id, dispositivo, agente)
  values (p_colab, p_disp, left(coalesce(p_agente,''), 300));

  return jsonb_build_object('ok', true);
exception when unique_violation then
  -- Dos toques simultáneos sobre el mismo nombre: gana el primero
  return jsonb_build_object('ok', false, 'motivo', 'nombre_ocupado');
end;
$$;

-- ── 7) RPC: MARCAR ASISTENCIA ────────────────────────────────────────
--    El estado lo decide el servidor, nunca el navegador: presente si
--    llega dentro de la tolerancia desde SU hora de entrada, tardanza si
--    no. Así los turnos de tarde funcionan sin ninguna regla aparte.
create or replace function public.asis_portal_marcar(p_clave text, p_disp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg    public.asis_portal_config;
  v_colab  public.asis_colaboradores;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_ahora  time := (now() at time zone 'America/Lima')::time;
  v_reg    public.asis_registros;
  v_ini    time;
  v_estado text;
  v_horas  numeric;
  v_vinc   text;
  v_dow    text;
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
    return jsonb_build_object('ok', false, 'motivo', 'sin_vinculo');
  end if;

  if not public.asis_labora(v_colab, v_hoy) then
    return jsonb_build_object('ok', false, 'motivo', 'no_labora');
  end if;

  -- Ya marcó: se le devuelve su estado, nunca se sobrescribe
  select * into v_reg from public.asis_registros
   where colaborador_id = v_colab.id and fecha = v_hoy;
  if v_reg.id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ya_marcado',
      'estado', v_reg.estado, 'marcado_at', v_reg.marcado_at);
  end if;

  v_ini := public.asis_hora_entrada(v_colab, v_hoy);
  -- Sin hora de entrada cargada no se puede juzgar el atraso: se da por presente
  v_estado := case
    when v_ini is null then 'P'
    when v_ahora <= v_ini + make_interval(mins => v_cfg.tolerancia_min) then 'P'
    else 'T' end;

  -- Horas y vínculo del día congelados al marcar, igual que hace el panel
  v_dow := extract(isodow from v_hoy)::text;
  v_horas := extract(epoch from (
      coalesce(nullif(v_colab.horario_semanal -> v_dow ->> 'fin','')::time, v_colab.hora_fin)
    - coalesce(nullif(v_colab.horario_semanal -> v_dow ->> 'ini','')::time, v_colab.hora_inicio))) / 3600.0;

  -- Solo los mixtos deciden día por día; el resto va todo a su único contador
  v_vinc := case when v_colab.tipo_vinculo = 'ambos'
                 then coalesce(nullif(v_colab.horario_semanal -> v_dow ->> 'vinc',''), 'practicas')
                 else v_colab.tipo_vinculo end;

  insert into public.asis_registros (colaborador_id, fecha, estado, origen, dispositivo, horas, vinculo)
  values (v_colab.id, v_hoy, v_estado, 'portal', p_disp,
          case when v_horas > 0 then v_horas else null end, v_vinc);

  return jsonb_build_object('ok', true, 'estado', v_estado,
    'nombre', v_colab.nombre, 'hora', v_ahora, 'hora_entrada', v_ini);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'ya_marcado');
end;
$$;

-- ── 8) PERMISOS ──────────────────────────────────────────────────────
--    Las tablas siguen cerradas por RLS; solo se abren estas tres puertas.
alter table public.asis_portal_config enable row level security;
alter table public.asis_vinculos      enable row level security;

drop policy if exists asis_vinc_sel on public.asis_vinculos;
drop policy if exists asis_vinc_del on public.asis_vinculos;
create policy asis_vinc_sel on public.asis_vinculos for select using (public.asis_es_miembro());
create policy asis_vinc_del on public.asis_vinculos for delete using (public.asis_rol() = 'direccion');

drop policy if exists asis_cfg_sel on public.asis_portal_config;
drop policy if exists asis_cfg_upd on public.asis_portal_config;
create policy asis_cfg_sel on public.asis_portal_config for select using (public.asis_es_miembro());
create policy asis_cfg_upd on public.asis_portal_config for update using (public.asis_rol() = 'direccion')
                                                          with check (public.asis_rol() = 'direccion');

grant execute on function public.asis_portal_estado(text, text)              to anon, authenticated;
grant execute on function public.asis_portal_vincular(text, text, bigint, text) to anon, authenticated;
grant execute on function public.asis_portal_marcar(text, text)              to anon, authenticated;

-- Refresca el caché de esquema de la API (evita PGRST204 / PGRST202).
notify pgrst, 'reload schema';

-- ── 9) EL ENLACE QUE HAY QUE REPARTIR ────────────────────────────────
--    Ejecutar aparte para ver la dirección final:
--
--    select 'https://www.kjadmb.com/marcar.html?k=' || clave as enlace
--      from public.asis_portal_config where id = 1;
