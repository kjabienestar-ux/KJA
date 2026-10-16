# Cursos y Talleres: separación de la web pública

Actualización del 16 de octubre de 2026: miniaturas de la biblioteca encuadradas sobre las personas (`object-position: 75% center`), con ancho estable en escritorio y móvil. Preparado para revisión mediante PR sobre la rama principal actualizada; no implica despliegue. Los manifiestos publicados omiten rutas absolutas de la computadora y conservan los prompts. Capturas y recursos históricos citados abajo son evidencia local de las iteraciones y no forman parte de los archivos de producción del PR.

Implementación local del 14 de octubre de 2026. Sin commit, push ni despliegue.

## Recorrido

`cursos.html` conserva hero, cuatro áreas, catálogo de siete cursos, filtros, paginación y detalle de cada curso. El catálogo ocupa todo el ancho disponible. Las URLs `cursos.html?area=...` conservan sus programas históricos.

`talleres.html` contiene hero para talleres virtuales con escena integrada en el fondo completo, biblioteca de grabaciones, agenda de octubre y franja fucsia con consulta por WhatsApp. El hero conserva libros, lavanda y ondas de la composición pública de Cursos: texto y acciones a la izquierda en escritorio, texto arriba y escena debajo en móvil. El enlace Talleres aparece junto a Cursos en los menús de las diez páginas públicas. La navegación móvil cubre hasta 968 px para evitar un tramo sin menú; la barra de escritorio se compacta entre 969 y 1180 px para acomodar los ocho enlaces.

La agenda muestra los 23 temas existentes: dos listas ordenadas independientes dentro de la línea de tiempo en escritorio, una lista única en móvil que conserva el orden 01–23. Las tarjetas miden 180 px en reposo. Cada tema despliega su descripción y foto al pasar el cursor o recibir foco de teclado y alcanza exactamente 540 px, tres veces la altura cerrada. La cabecera crece según el texto y la fotografía ocupa el espacio restante. Abrir una tarjeta desplaza solo su propia columna; no cambia la posición vertical de la tarjeta vecina en la otra columna.

La búsqueda admite palabras sin tildes y varios términos; el estado vacío permite restablecer la lista. Cada tema abre su detalle con la misma descripción, fotografía y consulta de WhatsApp; en móvil se accede tocando. Se mantiene la interacción aprobada del modal anterior: cerrar con la X o haciendo clic fuera. Se respeta la preferencia de movimiento reducido.

## Datos y disponibilidad

- Agenda: `assets/js/cursos-formacion-data.js`, misma fuente que el catálogo de Cursos. No se alteraron los títulos ni las aclaraciones pendientes.
- Descripciones: 23 textos de una o dos oraciones basados en los títulos, definidos en `KJA_WORKSHOP_DETAILS` y asignados a cada taller mediante `description`; orientan sobre el tema y no constituyen temarios oficiales. Se muestran entre título y acción al desplegar la tarjeta y también en el modal.
- Fechas: **por confirmar**. Octubre identifica la lista original; no se han creado días, horarios ni precios.
- Grabaciones: `assets/js/cursos-gratuitos-data.js`. Las tres entradas existentes siguen siendo ejemplos, con `preview: true` y aviso visible. No hay videos reales añadidos ni disponibles aún. El reproductor conserva validación de URLs de Google Drive y descarga el iframe al cerrar.
- Presentación de grabaciones: `assets/js/cursos-gratuitos.js`, ahora con textos de Talleres; nombres internos conservados para compatibilidad.

## Identidad y recursos

Se conserva el lenguaje público de Cursos: Poppins, azul #004fb0, fucsia #ca0062, lavanda, fotografías y esquinas suaves. `PRODUCT.md`, `DESIGN.md` y `.impeccable/design.json` documentan el portal interno y no se modifican por esta extensión pública.

Las tarjetas de la agenda usan un gradiente translúcido, reflejos interiores y desenfoque de fondo de 14 px. La preferencia de transparencia reducida sustituye ese tratamiento por fondos sólidos. El fondo del hero tiene un desenfoque suave de 0,65 px aplicado mediante CSS; texto y controles permanecen nítidos y el archivo de imagen no cambia. Hasta 850 px, la máscara desvanece la imagen entre el 78 % y el 100 % de su altura. El fondo #f1f5fc coincide con la biblioteca para evitar un corte entre secciones.

Hero vigente: `images/talleres/fondo-talleres-virtuales.webp`, 1774 × 887, 127944 bytes. Composición sintética editada con la herramienta integrada de imágenes a partir del fondo de Cursos, la videollamada anterior y el retrato autorizado aportado por el usuario. La mujer sustituye al hombre de la primera versión y conserva la identidad facial, gafas y cabello de la referencia real; la familia es ficticia. La imagen ilustra el servicio y no acredita una sesión real. Prompt exacto en `.impeccable/talleres-hero-v2-prompt.txt` y metadatos de procedencia en `images/talleres/fondo-talleres-virtuales.webp.json`.

La primera versión, `images/talleres/talleres-virtuales.webp` (1536 × 1024, aproximadamente 128 KB), se conserva como recurso histórico y ya no se consume en el hero. Su prompt y sidecar originales permanecen junto a los recursos de esa versión.

Fotos vigentes de talleres: 23 imágenes distintas de 1200 × 800 en `images/talleres/photos/oct-01.webp` a `oct-23.webp`, 2003722 bytes en total (aproximadamente 2 MB). Generadas con la herramienta integrada de imágenes para ilustrar cada tema con personajes ficticios; no representan personal, pacientes ni una aplicación real de pruebas psicológicas. Cada archivo tiene un sidecar `.webp.json` con el prompt exacto y la ruta de su fuente original conservada en el directorio de imágenes generadas de Codex. Manifiesto completo en `.impeccable/workshop-photo-prompts.json`.

La fuente de datos asigna `photo` y `description` a cada taller; tarjeta desplegada y modal consumen los mismos recursos. Las portadas de la biblioteca y las fotos históricas de Cursos permanecen en `images/cursos/photos/`, sin sobrescribirlas. Marca, navegación y footer heredados de Cursos. No hay dependencias nuevas de ejecución ni cambios de servidor.

## Verificación

`npm run test:cursos`: 18 pruebas correctas sobre la separación, catálogo, compatibilidad de áreas, biblioteca, reproducción controlada, búsqueda y consulta de los 23 talleres. Revisión de navegador a 1440, 820 y 390 px: sin errores de JavaScript ni desplazamiento horizontal del documento. Biblioteca, estados vacío/restablecido, detalles y menú móvil comprobados.

Verificación adicional de navegación: menú móvil a 360, 820 y 968 px; barra de escritorio a 969, 1024, 1180, 1181 y 1280 px. Sin desplazamiento horizontal en esos anchos.

Capturas vigentes en `.impeccable/review/talleres-photos-{hero,fade}-{desktop,tablet,mobile}.png`, `talleres-photos-oct-{01,08,09,23}-{desktop,tablet}.png`, `talleres-photos-detail-mobile.png` y la hoja de contacto. QA de navegador a 1440, 820 y 390 px: las 23 fotos cargan, títulos y descripciones no se recortan y se conservan las alturas de 180/540 px. Las cabeceras desplegadas midieron de 180 a 206,94 px en escritorio y de 181,65 a 253,22 px en tablet, acomodando el texto dentro del total de 540 px. En móvil, el modal muestra descripción y fotografía. Sin errores de JavaScript ni desplazamiento horizontal comunicados. Las 18 pruebas siguen correctas. El detector sobre CSS/JS, sin cargar el diseño global del portal interno ni avisos orientativos, devolvió avisos vacíos. Los tamaños pequeños nuevos conservan un mínimo de 12 px.

La separación inicial obtuvo **ship para entrega local**, registrado en `.impeccable/review/verdict-talleres-split.md`; sus capturas históricas están en `.impeccable/review/{talleres,cursos}-{desktop,tablet,mobile}-split.png`. La corrección del hero integrado y del despliegue de fotos también obtuvo **ship**, registrado en `.impeccable/review/verdict-talleres-integrated.md`: revisión visual independiente de tres heroes y la foto desplegada en escritorio, contrastada con la referencia facial. El revisor recibió las pruebas funcionales del implementador y no las repitió. Las capturas usan movimiento reducido y fallback sin GSAP; no acreditan la animación normal ni otros navegadores.

Las capturas de esa corrección anterior se conservan en `.impeccable/review/talleres-integrated-{desktop,tablet,mobile}.png`, sus variantes `-full.png` y `talleres-photo-hover-{desktop,tablet}.png`. La corrección de tarjetas glass y columnas independientes obtuvo **ship**, registrado en `.impeccable/review/verdict-talleres-glass.md`: revisión independiente de la tarjeta abierta en escritorio, reposo móvil, hero de escritorio, CSS/JS y aserciones de navegador. El revisor no repitió la navegación ni instrumentó contraste. Sus capturas están en `talleres-glass-{hero,rest}-{desktop,tablet,mobile}.png` y `talleres-glass-expanded-{desktop,tablet}.png`; el navegador de esa revisión confirmó que desplegar la columna izquierda no cambia la posición vertical de la vecina derecha a 1440 y 820 px, y que búsqueda/restablecimiento recuperan los 23 temas.

La revisión independiente de las nuevas 23 fotos, descripciones y ajuste del hero obtuvo **ship**, registrado en `.impeccable/review/verdict-talleres-photos.md`. Revisó el hero de escritorio, los desvanecimientos móvil/tablet, oct-09 escritorio, oct-08 tablet, el detalle móvil y la hoja de contacto de 23 escenas. No repitió navegación ni pruebas. Observación menor no bloqueante: el recorte vertical heredado del modal móvil oct-09 deja algunos rostros a los extremos; texto y consulta permanecen completos. Los veredictos anteriores conservan su alcance histórico.

Graphify se ejecuta mediante `graphify-safe.cmd update .`: actualización AST local sin clave de IA. Avisó de dependencia SQL ausente para 155 archivos, sin relación con esta implementación de páginas estáticas.
