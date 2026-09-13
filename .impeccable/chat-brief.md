# Chat del Portal KJA

## Alcance y autoridad

Modo **operate** sobre la identidad vigente de KJA. La implementación documentada vive en `assets/css/paginas/dashboard-chat.css` y `assets/js/dashboard-chat.js`; `DESIGN.md` conserva la autoridad global y `PRODUCT.md` el contexto del producto. Este brief registra únicamente la mensajería flotante. No modifica los tokens globales ni los valores existentes de `.impeccable/design.json`.

## Superficie implementada

- Identidad navy/azul e Inter (14px/1.5), superficies blancas, avatares con iniciales e iconos SVG lineales. Sin activos raster ni composición visual aprobada.
- Acceso Mensajes fijo abajo a la derecha; directorio con búsqueda por persona, filtros Equipo/Dirección, extracto de conversación e insignias de mensajes sin leer.
- Directorio de 330px y hasta dos conversaciones de 310px en escritorio. Cada conversación permite minimizar/restaurar y cerrar; se protege el borrador al cerrar manualmente y al sustituir ventanas.
- Hasta 1050px, el directorio abierto oculta visualmente las conversaciones. Hasta 700px, solo la última conversación permanece visible; su ancho se adapta al viewport y el acceso respeta navegación inferior y área segura.
- Cabeceras navy, mensajes propios azules y mensajes recibidos sobre fondo claro. Paneles con curvas de 14–16px y sombra; el énfasis corresponde a la tarea de comunicación.
- Ajustes locales para contraste accesible: texto secundario `#526279` e insignias `#c9005e` con texto blanco. Estos valores pertenecen exclusivamente al chat.

## Comportamiento y accesibilidad

Las consultas se repiten cada 5 segundos mientras la página está visible y se actualizan al recuperar foco. El historial permite cargar mensajes anteriores; los mensajes propios muestran Enviado o Leído. La lectura requiere conversación visible, foco dentro de ella y proximidad al final del historial.

Los controles tienen etiquetas accesibles, foco visible azul de 3px y estados textuales. Los nuevos mensajes se anuncian mediante una región de estado. Enter envía, Shift + Enter agrega una línea y Escape cierra el directorio o minimiza la conversación enfocada. Los fallos de envío conservan el texto para reintentar. Una cuenta desactivada permite consultar historial y deshabilita la composición.

## Evidencia y pendientes

La versión actual usa un botón compacto amarillo con solo la etiqueta Mensajes. La lista del directorio mide 300px, el panel mide hasta 800px y las pestañas Equipo, Dirección y Mis chats se distribuyen en tres columnas iguales; esto evita que los rótulos se junten o se superpongan sobre el buscador.

El acceso se refuerza con azul #075abc, borde blanco, icono de 28px, altura mínima de 68px y etiqueta secundaria Equipo y Dirección. La pestaña Mis chats permite encontrar conversaciones anteriores. El historial cargado se conserva en memoria al cerrar ventanas y se limpia al cerrar sesión; Supabase sigue siendo la fuente persistente. Se corrigió la paginación al enviar durante la carga inicial. Estos cambios se validaron con pruebas de comportamiento, sin nueva captura de navegador.

Las pruebas de comportamiento del código y las pruebas SQL aisladas pasaron, según la validación de implementación de esta entrega. El navegador no estuvo disponible; siguen pendientes la revisión visual en escritorio/móvil, los solapamientos, el comportamiento con zoom y la comprobación directa de teclado y lector de pantalla. No hay captura ni composición aprobada que sustituya estas comprobaciones. Las pruebas locales no acreditan activación en producción.
