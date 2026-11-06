# Coordinacion de lecturas del dashboard

Entrega KJA-032: solo frontend de notificaciones, cierres administrativos y Zoom. No requiere SQL, Edge Functions, cambios de permisos ni limpieza de datos.

## Comportamiento

- Notificaciones comparten una lectura por cuenta y ambito. Un INSERT durante la carga solicita una lectura posterior. Se descartan respuestas invalidadas.
- Cierres comparten las consultas de cierre y revision. Una accion guardada exige lectura posterior; un fallo de transporte no libera el vuelo hasta que ambas consultas terminen.
- Zoom comparte `dash_zoom_listar` por sesion/ambito y generacion. Una edicion o sincronizacion invalida la lectura anterior.
- Se conservan cadencias de 30 segundos en notificaciones y 60 segundos en cierres/Zoom, reglas de acceso y validaciones del servidor.

## Validacion de la entrega

Base `b682266` de master. Seleccion combinada de suite general, Zoom y pruebas relacionadas: base 427/449 y entrega 447/469, mismos 22 fallos anteriores, sin fallos nuevos. Las 20 pruebas incorporadas pasan. No se declara la suite completa libre de fallos.

Ensayo Edge aislado con HTML y scripts locales de la entrega, autenticacion y respuestas ficticias, conexiones externas bloqueadas: arranque del portal, doce cargas por modulo compartiendo cuatro consultas, y cambio a visor sin consultas administrativas ni controles de gestion Zoom. Cero errores JavaScript o escrituras del servidor simulado. No valida RLS o autenticacion remotas ni ahorro mensual.

## Publicacion y retorno

Publicar juntos `dashboard.html` y los cuatro scripts modificados; el HTML cambia sus versiones para evitar reutilizar copias antiguas. Comprobar una sesion autorizada de cada rol, actualizacion posterior a guardar, error/reintento y cambio de fecha. No usar reuniones reales ni archivos sensibles para pruebas de carga.

Medir solicitudes y bytes por recorrido antes y despues, sin guardar cuerpos, enlaces privados o credenciales. Comparar 24-48 horas de actividad semejante y tendencia semanal. Una reduccion sintetica de llamadas no garantiza reduccion mensual equivalente.

Ante fallo de acceso, resultados o frescura, revertir esta entrega completa (incluido HTML) y publicar de nuevo. No hay migraciones o datos que revertir. La medicion real y la publicacion quedan pendientes al preparar esta entrega.
