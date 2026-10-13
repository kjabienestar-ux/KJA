# Formación pública de KJA

La página pública de cursos presenta cuatro áreas informativas, un catálogo de siete cursos y la agenda de 23 talleres de octubre. La biblioteca gratuita, navegación y pie de página se conservan. El bloque anterior de nueve áreas dejó de mostrarse en esta página; las URL existentes con `?area=…` siguen abriendo sus programas.

## Experiencia

Las cuatro tarjetas de área usan fotografía, título destacado, gradiente y un icono SVG distinto. Hover o foco muestran la descripción; en móvil las tarjetas forman una fila con desplazamiento horizontal y el gradiente permite reconocer la fotografía. Títulos, descripciones e iconos se ven blancos en móvil para mantener contraste.

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
