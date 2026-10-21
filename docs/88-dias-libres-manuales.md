# Días libres asignados por administración

En **Mes completo → Días libres**, elegir trabajador activo, fecha y motivo (3–180 caracteres). Se admiten fechas futuras y pasadas desde el inicio del contrato. También puede abrirse desde una celda con **Gestionar día libre**, con persona y fecha ya seleccionadas.

El libro identifica las fechas con **DL** y las excluye de los días programados y de entradas pendientes. La persona ve la felicitación y la ilustración de descanso; no marca entrada ni salida ni entrega RPE o asignaciones. Facebook conserva su horario, plazo y revisión. Las marcas y evidencias existentes se conservan.

La lista del mes permite quitar los descansos manuales y restaurar las obligaciones del horario habitual; no elimina los beneficios presenciales del 2 de octubre. Dirección y editores pueden asignar y quitar; otros roles solo consultan. Cada cambio queda auditado con actor, fecha, persona, motivo y acción. No se modifica el saldo del banco de días libres.

## Activación

1. Ejecutar `supabase/dashboard_88_dias_libres_manuales.sql` después de la migración 87. Es reejecutable y no asigna descansos por sí sola.
2. Publicar `dashboard.html`, `assets/js/dashboard-admin-mes.js`, `assets/js/dashboard.js` y `assets/css/paginas/dashboard-admin-month-layout.css` junto a los cambios anteriores de descanso.
3. Recargar el panel e ingresar a **Mes completo → Días libres**.

No se ejecutó esta migración en la base remota desde esta sesión. Pruebas locales: `node --test tests/manual-days-off.test.mjs tests/presencial-day-off.test.mjs`. No se pudo comprobar la apariencia en un navegador conectado.


## Planificador de descansos

**Mes completo → Días libres** abre un calendario amplio con búsqueda por nombre, DNI o área y filtro de área. La búsqueda ignora tildes. Seleccionar una persona muestra sus descansos; al abrir, el calendario muestra a todo el equipo.

Se pueden elegir fechas sueltas o añadir un rango de hasta 62 días, incluso entre meses. Los descansos existentes y las fechas anteriores al contrato se omiten. La selección y su cantidad permanecen visibles al navegar. Antes de guardar se indica la persona destinataria y se solicita un motivo. Las vistas Mes y Semana permiten revisar la distribución; la semana comienza el lunes y consulta ambos meses cuando corresponde.

La asignación usa el RPC auditado existente por cada fecha. Si una fecha falla, se detiene el lote, se informa cuántos días se guardaron y los pendientes siguen seleccionados para revisión. No hay transacción única para todo el lote. Solo los descansos manuales ofrecen Quitar; los beneficios presenciales se conservan. Los roles de consulta tienen calendario y búsqueda sin acciones de escritura.

Publicar también `assets/js/dashboard-days-off-planner.js` y `assets/css/paginas/dashboard-days-off-planner.css` junto con `dashboard.html` y `assets/js/dashboard-admin-mes.js`. No requiere una migración adicional a la 88.

Validación local: `node --test tests/days-off-planner.test.mjs tests/manual-days-off.test.mjs tests/presencial-day-off.test.mjs tests/leave-review.test.mjs`. Revisión visual en Chrome a 390 y 1440 px con datos de ejemplo, sin operaciones en la base remota.
