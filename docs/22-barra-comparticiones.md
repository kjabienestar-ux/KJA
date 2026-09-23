# Asistencia y comparticiones en la barra mensual

Aplicar `supabase/dashboard_71_historial_comparticiones.sql` en el SQL Editor de Supabase después de la migración 70 y publicar los archivos del dashboard. No se ha ejecutado en producción desde este entorno.

La barra incluye días laborables y fechas con comparticiones asignadas, aunque no tengan marcación. El servidor determina si la entrega está completa y si venció su plazo. Un día sin ninguna de esas obligaciones no aparece.

- Rojo con `!`: plazo de comparticiones vencido sin completar evidencias, o jornada incompleta según el cierre existente.
- Verde en un día no laborable: comparticiones entregadas; no significa que ya estén aprobadas.
- Ámbar en un día no laborable: comparticiones pendientes con plazo aún vigente.
- Fechas futuras: programación, sin alerta de incumplimiento.

El mensaje muestra la fecha y la razón al pasar el mouse, enfocar con teclado o tocar el día. Se cierra con Escape, al tocar fuera o al desplazar la barra. En móvil la misma barra se ubica en el inicio rápido, sin duplicar sus controles.

La migración conserva la validación de sesión y acceso del historial original, así como sus horas, metas, totales y estados de asistencia. No modifica entregas, aprobaciones ni ranking. Se puede ejecutar de nuevo sin duplicar funciones base.

## Mi asistencia

Los cinco indicadores compactos se presentan junto al selector de mes; en pantallas pequeñas pasan a una fila inferior con desplazamiento horizontal. El calendario muestra también «Falta compartir», «Compartido» y «Por compartir» en días sin jornada. Cada celda es un botón y conserva su color aunque sea hoy. El contorno terracota identifica la selección; el foco de teclado tiene un contorno azul.

Al seleccionar una fecha, el panel lateral explica el estado con los datos del historial y consulta `dash_dia_detalle` para horario, modalidad, horas y observaciones. Omite horarios no aplicables y campos vacíos de días sin jornada. Ignora respuestas antiguas si se cambia de fecha antes de que termine la consulta, y permite reintentar si falla. El botón «Ver registro y evidencias» conserva el visor privado existente. Las solicitudes están en un desplegable bajo el detalle y la columna de escritorio tiene altura limitada y desplazamiento propio. En móvil el panel aparece debajo del calendario. No requiere una migración adicional a la 71.

Pruebas adicionales: `node --test tests/attendance-calendar.test.mjs`, incluidos datos incompletos, jornadas futuras, entregas pendientes de aprobación y consultas fuera de orden.

Validación: `node --test tests/month-progress.test.mjs tests/attendance-sharing-only.test.mjs`; PostgreSQL temporal con `node tests/history-sharing-sql-check.mjs <ruta-a-pglite/dist/index.js>`. La revisión visual en navegador y la comprobación con datos productivos quedan pendientes.
