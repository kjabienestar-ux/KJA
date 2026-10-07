# Evidencia previa y calendario de días libres

Aplicar `dashboard_97_evidencia_dias_libres.sql` después de la 96. Publicar dashboard.html, dashboard.js, dashboard-leave-review.js y dashboard-days-off.css.

El panel personal muestra un acceso compacto a **Mis solicitudes**. Abre un diálogo con fechas, estados, respuestas y contraofertas, sin expandir la columna de bienestar. Las propuestas por responder se anuncian en el acceso.

El calendario distingue disponibles en verde, elegidos en azul y no disponibles tachados, con una leyenda visible. Mantiene selección múltiple y restricciones de martes a jueves, saldo, horario y fechas futuras.

Antes de enviar se exige una imagen de la solicitud previa: captura o comprobante, JPG/PNG/WebP, máximo 3 MB en origen. Se comprime y se guarda en el bucket privado existente. Dirección verifica su contenido; el sistema no asume que adjuntar una imagen pruebe por sí solo una autorización.

La RPC valida dueño de la ruta, existencia en Storage y que la evidencia no esté usada por otra solicitud. El archivo se vincula a la primera fecha del grupo y se muestra una sola vez en el encabezado del modal de Dirección. Se conserva la protección existente contra borrar archivos referenciados. Las solicitudes antiguas no se modifican ni se invalidan por carecer de evidencia.

Se conserva el envío atómico. La RPC individual no permite eludir la evidencia para nuevas solicitudes de día libre; las demás clases de solicitud mantienen su flujo. No ejecutar migraciones anteriores después de la 97.

Verificación local: sintaxis JavaScript y pruebas SQL de evidencia ausente, ajena, inexistente, reutilizada, acceso al helper privado y evidencia única por grupo. Revisión visual en navegador conectado pendiente.
