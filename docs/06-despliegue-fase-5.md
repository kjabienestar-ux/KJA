# Fase 5 — Activación de Marcado propio

**Fecha:** 27 de agosto de 2026
**Estado:** aplicada en Supabase y publicada el 28 de agosto de 2026

> Esta fase ya está activa en producción. Los pasos de activación se
> conservan como referencia operativa; no se debe repetir la migración sin una
> revisión previa del estado remoto.

## Qué incorpora

- Centro de acceso exclusivo de Dirección.
- Ruta oficial `/dashboard` y QR descargable.
- Enlace `/marcar?k=…` identificado como activación inicial.
- Configuración de tolerancia y evidencia obligatoria.
- Apertura o cierre controlado del enlace anterior.
- Regeneración del enlace anterior sin cambiar PIN.
- Estado de PIN, DNI, bloqueos, intentos y primer ingreso.
- Reinicio de PIN con revocación de sesiones personales.
- Gestión de avisos de horario.
- Bitácora privada de acciones sensibles.

## Seguridad de la migración

Ejecutar `supabase/dashboard_08_admin_marcado.sql`:

- no cambia la configuración vigente;
- no regenera enlaces;
- no reinicia PIN;
- no cierra sesiones;
- no modifica colaboradores ni asistencias;
- no toca tablas, usuarios ni políticas de certificados;
- crea una tabla privada, un índice y cinco RPC.

Las acciones sensibles solo ocurren después, cuando Dirección confirma un
control específico en la interfaz.

## Requisitos previos

- Migraciones de asistencia 1 a 14.
- `dashboard_01`, `dashboard_03`, `dashboard_04`, `dashboard_05`,
  `dashboard_06` y `dashboard_07` aplicadas.
- Respaldo reciente confirmado.
- Acceso a una cuenta con `rol = direccion` y `acceso_panel = true`.

No se debe volver a ejecutar `dashboard_03_cerrar_panel.sql`.

## Activación

1. Abrir el SQL Editor de Supabase.
2. Copiar y ejecutar todo `supabase/dashboard_08_admin_marcado.sql`.
3. Confirmar siete filas `OK`:

   - `dash_admin_guardar_portal`
   - `dash_admin_marcado`
   - `dash_admin_regenerar_enlace`
   - `dash_admin_reiniciar_pin`
   - `dash_admin_resolver_horario`
   - `tabla asis_admin_eventos`
   - `RLS asis_admin_eventos`

4. Publicar en un mismo despliegue:

   - `dashboard.html`
   - `assets/css/paginas/dashboard.css`
   - `assets/js/dashboard.js`
   - `assets/js/dashboard-admin-equipo.js`
   - `assets/js/dashboard-admin-mes.js`
   - `assets/js/dashboard-admin-acceso.js`

5. Recargar con `Ctrl + F5`.
6. Entrar como Dirección y abrir **Gestión → Marcado propio**.

No se necesita cambiar `DASH_PIN_SECRET` ni desplegar `dash-entrar` o
`dash-evidencia`.

## Piloto mínimo

1. Comparar activos, con PIN, sin PIN y bloqueados con el panel anterior.
2. Copiar `/dashboard` y abrirlo en una ventana privada.
3. Escanear el QR y verificar que apunta al dashboard sin parámetros secretos.
4. Copiar la activación y confirmar que mantiene la clave vigente.
5. Guardar la misma tolerancia y evidencia; verificar la entrada en bitácora.
6. Probar una cuenta `editor`: no debe ver el módulo ni invocar sus RPC.
7. Abrir una ficha desde un aviso de horario y volver sin perder datos.
8. Cerrar un aviso de prueba y verificar actor, persona y fecha en bitácora.
9. Reiniciar únicamente un PIN de prueba y confirmar:

   - la sesión personal abierta deja de recibir datos;
   - la asistencia histórica permanece;
   - la persona puede crear un PIN nuevamente;
   - el resto del equipo sigue ingresando normalmente.

10. No regenerar el enlace compartido durante el piloto salvo que exista una
    razón real y se haya preparado la nueva comunicación.
11. Confirmar que certificados y sus usuarios no cambiaron.

## Diferencia entre los controles

| Control | Afecta | No afecta |
|---|---|---|
| Tolerancia | Clasificación futura entre presente y tardanza | Marcas históricas |
| Evidencia obligatoria | Próximas marcas personales | Evidencias y marcas existentes |
| Activación anterior | Entrada y alta mediante `/marcar` | Dashboard autenticado y PIN existentes |
| Regenerar enlace | URL anterior de `/marcar` | PIN, dashboard, contratos y asistencia |
| Reiniciar PIN | PIN de una persona y sus sesiones personales | Cuenta técnica, historial y otras personas |

## Retorno operativo

Durante el piloto permanecen disponibles:

- `asistencia.html?modo=dispositivos`
- `marcar.html`
- `dashboard.html`

Si falla la nueva vista, usar temporalmente el panel anterior. No es necesario
revertir la migración: las funciones y la bitácora son aditivas.
