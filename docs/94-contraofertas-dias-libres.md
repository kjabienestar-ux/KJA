# Días libres: martes a jueves y contraofertas

Aplicar `supabase/dashboard_94_contraofertas_dias_libres.sql` después de la 93. Publicar dashboard.html, assets/js/dashboard.js y assets/css/paginas/dashboard-days-off.css actualizados. No volver a ejecutar la 93 después de la 94: restauraría la regla anterior.

- El colaborador elige **martes, miércoles o jueves** en un calendario integrado al formulario. Una fecha futura por solicitud, dentro de los próximos 180 días y según su horario laboral.
- Dirección revisa en **Solicitudes del personal**. Puede aprobar, rechazar o abrir **Proponer otra fecha**, elegir la fecha alternativa y explicar el motivo.
- La propuesta conserva la solicitud pendiente y reserva un solo día de saldo. Tanto la fecha original como la alternativa quedan bloqueadas para evitar solicitudes duplicadas.
- El colaborador ve la propuesta en **Tu bienestar** y en su historial de solicitudes. **Aceptar fecha** aprueba directamente la alternativa autorizada por Dirección. **Rechazar propuesta** cierra la solicitud y libera el saldo para una nueva elección.
- Mientras la propuesta espera respuesta, Dirección no puede aprobar la fecha original; puede rechazar la solicitud. No se reemplazan propuestas pendientes silenciosamente.
- La aceptación vuelve a validar fecha futura, horario, saldo y duplicados. Una propuesta vencida puede rechazarse para liberar la reserva.
- Se conservan autor, fecha, motivo y resultado de la propuesta; la aceptación/rechazo queda auditada, incluida la fecha original. Las comparticiones de Facebook mantienen las reglas existentes.

Validación local: pruebas SQL en PGlite de creación, reserva, rechazo, aprobación, contraofertas, acceso propio, permisos RPC, migración idempotente y descuento único. Pruebas JavaScript de días habilitados y permanencia del calendario después de seleccionar. No validado en Supabase remoto ni en navegador conectado.
