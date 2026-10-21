# Reclutamiento: portada y desplazamiento

## Alcance

La página 
eclutamiento.html incorpora la portada de referencia y el proceso existente de cuatro pasos. Ambas copias locales (Live Server en 5505 y servidor en 3000) contienen la misma página y sus dependencias de reclutamiento.

## Diseño

La fotografía images/reclutamiento/entrevista.webp comienza en el borde superior y continúa detrás de la navegación. No hay un velo blanco horizontal sobre la cabecera. Se conserva el degradado lateral para la lectura, el fondo crema, el titular negro Poppins y el énfasis rosa en DM Serif Display cursiva. La onda blanca solo remata el borde inferior.

Los estilos de portada están aislados en ssets/css/paginas/reclutamiento-portada.css, con prefijo .rec-reference-hero. Los formularios conservan 
eclutamiento.css y 
eclutamiento-confirmacion.css. El rosa de display es #ed007a, el de los botones #d00068 y el de navegación #a50052.

La fotografía ilustrativa se generó con la herramienta integrada. Su procedencia y el prompt exacto están en images/reclutamiento/entrevista.webp.json; no representa al personal real de KJA.

## Navegación y flujo

La cabecera conserva el menú compartido del sitio. El botón principal y las modalidades enlazan a #rec-tabs-wrapper. Debajo de la portada están los requisitos, los datos y CV, la agenda y la confirmación. El cliente existente usa 
eclutamiento-api.js; esta modificación no despliega ni verifica el servicio remoto de envío.

El documento admite desplazamiento vertical. Los bloqueos específicos del menú móvil y los modales conservan sus reglas de interacción.

## Validación

La comprobación de render en escritorio y móvil confirmó fotografía con coordenada superior 0, ausencia de velo superior, formulario presente y desplazamiento efectivo hasta 700 px, sin desbordamiento horizontal. Las capturas están en .impeccable/review/recruitment-scroll/. Los recursos locales existen y los scripts pasan la comprobación de sintaxis. No se enviaron postulaciones reales.

El bloque para empresas y su enlace se retiraron por solicitud del usuario. La portada conserva el velo reducido, la navegación publicada y el proceso de postulación existente.
