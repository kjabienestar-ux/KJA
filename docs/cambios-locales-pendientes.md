# Cambios locales complementarios

Este cambio completa el trabajo local que no entró en el PR #142, ya fusionado. La comparación se realizó contra `master`, conservando las funciones y los accesos publicados posteriormente.

- Layout del portal: reserva coherente del espacio del menú en las vistas administrativas.
- Reclutamiento: comprobante imprimible sin portada ni widgets, mensaje de coordinación de WhatsApp con fecha, hora, canal y código, e información de diseño.
- Zoom: acceso al reporte desde el dashboard sin reemplazar el iframe de la reunión; actualización del reporte cada 15 segundos mientras la pestaña está visible; corrección de los eventos `meetingStatus` y de las cámaras observables en la misma sala que el responsable.
- Base de datos: migración 119 para admitir muestras de sala local sin reinterpretar las observaciones antiguas. Debe aplicarse en Supabase antes de usar esa cobertura. La corrección de columnas de entrevista es idempotente y conserva la API y los CV vigentes.

El SQL local antiguo de reclutamiento se conserva completo en `docs/archive/reclutamiento_01_postulaciones.sql.txt`, fuera de las migraciones ejecutables. No debe sustituir el esquema vigente; véase `docs/archive/README.md`.

Las fuentes locales modificadas o nuevas están representadas en la rama o ya estaban en `master`. Se conservaron los accesos de Dirección añadidos en la rama principal y se actualizaron las versiones de los recursos para renovar la caché. Las capturas temporales de `.impeccable/review/` permanecen como artefactos locales de verificación.

Verificación: 117 pruebas de Zoom, reclutamiento y carga mensual aprobadas con Node 24; comprobación adicional de la corrección de columnas ejecutada dos veces sobre el esquema vigente; sintaxis JavaScript y recursos locales de reclutamiento correctos. Chromium confirmó el recibo en flujo de impresión, sin portada. No se desplegaron migraciones ni se enviaron mensajes o registros reales.
