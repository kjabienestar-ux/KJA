# Formación pública de KJA

La página pública de cursos presenta una biblioteca de cursos grabados gratuitos y el catálogo completo de siete cursos. La agenda de 23 talleres permanece en `talleres.html`. Se conservan navegación y pie de página. El bloque anterior de nueve áreas dejó de mostrarse en esta página; las URL existentes con `?area=…` siguen abriendo sus programas.

## Experiencia

El recorrido vigente es **hero → cursos grabados → catálogo de cursos → CTA → footer**, por corrección explícita del usuario. Se retiró el bloque de cuatro cursos seleccionados. Las cuatro áreas permanecen como filtros del catálogo, que conserva sus siete cursos y detalles.

«Cursos grabados» utiliza una composición propia y comparte la biblioteca/reproductor con Talleres. El hero conserva Solicitar información y Ver cursos; el enlace adicional a grabados se retiró por petición del usuario. `data-library-kind` adapta textos y enlaces al curso o taller. Ambos apartados reutilizan por ahora los tres ejemplos de `FREE_COURSE_LIBRARY`, con `preview: true`: no hay grabaciones reales publicadas. Las URLs históricas `?area=…` ocultan catálogo y biblioteca.

El catálogo incluye cinco filtros: “Todas las áreas” y cuatro áreas de formación. Al entrar muestra todos los cursos disponibles en páginas de seis tarjetas en escritorio y cuatro en móvil. Si una página de un filtro no tiene suficientes cursos, las posiciones restantes muestran “Más cursos próximamente”; esas tarjetas no representan cursos reales. Los filtros actualizan la URL y conservan el historial de navegación. Tres cursos tienen el distintivo rosa tenue con estrella de destellos; el distintivo revela “Curso destacado” al hover o foco y se puede pulsar en táctil.

Cada tarjeta real presenta fotografía, título y “Ver curso”. El modal de curso conserva nombre completo, fotografía, tres temas y consulta contextual por WhatsApp. Los temas no se duplican dentro de la tarjeta.

“Talleres de octubre” mantiene una línea de tiempo y los 23 títulos. En escritorio la lista tiene desplazamiento vertical; en anchos menores se recorre horizontalmente con controles previos y siguientes. “Ver todos los talleres” avanza el scroll sin expandir el bloque. Al pulsar el título de un taller se abre el modal con fotografía temática, estado “Próximamente” y consulta discreta por WhatsApp. Los modales quedan centrados y solo se cierran con la X: ni Escape ni un clic fuera los cierran. El foco vuelve al control que abrió el modal.

## Datos y fechas

Los siete cursos proceden de `KJA_FORMATION.courses`; cada entrada define áreas asociadas, tres temas y una fotografía existente. Los destacados se identifican con `featured`. `KJA_FORMATION.routes` define las cuatro áreas y `KJA_FORMATION.workshops` conserva los 23 títulos recibidos, incluidas repeticiones y nombres pendientes de confirmación.

Los identificadores `oct-01` a `oct-23` son claves internas, no días del mes. Fechas, horarios, duración, modalidad y precio permanecen sin confirmar (`null`) y no deben inferirse ni mostrarse como datos confirmados. La interfaz muestra “Próximamente · fechas por confirmar”. “Eest de MACI” y “Cómo elaborar sesiones de terapia de lenguaje en niños con la r” conservan la nota de confirmación en los datos; verificar la denominación con KJA antes de cambiarlos.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `cursos.html` | Estructura, tarjetas, agenda, filtros y diálogos. |
| `assets/js/cursos-formacion-data.js` | Las cuatro áreas, siete cursos y 23 talleres. |
| `assets/js/cursos-formacion.js` | Renderizado, filtros, paginación, historial, desplazamiento y modales. |
| `assets/css/paginas/cursos-formacion.css` | Estilos, estados, diálogos y comportamiento adaptable. |
| `assets/js/cursos-catalogo.js` y `assets/js/cursos-data.js` | Compatibilidad de las URL antiguas `?area=…`. |
| `assets/js/cursos-gratuitos-data.js` y `assets/js/cursos-gratuitos.js` | Biblioteca de cursos grabados gratuitos. |
| `tests/cursos-formacion.test.mjs` | Catálogo, filtros, paginación, modales, agenda y comportamiento móvil. |
| `tests/cursos-biblioteca.test.mjs` | Biblioteca gratuita y coexistencia con el catálogo. |

Las rutas de imagen reutilizan archivos existentes en `images/cursos/photos/`; las asignaciones están en los datos. No se generaron imágenes nuevas. Ejecutar `npm run test:cursos` para validar la biblioteca y la sección pública.

## Diseño de grabados (2026-10-19)

Better UI aplicado a la biblioteca de Cursos: encabezado editorial con Poppins y Fraunces en cursiva, botón fucsia con flecha circular, fondo lavanda y superficies claras. Referencias locales: acentos editoriales de Terapia y superficies suaves de Talleres. La revisión solicitada por el usuario sustituye la composición asimétrica por **tres tarjetas equivalentes**, con fotografía 16:9 arriba y texto debajo, sin superponer la leyenda sobre la escena. Todas muestran título, descripción breve, disponibilidad y reproducción. La fotografía usa encuadre al 70 % horizontal para conservar las personas. Entre 601 y 850 px se apilan tarjetas horizontales; en móvil vuelven a fotografía arriba/texto debajo, con altura natural. No se fijan alturas de texto. La cabecera se compactó a una columna flexible de título/descripción y un botón a la derecha: se eliminó el salto forzado del título, se acortó el texto de apoyo y se redujeron separaciones. En móvil se apila. El orden de la página se conserva.

`assets/css/paginas/cursos-grabados.css` acota los estilos a Cursos. `renderRecordedCard` comparte los datos, validación de URLs, eventos y modal existentes; Talleres mantiene su presentación. Las fotos se reutilizan. Sin grabaciones nuevas: tres ejemplos con estado «Próximamente» y aclaración de vista previa en el modal. El aviso inferior y su divisor se retiraron de Cursos por petición del usuario; Talleres lo conserva.

Hover limitado a punteros compatibles; zoom/elevación solo sin preferencia de movimiento reducido, presión a .96 durante 150 ms, foco visible y regreso al control original. Las tarjetas tienen fondo blanco sólido. Las imágenes tienen contorno negro de .1 y los controles usan SVG con `currentColor`.

## Verificación vigente (2026-10-19)

`npm run test:cursos`: 20/20 correctas. Edge a 1440, 1051, 820, 600, 390 y 360 px: sin errores JavaScript, imágenes rotas, texto recortado o desborde horizontal; las tres tarjetas abren la vista previa sin iframe y restauran foco al cerrar. Biblioteca con tres entradas comprobada. Capturas `.impeccable/review/recorded-redesign-{ancho}.png`, hover normal en `recorded-redesign-hover.png`; resultados en `recorded-redesign-qa.json`, script `.impeccable/qa-recorded-redesign.cjs`. Revisión visual de escritorio, ancho intermedio y móvil. La comprobación anterior del orden se conserva en `cursos-order-{ancho}.png`.

Better UI: sin hallazgos accionables en los estados revisados; aprobado para entrega local. La animación al 10 % en el panel Animations, otros navegadores y contraste instrumentado no se verificaron. Sin commit ni despliegue.

Pulido de color: halo radial suave en el fondo del texto, alternando rosa, azul y lavanda; aumenta con hover y foco junto con la sombra del mismo tono. La fotografía y el texto permanecen nítidos. Fundido de opacidad de 150 ms; hover solo en punteros compatibles.
