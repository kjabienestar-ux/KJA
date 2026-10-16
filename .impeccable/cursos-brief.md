# Cursos públicos de KJA

Modo: Persuade. Extensión de la página existente, con composición fijada por el usuario. Estado vigente: **2026-10-13, v3 local**. Revisión independiente v3: **SHIP**, limitada a los cuatro puntos solicitados. La sección de corrección v3 define el contrato actual; v2 es histórica.

## Direction contract

THESIS: presentar cuatro áreas informativas, descubrir tres cursos al azar con filtros por área y consultar talleres con foto y modal. El bloque público de nueve áreas fue retirado por decisión expresa del usuario; las URLs anteriores siguen funcionando.

OWN-WORLD: lenguaje público de Cursos con Poppins, azul KJA, fucsia, lavanda y cian; fotografías del repositorio, superficies claras y esquinas suaves. Conservar hero, biblioteca, navegación y footer. `PRODUCT.md`, `DESIGN.md` y `.impeccable/design.json` corresponden al portal interno y se preservan.

STORY: descubrir contenido gratuito, elegir un interés, comparar cursos y consultar por WhatsApp. Siete cursos y 23 talleres de la lista aportada por KJA; programación pendiente de confirmar.

FIRST VIEWPORT: hero fotográfico y biblioteca conservados. Después, pregunta y cuatro áreas informativas; catálogo con tres cursos aleatorios y acceso a los siete, junto a talleres con desplazamiento acotado en escritorio. Hasta 1000 px, catálogo y talleres se apilan y la lista de talleres desplaza horizontalmente. CTA fucsia de cierre conservado.

FORM: extensión semántica de la composición aprobada con recursos existentes. Seed histórico: user-pinned-kja-cursos-final-20261012. Las correcciones del 13 de octubre prevalecen sobre el mockup inicial.

FINISH: cerrar con evidencia, revisión independiente y veredicto registrado; documentar esta superficie y la procedencia de fotografías. El sistema global incumbente se conserva.

## Contrato histórico aplicado en v2 — sustituido por v3

- Cuatro áreas sin logos, números ni botones: foto y título grande en reposo; velo completo y descripción breve en hover/foco. En la rama CSS sin hover, descripción permanente.
- Filtros en catálogo para las cuatro áreas y todos. Selección inicial aleatoria de tres entre siete, sin duplicados; acceso a los siete. Llama SVG en los tres cursos marcados `featured`, sin depender del sorteo.
- Los 23 talleres están en la lista desde el inicio, sin columna OCT ni día vacío. Título “Talleres próximamente”, fotografías definidas por `workshop.image` y lista vertical de máximo 500 px en escritorio, horizontal hasta 1000 px.
- “Ver todos los talleres (23)” enfoca y avanza la lista; no expande contenido. Controles de avance/retroceso, teclado, rueda/deslizamiento y respeto de movimiento reducido.
- Taller en diálogo con foto y desvanecido de la referencia aportada por el usuario, estado “Próximamente” y consulta de fechas/disponibilidad. WhatsApp discreto con contexto del título. Escape y restitución de foco; diálogo de cursos conservado.
- Fechas, horarios, duración, modalidad y precios sin inventar; las dos denominaciones ambiguas mantienen aclaraciones. Los IDs `oct-*` reflejan la lista de origen, no programación confirmada.

El recorte de títulos observado a 1040 px se corrigió: introducción encima de las áreas hasta 1180 px, título fluido y corte de palabras; una columna de áreas hasta 550 px.

## Evidencia y límites históricos de v2

Pruebas comunicadas por implementación: `npm run test:cursos` **18/18**. Navegador: filtro de tres a siete, Escape con retorno de foco, lista de escritorio de 500 px y avance/retroceso móvil. Viewports de 390, 1040 y 1440 px sin desborde horizontal del documento ni errores de consola.

Capturas actuales: `.impeccable/review/desktop-v2.jpg`, `mobile-v2.jpg`, `user-default-v2.jpg`, `area-focus-v2.jpg`, `modal-v2.jpg` y `mobile-modal-v2.jpg`. `touch-state-v2.jpg` muestra cuatro descripciones legibles con opacidad 1 mediante **simulación CSS**: `touch-preview.html` usa una copia de los estilos que cambia solo la consulta `hover: none` por `all`. No acredita una prueba en dispositivo táctil real. Fixtures y capturas son QA y no se incorporan al producto.

Detector ejecutado una vez en `detector-v2.json`; la animación de `max-height`/margen se corrigió con filas de grid. Diferencias entre CSS público y DESIGN.md interno, y estilos globales anteriores, se interpretaron por alcance. El revisor independiente cerró **SHIP** tras confirmar la corrección de títulos en cinco recapturas y conservar fotografía, desvanecido, título completo y consulta discreta en modales. El `ship` de `review/verdict.md` corresponde a la entrega anterior; el cierre histórico de v2 es `review/verdict-v2.md`.

No se generaron rasters. Fotos de `images/cursos/photos/` y hero `images/cursos/fondo-cursos.webp`, preexistentes; asignaciones, fuentes y mantenimiento en `docs/cursos-formacion-publica.md`. Entrega local en `rama-piero`, sin push. Graphify query/update bloqueados por Windows Application Control; actualización pendiente, sin eludir la restricción.

## Referencias históricas

El mockup inicial `C:/Users/piero/Documents/Codex/2026-10-12/referenced-chatgpt-conversation-this-is-an/outputs/kja-cursos-mockup-final.png` guio la primera composición. La entrega del 12 de octubre tuvo diez talleres iniciales, expansión a 23, 15 pruebas y revisión `ship`; esos comportamientos y su veredicto fueron sustituidos por v2 y no describen el estado actual.

La nueva referencia del modal es `C:/Users/piero/AppData/Local/Temp/codex-clipboard-54cd7e13-107d-490e-a2b7-ac6bf32f5984.png`. Su imagen guía la presentación; los datos confirmados prevalecen sobre cualquier fecha de ejemplo.

## Corrección del usuario — v3 (2026-10-13)

Autoridad actual: las tres capturas anotadas del usuario y sus cuatro puntos prevalecen sobre v2. La agenda de octubre vuelve a títulos de texto y línea/puntos; las fotos solo aparecen al abrir el modal. Sin OCT ni días ficticios; conservar Próximamente, 23 talleres y scroll acotado/horizontal móvil sin expansión. Quitar Ver todos los cursos y toda la barra duplicada de filtro: quedan únicamente cinco filtros y un conteo. Las cuatro áreas incorporan un icono SVG grande distinto SOLO al hover/foco (o en la rama sin hover junto a la descripción). Los cursos muestran foto, título, indicador de demanda cuando corresponde y Ver curso; los tres temas solo aparecen en el modal existente, cuyo aspecto se conserva.

Implementación actual v3 validada **18/18**; navegador comprobó filtros 7/4/6/3/3, agenda sin imágenes, cero temarios en tarjetas, cuatro iconos de área, apertura de taller desde título y temas completos en detalle de curso. Solo cinco filtros y un conteo; selección inicial de tres cursos al azar conservada. Cabecera “Talleres de octubre” y estado “Próximamente”; las 23 entradas permanecen acotadas a 500 px en escritorio y desplazan horizontalmente hasta 1000 px.

Capturas `.impeccable/review/*-v3.jpg` a 1440/390/788 px, área en foco y ambos modales. Detector único de esta corrección guardado en `detector-v3.json`; sin hallazgos mecánicos nuevos en CSS de formación fuera de las diferencias con DESIGN.md del portal interno. Sin errores de consola comunicados. Revisión independiente v3: **SHIP** sobre las cuatro correcciones, seis capturas, tres referencias del usuario, código y criterios mínimos de acabado. Sin incumplimientos materiales; no requirió cambios ni nuevas capturas.

Datos, fotografías preexistentes y compatibilidad por área conservados; fotos de talleres solo en modal. `PRODUCT.md`, `DESIGN.md` y `.impeccable/design.json` permanecen como sistema del portal interno. Entrega local sin push. Graphify query/update siguen bloqueados por Windows Application Control, sin eludir la restricción. Mantenimiento y procedencia en `docs/cursos-formacion-publica.md`.


## Ajuste de color de destacados — 2026-10-13

Petición del usuario: todos los cursos destacados con un mismo fucsia luminoso y glassmorphism. Aplicado únicamente a `.formation-course-featured`: gradiente translúcido fucsia, blur14px, borde/reflejo suave y texto/acción oscuros. Las áreas conservan sus propios tonos. Verificado mismo estilo en los tres destacados y adaptación móvil; transparencia reducida con fondo sólido. Refinamiento de color sobre el mundo existente, sin nuevo sistema visual. Evidencia: `featured-glass-desktop.jpg` y `featured-glass-mobile.jpg`.

## Elección aprobada — rosa tenue y estrella

Prevalece la petición final del usuario y su imagen: composición Perla, color Rosa tenue, sombra rosada y distintivo de estrella que despliega Curso destacado. Implementado con fotografía al borde superior, fondo #fcf4f8 y sombra rosada. Ya no usa llama ni el fondo fucsia intenso. El catálogo abre con seis cursos y pagina el séptimo, completando cada página o filtro con “Más cursos próximamente” hasta llegar a seis tarjetas. Los destacados se distribuyen al renderizar las tarjetas visibles. La agenda se estira a la altura del catálogo, sin modificar su lista de 23 títulos. 19/19 pruebas; el refinamiento mantiene hero, áreas y modales.

## Separación pública vigente — 2026-10-14

La composición vigente separa `cursos.html` y `talleres.html`: Cursos conserva hero, áreas, catálogo y detalles; Talleres reúne hero virtual, biblioteca de grabaciones y agenda de 23 temas de octubre. La agenda ocupa su propia sección a ancho completo, con búsqueda y una columna en móvil. Las descripciones anteriores de agenda junto al catálogo y scroll acotado corresponden al historial previo. Dirección y estado actual en `.impeccable/talleres-brief.md`; recursos, verificación y límites en `docs/talleres-publicos.md`. Extensión local de la estética pública, sin commit, push ni despliegue.
