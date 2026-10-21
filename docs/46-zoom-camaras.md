# Cámaras y reporte de observación Zoom

Implementación en la rama `feat/zoom-camera-report`. Activación en producción pendiente de la migración y de publicar los archivos; no se ha iniciado ninguna reunión real para las pruebas.

## Uso

- En **Reuniones Zoom**, Sistemas puede pulsar **Reporte de cámaras** en cada reunión. Los operadores delegados también encuentran el reporte en `zoom-sala.html`, junto a sus reuniones autorizadas.
- Al iniciar la reunión desde el portal aparece **Cámaras de participantes** dentro de **Control KJA**. El registro empieza después de conectarse; no se reconstruye actividad anterior.
- **Ver reporte guardado** abre otra pestaña sin desconectar al anfitrión. El reporte permite elegir una sesión de observación, actualizar sus datos y descargar CSV.
- Se muestran primera observación, última presencia observada, segundos con cámara encendida/apagada, tramos sin información y porcentaje del tiempo confirmado. No son horarios oficiales de entrada/salida ni acreditan atención.

## Alcance del dato

Se escucha `onUserJoin`, `onUserLeave`, `onUserUpdate`, espera, estado de salas y conexión. Cada cambio dispara una lectura agrupada de `ZoomMtg.getAttendeeslist`; una lectura fresca cada 15 segundos mantiene la señal de actividad. Se consulta `getBreakoutRoomStatus` en cada observación; un cambio de salas invalida las lecturas en curso. El formato `result.attendeesList` y el campo booleano `video` se verificaron en el bundle oficial del Meeting SDK **5.1.4** usado por el proyecto.

Solo se registra vídeo confirmado de la reunión principal, con estado de salas confirmado como cerrado. Mientras las salas separadas estén abiertas o cerrando, o su estado no esté confirmado, todas las cámaras se guardan como **sin información**. El anfitrión no acredita la visibilidad de las cámaras de todas las salas. Ampliar ese alcance requiere una prueba real de la versión del SDK.

El observador debe conservar Zoom conectado y el navegador en primer plano. Al ocultar la página, perder red, reconectarse, terminar o fallar el SDK, la vista deja de afirmar el estado anterior. Las respuestas tardías no reactivan observaciones descartadas. Las pestañas y dispositivos pueden limitar ejecución en segundo plano.

La hora válida de cada muestra es la recepción del servidor. El cálculo admite como máximo 20 segundos confirmados a partir de una muestra; el resto hasta la siguiente es desconocido. No se repiten muestras fallidas: el siguiente intento lee otra vez Zoom. Una sesión sin cierre queda interrumpida a los 40 segundos de su última señal; el reporte no prolonga su duración indefinidamente. Si se reanuda, el hueco entre muestras se conserva como desconocido. El porcentaje divide tiempo encendido entre encendido + apagado y excluye desconocidos. Es una observación aproximada de estados, no una medición forense de cada cambio instantáneo.

Se usa `participantUUID`/`persistentID`, o el ID de participante si no hay identificador persistente. Cambiar un nombre no mezcla identidades; dos nombres iguales siguen siendo filas separadas. No se vinculan automáticamente nombres de Zoom con colaboradores. Una reconexión que cambie todos sus identificadores aparecerá como otra fila. Cada observador genera su propia sesión: los reportes nunca suman sesiones simultáneas.

## Acceso y almacenamiento

Las tablas tienen RLS y carecen de permisos directos para `anon` y `authenticated`. Las RPC comprueban `dash_zoom_opera` por reunión; solo el observador puede añadir muestras a su sesión. Sistemas puede consultar también reportes de reuniones canceladas, conservando el historial. Revocar un operador bloquea nuevas muestras y lecturas; puede cerrar su propia sesión. Los UUID de sesión y números de secuencia hacen idempotentes inicios/reintentos y descartan muestras repetidas o fuera de orden.

Se guardan nombres, identificadores de participante y estados; no se almacenan imágenes, grabaciones, audio, correos, firmas ni ZAK. La interfaz informa del registro. Los CSV neutralizan fórmulas introducidas mediante nombres o títulos.

## Despliegue

1. Ejecutar `supabase/dashboard_118_zoom_camaras.sql` después de las migraciones 109, 110 y 112. Es reaplicable. No requiere nuevas credenciales ni cambiar los permisos de Zoom.
2. Publicar `dashboard.html`, `zoom-sala.html`, `assets/js/dashboard-zoom.js`, `assets/js/zoom-sala.js`, los tres módulos `assets/js/zoom-camera-*.js` y `assets/css/paginas/zoom-camera.css`.
3. Validar con dos participantes: encender/apagar cámara, renombrar, ocultar el navegador del observador, cortar/reanudar conexión, abrir salas, finalizar y consultar/descargar el reporte con otro responsable autorizado. La autorización del piloto de Meeting SDK se conserva.

Si falta la migración, la reunión sigue funcionando y el panel explica que el registro está pendiente de activación. No debe publicarse el frontend antes de la migración.

## Validación

Ejecutar `npm run test:zoom` con Node 22: 70 pruebas aprobadas, incluyendo PostgreSQL con PGlite de permisos, idempotencia, secuencias, sesiones, cálculo de intervalos, salas separadas e interrupciones, y eventos, errores y UI con JSDOM. En la vista previa local se verificaron el flujo completo con SDK simulado, estados en vivo, tabla y medidas de 1440 y 360 px, sin desbordamiento horizontal de página ni errores de consola. Se comprobó la estructura y geometría de la interfaz; la inspección visual final y la prueba con una reunión real quedan pendientes.

Referencias primarias: [eventos del Client View](https://developers.zoom.us/docs/meeting-sdk/web/client-view/participant-events/), [getAttendeeslist](https://marketplacefront.zoom.us/sdk/meeting/web/functions/ZoomMtg.getAttendeeslist.html), [bundle oficial 5.1.4](https://source.zoom.us/zoom-meeting-5.1.4.min.js).
