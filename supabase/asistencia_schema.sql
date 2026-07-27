-- =====================================================================
--  KJA · Registro de Asistencia — esquema Supabase
--  Sección AISLADA del sistema de certificados: tablas con prefijo asis_
--  y sus propias RLS. No toca perfiles / certificados / clientes.
--
--  Cómo usar: pega TODO este archivo en el SQL Editor de Supabase y ejecútalo.
--  (El SQL Editor corre como superusuario y salta las RLS, por eso el primer
--   perfil de dirección se puede insertar aunque las políticas exijan rol.)
-- =====================================================================

-- ── 1) PERFILES DE ASISTENCIA (quién entra y con qué rol) ────────────
--    id = auth.users.id. rol: direccion (admin) · editor (toma lista) · visor (solo lee)
create table if not exists public.asis_perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'visor' check (rol in ('direccion','editor','visor')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── 2) ÁREAS ─────────────────────────────────────────────────────────
create table if not exists public.asis_areas (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  orden      int  not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── 3) COLABORADORES ─────────────────────────────────────────────────
--    dias_laborables: días fijos de trabajo en ISO (1=Lun … 6=Sáb, 7=Dom).
--    Los días fuera de este set salen NG automático (salvo excepción).
create table if not exists public.asis_colaboradores (
  id              bigint generated always as identity primary key,
  area_id         bigint not null references public.asis_areas(id) on delete restrict,
  nombre          text not null,
  dni             text,
  dias_laborables int[] not null default '{1,2,3,4,5,6}',
  horario         text,
  activo          boolean not null default true,
  orden           int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists asis_colab_area_idx on public.asis_colaboradores(area_id);

-- ── 4) REGISTROS (una marca por persona por día) ─────────────────────
create table if not exists public.asis_registros (
  id             bigint generated always as identity primary key,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha          date not null,
  estado         text not null check (estado in ('P','T','J','NG')),
  nota           text,
  marcado_por    uuid references public.asis_perfiles(id),
  marcado_at     timestamptz not null default now(),
  unique (colaborador_id, fecha)
);
create index if not exists asis_reg_fecha_idx on public.asis_registros(fecha);

-- ── 5) EXCEPCIONES (feriados de empresa / overrides por persona) ─────
--    ambito 'empresa'      → feriado / día no laborable para todos.
--    ambito 'colaborador'  → override de una persona ese día:
--        laborable_extra = sí trabaja aunque su horario diga que no (hora extra)
--        no_laborable    = no trabaja aunque su horario diga que sí (permiso)
create table if not exists public.asis_excepciones (
  id             bigint generated always as identity primary key,
  fecha          date not null,
  ambito         text not null check (ambito in ('empresa','colaborador')),
  colaborador_id bigint references public.asis_colaboradores(id) on delete cascade,
  tipo           text not null check (tipo in ('feriado','no_laborable','laborable_extra')),
  nota           text,
  creado_por     uuid references public.asis_perfiles(id),
  created_at     timestamptz not null default now(),
  constraint asis_exc_ambito_chk check (
       (ambito = 'empresa'     and colaborador_id is null)
    or (ambito = 'colaborador' and colaborador_id is not null)
  )
);
create index if not exists asis_exc_fecha_idx on public.asis_excepciones(fecha);

-- ── FUNCIONES HELPER (security definer: saltan RLS, evitan recursión) ─
create or replace function public.asis_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.asis_perfiles where id = auth.uid() and activo = true;
$$;

create or replace function public.asis_es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.asis_perfiles where id = auth.uid() and activo = true);
$$;

create or replace function public.asis_puede_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.asis_rol() in ('editor','direccion'), false);
$$;

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.asis_perfiles      enable row level security;
alter table public.asis_areas         enable row level security;
alter table public.asis_colaboradores enable row level security;
alter table public.asis_registros     enable row level security;
alter table public.asis_excepciones   enable row level security;

-- perfiles: los miembros ven la lista (para mostrar autoría); solo dirección escribe
drop policy if exists asis_perf_sel on public.asis_perfiles;
drop policy if exists asis_perf_ins on public.asis_perfiles;
drop policy if exists asis_perf_upd on public.asis_perfiles;
drop policy if exists asis_perf_del on public.asis_perfiles;
create policy asis_perf_sel on public.asis_perfiles for select using (public.asis_es_miembro());
create policy asis_perf_ins on public.asis_perfiles for insert with check (public.asis_rol() = 'direccion');
create policy asis_perf_upd on public.asis_perfiles for update using (public.asis_rol() = 'direccion') with check (public.asis_rol() = 'direccion');
create policy asis_perf_del on public.asis_perfiles for delete using (public.asis_rol() = 'direccion');

-- áreas / colaboradores / registros / excepciones:
--   SELECT → cualquier miembro activo · escrituras → editor o dirección
do $$
declare t text;
begin
  foreach t in array array['asis_areas','asis_colaboradores','asis_registros','asis_excepciones']
  loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format('drop policy if exists %I_ins on public.%I', t, t);
    execute format('drop policy if exists %I_upd on public.%I', t, t);
    execute format('drop policy if exists %I_del on public.%I', t, t);
    execute format('create policy %I_sel on public.%I for select using (public.asis_es_miembro())', t, t);
    execute format('create policy %I_ins on public.%I for insert with check (public.asis_puede_editar())', t, t);
    execute format('create policy %I_upd on public.%I for update using (public.asis_puede_editar()) with check (public.asis_puede_editar())', t, t);
    execute format('create policy %I_del on public.%I for delete using (public.asis_puede_editar())', t, t);
  end loop;
end $$;

-- ── SEMILLA: áreas actuales (se pueden agregar más desde la web) ──────
insert into public.asis_areas (nombre, orden) values
  ('Salud ocupacional',          1),
  ('Psicología organizacional',  2),
  ('Recursos Humanos',           3),
  ('Marketing',                  4),
  ('Ingeniería',                 5),
  ('Diseño gráfico',             6),
  ('Clínica',                    7),
  ('Audiovisuales',              8),
  ('Reclutamiento',              9)
on conflict (nombre) do nothing;

-- ── PERFILES: plantilla (ejecutar DESPUÉS de crear los usuarios) ─────
--  1. Supabase → Authentication → Users → "Add user" (correo + contraseña)
--     para dirección, los 6 encargados y los visores.
--  2. Copia el UID de cada uno y reemplaza abajo. Ejecuta este bloque en el
--     SQL Editor (corre como superusuario, así el primer 'direccion' entra
--     aunque las RLS exijan rol dirección).
--
-- insert into public.asis_perfiles (id, nombre, rol) values
--   ('00000000-0000-0000-0000-000000000000', 'Dirección KJA',      'direccion'),
--   ('11111111-1111-1111-1111-111111111111', 'Encargado(a) 1',     'editor'),
--   ('22222222-2222-2222-2222-222222222222', 'Encargado(a) 2',     'editor'),
--   ('33333333-3333-3333-3333-333333333333', 'Encargado(a) 3',     'editor'),
--   ('44444444-4444-4444-4444-444444444444', 'Encargado(a) 4',     'editor'),
--   ('55555555-5555-5555-5555-555555555555', 'Encargado(a) 5',     'editor'),
--   ('66666666-6666-6666-6666-666666666666', 'Encargado(a) 6',     'editor')
-- on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- ── COMPROBACIONES rápidas (opcional) ────────────────────────────────
-- select * from public.asis_areas order by orden;
-- select public.asis_rol();          -- tu rol (logueado)
-- select public.asis_puede_editar(); -- true si eres editor/dirección
