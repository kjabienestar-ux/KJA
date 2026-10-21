# Aprobación de días libres por Dirección

Aplicar `supabase/dashboard_122_aprobacion_dias_libres_direccion.sql` en el SQL Editor de Supabase después de las migraciones existentes de solicitudes y días libres. Se puede aplicar directamente sobre dashboard_94 o después de dashboard_121; reemplaza sus bloqueos de aprobación por fecha y horario.

Dirección puede aprobar una solicitud pendiente aunque la fecha haya pasado o el horario actual indique que no es laborable. Aprobar la fecha original cierra una contraoferta pendiente. La creación de solicitudes y la aceptación de contraofertas conservan sus validaciones.

Una solicitud programada consume un día del saldo. Si esa fecha ya tiene un descanso asignado, se conserva el descanso existente y no se descuenta otra vez. Se mantienen el control de saldo, los permisos de Dirección y la auditoría. Reintentar una solicitud resuelta no vuelve a descontar.

Ejecutar el SQL no aprueba solicitudes automáticamente. Después de aplicarlo, Dirección utiliza el botón Aprobar. Publicar el frontend o fusionar el PR no ejecuta esta migración en Supabase.

Validación local: `node --test tests/leave-approval-sql.test.mjs tests/leave-review.test.mjs`.
