# Publicaciones y paleta del dashboard — KJA-032 / KJA-031

## Cambio
El historial muestra números y primer nombre del autor; ya no monta imágenes ni recupera flyers faltantes automáticamente. La imagen se descarga al abrir una publicación. Cada apertura consulta `cargar` para validar acceso; imágenes de la misma cuenta, rol, publicación, ruta y versión pueden reutilizarse durante 50 segundos en memoria (cuatro entradas como máximo). La imagen abierta permanece disponible hasta reemplazo/cierre aunque deje de ser reutilizable por la caché; cierre de sesión limpia referencias. No hay almacenamiento persistente.

En escritorio el menú principal comparte el control de mostrar/ocultar nombres, se retiran tooltips superpuestos y el área de trabajo usa fondo cálido sólido. Marketing, Zoom, certificados y Reclutamiento adoptan acentos terracota. Gestión conserva el lateral de secciones. No modifica reglas ni permisos del servidor.

## Validación
Base integrada: origin/master 21dca08 (PR #186). Doce pruebas seleccionadas aprobadas: caché de imágenes, borradores, equipo, estructura Marketing y familias/permisos de navegación. Sintaxis y diff correctos.
Piloto local autenticado previo a integrar #186: historial sin img, apertura real y vista previa, reapertura con mismo Blob y evento de descarga confirmado. El ajuste posterior de conservación de imagen activa tiene prueba automática; repetición integrada pendiente. No se cuantificó ahorro diario ni se acreditó publicación. Las firmas por lote del servidor continúan: no se cambió la Edge Function.

## Entrega y reversión
Publicar juntos HTML, los scripts y hojas de estilo de este cambio. No requiere SQL ni desplegar funciones. Revertir el commit del PR para regresar al comportamiento previo. Validar en el despliegue apertura/reapertura/descarga y navegación en las vistas de escritorio; no se acredita auditoría visual completa de formularios ni móvil.
