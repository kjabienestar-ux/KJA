-- =====================================================================
--  KJA · Asistencia — Migración 3: contratos, horas por día y bitácora
--  Aditiva y segura (no borra datos). Pegar en el SQL Editor y ejecutar.
-- =====================================================================

alter table public.asis_colaboradores
  add column if not exists contrato_inicio        date,  -- inicio real del contrato de prácticas
  add column if not exists contrato_fin_referencia date,  -- lo que dice el papel (solo informativo)
  -- horas que la persona YA traía cumplidas antes de empezar a registrar aquí.
  -- Sin esto, quien empezó sus prácticas antes de usar el sistema aparecería
  -- con 0 horas y su fecha de término se proyectaría muy lejos.
  add column if not exists horas_previas          numeric not null default 0;

-- contrato_horas ya existe desde la migración 2, no se toca.

alter table public.asis_registros
  add column if not exists horas numeric;  -- horas que cuenta ESE día, congeladas al momento de marcar
                                            -- (así un cambio de horario futuro no altera lo ya trabajado)

-- ── BITÁCORA DE CAMBIOS DE CONTRATO/HORARIO ───────────────────────────
create table if not exists public.asis_historial_contrato (
  id               bigint generated always as identity primary key,
  colaborador_id   bigint not null references public.asis_colaboradores(id) on delete cascade,
  fecha            date not null default current_date,
  tipo             text not null check (tipo in ('horario','horas_contrato','fechas','otro')),
  horario_anterior jsonb,
  horario_nuevo    jsonb,
  horas_anterior   numeric,
  horas_nueva      numeric,
  nota             text,
  creado_por       uuid references public.asis_perfiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists asis_hist_colab_idx on public.asis_historial_contrato(colaborador_id);

alter table public.asis_historial_contrato enable row level security;

-- Mismo patrón que el resto de tablas de asistencia: leen todos los miembros,
-- escriben solo editor/dirección (reutiliza asis_es_miembro() y asis_puede_editar()
-- creadas en asistencia_schema.sql).
drop policy if exists asis_historial_contrato_sel on public.asis_historial_contrato;
drop policy if exists asis_historial_contrato_ins on public.asis_historial_contrato;
drop policy if exists asis_historial_contrato_upd on public.asis_historial_contrato;
drop policy if exists asis_historial_contrato_del on public.asis_historial_contrato;
create policy asis_historial_contrato_sel on public.asis_historial_contrato for select using (public.asis_es_miembro());
create policy asis_historial_contrato_ins on public.asis_historial_contrato for insert with check (public.asis_puede_editar());
create policy asis_historial_contrato_upd on public.asis_historial_contrato for update using (public.asis_puede_editar()) with check (public.asis_puede_editar());
create policy asis_historial_contrato_del on public.asis_historial_contrato for delete using (public.asis_puede_editar());

-- ── COMPROBACIONES rápidas (opcional) ────────────────────────────────
-- select column_name from information_schema.columns where table_name='asis_colaboradores' and column_name in ('contrato_inicio','contrato_fin_referencia','horas_previas');
-- select column_name from information_schema.columns where table_name='asis_registros' and column_name='horas';
-- select * from public.asis_historial_contrato order by created_at desc limit 10;
