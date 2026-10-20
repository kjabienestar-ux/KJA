# Relevo KJA-006: integrar catálogo, animaciones y pack de cuatro cursos

## Prompt para el modelo del compañero

> Continúa KJA-006 sobre la rama `codex/oferta-cursos` o sobre una rama que ya contenga su PR. Lee este documento, `PRODUCT.md`, `docs/cursos-formacion-publica.md` y las instrucciones AGENTS aplicables. La pestaña y el panel de oferta ya están preparados. Tu trabajo es conectar la selección de «Explora nuestros cursos», implementar las animaciones de añadir cursos y completar el carrito y su salida a WhatsApp. Conserva el diseño y la API de la pestaña; no construyas otro panel ni otro estado paralelo dentro de ella. Implementa, verifica y entrega los cambios con evidencia.

## Acuerdo de producto y alcance de este PR

- Se eligen **cuatro cursos distintos** de `KJA_FORMATION.courses`: tres por **S/99 en total**, más uno gratis. Todos los cursos de ese catálogo participan. La biblioteca de grabados gratuitos y los talleres no forman parte del pack.
- Antes de tener cuatro cursos, el panel muestra «Elegir mis cursos» o «Seguir eligiendo». Esa acción cierra el panel y lleva al catálogo. Al tener exactamente cuatro, aparece «Continuar por WhatsApp». Volver a tres lo oculta.
- La pestaña es mayor en escritorio: 72×68 px cerrada, 184×68 px extendida. En móvil: 56×54 px cerrada. Conserva regalo → OFERTA → panel en dos tiempos al hover; en táctil abre con un toque.
- El panel muestra cuatro espacios, títulos/fotos del catálogo, progreso, beneficio del cuarto curso y total. En móvil usa `dialog` nativo, blur, fondo no interactivo y bloqueo de scroll. Al cerrar conserva la posición de lectura. Cabecera y acciones permanecen visibles; la lista tiene scroll interno cuando hace falta.
- Este PR entrega una **vista controlada**, no el carrito completo. No añade botones de selección al catálogo, animaciones de vuelo, persistencia ni navegación final a WhatsApp. Quitar y continuar emiten intenciones para que tu módulo las resuelva. No fusionar como flujo comercial terminado hasta conectar esas acciones.

## Archivos y fronteras para combinar trabajo

| Archivo | Responsabilidad |
| --- | --- |
| `cursos.html` | Montaje del panel y carga de CSS/JS. Mantener IDs, atributos `data-offer-*` y orden de scripts. |
| `assets/css/paginas/cursos-oferta.css` | Diseño adaptable, estados, dos tiempos y modalidad móvil. |
| `assets/js/cursos-oferta.js` | Renderizado del panel, validación de IDs recibidos, foco y apertura/cierre. |
| `assets/js/cursos-formacion-data.js` | Fuente única de cursos, IDs, títulos e imágenes. No duplicar esa lista. |
| `assets/js/cursos-formacion.js` | Catálogo, filtros, paginación y detalle existentes. Aquí puedes añadir controles de selección, conservando «Ver curso». |
| `tests/cursos-oferta.test.mjs` | Contrato público de la vista y condición de cuatro cursos. |

Crea tu controlador, por ejemplo `assets/js/cursos-pack-controller.js`, y sus estilos de selección en un archivo aparte. Cárgalo con `defer` **después** de `cursos-formacion.js` y `cursos-oferta.js`. No copies los mockups de `output/` a producción. No cambies Supabase ni otros módulos.

Para integrar ramas, incorpora primero `codex/oferta-cursos` a tu rama (merge o rebase según el acuerdo del equipo), resuelve solo las cargas/markup de `cursos.html` cuando corresponda y revisa que CSS/JS no queden cargados dos veces. Este PR parte de `origin/master` `03998e64926c4101b707f1626a0eee666be2d73e`. Un commit o PR no acredita despliegue.

## API pública, versión 1

Existe en las páginas normales de Cursos, después de ejecutar sus scripts. En `?area=…` y cuando falta el catálogo la oferta permanece oculta y la API no se crea. Comprueba su existencia.

```js
const view = window.KJA_COURSE_OFFER;
if (!view) return;

view.setSelection(['rrhh', 'wisc-v']); // Sincroniza una copia del estado del controlador.
view.getSelection();                 // Devuelve otra copia de los IDs renderizados.
view.getTarget();                    // Botón HTMLElement estable para el destino de la animación.
view.open();                         // Abre y enfoca; no lo invoques automáticamente en cada alta.
view.close();                        // Cierra, libera el fondo y restaura el foco.
```

`setSelection(courseIds)` exige un array de 0–4 IDs únicos existentes en `KJA_FORMATION.courses`. Lanza `TypeError` ante duplicados, IDs desconocidos o más de cuatro; la selección anterior no cambia. Valida en tu controlador antes de llamar para dar un mensaje útil al visitante. No uses títulos como identificador ni el orden aleatorio de tarjetas.

Retorna `{ courseIds, count, complete, total: 99, currency: 'PEN' }`. No modifica el array recibido ni comparte el array interno. Repetir exactamente la misma selección no emite una nueva notificación. El cuarto ID recibido ocupa el espacio marcado gratis: conserva el orden de selección al quitar y añadir.

### Eventos salientes en `document`

| Evento | `event.detail` | Qué debe hacer tu controlador |
| --- | --- | --- |
| `kja:offer:remove` | `{ courseId, courseIds, count, complete, total, currency }` | Quitar el ID del estado canónico, actualizar tarjetas y llamar `setSelection` con los restantes. La vista no elimina por su cuenta. |
| `kja:offer:checkout` | `{ courseIds, count, complete, total, currency }` | Revalidar cuatro cursos y abrir WhatsApp con sus nombres. La vista no navega. |
| `kja:offer:rendered` | `{ courseIds, count, complete, total, currency }` | Notificación después de una selección distinta. Evitar usarla para crear otro estado o un bucle de renders. |

Ejemplo del enlace entre módulos, sin imponer cómo implementas tu store:

```js
// cart es TU estado canónico. No debe depender de que el panel esté abierto.
function syncView() {
  window.KJA_COURSE_OFFER.setSelection(cart.courseIds);
  // Sincroniza aquí selección/aria-pressed/contadores de tus tarjetas.
}
document.addEventListener('kja:offer:remove', ({ detail }) => {
  cart.remove(detail.courseId);
  syncView();
});
document.addEventListener('kja:offer:checkout', ({ detail }) => {
  // Revalidar cart.courseIds y el catálogo; continuar solo si son cuatro distintos.
  // Construir y abrir el enlace dentro de este gesto del usuario, sin esperas asíncronas.
});
```

No hay método `add()` ni persistencia en la vista: son responsabilidad de tu controlador. Quitar un curso de un pack completo debe volver a mostrar el botón para seguir eligiendo, sin perder los otros tres. No habilites WhatsApp a partir de un contador visual o manipulando `hidden` directamente.

## Conectar las tarjetas y animarlas

El catálogo actual identifica tarjetas reales con `article[data-formation-course="ID"]` y su botón de detalle con `[data-formation-detail="ID"]`. Los filtros usan `[data-formation-route]`, la paginación `[data-formation-page]`; los placeholders llevan `.formation-course-soon` y no representan cursos. La sección se llama `#catalogo`; la biblioteca gratuita es otra sección.

1. Añade un botón de selección con atributo propio, por ejemplo `[data-offer-add="ID"]`, sin reemplazar «Ver curso» ni capturar clics de la estrella de destacado. Usa delegación en `#formation-courses-grid`: la paginación mueve tarjetas y también inserta placeholders.
2. Conserva una sola colección ordenada de IDs. Impide duplicados y un quinto curso, explica el límite y permite quitar/cambiar. Los filtros y la paginación no deben vaciar esa colección.
3. Sincroniza la vista y las tarjetas después de cada cambio. Mantén el foco en el control usado. Al agregar no abras automáticamente el modal móvil: el visitante necesita poder seguir eligiendo.
4. Para el vuelo, toma la foto de la tarjeta como origen y `view.getTarget().getBoundingClientRect()` como destino, ambos en coordenadas del viewport. No uses coordenadas fijas ni dependa del tamaño del panel abierto. El botón se conserva al renderizar; las filas del panel se reemplazan, por eso no deben ser el destino estable.
5. La capa del vuelo no debe interceptar toques (`pointer-events: none`), copiar IDs ni añadir controles enfocables. Retira los clones al terminar/cancelar. Con movimiento reducido, actualiza contador/estado sin vuelo. La animación debe poder interrumpirse y no bloquear nuevas acciones.

## Salida a WhatsApp

Número vigente en el sitio y en este acuerdo: **51988918238**. Usa los nombres de los cuatro IDs validados desde el catálogo, el origen web y el total del pack. Texto sugerido:

```text
Hola KJA, vengo por la oferta de cursos de su web: 3 cursos por S/99 en total + 1 gratis.
Elegí estos 4 cursos:
1. [nombre]
2. [nombre]
3. [nombre]
4. [nombre, incluido gratis]
Quisiera confirmar mi inscripción.
```

Construye `https://wa.me/51988918238?text=` más `encodeURIComponent(message)`. Solo abre el enlace tras una acción explícita de continuar con cuatro cursos válidos. El visitante decide enviar el mensaje. No afirmes pago, cupo reservado, certificación o vigencia que no estén confirmados.

## Verificación antes de combinar y cerrar

Ejecuta `npm ci` y `npm run test:cursos` (incluye las pruebas de la vista). Agrega pruebas propias del controlador: límite de cuatro, duplicados, quitar/volver a añadir, filtros/paginación sin pérdida de selección y mensaje con cuatro nombres válidos. Verifica visualmente 360/390 px, tablet, escritorio y teléfono horizontal.

Recorre 0, 1, 2, 3 y 4 seleccionados. Asegura que WhatsApp no aparezca hasta cuatro; prueba volver de cuatro a tres. En móvil comprueba fondo bloqueado, foco encerrado, CTA visible, scroll de la lista y posición restaurada al cerrar. En escritorio conserva la apertura en dos tiempos y la cancelación si el puntero sale. Prueba Escape, toque fuera, botón de cierre, teclado y movimiento reducido. No rompas las consultas individuales existentes por WhatsApp, los modales del catálogo ni `?area=…`.

Actualiza la ficha KJA-006, documenta rama/SHA, evidencia y lo pendiente. No declares terminado el carrito por tener solo este panel. No fusionar ni desplegar sin el flujo integrado revisado por el equipo.
