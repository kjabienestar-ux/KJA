# Fase 2 — Activación y prueba de Pasar lista

**Fecha:** 26 de agosto de 2026
**Estado:** aplicada en Supabase y publicada el 28 de agosto de 2026

> Esta fase ya está activa en producción. Los pasos de activación se
> conservan como referencia operativa; no se debe repetir la migración sin una
> revisión previa del estado remoto.

## Qué incorpora

- Pasar lista dentro de `dashboard.html`, sin `iframe`.
- Navegación por fecha, búsqueda y filtro por área.
- Indicadores de personas, registros, presentes, tardanzas y pendientes.
- Estados `P`, `T`, `J` y `NG` para `editor` y `direccion`.
- Consulta de evidencias privadas y eliminación coordinada.
- Vista de consulta sin escritura para `visor`.
- `asistencia.html?modo=lista` como respaldo durante el piloto.

## Activación

1. En Supabase, abrir **SQL Editor**.
2. Copiar y ejecutar todo `supabase/dashboard_05_admin_lista.sql`.
3. Verificar cuatro resultados `OK`:

   - `dash_admin_guardar_estado`
   - `dash_admin_lista`
   - `dash_admin_quitar_estado`
   - `policy borrar evidencia solo editores`

4. Recargar el dashboard con `Ctrl + F5`.
5. Ingresar desde la pestaña **Dirección** y abrir **Gestión de asistencia →
   Pasar lista**.

No se debe volver a ejecutar `dashboard_03_cerrar_panel.sql`. No se requiere
modificar `DASH_PIN_SECRET` ni desplegar nuevamente las Edge Functions.

## Prueba mínima antes de publicar

Usar primero una fecha y un colaborador de prueba:

1. Comparar cantidad de personas y horarios con
   `asistencia.html?modo=lista`.
2. Registrar `P` y comprobar la misma fila en el panel anterior.
3. Cambiar a `T`, recargar ambas pantallas y comprobar estado y hora.
4. Probar `J` y `NG`; confirmar que las horas se conservan o quedan en cero
   según corresponda.
5. Seleccionar nuevamente el estado activo para quitar la marca.
6. En una marca con foto, abrir **Ver evidencia** y cancelar el borrado.
7. Repetir, aceptar el borrado y comprobar que desaparecieron imagen y marca.
8. Entrar con un `visor`: debe ver la lista, pero todos los estados deben estar
   deshabilitados.
9. Entrar con una cuenta personal por DNI + PIN: no debe aparecer Gestión de
   asistencia.
10. Confirmar que certificados y sus usuarios continúan sin cambios.

## Retorno operativo

Si la pantalla nueva presenta una diferencia, usar **Panel anterior** o abrir
`asistencia.html?modo=lista`. La migración no elimina el módulo vigente y ambas
interfaces operan sobre `asis_registros`.
