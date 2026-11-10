# Pausas activas

La tarjeta y los diálogos usan vidrio translúcido en tonos piedra, con texto azul institucional. El navegador puede desactivar transparencia y movimiento mediante sus preferencias de accesibilidad.

## Activación

Ejecutar `supabase/dashboard_78_pausas_sesiones.sql` en el SQL Editor después de `dashboard_75_pausas_activas.sql` (si 75 ya está aplicado, ejecutar solo 78). Publicar después el JS, CSS y HTML del dashboard y recargar las pestañas abiertas. **No volver a ejecutar 75 después de 78:** reemplazaría las RPC protegidas por sus versiones anteriores. No se ejecutó esta migración en una base remota desde esta sesión.

78 conserva los consumos anteriores, sin inventar tiempos de inicio ni sesiones completadas. Los registra en Dirección como usos anteriores sin seguimiento. El frontend nuevo exige la versión 2 del contrato; no inicia contadores locales si falta la migración. El endpoint antiguo devuelve `actualizar_portal`, evitando que pestañas con código antiguo consuman nuevas pausas.

## Reglas

- Dos pausas diarias: movilidad de 20 minutos y descanso visual de 10 minutos, una por tipo.
- Cada pausa consume un cupo al iniciar. Solo puede existir una sesión en curso por persona, incluso entre dispositivos; inicios simultáneos recuperan esa misma sesión sin consumir otro cupo.
- Recargar, cerrar una pestaña o cambiar a otra no reinicia ni congela el plazo. Todas recuperan el inicio y final fijados por Supabase. Es válido apartarse de la pantalla durante la pausa.
- La finalización exige cumplir los 10 o 20 minutos según el reloj del servidor. No se confía en segundos, fechas ni un indicador de completado enviados por el navegador.
- Abandonar requiere confirmación del servidor y termina la sesión en todas las pestañas. Consume el cupo y se registra como abandonada, no completada. Abrir la confirmación no detiene el reloj.
- La fecha es la del servidor en America/Lima. Los saldos sin usar no se acumulan.
- El servidor exige colaborador activo, sesión vigente, día laborable, hora dentro de la jornada y entrada registrada sin salida.
- No permite iniciar una pausa si no queda tiempo para cumplir toda su duración antes del fin del turno.
- Las llamadas simultáneas se serializan en la base de datos. Los clientes autenticados no pueden modificar directamente la tabla.
- Administración muestra todos los colaboradores activos, incluidos quienes no usaron pausas. Dirección puede restablecer las pausas de hoy por persona o para todo el equipo.
- El cliente recupera el estado al abrir, al volver a la pestaña, recuperar conexión y cada 30 segundos. BroadcastChannel avisa a las otras pestañas; cada una verifica el estado con el servidor. El reloj visual usa tiempo monotónico, no resta un segundo por callback.
- Sin conexión no se inicia, abandona ni anuncia como completada una pausa. Si termina el contador, espera confirmación y reintenta. Una respuesta tardía no puede sobrescribir un inicio/cierre nuevo ni afectar a otra cuenta.
- Dirección distingue sesiones en curso, tiempo cumplido y abandonadas. Los reseteos eliminan las sesiones asociadas al consumo; una llamada con el identificador anterior no puede revivirlas.
- El campo heredado `completadas_count` representa pausas usadas, no ejercicios terminados.
- El sistema verifica duración y uso; no puede comprobar que una persona haya realizado físicamente los ejercicios.

## Verificación

`npm run test:pausas` comprueba inicios simultáneos, pestañas con callbacks retrasados, recarga, abandono, desconexión, invalidación de cuenta y lecturas obsoletas. También valida las funciones SQL con PGlite: plazo completo, propiedad de sesión, permisos, límites de jornada, idempotencia y reseteos. En esa prueba SQL se sustituye únicamente el reloj para comprobar fronteras temporales sin esperar 20 minutos reales.

Pendiente en el entorno desplegado: ejecutar 78, comprobar dos dispositivos simultáneos con una cuenta de prueba dentro del horario y probar la recuperación tras suspensión del equipo. No había navegador conectado para realizar esta comprobación desde la sesión de desarrollo.
