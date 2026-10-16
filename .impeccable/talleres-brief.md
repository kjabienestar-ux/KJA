# Separación de Cursos y Talleres

Modo: Persuade. Petición del 14 de octubre de 2026: implementación local, sin publicar ni subir cambios.

## Direction contract

THESIS: dar a Talleres su propio espacio para descubrir grabaciones y recorrer la programación de octubre; Cursos conserva rutas, catálogo y sus detalles.

OWN-WORLD: extensión del lenguaje público de Cursos, Poppins, azul #004fb0, fucsia #ca0062, lavanda y fondos claros. Conservar cabecera, biblioteca, modal fotográfico y franja fucsia de WhatsApp. El sistema del portal interno permanece fuera de alcance.

STORY: conocer la propuesta virtual, explorar talleres grabados a su ritmo y consultar un tema de octubre. Los tres videos siguen siendo ejemplos sin reproducción disponible; las fechas de los 23 talleres siguen pendientes de confirmar.

FIRST VIEWPORT: corrección del usuario del 14 de octubre: escena de videollamada integrada en el fondo completo, reemplazando la clase presencial. Sustituir al psicólogo por la mujer de la referencia, conservando sus rasgos, gafas y cabello; familia a la derecha, sin tarjeta flotante. Mantener libros, lavanda y ondas del fondo. Texto y acciones a la izquierda en escritorio; texto arriba y escena debajo en móvil. La línea de tiempo aprobada se conserva y despliega foto temática al hover/foco, con detalle fotográfico al tocar en celular.

FORM: extensión directa en código solicitada por el usuario, sin cambiar la identidad ni pedir otra elección de composición. Interacción principal: filtrar la agenda y abrir el detalle fotográfico con consulta contextual.

Corrección vigente: las dos columnas de la agenda son listas independientes. Tarjetas glass uniformes de 180 px; cada tarjeta desplegada mide 540 px (tres tarjetas cerradas), sin desplazar la columna vecina. Al desplegar se muestra una descripción temática de máximo dos oraciones y una fotografía generada específicamente para ese taller; la descripción también figura en el detalle móvil. Las descripciones son textos orientativos basados en los títulos, no temarios oficiales. En móvil se conserva el orden de los 23 temas en una lista única. Hero con blur muy sutil de .65 px y máscara con desvanecimiento superior e inferior en responsive para eliminar el corte con la siguiente sección. Texto y controles nítidos; fechas pendientes y CTA conservados.

FINISH: revisión independiente con capturas de escritorio y móvil, pruebas de navegación, biblioteca y filtros; documentación de recursos y límites. Sin commit, push ni despliegue.

## Ajuste vigente del 16 de octubre de 2026

La última petición sustituye las alturas fijas de 180/540 px: las tarjetas se ajustan al contenido, muestran su descripción desde el inicio y agrupan título, explicación y enlace con separación breve. Se mantienen las dos columnas independientes y la fotografía al hover/foco. El único efecto nuevo es una transición suave rosa/lila, elegida por el usuario, que avanza con el desplazamiento mediante CSS scroll timelines; sin soporte o con movimiento reducido queda un tinte estático. No se añaden fechas ni datos comerciales.

Los detalles de talleres y cursos muestran la fotografía completa centrada en una zona propia, separada del texto, con altura limitada a la pantalla. Los modales bloquean el desplazamiento del documento y conservan el scroll interno necesario para leer el contenido. La regla se comparte con la biblioteca y los paneles públicos de asistencia y accesibilidad; el portal interno queda fuera de alcance.

Corrección posterior del usuario: la fotografía debe cubrir el ancho de su zona sin franjas laterales; se prioriza `object-fit: cover` centrado sobre conservar la imagen entera. La distribución compacta de tarjetas queda aprobada. El efecto bicolor queda pendiente de sustituir: se preparan tres propuestas monocromáticas en imágenes y una demostración aparte con desplazamiento real, sin aplicar una opción a la página principal hasta que el usuario elija.

## Ola aprobada e implementada

El usuario autorizó pasar a código la ola lateral difuminada. Se sustituye el efecto bicolor por una única tonalidad lila, algo más visible que la última propuesta: opacidad .4 y desenfoque de 7 px. La curva mantiene una fase compartida por columna, pero cada tarjeta recorta su tramo; los espacios entre tarjetas permanecen limpios. Se conservan altura automática, descripciones visibles, columnas independientes y fotografía al hover/foco.

El desplazamiento se actualiza como máximo una vez por frame, sin medir posiciones en cada scroll. ResizeObserver vuelve a medir al expandir tarjetas o variar sus alturas; los filtros, cambios de columnas y fuentes recalculan los tramos. Fuera de la sección se omiten las actualizaciones por scroll. La preferencia de movimiento reducido conserva la onda estática y la de transparencia reducida conserva una tarjeta opaca.
