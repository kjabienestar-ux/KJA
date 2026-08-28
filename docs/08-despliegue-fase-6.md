# Fase 6 — Roles y liderazgo por área

**Fecha:** 27 de agosto de 2026
**Estado:** aplicada en Supabase y publicada el 28 de agosto de 2026

> Esta fase ya está activa en producción. Los pasos de activación se
> conservan como referencia operativa; no se debe repetir la migración sin una
> revisión previa del estado remoto.

## Modelo visible

- **Administrador de sistemas:** cuenta creada con correo, nivel `sistemas`,
  rol `direccion` y acceso al panel. Gestiona todas las áreas y los líderes.
- **Líder técnico:** colaborador con nivel `lider`. Gestiona su asistencia y
  consulta únicamente el perfil y la asistencia de su área.
- **Colaborador:** practicante, interno o colaborador con nivel `miembro`.
  Consulta y registra únicamente su propia asistencia.

`rol` y `acceso_panel` permanecen internamente porque las operaciones de
asistencia desplegadas dependen de ellos. No deben editarse para promover a un
líder; el cambio correcto afecta únicamente `nivel`.

## Seguridad de la migración

Ejecutar `supabase/dashboard_09_roles_y_liderazgo.sql`:

- no asigna ni retira líderes al instalarse;
- no crea administradores;
- no modifica colaboradores, contratos o áreas;
- no reinicia PIN ni sesiones;
- no modifica asistencias;
- no toca certificados ni sus usuarios;
- crea una bitácora privada y dos RPC.

## Activación

1. Confirmar que `dashboard_08_admin_marcado.sql` está instalada.
2. Abrir el SQL Editor de Supabase.
3. Copiar y ejecutar todo `supabase/dashboard_09_roles_y_liderazgo.sql`.
4. Confirmar cuatro filas `OK`:

   - `tabla asis_roles_eventos`
   - `RLS asis_roles_eventos`
   - `dash_admin_roles`
   - `dash_admin_asignar_lider`

5. Publicar:

   - `dashboard.html`
   - `assets/css/paginas/dashboard.css`
   - `assets/js/dashboard.js`
   - `assets/js/dashboard-admin-roles.js`

6. Recargar con `Ctrl + F5`.
7. Entrar con la cuenta Administrador de sistemas y abrir
   **Gestión de asistencia → Roles y equipos**.

No se necesita cambiar `DASH_PIN_SECRET` ni desplegar las Edge Functions.

## Condición previa para ser líder

La persona debe haber ingresado al dashboard al menos una vez con DNI y PIN.
Ese primer ingreso crea su cuenta técnica y permite asociar el nivel `lider`.
Si aún no ingresó, el panel la muestra como pendiente y Supabase rechaza la
promoción con `sin_cuenta`.

## Piloto mínimo

1. Elegir un área de prueba y anotar su líder actual.
2. Asignar un colaborador activo con cuenta creada.
3. Cerrar sesión e ingresar con el DNI y PIN de esa persona.
4. Confirmar que ve Inicio, Mi asistencia, Mi perfil y Mi equipo.
5. Confirmar que Mi equipo solo contiene personas de su área.
6. Intentar abrir Gestión: debe rechazarse.
7. Reemplazar al líder y comprobar que el anterior vuelve a Colaborador.
8. Retirar el liderazgo y comprobar que el área queda vacante.
9. Confirmar que PIN, contrato e historial de ambos permanecen.
10. Revisar que los tres cambios aparezcan en la bitácora.
11. Probar una cuenta administrativa sin `colaborador_id`: debe ver Gestión,
    pero no Inicio, Mi asistencia, Mi perfil ni Mi equipo.

## Retorno operativo

Si la vista nueva falla, no realizar cambios manuales en `asis_perfiles` ni
intentar reemplazos parciales. Conservar la migración, suspender temporalmente
los cambios de liderazgo y corregir o volver a publicar el frontend. Las
asignaciones vigentes continúan funcionando porque la instalación no las
modifica.

No se debe volver a ejecutar `dashboard_03_cerrar_panel.sql`.
