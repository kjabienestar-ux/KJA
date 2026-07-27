-- =====================================================================
--  KJA · Asistencia — Carga de colaboradores desde la hoja HORARIOS
--  (Abril–Agosto 2026). Ejecuta DESPUÉS de la migración 2 (horario_semanal).
--  ✔ Corregido con la captura completa (Viernes/Sábado ya alineados).
--
--  · Idempotente: no duplica si el nombre ya existe en esa área.
--  · Busca el área por nombre (no por ID). dias_laborables se calcula solo.
-- =====================================================================

-- Área que faltaba
insert into public.asis_areas (nombre, orden) values ('Contabilidad', 10)
on conflict (nombre) do nothing;

-- ¿Ya corriste una versión ANTERIOR de este seed? Descomenta para reemplazar limpio:
 delete from public.asis_colaboradores where nombre in (
 'Angel Raul Tito Policarpo','Erika del Socorro Moreno Quilcate','Pedro Manuel Cajaleon',
'Jade Alina Cabrera Pérez','Dayana Rojas','Pierina Rosas','Jheferson Junior Quispe',
'Mario Olavarría','Ida Laura Bermúdez Reyes','Yeiser Jamber Avila Medina',
 'Luis Antony Gonzalo Guerrero','Jian Phol Damian Gregorio','Juan Diego Marquez Carbajal',
 'Kevin Jesus Montoya Garcia','Valdivia Díaz Jimena Elizabeth','Daniela Lupa Gonzales',
 'Mariana Celeste Alejandro Díaz','Diego Franco Landeo Ramon','Merly Stefany Medina Rodas');

with datos(nombre, area, ini, fin, hs) as (
  values
  ('Angel Raul Tito Policarpo','Salud ocupacional','13:00','18:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual"},"4":{"mod":"virtual"},"5":{"mod":"virtual"}}'),
  ('Erika del Socorro Moreno Quilcate','Recursos Humanos','08:00','14:00',
    '{"2":{"mod":"virtual"},"3":{"mod":"virtual"},"4":{"mod":"virtual"},"5":{"mod":"virtual"}}'),
  ('Pedro Manuel Cajaleon','Recursos Humanos','08:00','13:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"opcional"},"4":{"mod":"virtual"},"5":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Jade Alina Cabrera Pérez','Reclutamiento','08:00','13:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"4":{"mod":"virtual"},"5":{"mod":"opcional"},"6":{"mod":"virtual"}}'),
  ('Dayana Rojas','Reclutamiento','08:00','13:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual"}}'),
  ('Pierina Rosas','Reclutamiento','08:00','13:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual"}}'),
  ('Jheferson Junior Quispe','Marketing','09:00','14:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual","ini":"14:00","fin":"17:00"},"4":{"mod":"virtual"},"5":{"mod":"virtual","ini":"10:00","fin":"15:00"},"6":{"mod":"presencial"}}'),
  ('Mario Olavarría','Marketing','08:00','13:00',
    '{"1":{"mod":"virtual","ini":"13:00","fin":"16:00"},"2":{"mod":"virtual","ini":"14:00","fin":"18:00"},"3":{"mod":"virtual","ini":"08:00","fin":"17:00"},"5":{"mod":"virtual","ini":"08:00","fin":"16:00"},"6":{"mod":"virtual","ini":"09:00","fin":"13:00"}}'),
  ('Ida Laura Bermúdez Reyes','Marketing','14:00','18:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual","ini":"13:00","fin":"17:00"},"5":{"mod":"virtual","ini":"15:00","fin":"19:00"},"6":{"mod":"virtual"}}'),
  ('Yeiser Jamber Avila Medina','Ingeniería','08:00','14:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"5":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Luis Antony Gonzalo Guerrero','Ingeniería','08:00','13:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Jian Phol Damian Gregorio','Diseño gráfico','08:00','13:00',
    '{"1":{"mod":"virtual","ini":"08:00","fin":"15:00"},"3":{"mod":"virtual","ini":"08:00","fin":"15:00"},"5":{"mod":"virtual","ini":"08:00","fin":"16:00"},"6":{"mod":"virtual","ini":"08:00","fin":"16:00"}}'),
  ('Juan Diego Marquez Carbajal','Diseño gráfico','08:00','14:00',
    '{"1":{"mod":"virtual"},"3":{"mod":"virtual"},"4":{"mod":"virtual","ini":"16:00","fin":"22:00"},"6":{"mod":"virtual"}}'),
  ('Kevin Jesus Montoya Garcia','Diseño gráfico','08:00','13:00',
    '{"1":{"mod":"virtual"},"5":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Valdivia Díaz Jimena Elizabeth','Diseño gráfico','08:00','14:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"virtual"},"3":{"mod":"virtual"},"4":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Daniela Lupa Gonzales','Clínica','09:00','18:00',
    '{"1":{"mod":"presencial"},"2":{"mod":"presencial"},"4":{"mod":"presencial"},"5":{"mod":"presencial","ini":"14:00","fin":"18:00"},"6":{"mod":"virtual","ini":"09:00","fin":"13:00"}}'),
  ('Mariana Celeste Alejandro Díaz','Clínica','08:00','19:00',
    '{"2":{"mod":"presencial","ini":"09:00","fin":"18:00"},"4":{"mod":"presencial","ini":"14:00","fin":"19:00"},"5":{"mod":"presencial","ini":"09:00","fin":"18:00"}}'),
  ('Diego Franco Landeo Ramon','Audiovisuales','08:00','12:00',
    '{"1":{"mod":"virtual"},"2":{"mod":"presencial","ini":"08:00","fin":"14:00"},"3":{"mod":"virtual","ini":"13:00","fin":"16:00"},"4":{"mod":"virtual"},"6":{"mod":"virtual"}}'),
  ('Merly Stefany Medina Rodas','Contabilidad','14:00','19:00',
    '{"1":{"mod":"virtual"},"3":{"mod":"virtual"},"4":{"mod":"virtual"},"6":{"mod":"virtual","ini":"13:00","fin":"18:00"}}')
)
insert into public.asis_colaboradores (area_id, nombre, hora_inicio, hora_fin, horario_semanal, dias_laborables)
select a.id, d.nombre, d.ini::time, d.fin::time, d.hs::jsonb,
       (select array_agg(k::int order by k::int) from jsonb_object_keys(d.hs::jsonb) as k)
from datos d
join public.asis_areas a on a.nombre = d.area
where not exists (
  select 1 from public.asis_colaboradores c where c.nombre = d.nombre and c.area_id = a.id
);

-- Comprobación:
-- select c.nombre, a.nombre area, c.hora_inicio, c.hora_fin, c.dias_laborables
-- from public.asis_colaboradores c join public.asis_areas a on a.id=c.area_id order by a.orden, c.nombre;

-- =====================================================================
--  Correcciones aplicadas en esta versión (vs la anterior):
--   Merly Sáb = Virtual 13:00–18:00 · Jade Vie = Opcional · Pedro Vie = Virtual
--   Pierina = solo Lun–Mié · Jheferson Vie 10–15 y Sáb Presencial
--   Mario Vie = 08–16 · Ida Vie = 15–19 · Yeiser +Vie · Luis Vie = No gestiona
--   Jian Vie/Sáb 08–16 · Valdivia Vie = No gestiona · Daniela Vie 14–18 y Sáb 09–13
--   Mariana Vie Presencial 09–18 (sin Sáb) · Diego Sáb = Virtual (08–12 general)
--  Quedan por confirmar (poca certeza en la imagen): las horas con "PM/F"
--  cortadas y Jheferson Sáb (lo leí Presencial). Revisa en la vista Horarios.
-- =====================================================================
