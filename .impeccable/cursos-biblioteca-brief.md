# Cursos y biblioteca gratuita

Modo: persuade. Implementación incremental de la propuesta UI 1 aprobada por el usuario el 9 de octubre de 2026.

## Direction contract

THESIS: descubrir cursos gratuitos antes del catálogo de nueve áreas, con imágenes continuas y texto integrado lateralmente.

OWN-WORLD: Poppins, azul #004fb0, rosa KJA, superficies lavanda claras, velos laterales esmerilados y acciones circulares con reflejo; heredar navegación, hero y footer públicos, no el sistema del dashboard interno.

STORY: explorar la biblioteca o elegir un área y consultar sus programas. Preservar rutas y programas reales; no presentar títulos ilustrativos como cursos disponibles.

FIRST VIEWPORT: navegación y hero fotográfico existentes; debajo un panel con introducción a la izquierda y tres videos a la derecha. Después nueve áreas en cuadrícula 3×3, contacto rosa y footer azul. En móvil, bloques apilados.

FORM: composición y tratamiento fijados directamente por la imagen adjunta codex-clipboard-348775f1-264d-4c38-937e-0641d8bd8e3b.png; no se requiere selección de concepto ni más mockups.

FINISH: comprobar escritorio y móvil, navegación a áreas, biblioteca, estados previos a publicación y reproducción Drive configurada. Mantener las decisiones globales de DESIGN.md. Fotografías reutilizadas del repositorio.

## Interacciones acordadas

Las nueve áreas mantienen velos laterales y sombras alternadas rosa/azul. En escritorio, hover o foco de teclado ensancha la tarjeta y revela la descripción de cursos-data.js, siguiendo la expansión incorporada desde master. Sus compañeras se contraen con títulos verticales. En tablet y móvil se muestran únicamente el título y la fotografía, en formato 16:9 con velo inferior suave; la tarjeta completa mantiene el enlace al área. Las sombras desaparecen en la tarjeta activa.

Las descripciones de catálogo usan catalogSummary: 23–25 palabras basadas en los programas reales. La descripción completa de cada área se conserva. La fuente de las descripciones es .85rem en escritorio; en tablet y móvil las descripciones se ocultan. La tarjeta expandida se divide en 60% texto y 40% fotografía: el velo queda exclusivamente detrás del texto y la foto ocupa su propio espacio sin desenfoque. El texto se centra verticalmente con la acción próxima, en una fila de 285 px; la tarjeta activa lleva borde rosa.

Los cursos grabados siguen la referencia codex-clipboard-489d287b-f137-4694-bf24-4a7a15998fae.png: foto inmersiva, overlay oscuro inferior, título blanco integrado, badges glass y reproducción azul lavanda con halo. Acentos amarillos trazados alrededor del botón y junto a la foto. El metadato A tu ritmo sustituye duración y nivel, que todavía no se conocen. Se conservan Gratis y Próximamente en la vista previa.

Al pasar el cursor o recibir foco de teclado, una superficie azul translúcida con desenfoque y reflejos muestra el título grande y la acción centrada. La transición dura 600–650 ms. La acción dice Ver vista previa mientras la biblioteca sea ilustrativa e Ir al curso cuando haya un video publicado.

## Contenido y conexión

El usuario aún no tiene acceso al Drive. FREE_COURSE_LIBRARY.preview permanece true. Los ejemplos muestran Próximamente y un aviso visible. Publicación futura: cambiar preview a false y completar títulos reales y driveUrl en assets/js/cursos-gratuitos-data.js. La fuente permite enlaces públicos de archivo de Drive y abre su preview únicamente al solicitar reproducción; no hay sincronización automática de carpetas ni credenciales.

La cuadrícula oficial conserva el título real Adultos Mayores y Psicooncología que existe en cursos-data.js, aunque el mockup generado decía Psicogerontología.
