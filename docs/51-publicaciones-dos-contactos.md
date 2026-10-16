# Dos contactos y copy de atención psicológica

En Corregir información, cada contacto detectado ofrece «Solo» y «Ambos · enlace a…». Ambos números aparecen en el copy; el primero abre el enlace de WhatsApp. También se pueden escribir separados por `/`. Los contactos originales del flyer siguen disponibles al elegir uno.

El generador reconoce servicios por título, descripción, temario y modalidad; los títulos explícitos de cursos conservan el formato educativo. Los flyers de atención psicológica usan presentación, opciones de atención, ubicación y llamada a agendar. Las explicaciones no prometen resultados ni añaden precios o credenciales.

Para actualizar un borrador existente, usar Actualizar copy / Aplicar formato. No hace falta analizar nuevamente el flyer. El texto editado manualmente no se sustituye automáticamente al abrirlo.

## Activación

Publicar los assets y desplegar la función actualizada para guardar ambos contactos:

```powershell
npx supabase functions deploy marketing-publicaciones --project-ref xadxmfgdxwplmhijagix --use-api
```

No requiere migración SQL. Con la función anterior, generar el enlace funciona con el contacto principal, pero guardar dos teléfonos será rechazado. Este cambio no se ha desplegado desde esta sesión: no hay una credencial de despliegue disponible en el entorno. No cambiar la configuración de verificación JWT como parte de esta actualización.

Validación: 53 pruebas aprobadas de publicaciones, teléfonos y Gemini; sin prueba visual ni guardado real en Supabase en esta sesión.
