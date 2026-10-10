# Cursos: biblioteca gratuita y tarjetas con velo glass

La página `cursos.html` conserva el hero, las nueve áreas y sus rutas, el contacto y el footer. La biblioteca gratuita aparece antes del catálogo. Las tarjetas oficiales combinan fotografía completa con texto sobre un velo lateral, una acción circular y sombras alternadas rosa/azul. En escritorio, hover o foco ensancha la tarjeta y muestra su descripción; las compañeras de la fila se contraen. La tarjeta activa pierde la sombra.

El catálogo se adapta a tres columnas en escritorio, dos en tablet y una en móvil. En tablet y móvil se muestran únicamente el título y la fotografía, en formato 16:9 con velo inferior suave; la tarjeta completa mantiene el enlace al área. Las tarjetas usan resúmenes de 23–25 palabras (`catalogSummary`) y conservan la descripción completa en la vista del área. La fuente de las descripciones es .85rem en escritorio; en tablet y móvil las descripciones se ocultan. En escritorio la tarjeta expandida reserva el 60% para texto y el 40% para fotografía. El velo se limita al bloque de texto, sin cubrir ni desenfocar la foto, y la tarjeta activa se resalta con borde rosa.

Los videos destacados se apilan en móvil. En reposo muestran fotografía inmersiva con overlay oscuro inferior, título blanco, badges glass, botón de reproducción lavanda con halo y pequeños acentos amarillos, siguiendo la última referencia aprobada. El metadato A tu ritmo evita inventar duración o nivel. En escritorio su hover muestra una superficie azul translúcida con desenfoque, reflejos, título grande y acción centrada. El teclado dispone del mismo estado. Se respetan preferencias de movimiento y transparencia reducidos.

## Publicar videos reales

Editar `assets/js/cursos-gratuitos-data.js`:

1. Sustituir títulos, descripciones y portadas ilustrativos por los reales.
2. Completar `driveUrl` con enlaces de archivo, por ejemplo `https://drive.google.com/file/d/ID_DEL_ARCHIVO/view`.
3. Comprobar que cada archivo permite el acceso y reproducción a los visitantes previstos.
4. Cambiar `preview` a `false`.

Solo se muestran los tres primeros cursos en la página; el botón Ver biblioteca permite consultar todos. Los enlaces sin archivo válido siguen mostrando Próximamente. El iframe de Drive se crea al solicitar reproducción y se descarga al cerrar la ventana; el video también puede abrirse en otra pestaña.

Esta entrega no sincroniza automáticamente carpetas de Drive. Esa integración requiere conocer la carpeta, los permisos y la forma de publicación cuando se disponga de acceso. No se han conectado ni verificado videos reales: el usuario aún no tiene acceso a la fuente.

## Validación

- `npm run test:cursos`: diez pruebas sobre catálogo, expansión con teclado, contenido en pantallas táctiles, vistas por área, vista previa, biblioteca vacía, más de tres cursos, reproducción publicada, enlaces inválidos y cierre del reproductor.
- Navegador Edge: 1440, 820, 390 y 360 px; sin errores de JavaScript, imágenes rotas o desbordes de las tarjetas. Escape cierra y devuelve el foco al botón que abrió la ventana.
- Otras 19 pruebas de videos, historial personal y portada de perfil pasaron después de incorporar la rama principal.
- `npm test`: 270 pruebas pasaron y 16 fallaron en `dashboard-close.test.mjs` y `dashboard-guided-tour.test.mjs`. Los archivos del dashboard que consumen esas pruebas coinciden con `origin/master`; esta implementación no los modifica.

## Actualización de rama

Se actualizó `rama-piero` mediante fast-forward a `origin/master` (`f25877f`). El remoto usa `master`, no `main`. Los cambios locales previos se guardaron en un stash de respaldo antes de actualizar. Hubo conflictos al restaurar cursos.html, cursos-catalogo.js y cursos-area.css: se resolvieron combinando las tarjetas glass y la biblioteca con la expansión, descripciones, enfoques fotográficos y tiempos de transición de master. Los cambios de inicio y videos llegaron completos de esa rama. Los cambios locales de herramientas y los archivos no versionados se conservaron.

Los cambios de Cursos permanecen locales para iterar; no se publicaron ni se enviaron al remoto.
