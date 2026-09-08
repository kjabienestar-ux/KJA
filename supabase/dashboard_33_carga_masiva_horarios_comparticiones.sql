-- DASHBOARD 33 · CARGA MASIVA DE HORARIOS DE COMPARTICIONES
-- Fuente: cuadro "HORARIOS Y DÍAS EN LOS QUE COMPARTES" del 07/09/2026.
--
-- Esta carga:
--   1. busca por DNI; solo usa el nombre cuando la fuente no tiene DNI;
--   2. actualiza únicamente coincidencias únicas que todavía no tengan horario;
--   3. no elimina ni reemplaza horarios existentes;
--   4. devuelve un reporte final con actualizados, no encontrados y pendientes.

begin;

create table if not exists public.asis_comparticiones_horarios_respaldo (
  lote_id uuid not null,
  colaborador_id bigint not null references public.asis_colaboradores(id) on delete cascade,
  nombre_fuente text not null,
  dni_ultimos_4 text,
  configurado_anterior boolean not null,
  horario_anterior jsonb not null,
  horario_nuevo jsonb not null,
  creado_at timestamptz not null default now(),
  creado_por uuid,
  primary key (lote_id, colaborador_id)
);

alter table public.asis_comparticiones_horarios_respaldo enable row level security;
revoke all on public.asis_comparticiones_horarios_respaldo from anon, authenticated;

create temporary table carga_comparticiones_fuente (
  orden integer primary key,
  nombre_fuente text not null,
  dni text,
  nombre_selector text,
  franjas jsonb not null,
  observacion text
) on commit drop;

insert into carga_comparticiones_fuente
  (orden, nombre_fuente, dni, nombre_selector, franjas, observacion)
values
  (1, 'Erika del Socorro Moreno Quilcate', '71338491', null,
   '[{"dias":[1,2,3,4,5],"ini":"11:00","fin":"14:00"}]', null),
  (2, 'Melina Gabriela Loyola León', '72686519', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"12:00"}]', null),
  (3, 'Liesel Palomino', '74146182', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"13:00"}]', null),
  (4, 'Doris Inga', '71089285', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"12:00"}]',
   'Se interpretó «12 am» como 12 pm (mediodía).'),
  (5, 'Ximena Alexandra Castillo Samaniego', '77417918', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"13:00"}]',
   'Se interpretó «10 pm - 1 pm» como 10 am - 1 pm.'),
  (6, 'Mayerlin Dayana Rojas Fernandez', '72562416', null,
   '[{"dias":[1,2,3,4,5],"ini":"08:00","fin":"13:00"}]', null),
  (7, 'Jean pier Prado Huamán', '77090065', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"13:00","fin":"14:00"}]', null),
  (8, 'Carlos Mauricio Obregón Dávila', '72908815', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"14:00","fin":"16:00"}]', null),
  (9, 'Ronny Yural Ruiz Pinillos', '72020383', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"12:00","fin":"13:00"}]', null),
  (10, 'Gianfranco Vargas Chávez', '72754555', null,
   '[{"dias":[1,2,3,4,5],"ini":"10:00","fin":"13:00"},{"dias":[6,7],"ini":"21:00","fin":"23:00"}]', null),
  (11, 'Gian Franco Miranda Ramos', '72657419', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"08:00","fin":"13:00"}]', null),
  (12, 'Alejandra Victoria Pimentel Velásquez', '78021060', null,
   '[{"dias":[1,2,3,4,5],"ini":"14:00","fin":"19:00"}]',
   'Se interpretó «2:00 - 7:00 pm» como 2 pm - 7 pm.'),
  (13, 'Camila Yamile Lopez Torres', '74929364', null,
   '[{"dias":[1,2,3,4,5],"ini":"08:00","fin":"13:00"}]', null),
  (14, 'Abel Leoncio Huilca Rios', '70028210', null,
   '[{"dias":[1,2,3,4,5],"ini":"08:00","fin":"13:00"}]', null),
  (15, 'Alberto Alviery Gonzales Chonta', '73939131', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"15:00","fin":"19:00"}]', null),
  (16, 'Ida Laura Bermudez Reyes', '71479461', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"15:00","fin":"19:00"}]', null),
  (17, 'Ezequiel Andrés Oscanoa Ulloa', '75177722', null,
   '[{"dias":[1,4,6],"ini":"09:00","fin":"10:00"},{"dias":[2,3,5,7],"ini":"14:00","fin":"17:00"}]', null),
  (18, 'Lisbeth Champi Curo', '71032505', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"18:00","fin":"22:00"}]', null),
  (19, 'Yeiser Avila medina', '70478056', null,
   '[{"dias":[1,2,3,4,6],"ini":"10:00","fin":"13:00"}]', null),
  (20, 'Jhony Miguel Rivera Almanza', '74323358', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"15:00","fin":"21:00"}]', null),
  (21, 'Luis Antony Gonzalo Guerrero', '75588627', null,
   '[{"dias":[1,2,5,6],"ini":"08:00","fin":"13:00"}]', null),
  (22, 'Jimena Elizabeth Valdivia Díaz', '72928613', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"12:00"}]', null),
  (24, 'Ketty Antoaneth Huamán Carrasco', '73191014', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"08:00","fin":"13:00"}]', null),
  (26, 'Alessandra Rocío López Yanac', '75925377', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"14:00"}]', null),
  (27, 'Camila Irene Lopez Alejos', '72159119', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"14:00"}]', null),
  (28, 'Camila Cruz', '72022016', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"14:00","fin":"16:00"}]', null),
  (29, 'Cynthia Paredes', '72453804', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"11:00","fin":"16:00"}]', null),
  (30, 'Nacira Liz Santana Ríos', '72712049', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"18:00","fin":"22:00"}]', null),
  (31, 'Rebeca Cristina Montes Tamayo', '72702742', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"18:00","fin":"22:00"}]', null),
  (32, 'Merly Stefany Medina Rodas', '60775713', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"14:00","fin":"18:00"}]', null),
  (33, 'Dayron Lennyn Usuchagua', '76391574', null,
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"12:00"}]', null),
  (34, 'Fabrizio Manuel Ibañez Rodriguez', null, 'Fabrizio Manuel Ibañez Rodriguez',
   '[{"dias":[1,2,5,6],"ini":"08:00","fin":"14:00"}]',
   'La fuente no incluye DNI; se exige una coincidencia única por nombre completo.'),
  (35, 'José Joaquín Ramos', null, 'José Joaquín Ramos',
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"14:00"}]',
   'La fuente no incluye DNI; se exige una coincidencia única por nombre completo.'),
  (36, 'Kevin Jesús Montoya García', null, 'Kevin Jesús Montoya García',
   '[{"dias":[1,2,3,4,5,6,7],"ini":"10:00","fin":"14:00"}]',
   'La fuente no incluye DNI; se exige una coincidencia única por nombre completo.');

create temporary table carga_comparticiones_preparada on commit drop as
select
  f.*,
  coalesce(m.ids, array[]::bigint[]) as ids,
  cardinality(coalesce(m.ids, array[]::bigint[])) as coincidencias,
  (
    select jsonb_object_agg(
      dia.valor,
      jsonb_build_object('ini', franja.valor->>'ini', 'fin', franja.valor->>'fin')
      order by dia.valor::integer
    )
    from jsonb_array_elements(f.franjas) as franja(valor)
    cross join lateral jsonb_array_elements_text(franja.valor->'dias') as dia(valor)
  ) as horario
from carga_comparticiones_fuente f
left join lateral (
  select array_agg(c.id order by c.id) as ids
  from public.asis_colaboradores c
  where case
    when f.dni is not null then
      regexp_replace(coalesce(c.dni, ''), '[^0-9]', '', 'g') = f.dni
    else
      regexp_replace(
        translate(lower(coalesce(c.nombre, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]+', '', 'g'
      ) = regexp_replace(
        translate(lower(coalesce(f.nombre_selector, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]+', '', 'g'
      )
    end
) m on true;

-- Protege lo configurado previamente, incluso si la bandera y las filas hubieran
-- quedado desincronizadas: cualquiera de las dos señales basta para omitirlo.
alter table carga_comparticiones_preparada
  add column ya_configurado boolean not null default false;

update carga_comparticiones_preparada p
set ya_configurado =
  coalesce(c.comparticiones_horario_configurado, false)
  or exists (
    select 1
    from public.asis_comparticiones_horarios h
    where h.colaborador_id = c.id
  )
from public.asis_colaboradores c
where p.coincidencias = 1
  and c.id = p.ids[1];

-- Detiene la transacción si la propia carga contiene un día repetido o una hora inválida.
do $$
begin
  if exists (
    select 1
    from carga_comparticiones_preparada p
    where (select count(*) from jsonb_object_keys(p.horario)) <> (
      select count(*)
      from jsonb_array_elements(p.franjas) f(valor)
      cross join lateral jsonb_array_elements(f.valor->'dias') d(valor)
    )
       or exists (
         select 1
         from jsonb_each(p.horario) h
         where (h.value->>'ini')::time = (h.value->>'fin')::time
       )
  ) then
    raise exception 'La carga contiene días repetidos o franjas inválidas.';
  end if;
end $$;

create temporary table carga_comparticiones_lote (lote_id uuid not null) on commit preserve rows;
insert into carga_comparticiones_lote values (gen_random_uuid());

insert into public.asis_comparticiones_horarios_respaldo (
  lote_id, colaborador_id, nombre_fuente, dni_ultimos_4,
  configurado_anterior, horario_anterior, horario_nuevo, creado_por
)
select
  l.lote_id,
  c.id,
  p.nombre_fuente,
  case when p.dni is null then null else right(p.dni, 4) end,
  c.comparticiones_horario_configurado,
  coalesce((
    select jsonb_object_agg(
      h.dia_semana::text,
      jsonb_build_object(
        'ini', to_char(h.hora_inicio, 'HH24:MI'),
        'fin', to_char(h.hora_fin, 'HH24:MI')
      ) order by h.dia_semana
    )
    from public.asis_comparticiones_horarios h
    where h.colaborador_id = c.id
  ), '{}'::jsonb),
  p.horario,
  auth.uid()
from carga_comparticiones_preparada p
cross join carga_comparticiones_lote l
join public.asis_colaboradores c on c.id = p.ids[1]
where p.coincidencias = 1
  and not p.ya_configurado;

insert into public.asis_comparticiones_horarios (
  colaborador_id, dia_semana, hora_inicio, hora_fin, actualizado_por
)
select
  p.ids[1],
  h.key::smallint,
  (h.value->>'ini')::time,
  (h.value->>'fin')::time,
  auth.uid()
from carga_comparticiones_preparada p
cross join lateral jsonb_each(p.horario) h
where p.coincidencias = 1
  and not p.ya_configurado;

update public.asis_colaboradores c
set comparticiones_horario_configurado = true
from carga_comparticiones_preparada p
where p.coincidencias = 1
  and not p.ya_configurado
  and c.id = p.ids[1];

-- El reporte permanece visible en el editor SQL después de confirmar la carga.
create temporary table carga_comparticiones_reporte on commit preserve rows as
select
  p.orden,
  case
    when p.coincidencias = 1 and p.ya_configurado then 'OMITIDO · YA CONFIGURADO'
    when p.coincidencias = 1 then 'ACTUALIZADO'
    when p.coincidencias = 0 then 'NO ENCONTRADO'
    else 'COINCIDENCIA AMBIGUA'
  end as estado,
  p.nombre_fuente,
  coalesce('••••' || right(p.dni, 4), 'Sin DNI') as dni,
  case when p.coincidencias = 1 and not p.ya_configurado
    then (select count(*)::integer from jsonb_object_keys(p.horario))
    else 0
  end as dias_configurados,
  p.observacion
from carga_comparticiones_preparada p;

commit;

select
  (select lote_id from carga_comparticiones_lote) as lote_respaldo,
  count(*) filter (where estado = 'ACTUALIZADO') as actualizados,
  count(*) filter (where estado = 'OMITIDO · YA CONFIGURADO') as conservados,
  count(*) filter (where estado = 'NO ENCONTRADO') as no_encontrados,
  count(*) filter (where estado = 'COINCIDENCIA AMBIGUA') as ambiguos
from carga_comparticiones_reporte;

select *
from carga_comparticiones_reporte
order by orden;

-- PENDIENTES QUE NO SE MODIFICAN AUTOMÁTICAMENTE
-- 1. DNI 71195961 aparece para "Arellis Centurion" (1 pm - 9 pm) y
--    "Eovyn Arellis Centurion Zúñiga" (9 am - 11 am). Hay que confirmar cuál vale.
-- 2. "Jimena Elizabeth Valdivia Diaz" no tiene horario en la fuente.
-- 3. "Stefany Medina Rodas" y "alviery" son nombres parciales que parecen duplicar
--    registros ya cargados, por lo que no deben sobrescribirse a ciegas.

-- ROLLBACK DE UN LOTE (usar solo si se necesita revertir y reemplazar UUID_AQUI):
-- begin;
-- delete from public.asis_comparticiones_horarios h
-- using public.asis_comparticiones_horarios_respaldo r
-- where r.lote_id = 'UUID_AQUI'::uuid and h.colaborador_id = r.colaborador_id;
-- insert into public.asis_comparticiones_horarios
--   (colaborador_id, dia_semana, hora_inicio, hora_fin, actualizado_por)
-- select r.colaborador_id, h.key::smallint, (h.value->>'ini')::time,
--        (h.value->>'fin')::time, auth.uid()
-- from public.asis_comparticiones_horarios_respaldo r
-- cross join lateral jsonb_each(r.horario_anterior) h
-- where r.lote_id = 'UUID_AQUI'::uuid;
-- update public.asis_colaboradores c
-- set comparticiones_horario_configurado = r.configurado_anterior
-- from public.asis_comparticiones_horarios_respaldo r
-- where r.lote_id = 'UUID_AQUI'::uuid and c.id = r.colaborador_id;
-- commit;
