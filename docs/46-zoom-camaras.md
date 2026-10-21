# Cámaras y reporte de observación Zoom

Integrado en localhost. Migraciones 118 y 119 aplicadas a la base conectada el 21 de octubre de 2026. Las correcciones se verificaron con SDK simulado y PostgreSQL; falta confirmar los nuevos estados con Zoom real después de recargar el cliente.

## Uso

- En **Reuniones Zoom**, Sistemas puede pulsar **Reporte de cámaras** en cada reunión. Los operadores delegados también encuentran el reporte en `zoom-sala.html`, junto a sus reuniones autorizadas.
- Con Zoom abierto en el dashboard, **Reporte de cámaras** está visible junto a **Ampliar Zoom** y **Cerrar panel**. Consulta el reporte sin recargar ni desconectar la reunión. Dentro de Zoom, **Control KJA · cámaras y salas** contiene los estados observados y el acceso al mismo reporte del dashboard.
- Al iniciar la reunión desde el portal aparece **Cámaras de participantes** dentro de **Control KJA**. El registro empieza después de conectarse; no se reconstruye actividad anterior.
- **Ver reporte guardado** abre el reporte en el mismo dashboard cuando Zoom está integrado. En la página independiente abre otra pestaña; hay que volver a la pestaña del observador para continuar registrando. El reporte se actualiza cada 15 segundos y permite elegir una sesión de observación y descargar CSV.
- Se muestran primera observación, última presencia observada, segundos con cámara encendida/apagada, tramos sin información y porcentaje del tiempo confirmado. No son horarios oficiales de entrada/salida ni acreditan atención.

## Alcance del dato

Se escucha `onUserJoin`, `onUserLeave`, `onUserUpdate`, espera, estado de salas y conexión. Cada cambio dispara una lectura agrupada de `ZoomMtg.getAttendeeslist`; una lectura fresca cada 15 segundos mantiene la señal de actividad. Se consulta `getBreakoutRoomStatus` en cada observación; un cambio de salas invalida las lecturas en curso. El formato `result.attendeesList`, el campo `video` y el evento `onMeetingStatus` con `meetingStatus` se verificaron en el bundle oficial del Meeting SDK **5.1.4** usado por el proyecto.

Con salas cerradas se observan los participantes de la reunión principal. Con salas abiertas se consultan `getUserStatus`, `getBreakoutRooms` y, si corresponde, `getCurrentBreakoutRoom`. Se cruzan identificadores persistentes, `boId`, `roomId` y `participantStatus` para confirmar solamente participantes de la misma sala que el observador. Los de otras salas y los cambios de sala no confirmados quedan sin información. La migración 119 admite el alcance `local`; no modifica muestras antiguas. No se acredita seguimiento simultáneo de todas las salas desde un único observador.

El observador debe conservar Zoom conectado y el navegador en primer plano. Al ocultar la página, perder red, reconectarse, terminar o fallar el SDK, la vista deja de afirmar el estado anterior. Las respuestas tardías no reactivan observaciones descartadas. Las pestañas y dispositivos pueden limitar ejecución en segundo plano.

La hora válida de cada muestra es la recepción del servidor. El cálculo admite como máximo 20 segundos confirmados a partir de una muestra; el resto hasta la siguiente es desconocido. No se repiten muestras fallidas: el siguiente intento lee otra vez Zoom. Una sesión sin cierre queda interrumpida a los 40 segundos de su última señal; el reporte no prolonga su duración indefinidamente. Si se reanuda, el hueco entre muestras se conserva como desconocido. El porcentaje divide tiempo encendido entre encendido + apagado y excluye desconocidos. Es una observación aproximada de estados, no una medición forense de cada cambio instantáneo.

Se usa `participantUUID`/`persistentID`, o el ID de participante si no hay identificador persistente. Cambiar un nombre no mezcla identidades; dos nombres iguales siguen siendo filas separadas. No se vinculan automáticamente nombres de Zoom con colaboradores. Una reconexión que cambie todos sus identificadores aparecerá como otra fila. Cada observador genera su propia sesión: los reportes nunca suman sesiones simultáneas.

## Acceso y almacenamiento

Las tablas tienen RLS y carecen de permisos directos para `anon` y `authenticated`. Las RPC comprueban `dash_zoom_opera` por reunión; solo el observador puede añadir muestras a su sesión. Sistemas puede consultar también reportes de reuniones canceladas, conservando el historial. Revocar un operador bloquea nuevas muestras y lecturas; puede cerrar su propia sesión. Los UUID de sesión y números de secuencia hacen idempotentes inicios/reintentos y descartan muestras repetidas o fuera de orden.

Se guardan nombres, identificadores de participante y estados; no se almacenan imágenes, grabaciones, audio, correos, firmas ni ZAK. La interfaz informa del registro. Los CSV neutralizan fórmulas introducidas mediante nombres o títulos.

## Despliegue

1. Ejecutar `supabase/dashboard_118_zoom_camaras.sql` después de las migraciones 109, 110 y 112, y luego `supabase/dashboard_119_zoom_camaras_sala.sql`. Son reaplicables. No requieren nuevas credenciales ni cambiar los permisos de Zoom.
2. Publicar `dashboard.html`, `zoom-sala.html`, `assets/js/dashboard-zoom.js`, `assets/js/zoom-sala.js`, los tres módulos `assets/js/zoom-camera-*.js` y `assets/css/paginas/zoom-camera.css`.
3. Validar con dos participantes: encender/apagar cámara, renombrar, ocultar el navegador del observador, cortar/reanudar conexión, abrir salas, finalizar y consultar/descargar el reporte con otro responsable autorizado. La autorización del piloto de Meeting SDK se conserva.

Si falta la migración, la reunión sigue funcionando y el panel explica que el registro está pendiente de activación. No debe publicarse el frontend antes de la migración.

## Validación

Ejecutar `npm run test:zoom` y `node --test tests/zoom-embed.test.mjs` con Node 22. Se verificaron permisos e idempotencia en PGlite, tiempos, aislamiento de salas, estados locales, retorno síncrono y callbacks del SDK, `meetingStatus`, reconexión, actualización del reporte y apertura desde el iframe sin navegar. La base conectada admite el nuevo alcance `local` y conserva la restricción contra escritura anónima. Localhost entrega los módulos actualizados. Estas verificaciones no sustituyen confirmar una cámara encendida y apagada en una nueva sesión real.

Referencias primarias: [eventos del Client View](https://developers.zoom.us/docs/meeting-sdk/web/client-view/participant-events/), [getAttendeeslist](https://marketplacefront.zoom.us/sdk/meeting/web/functions/ZoomMtg.getAttendeeslist.html), [bundle oficial 5.1.4](https://source.zoom.us/zoom-meeting-5.1.4.min.js).

## Corrección de cámaras sin información

La sesión real examinada tenía 50 muestras con alcance `breakout` y ninguna muestra confirmada: la versión anterior descartaba todas las cámaras al abrir salas. También interpretaba `onMeetingStatus.status` en lugar del campo `meetingStatus` del SDK 5.1.4. Se corrigieron ambas causas, se añadieron pruebas de regresión y se conserva el historial anterior sin inventar tiempos.
