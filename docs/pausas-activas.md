# Pausas activas

La tarjeta y los diálogos usan vidrio translúcido en tonos piedra, con texto azul institucional. El navegador puede desactivar transparencia y movimiento mediante sus preferencias de accesibilidad.

## Activación

Ejecutar `supabase/dashboard_75_pausas_activas.sql` en el SQL Editor del proyecto Supabase después de las migraciones existentes. Después publicar `assets/js/dashboard-pausa-activa.js` y `assets/css/paginas/dashboard-pausa-activa.css` junto con el dashboard. La migración no se ejecutó en una base remota desde esta sesión.

## Reglas

- Dos pausas diarias: movilidad de 20 minutos y descanso visual de 10 minutos, una por tipo.
- Cada pausa se consume al iniciar, también si se abandona o se recarga la página. No se acredita ejercicio completado: se registra uso.
- La fecha es la del servidor en America/Lima. Los saldos sin usar no se acumulan.
- El servidor exige colaborador activo, sesión vigente, día laborable, hora dentro de la jornada y entrada registrada sin salida.
- Las llamadas simultáneas se serializan en la base de datos. Los clientes autenticados no pueden modificar directamente la tabla.
- Administración muestra todos los colaboradores activos, incluidos quienes no usaron pausas. Dirección puede restablecer las pausas de hoy por persona o para todo el equipo.
- El cliente consulta el saldo al abrir y cada 30 segundos. Los errores de red no se convierten en consumos o reseteos exitosos.
- El campo heredado `completadas_count` representa pausas usadas, no ejercicios terminados.

## Verificación

`node --test tests/pausa-server.test.mjs` comprueba confirmación de consumo antes del inicio, doble clic, rechazo del servidor, error de red, recarga, lectura de un reseteo y rechazo de reseteo sin pérdida de saldo.

Pendiente en el entorno desplegado: ejecutar la migración, comprobar dos dispositivos simultáneos, horario real, permisos de Dirección y cambio de fecha. No hubo navegador disponible para verificar visualmente escritorio y móvil.
