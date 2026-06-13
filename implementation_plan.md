# Rediseño de la Sección "Nuestros Servicios"

El usuario ha solicitado mejorar la sección "Nuestros Servicios" para que sea más llamativa, interactiva y orientada a la conversión (llamar la atención del usuario final para que decida contactar o saber más). El diseño actual de cuadrícula (grid) con tarjetas blancas es funcional pero puede sentirse estático y tradicional.

## Análisis UX/UI de la Petición
El objetivo es transformar la sección en una experiencia visual premium que fomente la interacción ("click" o "tap"). La propuesta del usuario de un "carrusel" nos indica que busca dinamismo y aprovechamiento del espacio. 

## Proposed Changes (Cambios Propuestos)

Para lograr un diseño "Front-end avanzado", propongo transformar las tarjetas actuales en **Tarjetas Interactivas de Revelación (Interactive Hover-Reveal Cards)** integradas en un diseño de **Carrusel Moderno**.

### 1. Estructura de "Premium Overlay Cards"
En lugar del diseño clásico (imagen arriba, texto abajo en fondo blanco), transformaremos las tarjetas:
- **Full-bleed Backgrounds:** La fotografía de cada servicio cubrirá el 100% de la tarjeta.
- **Glassmorphism & Gradient Overlay:** Un degradado oscuro en la parte inferior asegurará que el texto sea siempre legible.
- **Micro-interacciones (Hover Effects):** 
  - **Estado normal:** Solo se verá la imagen hermosa y el título del servicio (ej. "Terapia para Niños") en tipografía grande y elegante.
  - **Al hacer Hover (Desktop):** La imagen hace un suave zoom (`scale 1.1`), el degradado se oscurece, y la descripción detallada junto con un **botón prominente de "Agendar Cita"** se deslizan hacia arriba (Slide-up reveal).
- Esto reduce la carga cognitiva inicial (no hay un muro de texto) y premia la interacción del usuario.

### 2. Layout & Carrusel Dinámico
- **Desktop:** Usaremos un Grid asimétrico (Bento Grid) o un diseño de tarjetas expandibles (Horizontal Accordion) donde la tarjeta sobre la que pasas el mouse se expande ligeramente.
- **Mobile / Tablet:** Implementaremos el "Carrusel" que mencionaste usando **CSS Scroll Snap** ultra fluido. Las tarjetas ocuparán el 85% de la pantalla, permitiendo al usuario deslizar (swipe) horizontalmente, revelando siempre un "pedacito" de la siguiente tarjeta para invitar al deslizamiento continuo. Las descripciones y botones siempre serán visibles en móvil.

### 3. Archivos a Modificar
#### [MODIFY] index.html
- Reestructurar el HTML dentro de `.service-card` para soportar imágenes de fondo con `position: absolute` y overlays.
- Cambiar los enlaces de texto simples ("Ver más →") por botones tipo píldora llamativos (ej. `<button class="btn-primary">Agendar Cita</button>`).

#### [MODIFY] shared.css
- Escribir toda la lógica CSS para las animaciones avanzadas: `transform: translateY`, `opacity`, `transition: all 0.4s cubic-bezier(...)`.
- Mejorar el scroll horizontal en móviles (`scroll-snap-type: x mandatory`).

## Open Questions (Preguntas para el Usuario)

> [!IMPORTANT]
> **Decisión de Diseño UI:**
> Para las tarjetas en vista de computadora (Desktop), ¿qué prefieres?
> 1. **Grid Animado (Recomendado):** Una cuadrícula elegante de 3x2 donde las tarjetas revelan mágicamente su contenido al pasar el mouse por encima.
> 2. **Carrusel Horizontal (Tipo Netflix):** Una sola fila larga donde el usuario tiene que hacer clic en flechas (Izquierda / Derecha) para ver los demás servicios.
> 
> *Nota: En celulares (Mobile), SIEMPRE usaremos el formato de carrusel deslizable con el dedo porque es el estándar moderno de UX.*

## Verification Plan
1. **Estética Visual:** Verificar que los degradados sobre las imágenes permitan leer el texto perfectamente.
2. **Interacciones:** Asegurar que las animaciones de subida (slide-up) se sientan fluidas a 60fps usando `transform`.
3. **Responsividad:** Probar que en móvil el carrusel se pueda arrastrar con el dedo fluidamente y que no dependa del efecto "hover" (ya que en móvil no hay mouse).
