# Una solicitud por envío

Aplicar `dashboard_96_solicitudes_agrupadas.sql` después de la 95. Publicar dashboard.html, dashboard.js, dashboard-leave-review.js y dashboard-days-off.css.

Cada envío de varios días tiene un identificador de grupo. La bandeja de Dirección cuenta envíos y muestra una sola fila por solicitud, con las fechas y el número de días pendientes. «Revisar» abre un diálogo con el comentario y las acciones de cada fecha.

Aprobar, rechazar y proponer otra fecha conservan el comportamiento de la 94. Los días ya resueltos permanecen visibles mientras quedan días pendientes del grupo. Cuando todos se resuelven, el envío desaparece de la bandeja; el diálogo abierto conserva el resultado de la última revisión hasta cerrarse.

Los envíos anteriores se agrupan por colaborador, instante exacto de creación y comentario: el lote de la 95 comparte el timestamp de su transacción. No se agrupan envíos distintos solo por ser de la misma persona. Se conservan las filas individuales para auditoría y decisiones por fecha.

Validación: pruebas SQL de permisos, recuperación de lotes anteriores, grupos nuevos y revisión parcial; prueba de agrupación JavaScript. La verificación visual en navegador conectado queda pendiente.
