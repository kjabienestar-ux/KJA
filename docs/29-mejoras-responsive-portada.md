# Mejoras responsive de la portada

## Alcance

Esta actualización corrige problemas visuales de `index.html` en teléfonos sin modificar la lógica funcional ni la presentación de escritorio. Las reglas se concentran en `assets/css/paginas/index-mobile-polish.css` y se activan hasta los 768 px de ancho.

## Cambios realizados

### 1. Banner principal

- Se muestra nuevamente el CTA principal en móvil con un área táctil mínima de 44 px.
- Se ocultan las flechas del carrusel porque la navegación móvil se realiza mediante deslizamiento.
- La tarjeta de confianza se centra debajo del CTA para evitar superposiciones.
- El título utiliza un tamaño fluido entre 30 y 36 px, mejor reparto de líneas y mayor contraste.
- El encabezado utiliza un fondo blanco al 88 %, desenfoque y sombra suave para impedir que el contenido del hero interfiera con el logotipo.

### 2. Franja de convenios

- El título utiliza 12 px, espaciado de `0.14em` y una distribución equilibrada en dos líneas.
- Los logotipos conservan el tratamiento monocromático con `grayscale(100%) contrast(1.15)` y opacidad de `0.8`.
- Se reducen los degradados laterales para mejorar la visibilidad de las instituciones.

### 3. Carrusel de servicios

- Se añaden 16 px de margen interior y cada tarjeta ocupa el 86 % del ancho para dejar visible el inicio de la siguiente.
- Se mantiene `scroll-snap` para estabilizar el desplazamiento táctil.
- El degradado inferior es más alto y oscuro para mejorar el contraste del contenido blanco.
- Las descripciones admiten hasta cuatro líneas.
- La indicación de deslizamiento se presenta como una etiqueta rosada con movimiento sutil.
- El botón de cada servicio ocupa todo el ancho útil de la tarjeta y mantiene 44 px de altura mínima.

### 4. Indicadores y botón secundario

- Cada indicador dispone de un área táctil invisible de 44 × 44 px.
- El indicador activo se muestra alargado a 26 px.
- El botón «Ver todas las terapias» usa ancho automático, permanece en una línea y se centra.

### 5. Encabezado de Áreas de atención

- El título utiliza `clamp(30px, 9vw, 38px)`, interlineado compacto y reparto equilibrado de líneas.
- Se ajusta el espaciado vertical de la sección en móvil.

### 6. Mosaico de Áreas de atención

- Todas las áreas forman una rejilla uniforme de dos columnas.
- Los iconos aparecen encima del nombre.
- Todas las tarjetas tienen un alto mínimo de 104 px y el mismo ancho.
- Los nombres pueden ocupar varias líneas sin recortarse.
- Las áreas finales se integran en la misma rejilla y dejan de tener anchos diferentes.

### 7. Tarjeta de contacto

- La columna se define con `minmax(0, 1fr)` y se adapta al ancho disponible.
- El correo y los demás valores largos pueden dividirse sin producir desbordamiento horizontal.
- El CTA de WhatsApp ocupa todo el ancho, mantiene su texto completo y usa 15 px.

### 8. Mapa

- El bloque comparte los márgenes laterales de 16 px de la tarjeta superior.
- Se aplican esquinas inferiores redondeadas de 20 px y una altura móvil estable de 280 px.

### 9. Footer y controles flotantes

- El footer reserva 96 px adicionales más el área segura del dispositivo para evitar que los botones oculten el copyright.
- El botón de accesibilidad se reduce a 44 px y recibe una sombra más contenida.
- Los controles flotantes respetan el área segura inferior.

## Archivos

- `index.html`: carga versionada de la hoja de mejoras móviles.
- `assets/css/paginas/index-mobile-polish.css`: reglas visuales responsive.

## Verificación

- Sintaxis válida en los ocho scripts inline de la portada.
- Los 34 recursos locales referenciados existen.
- La hoja CSS tiene llaves equilibradas y `git diff --check` no reporta errores.
- `index.html` y la hoja CSS responden con estado HTTP 200 mediante el servidor local.
- 23 pruebas dirigidas aprobadas.
- Revisión visual de la portada en viewport móvil mediante navegador Chromium.

La suite general mantiene seis fallos previos en pruebas del dashboard que no corresponden a los archivos modificados en esta actualización.
