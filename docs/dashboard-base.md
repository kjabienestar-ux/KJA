# Dashboard KJA — base de identidad y asistencia

**Estado:** desplegado en producción el 28 de agosto de 2026

## Alcance de esta primera entrega

Esta base permite que un colaborador que **ya tiene DNI y PIN** ingrese en
`/dashboard`, obtenga una sesión real de Supabase y use la asistencia existente
sin depender del enlace compartido de `marcar.html`.

Incluye:

- Entrada por DNI + PIN y sesión máxima de ocho horas.
- Cuenta técnica creada automáticamente la primera vez.
- Inicio personal con estado, horario y progreso de horas.
- Historial mensual y perfil laboral de solo lectura.
- Marcación autenticada con las reglas y evidencia actuales.
- Visibilidad de equipo para líderes y sistemas.
- Compatibilidad temporal con `marcar.html`.

Todavía no incluye activación o recuperación por correo. Quien no tenga PIN
debe crearlo desde el portal de marcado actual durante esta etapa.

## Flujo

```text
DNI + PIN
    │
    ▼
dash-entrar (Edge Function)
    ├── dash_validar_pin() ── asis_claves / bloqueo existente
    ├── crea o reutiliza auth.users
    ├── enlaza asis_perfiles.colaborador_id
    └── registra dash_sesiones (8 h)
             │
             ▼
        dashboard.html
    ├── dash_inicio()
    ├── dash_historial()
    ├── dash-evidencia → Storage privado
    └── dash_marcar() → asis_registros
```

Las políticas RLS conservan dos ejes independientes:

- `rol` y `acceso_panel`: edición en `asistencia.html`.
- `nivel`: lectura en el dashboard (`miembro`, `lider`, `sistemas`).

## Orden de despliegue

1. Ejecutar `dashboard_00_comprobacion.sql` y guardar el resultado.
2. Confirmar que `dashboard_01_identidad_y_roles.sql` y
   `dashboard_03_cerrar_panel.sql` ya fueron aplicados.
3. **No volver a ejecutar `dashboard_03_cerrar_panel.sql`** una vez que existan
   cuentas creadas desde el dashboard.
4. Ejecutar completo `dashboard_04_portal_asistencia.sql`.
5. Confirmar que las cuatro filas finales de la migración dicen `OK`.
6. Volver a ejecutar `dashboard_00_comprobacion.sql`; los totales de negocio
   deben coincidir con los del paso 1.
7. Configurar el secreto una sola vez:

   ```bash
   supabase secrets set DASH_PIN_SECRET="<cadena larga y aleatoria>"
   ```

8. Desplegar las dos funciones:

   ```bash
   npx supabase@latest functions deploy dash-entrar --project-ref xadxmfgdxwplmhijagix --use-api
   npx supabase@latest functions deploy dash-evidencia --project-ref xadxmfgdxwplmhijagix --use-api
   ```

   `supabase/config.toml` desactiva la comprobación JWT antigua solamente para
   `dash-entrar`, porque el proyecto usa una clave `sb_publishable_...` y la
   validación real de ese acceso es DNI + PIN. `dash-evidencia` conserva JWT.

9. Publicar la web. Vercel expone `dashboard.html` también como `/dashboard`.

## Activación de la fase 2 administrativa

Después de validar la base personal anterior:

1. Ejecutar completo `supabase/dashboard_05_admin_lista.sql` en el SQL Editor.
2. Confirmar que las cuatro filas finales dicen `OK`.
3. Publicar `dashboard.html`, `assets/js/dashboard.js` y
   `assets/css/paginas/dashboard.css` juntos para conservar sus versiones de
   caché.
4. Ingresar con una cuenta administrativa y abrir **Gestión de asistencia →
   Pasar lista**.
5. Comparar una fecha contra `asistencia.html?modo=lista` antes de usarlo como
   pantalla principal.

Esta fase no necesita un nuevo secreto ni volver a desplegar `dash-entrar` o
`dash-evidencia`. La migración crea funciones y una policy; no modifica marcas
existentes al ejecutarse.

## Activación de la fase 3 administrativa

Después de aplicar y validar `dashboard_05_admin_lista.sql`:

1. Ejecutar completo `supabase/dashboard_06_admin_equipo.sql`.
2. Confirmar que sus siete comprobaciones dicen `OK`.
3. Publicar juntos `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-equipo.js` y
   `assets/css/paginas/dashboard.css`.
4. Probar **Gestión → Colaboradores** y **Gestión → Contratos** primero con una
   ficha de prueba.

La fase 3 no requiere cambios en `DASH_PIN_SECRET` ni desplegar Edge Functions.
La migración no modifica colaboradores o contratos existentes al instalarse;
los cambios ocurren únicamente cuando un usuario autorizado guarda una ficha.

## Activación de la fase 4 administrativa

Después de aplicar y validar `dashboard_06_admin_equipo.sql`:

1. Ejecutar completo `supabase/dashboard_07_admin_mes.sql`.
2. Confirmar que sus cinco comprobaciones dicen `OK`.
3. Publicar juntos `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-equipo.js`, `assets/js/dashboard-admin-mes.js` y
   `assets/css/paginas/dashboard.css`.
4. Comparar un mes cerrado en **Mes completo** y **Resumen mensual** contra el
   panel anterior antes de editar feriados o excepciones.

La fase 4 no cambia secretos ni Edge Functions. Al instalarse solo crea
funciones e índices; no modifica asistencia, feriados ni colaboradores
existentes. Las escrituras ocurren después, cuando un usuario autorizado usa
un control de la interfaz.

## Activación de la fase 5 administrativa

Después de aplicar y validar `dashboard_07_admin_mes.sql`:

1. Ejecutar completo `supabase/dashboard_08_admin_marcado.sql`.
2. Confirmar que sus siete comprobaciones dicen `OK`.
3. Publicar juntos `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-equipo.js`, `assets/js/dashboard-admin-mes.js`,
   `assets/js/dashboard-admin-acceso.js` y
   `assets/css/paginas/dashboard.css`.
4. Ingresar como Dirección y abrir **Gestión → Marcado propio**.
5. Comparar los totales de PIN, bloqueados y avisos con el panel anterior.

La migración no cambia configuraciones, PIN, enlaces ni sesiones al instalarse.
Únicamente crea la bitácora privada y las RPC. No requiere cambiar
`DASH_PIN_SECRET` ni desplegar nuevamente las Edge Functions.

El enlace `/marcar` no debe cerrarse mientras existan personas sin PIN. El QR
oficial de la fase 5 apunta a `/dashboard`; el enlace anterior queda reservado
para activación inicial y contingencia.

## Activación de la fase 6 administrativa

Después de aplicar y validar `dashboard_08_admin_marcado.sql`:

1. Ejecutar completo `supabase/dashboard_09_roles_y_liderazgo.sql`.
2. Confirmar que sus cuatro comprobaciones dicen `OK`.
3. Publicar juntos `dashboard.html`, `assets/js/dashboard.js`,
   `assets/js/dashboard-admin-roles.js` y
   `assets/css/paginas/dashboard.css`.
4. Ingresar como Administrador de sistemas y abrir
   **Gestión → Roles y equipos**.
5. Probar primero con un área y una cuenta personal de prueba.

La migración no cambia líderes al instalarse. Tampoco modifica PIN, sesiones,
asistencias, contratos ni certificados. El cambio ocurre únicamente al
confirmar una asignación o retiro desde el nuevo módulo.

## Piloto mínimo

Antes de comunicarlo a todo el equipo, probar con cuatro casos:

1. Colaborador con DNI y PIN existentes: entra, consulta y marca.
2. Colaborador sin PIN: recibe la indicación de usar el flujo actual de alta.
3. Líder: solo ve personas de su área y no puede editar registros.
4. Dirección/sistemas: entra con correo y ve todas las áreas.

Verificar además:

- Cinco PIN incorrectos bloquean el acceso durante 15 minutos.
- Una sesión vencida deja de recibir datos aunque la pestaña siga abierta.
- Una fotografía queda bajo `AAAA/MM/<colaborador>/<fecha>.jpg`.
- Una segunda marca del mismo día responde `ya_marcado`.
- `marcar.html` continúa funcionando durante la transición.

## Operación segura

- `DASH_PIN_SECRET` no se guarda en Git y no debe rotarse sin un procedimiento
  para actualizar las contraseñas técnicas ya creadas.
- La clave `service_role` vive únicamente dentro de las Edge Functions.
- El dashboard nunca recibe la sal ni la huella del PIN.
- Las cuentas del dashboard nacen con `acceso_panel = false`.
- El plan gratuito de Storage requiere vigilar el crecimiento de evidencias y
  definir posteriormente una política de retención.
