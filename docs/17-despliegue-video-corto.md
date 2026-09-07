# Fase 7 · video corto opcional

Esta fase permite adjuntar un video privado al RPE o a un entregable asignado. No reemplaza las capturas de Facebook, la evidencia principal ni la foto de salida.

## 1. Aplicar la migración

En Supabase SQL Editor, ejecutar completo:

`supabase/dashboard_27_video_corto.sql`

El resultado esperado es:

| estado | pieza | encontrado | esperado |
|---|---|---:|---:|
| OK | mime multimedia | 1 | 1 |
| OK | RPC de video | 2 | 2 |
| OK | bucket multimedia | 1 | 1 |
| OK | lectura privada multimedia | 1 | 1 |

## 2. Desplegar la función privada

Desde la raíz del proyecto:

```powershell
npx supabase@latest functions deploy dash-entrega --project-ref xadxmfgdxwplmhijagix --use-api
```

## 3. Publicar el portal

Publicar estos archivos junto con el resto del sitio:

- `dashboard.html`
- `assets/js/dashboard.js`
- `assets/js/dashboard-admin-cierre.js`
- `assets/css/paginas/dashboard.css`

## 4. Prueba controlada

1. Ingresar con una cuenta que tenga jornada abierta.
2. Abrir “RPE y evidencias del día”.
3. Adjuntar al menos una imagen.
4. Adjuntar opcionalmente un MP4 o WebM de hasta 30 segundos y 8 MB.
5. Guardar y comprobar la animación de envío.
6. Desde Dirección, abrir la revisión y reproducir el video.
7. Desde un líder técnico del área, comprobar que el video sea visible en modo de solo lectura.

La duración se valida en el navegador. El formato, propietario, ruta, tamaño máximo, jornada abierta y límite de un video se vuelven a validar en Supabase.
