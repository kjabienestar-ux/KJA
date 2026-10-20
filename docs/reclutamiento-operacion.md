# Reclutamiento KJA: activación y funcionamiento

## Estado

El código está integrado y probado localmente. La consulta de lectura al proyecto configurado, `rec_postulaciones?select=id&limit=0`, devolvió `PGRST205` el 20 de octubre de 2026: la tabla aún no está creada. No se aplicaron cambios al servidor ni se enviaron postulaciones de prueba a producción.

Para activar la recepción real, ejecutar todo [reclutamiento_01_solicitudes.sql](../supabase/reclutamiento_01_solicitudes.sql) en el SQL Editor del proyecto Supabase `xadxmfgdxwplmhijagix`. Publicar también los HTML y JS/CSS de esta entrega. No requiere una Edge Function, un bucket ni claves privadas en el frontend. El SQL es aditivo y repetible; requiere las tablas de identidad existentes `asis_perfiles` y `perfiles`.

## Formulario

1. Aceptar los requisitos.
2. Completar datos y adjuntar CV PDF, DOC o DOCX de hasta 10 MB.
3. Solicitar fecha, hora y canal de entrevista, registrar correo y enviar.
4. Ver el comprobante solo después de la confirmación del servidor: código, resumen, CV recibido, fecha de registro y siguientes pasos.

La entrevista está sujeta a coordinación: el formulario no reserva un cupo exclusivo ni confirma una reunión. No promete un plazo de aprobación. El DISC se realiza fuera del formulario.

Los expedientes ya no se guardan en `localStorage`. El archivo permanece en memoria hasta el envío; `sessionStorage` conserva únicamente el UUID de un envío pendiente. Reintentar con el mismo UUID y contenido devuelve el mismo comprobante. No se puede alterar el expediente registrado por ese mecanismo. Una recarga antes de confirmar requiere volver a completar los datos y adjuntar el CV.

## Acceso administrativo

- Dashboard compartido: Dirección con acceso al panel → Administración → **Solicitudes**. También aparece **Reclutamiento** en la navegación y en el panorama de gestión, con contador de pendientes.
- `admin.html`: perfil de certificados `admin` → Administración → **Reclutamiento**. Usa los mismos datos y la misma bandeja del servidor.
- Una cuenta personal de colaborador no tiene acceso a los expedientes.

La bandeja tiene filtros, búsqueda, páginas de 25 expedientes, notas internas y descarga real del CV. Estados: Pendiente, En revisión, Entrevista, Aprobado y No seleccionado. Se actualiza al entrar, por botón y cada minuto mientras está visible. Una versión de revisión detecta cambios simultáneos.

Esta entrega **no envía correos automáticamente**. «Preparar correo» abre el cliente de correo del administrador. Cambiar un estado no marca ningún correo como enviado. El enlace de WhatsApp requiere que el postulante envíe el mensaje.

## Datos y permisos

`rec_postulaciones` guarda datos declarados, código, estado, notas y versión. `rec_curriculos` conserva el CV binario en privado; no se descarga en los listados. Ambos se guardan en una sola transacción.

Las tablas tienen RLS y carecen de permisos directos para visitantes y cuentas autenticadas. Las funciones de consulta, revisión y descarga comprueban el permiso en cada llamada: Dirección activa con `acceso_panel=true`, o perfil de certificados con rol `admin`. El cliente usa la sesión existente de cada portal; no cambia sus claves de autenticación.

El servidor valida campos, correo, aceptación, fechas, horarios, extensión, tamaño y encabezado del archivo; limita reenvíos por correo/documento. La comprobación del encabezado no es un análisis antivirus. Las funciones restringen `search_path` y sus permisos de ejecución, siguiendo la [documentación de funciones de Supabase](https://supabase.com/docs/guides/database/functions).

## Pruebas

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npx --yes --package=node@22 node --test tests/reclutamiento-integracion.test.mjs tests/reclutamiento-persistencia.test.mjs tests/reclutamiento-steps-cv.test.mjs tests/admin-entry.test.mjs
node tests/check-reclutamiento-assets.mjs
```

22 pruebas aprobadas. Las nuevas pruebas ejecutan el HTML/JS reales con DOM simulado y la migración en PostgreSQL local con PGlite: atomicidad, reintentos, archivos inválidos, permisos, descarga, conflictos de revisión, salida de sesión y contenido escapado. No sustituyen una verificación visual ni un ensayo en producción.

Después de activar Supabase, enviar una solicitud identificada como prueba desde otro navegador. Comprobar el código en la bandeja de Dirección o admin; descargar y revisar el CV; guardar una revisión y comprobarla tras actualizar. Verificar también que una cuenta de colaborador no pueda consultar los datos. No se incluyen eliminaciones de expedientes.
