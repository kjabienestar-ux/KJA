# Horario temporal de Ronny

Ejecutar completo `supabase/dashboard_123_horario_temporal_ronny.sql` en el SQL Editor de Supabase. El archivo identifica a Ronny por su nombre completo, tolera mayúsculas y espacios adicionales, y exige una sola coincidencia activa. No utiliza el documento del archivo histórico, que no está confirmado en producción. Si la búsqueda no es única, muestra los IDs, nombres y estados de los registros llamados Ronny y revierte la operación. La última consulta muestra las diez fechas resultantes.

| Fecha de 2026 | Jornada autorizada |
| --- | --- |
| 20 de octubre | Sin gestión |
| 21 de octubre | 10:30–13:00 |
| 22 de octubre | Sin gestión |
| 23 de octubre | 10:30–13:00 |
| 26 de octubre | 10:30–13:00 |
| 27 de octubre | 10:30–13:00 |
| 28 de octubre | 10:30–13:00 |
| 29 de octubre | 10:30–13:00 |
| 2 de noviembre | 10:30–13:00 |
| 3 de noviembre | 10:30–13:00 |

Todas las horas corresponden a Lima. Las ocho jornadas suman 20 horas de trabajo programado. Fuera de estas fechas se utiliza el horario semanal habitual, incluida la semana posterior al 3 de noviembre.

Las horas de entrada y salida se guardan en una tabla de excepciones por fecha. Las funciones compartidas de horario aplican el cambio al marcado, las ventanas de cierre y los cálculos que las consultan. Las excepciones de jornada también se registran en el calendario existente y el ajuste queda en la bitácora contractual.

Este ajuste modifica la programación, no las evidencias ni las horas ya registradas. No cambia modalidad, metas contractuales, horario semanal, agenda específica de Facebook ni saldo del banco de días libres; no convierte beneficios parciales en descuentos enteros. Si ya existe un descanso completo en una de las ocho fechas de jornada reducida, el nuevo acuerdo lo sustituye por la jornada de 10:30 a 13:00 y conserva el registro anterior en la bitácora. Los descansos de otras fechas permanecen vigentes.

El script se puede ejecutar de nuevo sin duplicar fechas ni la bitácora. Preparar o publicar este archivo no ejecuta cambios en la base de producción.

Validación: `node --test tests/ronny-temporary-schedule-sql.test.mjs`.

Si la entrada se registró antes de aplicar el acuerdo, su estado de tardanza queda guardado con el horario anterior. Ejecutar `supabase/dashboard_124_recalcular_puntualidad_ronny.sql` después del ajuste para corregir de T a P las marcas puntuales de estas ocho fechas. La corrección utiliza la hora real en Lima y la tolerancia vigente, conserva las horas registradas y no cambia tardanzas reales ni estados justificados. Se registra en la bitácora y se puede repetir sin duplicar cambios.

Para mostrar el ajuste en Colaboradores, ejecutar `supabase/dashboard_125_directorio_horarios_temporales.sql` y cargar el frontend actualizado. La consulta del directorio conserva sus permisos e incluye la semana efectiva de Lima y los ajustes fechados. La tarjeta muestra la semana con fechas cuando tiene excepciones y un resumen de las jornadas reducidas y los días libres. La ficha completa y su PDF incluyen una tabla de horario temporal, junto al horario habitual de referencia. Al terminar la última fecha temporal, la tarjeta vuelve al horario habitual. No se modifica el formulario de edición del horario semanal.

La tarjeta presenta ahora un resumen de jornada reducida y días libres, agrupando las fechas para evitar diez filas repetidas. Indica que el horario es temporal hasta el 3 de noviembre y que desde el 4 vuelve automáticamente al habitual. El aviso temporal desaparece al terminar la última fecha, también cuando la semana todavía incluye días anteriores con ajustes.

Ejecutar `supabase/dashboard_126_notificar_horario_temporal_ronny.sql` para enviar a Ronny la notificación privada solicitada dentro de la campana del portal. El script verifica primero el horario instalado, informa de las fechas y del retorno automático, y evita avisos duplicados o restablecer el estado leído. No se envía correo ni WhatsApp. Preparar el archivo no crea la notificación en producción hasta ejecutarlo.

Aplicar `supabase/dashboard_127_puntualidad_horario_temporal_ronny.sql` para fijar 15 minutos de tolerancia únicamente en las ocho jornadas reducidas, independientemente del valor general. El servidor considera P desde las 10:30 y durante todo el minuto 10:45; desde las 10:46 considera T. Antes de las 10:30 la ventana propia todavía no abre. La salida permanece a las 13:00. Portal, dashboard, información del día y registro administrativo utilizan la misma tolerancia temporal. Se corrigen las marcas T puntuales anteriores sin alterar horas ni evidencias y se conserva la bitácora. Otras personas y fechas conservan su regla habitual.

La tarjeta distingue Entrada y Salida, muestra las fechas como días agrupados por mes y presenta «Puntual hasta las 10:45 a. m.» únicamente después de recibir ese límite del servidor. El cambio visual por sí solo no habilita la tolerancia.
