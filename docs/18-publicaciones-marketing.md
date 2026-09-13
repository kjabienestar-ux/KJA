# Publicaciones de marketing

Flujo acordado: subir flyer o pegar texto → revisar el copy generado → publicar.

Implementado en `dashboard.html`, como módulo adicional. Conserva la sesión y la identidad del portal. No cambia la portada pública ni los registros de asistencia.

## Activación pendiente

La función `marketing-publicaciones` se desplegó en el proyecto `xadxmfgdxwplmhijagix` el 12 de septiembre de 2026 para resolver el error 404. Se verificó OPTIONS 200 y POST sin sesión 401. El usuario confirmó haber aplicado las migraciones 01 y 02. No se publicaron posts reales. En la comprobación de esa fecha todavía faltaban los secretos de Gemini y Facebook; deben configurarse para activar esas integraciones. La actualización del frontend depende del despliegue habitual del sitio.

1. Ejecutar una vez `supabase/marketing_01_publicaciones.sql` en el proyecto Supabase que ya utiliza el portal. Después ejecutar `supabase/marketing_02_gemini_cache.sql`, que añade extracción persistente y cuota compartida. Si ya aplicaste la primera, ejecuta únicamente la segunda. No se borran los borradores existentes.
2. Asignar acceso a las cuentas confirmadas de marketing. Desde SQL Editor, reemplazar el UUID por el de la cuenta de Supabase Auth:

   ```sql
   insert into public.marketing_accesos(usuario_id,puede_publicar)
   values ('UUID_DE_LA_CUENTA', false)
   on conflict(usuario_id) do update set puede_publicar=excluded.puede_publicar;
   ```

   Usar `true` solo para las personas autorizadas a publicar. Los perfiles activos de Sistemas tienen acceso completo. Pertenecer a otra área o tener acceso a asistencia no concede este permiso.
3. Configurar secretos de la Edge Function, nunca en HTML/JavaScript del navegador ni en Git:

   | Secreto | Uso |
   | --- | --- |
   | `GEMINI_API_KEY` | Clave del proyecto de Google AI Studio de KJA |
   | `MARKETING_GEMINI_MODEL` | `gemini-2.5-flash` (valor por defecto), según la cuota mostrada en la cuenta de KJA |
   | `MARKETING_FACEBOOK_PAGE_ID` | Identificador de la página empresarial de destino |
   | `MARKETING_FACEBOOK_PAGE_NAME` | Nombre visible para la revisión de marketing |
   | `MARKETING_FACEBOOK_PAGE_TOKEN` | Token de página con permiso de publicación vigente |
   | `MARKETING_FACEBOOK_GRAPH_VERSION` | Versión vigente de Graph API, con formato `vNN.0` |

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son las variables de servidor del proyecto. No compartir sus valores en el chat. Ya no se utiliza OpenAI: `OPENAI_API_KEY` y `MARKETING_VISION_MODEL` no son necesarios para este módulo. Mantener el proyecto de Google en nivel gratuito si se desea trabajar solo con su cuota gratuita.
4. Desplegar `marketing-publicaciones` con el mismo procedimiento de las Edge Functions existentes. El manejador valida el usuario con `auth.getUser()` y después consulta su permiso en SQL. Si el gateway rechaza tokens de sesión válidos por su configuración JWT, revisar la configuración del proyecto antes de modificarla; no retirar la validación interna del manejador.
5. Publicar los archivos del dashboard y sus assets mediante el despliegue habitual. Facebook se habilita cuando existen los secretos, pero ese indicador solo confirma configuración: la validez real de la credencial se verifica al enviar. Validar primero en una página de prueba autorizada. No usar el post del curso como prueba de producción sin revisión de marketing.

## Comportamiento

- El editor tiene tres pasos: Contenido, Revisar copy y Publicar. Analizar la imagen o generar desde texto crea inmediatamente el copy y el enlace, y abre la revisión. «Corregir información» es una herramienta opcional, no un paso. Los datos ausentes se omiten; solo un nombre ausente o un teléfono inválido requieren corrección. Si falta el teléfono se propone `51988918238`, el contacto de KJA del material compartido; se muestra en la revisión y puede cambiarse para esa campaña.
- «Publicar en Facebook» guarda el borrador revisado y después lo envía. No exige pulsar previamente Guardar. «Guardar para después» sigue disponible como acción opcional. Se conserva la casilla de revisión, el permiso de publicación, la conexión a Facebook y el bloqueo contra duplicados.
- Un fallo de conexión termina el indicador de carga y ofrece «Reintentar conexión». Se distinguen servicio no activado (404), sesión no validada (401) y falta de permisos (403). Preparar texto manual sigue disponible; guardar necesita conexión al servicio.
- Marketing elige «Analizar imagen con Gemini» o «Pegar texto · sin consumir lecturas». Subir el flyer nunca inicia la lectura automáticamente: Gemini solo se consulta al pulsar «Leer información del flyer» y cuando no hay extracción guardada.
- La opción manual funciona con Gemini sin configurar o con la cuota agotada. Se pega el texto y se pulsa «Generar copy con este texto»; el navegador reconoce encabezados explícitos como Título, Descripción, Público, Temario, Modalidad, Beneficios, Fecha, Precio, WhatsApp y Correo. No utiliza IA ni promete interpretar cualquier prosa. Sin encabezados, toma la primera línea como título y conserva el resto como descripción. No infiere el código de país. Revisa los campos y genera el copy con la plantilla habitual.
- Puedes preparar el texto antes de subir el flyer; se conserva al adjuntar la primera imagen. El flyer sigue siendo necesario para guardar y publicar este tipo de post con imagen. Generar desde texto reemplaza la información anterior previa confirmación y crea un nuevo copy para revisar. Puedes guardarlo para después o continuar a publicar.
- Cada persona dispone de sus últimos 30 borradores/publicaciones. Los flyers son privados y se consultan con URLs firmadas de una hora.
- Se admiten JPG, PNG y WebP hasta 5 MB. Se almacena el archivo original; no se vuelve a dibujar ni modifica el diseño.
- Gemini extrae texto visible y deja vacíos los datos ausentes; marketing debe verificar posibles errores. Se guarda automáticamente la extracción original, el modelo y la fecha en el borrador antes de devolver el resultado. Abrirlo recupera los datos aunque aún no se haya guardado un copy. Las ediciones guardadas tienen prioridad sobre la extracción original.
- El límite interno compartido es de 20 intentos nuevos en las últimas 24 horas y 5 por minuto por modelo, reservado de forma atómica en SQL. Reemplaza la protección anterior de 30 lecturas por persona. Los errores también conservan la reserva por precaución. El límite de carga de archivos sigue siendo de 30 por persona cada 24 horas y es independiente de Gemini.
- Estos valores conservadores se basan en la captura de cuotas de KJA: no son una garantía de Google. El contador local no incluye otros sistemas que usen el mismo proyecto y emplea una ventana móvil de 24 horas, mientras Google reinicia su cuota diaria a medianoche del Pacífico. Google también aplica límites de tokens. Un error 429 se comunica sin reintentar automáticamente ni cambiar de modelo.
- Cada borrador reutiliza su extracción: “Recuperar datos del flyer” restaura el texto original sin otra llamada a Gemini. Abrir, editar, generar copy o enlace y publicar tampoco llaman a Gemini. Recuperar los datos originales reemplaza los campos del editor, previa confirmación. Subir el mismo archivo como un borrador nuevo sí puede consumir otra lectura: no existe deduplicación entre archivos/borradores.
- Dos solicitudes simultáneas del mismo borrador no deben iniciar dos lecturas. Una reserva sin resultado caduca tras dos minutos; se puede volver a intentar manualmente. Si Gemini respondió pero falló el guardado de la extracción, se avisa del error y un nuevo intento puede consumir cuota. No se declara guardado un resultado que no se pudo persistir.
- El copy usa una plantilla determinista con las secciones del ejemplo aprobado; omite secciones vacías. No añade promesas, cupos limitados, modalidad ni beneficios no confirmados. La plantilla actual está en `assets/js/marketing-model.js`.
- El mensaje de WhatsApp puede editarse. El enlace `wa.me` incluye el número internacional y el texto codificado. No se ha integrado la marca/enlace corto de Walink, ni se crean enlaces de invitación a grupos.
- Cambiar datos o copy invalida la revisión. En el último paso se marca la casilla y se pulsa Publicar; el sistema guarda primero el borrador. Guardar para después nunca publica.
- La publicación envía la imagen y el copy a la página configurada. No contempla perfiles personales, grupos de Facebook, anuncios pagados ni programación por fecha.
- Los tokens y las llamadas a IA/Facebook quedan en el servidor. Las tablas no admiten escritura directa desde el navegador. Cada operación comprueba permiso vigente y propiedad del borrador.

## Resultado incierto al publicar

Antes de llamar a Facebook se reclama el borrador con una actualización atómica. Un segundo envío no lo puede reclamar. Un cambio concurrente del copy cancela el envío si ya no coincide con lo revisado.

Un timeout o error ambiguo deja el registro en `verificar` (o `publicando` si se interrumpe el proceso). No hay reintento automático, porque Facebook podría haber recibido el post. Sistemas debe comprobar la página y registrar el resultado desde SQL Editor. Si está publicado, asignar `estado='publicado'` y el `facebook_id` real. Si se confirma que no existe, devolver a `borrador`; marketing debe cargarlo y revisarlo de nuevo. No restablecer por el mero paso del tiempo.

## Validación antes de uso real

Durante las operaciones se muestra un indicador de carga y se bloquean los envíos repetidos; el indicador desaparece también si hay un error. Respeta la preferencia de movimiento reducido. “Clave de Gemini configurada” confirma únicamente la presencia del secreto, no su validez. Los rechazos de Gemini distinguen clave inválida o bloqueada, autenticación (401), permisos (403), modelo no disponible (404) y solicitud incompatible (400), sin mostrar el mensaje original del proveedor ni credenciales. Los espacios al principio o final de la clave y el modelo se eliminan antes de usarlos.

El 12 de septiembre se verificó que `MARKETING_GEMINI_MODEL` corresponde a `gemini-2.5-flash` mediante su resumen SHA-256 y se desplegó el diagnóstico actualizado. La validez de la clave y una extracción real siguen pendientes de comprobar desde una sesión autorizada del portal. No hace falta volver a ejecutar las migraciones para este cambio.

En el intento posterior, Google devolvió 404 para `gemini-2.5-flash`. Se cambió el secreto remoto `MARKETING_GEMINI_MODEL` a `gemini-2.5-flash-lite` como alternativa con entrada de imágenes y nivel gratuito documentados. El cambio no confirma todavía una extracción correcta: falta probar desde el portal con la sesión de marketing. No se cambió la clave ni se habilitó facturación. El valor por defecto del código sigue siendo `gemini-2.5-flash`; el secreto remoto tiene prioridad.

- Cuenta sin acceso: no puede operar ni llamando directamente a la función.
- Cuenta preparadora: puede guardar y recuperar su borrador; no puede publicar.
- Flyer del ejemplo: lectura del título, siete temas y contactos; público/modalidad/beneficios ausentes quedan vacíos.
- Teléfono inválido, cambio del mensaje, datos editados y copy sin enlace vigente: no publicar hasta corregir y guardar.
- Doble clic, dos pestañas y respuesta perdida: como máximo un intento sobre el mismo borrador; verificar resultados inciertos.
- Prueba controlada en la página de ensayo: comprobar visualmente imagen, copy y apertura del chat con el mensaje correcto.
- Leer un flyer y recargar sin guardar copy: recuperar la extracción sin nueva llamada. Guardar un título corregido, reabrir y verificar que conserva esa corrección.
- Subir una imagen en cualquiera de los modos: cero llamadas de análisis hasta pulsar el botón. Con Gemini sin configurar o con error de cuota, pegar texto, organizarlo, generar enlace y guardar el copy sin volver a llamar a Gemini.
- Dos lecturas simultáneas del mismo borrador, cuota compartida agotada y error 429: verificar que no hay reintentos automáticos ni llamadas duplicadas. Esta validación SQL requiere aplicar la migración en un entorno de prueba.

Las llamadas reales de IA, SQL/Storage y Facebook requieren las credenciales y el despliegue anteriores. Las pruebas locales usan respuestas simuladas y no sustituyen esa validación.

Referencias de implementación: [imágenes en Gemini](https://ai.google.dev/gemini-api/docs/image-understanding), [generateContent y configuración de salida](https://ai.google.dev/api/generate-content), [límites de Gemini](https://ai.google.dev/gemini-api/docs/rate-limits), [fotos de página en Graph API](https://developers.facebook.com/docs/graph-api/reference/page/photos/). Confirmar versión y permisos vigentes de Meta al activar.
