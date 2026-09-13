# Publicaciones — brief de superficie

Modo: **Operate**. Alcance exclusivo: `#view-marketing` en `dashboard.html`. Documentación de la implementación local, sin validación visual en navegador.

## Propósito y autoridad visual

Marketing prepara una publicación a partir del flyer original, contrasta los datos, revisa el copy y el destino de WhatsApp, guarda y confirma antes de publicar. La superficie extiende la identidad existente del Portal KJA: Inter en controles, navy institucional y azul de acción sobre superficies blancas. `DESIGN.md` sigue siendo la autoridad global; este brief conserva decisiones particulares de Publicaciones sin convertirlas en reglas de todo el portal.

## Composición

Flujo vigente: tres pasos Contenido → Revisar copy → Publicar. Tanto Gemini como el texto manual generan directamente el copy; «Corregir información» es opcional, accesible desde revisión. Publicar guarda el borrador antes del envío, y «Guardar para después» es opcional. Los datos ausentes se omiten y el WhatsApp de KJA se propone solo si no hay teléfono. Esta actualización reemplaza la navegación Contenido/Datos/Revisión descrita abajo.

Actualización de compactación: la columna derecha muestra solo una de tres vistas (Contenido, Datos, Revisar post), con navegación persistente y conservación de datos. Nombre y WhatsApp se muestran primero; los opcionales se agrupan en un `details`. El flyer limita su altura a 320px y el historial tiene un área desplazable de hasta 240px. Los errores de conexión terminan la carga y ofrecen reintento. La verificación visual en navegador sigue pendiente; las pruebas de eventos cubren la navegación.

Una cabecera con título y «Nueva publicación» precede a cuatro pasos numerados: subir flyer, generar borrador, revisar y publicar. El paso actual usa `aria-current`; los mensajes de operación y conexión aparecen antes del área de trabajo.

En escritorio, el flyer y el historial personal ocupan la izquierda; edición y revisión ocupan la derecha. La rejilla declarada distribuye `minmax(200px, .75fr)` y `minmax(0, 1.25fr)`, separados por 28px. La fuente permanece sticky a 24px y presenta el flyer completo con `object-fit: contain`, sin redibujarlo. La revisión aparece dentro del editor cuando existe copy. En esta vista, por encima de 900px, el portal reserva 240px a navegación y oculta su columna contextual derecha.

A 1100px o menos se apila fuente, historial y editor; la fuente deja de ser sticky y la imagen limita su altura a 360px. A 600px o menos la cabecera y los pasos se redistribuyen, el título pasa de 32 a 28px, los paneles usan 18px de relleno y las acciones pueden repartirse el ancho disponible.

## Tratamiento y controles

El editor es blanco, con borde tenue y curva de 16px; la carga usa borde discontinuo y curva de 12px. Campos y botones usan curvas de 8px, una variación local observada. El azul de acción (`#075abc`) identifica botones principales, enlace y foco; el navy (`#09244c`) sostiene controles secundarios e historial. La separación depende de borde, espacio y tono, sin sombras nuevas en la hoja específica.

Los campos tienen etiquetas persistentes y ayudas para datos confirmados. Los opcionales vacíos se omiten del copy. Los errores llevan texto y fondo rosado; los estados normales usan fondo azul tenue. Hay contorno `:focus-visible` de 3px, mensajes `role="status"` con `aria-live="polite"` y `aria-busy` en el editor. Los botones declaran una altura mínima local de 42px: estas propiedades no equivalen a una certificación de accesibilidad ni resuelven por sí solas el objetivo global de controles de 44px.

## Flujo y estados

- La carga admite JPG, PNG o WebP hasta 5 MB y conserva el original sin iniciar Gemini. Un selector de radios nativos permite elegir análisis de imagen o texto pegado. El análisis requiere un clic explícito y guarda la extracción automáticamente. El modo texto organiza encabezados con reglas locales, conserva el contenido no clasificado y funciona sin cuota de IA. Abrir un borrador restaura las ediciones guardadas o, si aún no las hay, la extracción original. «Recuperar datos del flyer» reutiliza esa extracción sin consumir otra lectura.
- La generación prepara copy y enlace `wa.me`; el mensaje queda prellenado en WhatsApp y el cliente decide enviarlo. La interfaz permite probar el enlace y copiar el texto.
- Guardar conserva un borrador; publicar requiere borrador guardado, casilla de revisión, conexión configurada y permiso de publicación. Editar datos o copy invalida la revisión, y guardar vuelve a desmarcarla.
- El historial muestra borradores y estados escritos. Los registros publicados o de resultado incierto se bloquean contra nuevos envíos; un resultado incierto exige comprobar Facebook según la guía operativa.
- La interfaz declara «Lectura automática pendiente de configuración», «Facebook pendiente de conexión» o que la cuenta solo prepara borradores, según corresponda. «Destino configurado» informa configuración, no garantiza validez de credenciales.
- Sin la migración o sin acceso autorizado, la navegación a Publicaciones permanece oculta. Si falla la función, el estado solicita a Sistemas revisar la conexión.

## Activación y evidencia

La capacidad está implementada en archivos locales. Migración, accesos, secretos, Edge Function y despliegue siguen pendientes de activación según `docs/18-publicaciones-marketing.md`; no se atribuyen publicaciones reales ni conexiones verificadas a esta documentación.

Fuentes inspeccionadas: `PRODUCT.md`, `DESIGN.md`, la sección `view-marketing` de `dashboard.html`, `assets/css/paginas/dashboard-marketing.css`, `assets/js/dashboard-marketing.js` y `docs/18-publicaciones-marketing.md`. Se aplicó la referencia de documentación de Impeccable para capturar hechos observables sin inventar un sistema nuevo. No se ejecutó navegador: composición final, estilos computados, contraste y uso con teclado requieren comprobación sobre la vista renderizada. El brief registra intención y reglas declaradas, sin garantía visual.
