# Estudio de Publicaciones

15 de octubre de 2026. Rediseño implementado localmente en `dashboard.html#view-marketing`, `assets/css/paginas/dashboard-marketing.css` y `assets/js/dashboard-marketing.js`.

## Dirección y recorrido

Modo **Operate**: facilitar el trabajo recurrente de Marketing, desde retomar una campaña hasta revisar y compartir su contenido. Conserva la identidad KJA, los tonos navy y azul y la tipografía Inter del portal. Esta composición pertenece a Publicaciones; no modifica `DESIGN.md` ni el sidecar del sistema visual.

- **Biblioteca visible:** historial lateral con miniatura, título, fecha y estado; búsqueda por nombre, filtros Todas/Borradores/Publicadas y «Cargar anteriores». En móvil pasa a una franja horizontal sobre el editor. El borrador activo se identifica y abrir otro solicita confirmación si hay cambios sin guardar.
- **Preparación:** carga por selector o arrastre, vista del flyer y dos opciones visuales: crear desde la imagen o pegar texto sin lecturas de IA. Adjuntar una imagen no dispara el análisis.
- **Revisión:** editor de Facebook con contador de caracteres y WhatsApp visible en una superficie verde. El número, el mensaje del cliente y el enlace de campaña permanecen accesibles. «Corregir información» permite revisar los datos de origen.
- **Compartir:** el pie reúne copiar, guardar y continuar. La salida permite copiar el texto y descargar el flyer; publicar un post nuevo requiere conexión, permiso y confirmación de revisión. Abrir WhatsApp prepara el mensaje, pero el cliente decide enviarlo.

El código incluye foco visible, etiquetas de campos, estados anunciados, controles bloqueados durante operaciones y movimiento reducido. La biblioteca se reorganiza a 900 px y el editor adopta una columna a 600 px; estos comportamientos todavía requieren comprobación visual.

## Contenido e historial

`assets/js/marketing-model.js` conserva la composición determinista del copy y el mensaje de WhatsApp. `supabase/functions/marketing-publicaciones/gemini.mjs` pide recorrer los bloques del flyer y conservar condiciones, horarios, duración, docentes, entidades, requisitos y promociones visibles. No debe completar datos ausentes ni prometer resultados; la revisión humana sigue siendo necesaria.

La acción `listar` de `marketing-publicaciones/index.ts` devuelve páginas de 30 registros del autor, total y `has_more`, ordenadas por fecha e identificador. Incluye datos, extracción, copy, enlace y URLs de imágenes firmadas en lote, con vigencia de una hora.

La apertura puede reutilizar el resultado en una caché de memoria de la sesión durante 60 segundos; después consulta `cargar`. Reabrir el registro activo también consulta el servidor. La caché se limpia al refrescar el historial y cerrar sesión. Esta optimización no analiza imágenes ni genera enlaces. Puede mostrar datos de otra pestaña con hasta 60 segundos de antigüedad; las operaciones siguen validándose en el servidor.

**La búsqueda y los filtros solo abarcan las páginas cargadas.** El contador de cabecera representa el total del servidor; el resumen indica coincidencias locales y avisa cuando quedan registros anteriores. No es una búsqueda global del historial.

## Activación pendiente

El listado enriquecido en una sola petición y el prompt actualizado requieren desplegar la Edge Function. Las miniaturas también funcionan con el servicio anterior mediante la lectura autenticada `cargar`; no dependen de ese despliegue. No añade una migración. Las dependencias de acceso, almacenamiento, análisis y enlaces son las documentadas en [18](18-publicaciones-marketing.md), [48](48-whatsapp-enlace-por-flyer.md) y [49](49-flyers-compresion-cuota.md).

Desde la raíz del repositorio, con una sesión de CLI autorizada:

```powershell
npx supabase login
npx supabase functions deploy marketing-publicaciones --project-ref xadxmfgdxwplmhijagix
```

Conservar la validación JWT configurada y las comprobaciones internas de usuario, permiso y propiedad. Configurar cualquier credencial pendiente mediante los secretos del proyecto Supabase; nunca incluir sus valores en el frontend, Git o esta documentación. Publicar también el HTML y los assets mediante el despliegue habitual del sitio.

**No se efectuó ningún despliegue ni publicación real en este trabajo.** Los despliegues históricos descritos en documentos anteriores no activan estos cambios nuevos.

## Verificación y límites

`npm run test:marketing`: **54 pruebas aprobadas**, que cubren editor, caché, filtros, recuperación, compresión, cuota SQL, Gemini, estructura, seis miniaturas con concurrencia limitada, vista previa y splash ante errores. Se añadieron tres comprobaciones estructurales con parse5 y una comprobación del prompt. `git diff --check` sin errores. La revisión confirmó la preservación del copy al adjuntar el primer flyer y la consulta al servidor al reabrir el registro activo. Las pruebas locales no sustituyen una sesión real de Marketing.

No hubo validación visual: el inventario de CUA estaba vacío y el navegador integrado no estaba disponible. Quedan pendientes la inspección de escritorio y móvil, la navegación por teclado, y la comprobación autenticada de paginación, apertura desde caché, imágenes firmadas, guardado y enlaces. Las conexiones reales de IA y Facebook tampoco quedaron acreditadas por este rediseño.

## Ajuste según captura del usuario

La cabecera conserva título y Nueva publicación; se retiraron las frases de presentación y los avisos informativos permanentes del espacio visual. Los estados siguen anunciándose a tecnologías de asistencia y los errores y el botón Reintentar permanecen visibles cuando corresponde. El editor se titula «Editar publicación».

El historial recupera imágenes ausentes con un máximo de tres lecturas simultáneas y guarda sus respuestas en la caché de sesión. Ya no representa las campañas con iniciales. Un icono de imagen identifica temporalmente un flyer pendiente o no disponible; una lectura fallida permite reintentar. Esta recuperación no analiza, guarda ni publica campañas.

El flyer seleccionado aparece encima de WhatsApp, con acceso a tamaño completo, y se limpia al crear otra campaña. Las operaciones usan `withActionLoader`, el splash existente del portal; se mantiene un splash equivalente como respaldo si esa función no está disponible. No se añade una espera artificial.
