# Cuentas administrativas — KJA-037

## Decisiones confirmadas

Dos superadministradores personales, inicialmente Piero y Yeiser. La designación es independiente de Ingeniería y de `nivel=sistemas`. Cada titular delega únicamente su propio puesto a otro administrador activo; la sustitución es atómica y exige contraseña actual. No puede suspenderse ni archivarse a un titular antes de delegar. El otro superadmin tampoco puede quitarle el puesto desde el panel.

Se reutiliza la composición del directorio de certificados con la estética cálida de Dirección. Menú debajo de Reclutamiento, dos responsables, buscador, cuentas activas, suspendidas/archivadas e historial de las últimas 50 operaciones. Solo diseño y validación de escritorio.

No hay eliminación física. Archivar exige suspensión previa y escribir el correo. Restaurar deja la cuenta suspendida; reactivarla requiere otra acción. Se conservan UUID, perfil, vínculo laboral y autorías. El estado de acceso administrativo vive en `kja_admin.estados`, sin dar de baja al colaborador ni suspender certificados.

Creación: nombre, correo, rol existente (`visor` predeterminado), contraseña inicial y motivo. La incorporación de una identidad Auth existente exige confirmar su UUID después de comprobar a la persona; no cambia su contraseña. No convierte perfiles existentes ni cuentas técnicas `@interno.kja`. El frontend no concede Sistemas por sí mismo; las nuevas cuentas del panel reciben el alcance administrativo existente en servidor, independiente de los dos puestos.

Restablecimiento directo sin correo, sin anunciar contraseña temporal ni cambio obligatorio. Mínimo 12 caracteres y máximo 72 bytes UTF-8; Auth conserva la validación final del proyecto. El titular recibe su clave por un canal privado y puede cambiarla en su perfil. La clave afecta a todos los módulos que compartan el UUID.

## Implementación y seguridad

- Migración `supabase/migrations/20261113150435_cuentas_administrativas_kja037.sql`: esquema privado con RLS, dos puestos, estados y operaciones; instala el módulo deshabilitado y sin titulares.
- `dash_es_superadmin()` es la capacidad del cliente. `dash_arranque()` también la incluye; `dash_admin_cuentas()` entrega directorio e historial solo a los dos designados.
- `admin-cuentas` verifica `auth.getUser()` y la capacidad antes de usar la clave de servicio. Las RPC de mutación/búsqueda/auditoría solo son ejecutables por `service_role`; actor y sesión proceden del token verificado, nunca del cuerpo. Todas las mutaciones serializan mediante el bloqueo de configuración y comprueban nuevamente la designación y la sesión real.
- Una restricción diferida mantiene exactamente dos titulares activos y distintos al finalizar cada transacción. Protege puestos, configuración, estados, perfiles y Auth. Solo un custodio externo puede intervenir fuera de la delegación ordinaria.
- Se retira la escritura directa de `asis_perfiles`; un trigger bloquea también RPC antiguas que intenten modificar perfiles administrativos. La escritura de colaboradores sin acceso administrativo conserva sus RPC existentes.
- `asis_es_miembro`, `asis_rol`, `dash_nivel` y `dash_sesion_vigente` hacen cumplir estados y sesiones reales. Reclutamiento, Zoom y gestión de certificados también comprueban el acceso administrativo efectivo. Ranking, reporte Facebook y calendario de asignaciones conservan sus cálculos en funciones privadas con una entrada pública protegida. Marketing conserva sus reglas personales pero bloquea los privilegios de la cuenta administrativa suspendida. Una cuenta suspendida con colaborador asociado puede volver a iniciar sesión para sus funciones personales con alcance `miembro`.
- `cert-cuentas` rechaza cambios/recuperaciones de contraseñas de identidades administrativas y dirige al nuevo apartado, incluso para un superadmin: hay una sola ruta auditada.
- El restablecimiento reserva una operación, ejecuta `auth.admin.updateUserById` y concilia el resultado. Auth revoca sus sesiones en la actualización de contraseña; adicionalmente se verifica `auth.sessions` y un corte de sesión en servidor. No se escriben tablas de Auth manualmente. Las sesiones antiguas no recuperan privilegios mediante refresh.
- Si falla la red durante un cambio de clave, queda un estado pendiente visible. Otro superadmin puede reintentar después de tres minutos. Un cierre incierto puede requerir al custodio; no se anuncia éxito sin conciliación. Solo la reserva exacta puede completarse, aunque el cambio haya revocado la sesión del propio actor.
- Se auditan campos seleccionados (actor, destino, motivo, acción, antes/después, fecha de servidor, resultado). Contraseñas y tokens no se envían a SQL ni se guardan en almacenamiento del navegador. Los campos se vacían al terminar o cerrar el diálogo.
- Alta Auth y perfil son operaciones separadas: si falla el perfil, la identidad se conserva sin acceso administrativo. Se retoma buscando el correo y confirmando explícitamente la identidad; no se elimina ni duplica automáticamente.
- El cliente limpia datos al salir/cambiar de sesión, descarta respuestas tardías y comprueba permisos al volver a la pestaña y cada 30 segundos mientras está visible. Esta actualización visual no reemplaza los controles de servidor.

Referencia oficial consultada el 13/11/2026: [actualización administrativa de usuario](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [sesiones](https://supabase.com/docs/guides/auth/sessions) y [implementación Auth UpdatePassword](https://github.com/supabase/auth/blob/master/internal/models/user.go). La versión realmente desplegada y su revocación se validan nuevamente en piloto.

## Activación posterior a revisión

No ejecutar estos pasos durante una entrega local:

1. Revisar cambios y aplicar primero en un entorno aislado con el esquema vigente, incluidos certificados, Marketing, ranking, reportes, Zoom y Reclutamiento. Se contrastó su presencia en producción por lectura. Las pruebas PGlite no sustituyen al gateway Auth real ni a una prueba de concurrencia en PostgreSQL desplegado.
2. Confirmar de nuevo las identidades por lectura. El 13/11 se contrastaron Piero (`piero69@kja.com`) y Yeiser (`yeiser69@gmail.com`), ambos activos, confirmados y con acceso administrativo. Yeiser también tiene una cuenta técnica separada para el colaborador 29; no se utiliza como titular ni se modifica.
3. Aplicar la migración aditiva y desplegar **ambas** funciones, `admin-cuentas` y `cert-cuentas`. Usan las variables de Supabase en servidor; no añadir secretos al frontend. Comprobar grants, RLS y asesores de seguridad. El módulo sigue sin designaciones y cerrado.
4. Ejecutar de forma explícita `supabase/operaciones/KJA-037-activar-superadmins.sql`. Valida UUID/correo/actividad/confirmación y falla si ya existe una designación. No recrea personas ni modifica claves.
5. Probar sesiones reales de ambos titulares y de un administrador no designado. Probar el bloqueo de la ruta de certificados para una identidad compartida.
6. Publicar HTML, JS y CSS juntos. Piloto con cuenta de ensayo: crear, restablecer, volver a entrar, suspender, archivar, restaurar y reactivar. Delegación con sucesor de ensayo y retorno, verificando siempre dos puestos. Comprobar los JWT emitidos antes de suspensión/cambio de clave y los reintentos simultáneos.

## Emergencia y reversión

Si ambos titulares pierden acceso, Piero o el custodio de Supabase que él designe debe verificar identidad por un canal institucional, recuperar la cuenta en Auth o sustituir un titular. La plantilla `supabase/operaciones/KJA-037-recuperacion-emergencia.sql` no ejecuta nada hasta completar UUID saliente/sucesor y motivo; mantiene dos puestos y audita la intervención. No concede un tercer permiso. Si ambos están inaccesibles se recuperan/reemplazan sucesivamente, sin borrar perfiles ni cambiar registros laborales.

Para deshabilitar la nueva gestión: `update kja_admin.config set habilitado=false where id;` desde el custodio. Ocultar el menú/publicar la versión anterior si es necesario. Mantener los estados y los controles de seguridad: no reinstalar las políticas antiguas de escritura de perfiles, no borrar historial, no deshacer contraseñas ni habilitar suspendidos automáticamente.

## Verificación local

Regresión final 13/11: **111/111** pruebas combinadas aprobadas, incluidas 53 de Marketing con su fixture actualizado al comportamiento vigente. Se corrigió la comparación TEXT/UUID de la sesión DNI/PIN tanto en la migración preparada como en el entorno aislado. Ensayo PostgreSQL/Auth/Storage/Edge real aprobado para ingreso DNI/PIN, consultas personales, subida/lectura privada y registro de entrada ficticia; resultados en `output/kja-037/collaborator-e2e.json` y `regression-final.txt`. El aviso estático de eliminación heredada no se reprodujo en una ejecución local revertida. Estos resultados sustituyen los pendientes de regresión descritos al inicio de la validación; no acreditan todos los casos posibles ni activación remota. Siguiente paso: aprobación de Piero para activación controlada.

El 13/11/2026 se completó además la instalación en un entorno Supabase **aislado en Docker**, API `http://127.0.0.1:56321`. Se importaron por lectura las definiciones del esquema público vigente sin registros reales y se aplicó la migración; se cargaron ambas Edge Functions. Se utilizaron exclusivamente identidades ficticias y dos puestos de ensayo. Ocho escenarios con PostgreSQL/Auth/Edge reales aprobados: capacidad, rechazo de terceros, directorio, estados, restablecimiento sin correo y bloqueo de sesiones anteriores, alta/duplicados, delegación simultánea y auditoría. Resultados en `output/kja-037/staging-results.json`; límites y siguiente acción en KJA-037. No acredita activación remota ni la regresión completa de otros módulos.

Lint del esquema privado sin errores; RLS y grants verificados. Los asesores locales detectaron nueve avisos del esquema heredado (seis funciones sin search_path fijo y tres políticas permisivas), sin avisos sobre los objetos nuevos de cuentas; detalle en `output/kja-037/staging-security-advisors.json`. Su revisión no equivale a una auditoría total del producto. Configuración y credenciales locales en `.tmp/`, excluidas de Git. El dashboard habitual en 4173 conserva su conexión original. Revisión visual autenticada completada en Codex: quince vistas habituales y Cuentas administrativas con backend aislado en 4174; informe en `output/kja-037/revision-visual-autenticada.md`. Pendiente la regresión completa con la migración nueva.

- `node --test tests/admin-accounts-sql.test.mjs tests/admin-accounts-edge.test.mjs tests/cert-accounts.test.mjs tests/admin-password.test.cjs tests/admin-mode.test.mjs`
- `node tests/admin-accounts-browser.cjs`: Edge headless, sección y sidebar reales con transporte simulado y datos ficticios; 1280, 1366 y 1440 px. Cubre alta, identidad, contraseñas no coincidentes, cierre y foco, suspensión, doble confirmación de archivo, restauración, errores/reintento y menú sin permiso. También prueba arranque y navegación desde el dashboard completo; los módulos ajenos reciben respuestas genéricas de ensayo.
- Capturas y resultado: `output/kja-037/`. No acreditan una sesión Supabase real. No se valida móvil en esta tarea.
