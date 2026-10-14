# Mensaje y enlace corto de WhatsApp por flyer

El mensaje propuesto utiliza el nombre del flyer y el origen Facebook:

> Hola KJA. Vengo de Facebook, deseo información sobre la TERAPIA FAMILIAR Y DE PAREJA de la siguiente publicación: https://www.facebook.com/photo?fbid=122194279262870132&set=a.122125263440870132&locale=es_LA

La URL se pega en **Enlace de esta publicación en Facebook**. Si todavía no existe el post, se propone un mensaje específico sin esa URL. **Generar mensaje de este flyer** reemplaza explícitamente el mensaje con la propuesta del flyer actual. Los mensajes escritos manualmente se conservan al generar de nuevo el copy.

El enlace corto utiliza el dominio propio: `https://www.kjadmb.com/w.html?k=CLAVE_ALEATORIA`. No se emiten URLs `wa.link`: ese dominio pertenece a Walink. La página pública `w.html` resuelve la clave y abre el `wa.me` con el mensaje codificado. No se instala otro proveedor ni se añaden credenciales externas.

Cada versión de número y mensaje tiene su propio destino. Generar otra versión no altera enlaces ya compartidos. Cambiar número o mensaje exige generar el enlace corto actualizado antes de copiar, guardar o publicar. El servidor comprueba que el enlace pertenece a ese borrador y coincide con su mensaje actual. Generar estos enlaces no consulta Gemini.

## Activación

1. Ejecutar `supabase/marketing_03_whatsapp_enlaces.sql` después de `marketing_01_publicaciones.sql` y `marketing_02_gemini_cache.sql`.
2. Publicar `w.html`, `dashboard.html`, `assets/js/marketing-model.js` y `assets/js/dashboard-marketing.js` en el sitio KJA. **Publicar w.html es necesario para que los enlaces compartidos abran WhatsApp.**
3. Desplegar la función `marketing-publicaciones` actualizada.

Los datos del borrador no son públicos. La tabla de enlaces sólo admite escritura del servicio; el resolutor público devuelve únicamente el destino de una clave concreta de 96 bits. No hay permiso de listado ni edición pública.

El 13 de octubre de 2026 se aplicó `marketing_03_whatsapp_enlaces.sql` en el proyecto `xadxmfgdxwplmhijagix` y se desplegó la función actualizada. No hace falta volver a ejecutar esa migración. La publicación de `w.html` y el frontend en la web sigue pendiente y es necesaria para distribuir los enlaces.

## Verificación

33 pruebas locales aprobadas: mensaje exacto del ejemplo, codificación y acentos, URL de Facebook válida, mensajes personalizados conservados, enlaces cortos y destino coincidente, reutilización de caché, permisos del resolutor y errores. No se enviaron posts reales ni se publicaron enlaces de prueba.
# Corrección del 404 y formato del copy (13 de octubre de 2026)

- El 404 era de la web: `w.html` no estaba publicada. Se preparó el commit `6fc1eb3` exclusivamente con esa página y el PR https://github.com/kjabienestar-ux/KJA/pull/96. GitHub exige PR para `master`; la página sigue pendiente de integración y despliegue de Vercel.
- El formato local distingue terapia de formación. Ordena título, descripción, contenidos, modalidad, beneficios, condiciones, contacto y cierre. Separa beneficios de lecturas guardadas en líneas con emojis; evita duplicar certificado/material y no agrega hechos ausentes.
- El prompt de Gemini conserva el eslogan visible y extrae beneficios y condiciones uno por línea. La función `marketing-publicaciones` actualizada se desplegó en Supabase. La caché existente no se vuelve a leer ni consume otra llamada.
- Verificación: 35 pruebas de marketing, Gemini y resolución SQL aprobadas. Para actualizar un borrador existente en el portal local, recargar y usar **Aplicar formato**; las ediciones manuales solo se reemplazan tras la confirmación existente.

