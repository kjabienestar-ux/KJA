# Solicitar días libres

Aplicar `supabase/dashboard_93_solicitar_dias_libres.sql` después de las migraciones anteriores. Publicar también los cambios de dashboard.html, dashboard.js, dashboard-days-off.css y la imagen images/dashboard/dias_libres.png.

Dirección agrega saldo en **Colaboradores → Días libres → Agregar**, con cantidad y motivo. Este banco requiere la migración 18. La asignación directa de una fecha desde la vista mensual (migración 88) es una operación diferente y no agrega saldo para elegir fechas.

El colaborador con saldo disponible ve el anuncio en **Tu bienestar**. Puede solicitar un martes o viernes futuro, hasta 180 días adelante, una fecha por solicitud. También puede entrar desde **Mi asistencia → Solicitar un día libre**. Los días no laborables, los descansos asignados y las solicitudes pendientes o aprobadas quedan bloqueados en el calendario.

Dirección revisa en la bandeja de solicitudes del resumen de gestión. El saldo se reserva al solicitar y se descuenta al aprobar. Un rechazo libera la reserva. Una aprobación registra el descanso en el mismo sistema que los descansos manuales, conservando las comparticiones de Facebook programadas. Una fecha que ya llegó no se puede aprobar: debe rechazarse para liberar el saldo.

La migración no asigna saldos automáticamente ni altera solicitudes históricas. Las solicitudes anteriores conservan su comportamiento. Las validaciones del servidor usan America/Lima y bloquean la fila del colaborador para serializar el uso del saldo.
