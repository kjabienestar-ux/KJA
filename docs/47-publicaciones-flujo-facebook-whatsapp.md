# Publicaciones: del flyer al texto y WhatsApp

El editor permite dos salidas: preparar el contenido para actualizar manualmente una publicación existente en Facebook, y crear un post nuevo en la página conectada.

1. Subir el flyer y pulsar **Analizar flyer y generar copy**. Gemini lee los datos y redacta una presentación basada en la descripción o temario visible. La lectura queda guardada; corregir texto o WhatsApp no vuelve a llamar a Gemini.
2. Revisar el texto con los encabezados del ejemplo de KJA: título, modalidad, público, formación, beneficios e inscripción. Los datos ausentes se omiten. **Formato y beneficios de esta campaña** permite confirmar certificado con QR, material digital, validez en Perú y vacantes limitadas antes de aplicar esas frases. Las opciones comienzan desmarcadas y se guardan con el borrador.
3. Ajustar el número y el mensaje predeterminado en **WhatsApp para las inscripciones**. **Actualizar enlace** incorpora el enlace y conserva las ediciones del copy. El enlace es `wa.me`, con el mensaje codificado; no depende de Walink ni genera un enlace corto `wa.link`.
4. **Copiar o publicar** ofrece **Copiar texto para Facebook** y **Descargar flyer**, disponibles aunque Facebook no esté conectado. El operador pega el texto al crear o editar el post en Facebook. No se modifican automáticamente posts existentes.
5. Para un post nuevo, **Publicar post nuevo en Facebook** conserva la revisión explícita, el guardado previo, el permiso de publicación y el bloqueo contra envíos duplicados.

## Activación de los cambios

No requiere una nueva migración: las opciones de campaña se almacenan en el JSON `datos` existente. Mantener las migraciones `marketing_01` y `marketing_02` previamente instaladas.

Publicar `dashboard.html`, `assets/js/marketing-model.js`, `assets/js/dashboard-marketing.js` y `assets/css/paginas/dashboard-marketing.css`. Desplegar la función actualizada, incluido `gemini.mjs`:

```powershell
npx supabase functions deploy marketing-publicaciones --project-ref xadxmfgdxwplmhijagix
```

La captura del usuario muestra Gemini configurado y Facebook pendiente de conexión. Para publicar directamente, siguen siendo necesarios los secretos de página, token y versión de Graph API descritos en `docs/18-publicaciones-marketing.md`. La existencia de la clave Gemini no confirma su validez o cuota: se comprueba al analizar. No se configuraron credenciales ni se enviaron publicaciones reales durante esta implementación.

## Corrección del modelo Gemini (13 de octubre de 2026)

Ante el error 404 al analizar, se actualizó el modelo por defecto a `gemini-3.1-flash-lite`, se cambió `MARKETING_GEMINI_MODEL` en Supabase y se desplegó `marketing-publicaciones` en `xadxmfgdxwplmhijagix`. El nuevo estado devuelve también el nombre del modelo, sin exponer credenciales. No se cambió `GEMINI_API_KEY` ni la facturación.

Google documenta restricciones de acceso a la familia 2.5 para proyectos nuevos y recomienda 3.1 Flash-Lite o Flash para esos proyectos. [Explicación de Google](https://discuss.ai.google.dev/t/gemini-2-5-flash-visible-via-models-get-and-advertises-generatecontent-but-generatecontent-returns-404-model-or-resource/182253/2). [Modelo con imágenes y JSON estructurado](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).

Las 30 pruebas locales pasan con el modelo actualizado. La extracción real con la clave del usuario sigue pendiente de comprobar desde el portal; el despliegue y la compatibilidad documentada no acreditan por sí solos acceso o cuota de esa clave.

## Verificación

30 pruebas locales aprobadas con `node --test tests/marketing.test.mjs tests/marketing-gemini.test.mjs`.

Pruebas de Publicaciones y Gemini cubren formato, omisión de afirmaciones no confirmadas, opciones por campaña, preservación de ediciones al actualizar WhatsApp, copia sin Facebook conectado, descarga de la imagen original, revisión obligatoria, caché, cuota y bloqueo de duplicados. El navegador no estaba disponible en esta sesión; la presentación visual y un ensayo con los servicios reales quedan pendientes.
