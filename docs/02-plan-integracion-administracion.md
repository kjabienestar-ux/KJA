# Plan de integración — Administración de asistencia en Portal KJA

**Versión:** 0.1

**Fecha:** 26 de agosto de 2026
**Estado:** Integración desplegada; transición en observación

## 1. Decisión de arquitectura

`asistencia.html` no se insertará mediante `iframe` ni se copiará completo
dentro de `dashboard.html`. Es una aplicación monolítica con reglas de horario,
contrato, evidencia, excepciones y permisos que deben conservar una sola fuente
de verdad.

La integración se hará de manera progresiva:

```text
dashboard.html
├── Portal personal
│   ├── Inicio
│   ├── Mi asistencia
│   └── Mi perfil
└── Centro administrativo (solo acceso_panel)
    ├── Resumen operativo nativo
    ├── Pasar lista
    ├── Mes completo
    ├── Colaboradores
    ├── Contratos
    ├── Resumen
    └── Marcado propio
```

Las tablas, RPC y políticas RLS existentes se reutilizan. La navegación oculta
es solo una ayuda visual: la autorización definitiva continúa en Supabase.

## 2. Fases

### Fase 1 — Puerta administrativa y centro operativo

**Estado: implementada localmente**

- detectar `rol` y `acceso_panel` del usuario autenticado;
- mostrar Gestión de asistencia solo a cuentas autorizadas;
- rechazar aperturas internas sin permiso;
- mostrar indicadores y estado del día;
- mostrar solicitudes de horario pendientes;
- agregar accesos profundos a cada módulo vigente;
- validar `modo` en `asistencia.html`;
- exigir explícitamente `acceso_panel = true` en el panel vigente;
- mantener la columna personal fuera de la vista administrativa para ampliar el
  espacio de trabajo.

### Fase 2 — Pasar lista

**Estado: migración aplicada; pendiente de piloto**

- carga por fecha de áreas, colaboradores y registros mediante una RPC
  administrativa protegida;
- cálculo de días laborables, modalidad, horarios, horas y vínculo en el
  servidor reutilizando los helpers vigentes;
- registro y corrección de estados `P`, `T`, `J` y `NG` dentro del dashboard;
- conservación de notas y evidencias cuando se corrige una marca;
- consulta de evidencia mediante URL privada temporal;
- eliminación coordinada de marca y evidencia;
- modo de solo lectura para `visor` y edición para `editor`/`direccion`;
- búsqueda, filtro por área, navegación por fecha e indicadores operativos;
- actualización automática de la lista después de cada cambio;
- política de Storage endurecida para que un `visor` no pueda borrar fotos;
- migración preparada en `supabase/dashboard_05_admin_lista.sql`.

`asistencia.html?modo=lista` permanece como respaldo hasta aprobar esta fase.

### Fase 3 — Colaboradores y contratos

**Estado: migración aplicada; pendiente de piloto**

- alta, edición, baja lógica y reactivación sin eliminar asistencia;
- DNI normalizado de ocho dígitos y único; consulta del estado del PIN sin
  exponer sal ni huella;
- creación de áreas y asignación desde la ficha;
- horario semanal por día, modalidad, horas y vínculo para perfiles mixtos;
- contrato, fechas, metas, horas previas, estado pendiente y voluntariado;
- resumen contractual calculado en el servidor con horas cumplidas, faltantes,
  semana típica, alertas y término estimado;
- historial atómico de horario, horas, fechas, identidad y bajas lógicas;
- acceso de consulta para `visor` y escritura para `editor`/`direccion`;
- interfaces nativas de Colaboradores y Contratos dentro del dashboard;
- migración preparada en `supabase/dashboard_06_admin_equipo.sql`.

`asistencia.html?modo=horarios` y `asistencia.html?modo=contratos` permanecen
como respaldo hasta aprobar esta fase.

### Fase 4 — Mes completo y resumen

**Estado: migración aplicada; pendiente de piloto**

- grilla mensual nativa con nombre y cabecera fijos, detalle por celda y
  señalización de marcas, días no laborables, preinicio, feriados, excepciones
  y evidencias;
- navegación mensual, búsqueda, filtro por área e inclusión opcional de bajas;
- administración de feriados y excepciones personales protegida por rol;
- creación, corrección y retiro de estados reutilizando las RPC de la fase 2;
- resumen mensual por persona con `P`, `T`, `J`, `NG`, programados, pendientes,
  horas y porcentaje histórico de asistencia;
- exportaciones CSV de detalle y resumen respetando los filtros visibles;
- consulta consolidada en una RPC e índices de apoyo para evitar N+1 al crecer;
- migración preparada en `supabase/dashboard_07_admin_mes.sql`.

`asistencia.html?modo=grilla` y `asistencia.html?modo=resumen` permanecen como
respaldo hasta aprobar esta fase.

### Fase 5 — Marcado propio y cierre de transición

**Estado: migración aplicada; pendiente de publicación y piloto final**

- centro nativo de acceso, PIN y marcado propio dentro del dashboard;
- ruta oficial del dashboard separada del enlace anterior de activación;
- QR descargable del Portal KJA para inducciones y piezas internas;
- configuración de tolerancia, evidencia obligatoria y disponibilidad del
  enlace anterior;
- regeneración explícita del enlace sin modificar PIN, cuentas o asistencias;
- directorio de PIN configurados, pendientes, bloqueos, DNI y primer ingreso;
- reinicio de PIN con revocación de sesiones personales vigentes;
- avisos de horario con acceso directo a la ficha y resolución auditada;
- bitácora privada de configuración, regeneraciones, reinicios y resoluciones;
- autorización visual y de servidor limitada al rol `direccion`;
- migración preparada en `supabase/dashboard_08_admin_marcado.sql`;
- regresión y criterios de cierre documentados sin retirar aún el panel anterior.

`asistencia.html` y `marcar.html` permanecen como contingencia. La primera solo
se retirará tras el piloto final; la segunda conserva por ahora el alta inicial
del PIN y no debe desactivarse mientras existan personas sin PIN.

### Fase 6 — Roles, liderazgo y navegación adaptativa

**Estado: implementada localmente; pendiente de migración, publicación y piloto**

- tres roles visibles: Administrador de sistemas, Líder técnico y Colaborador;
- menú personal condicionado a la existencia de un colaborador vinculado;
- Mi equipo reservado al líder técnico, sin duplicarlo para Sistemas;
- Gestión separada para cuentas con acceso administrativo;
- mapa de áreas con líder actual, vacantes, cuentas activadas y alertas;
- asignación, reemplazo y retiro atómicos de un líder por área;
- exigencia de cuenta personal activa antes de promover a una persona;
- preservación de PIN, contrato, asistencia e identidad al retirar liderazgo;
- bitácora privada de cambios de rol;
- migración preparada en `supabase/dashboard_09_roles_y_liderazgo.sql`.

La creación de administradores de sistemas continúa siendo una operación
controlada en Supabase. Esta fase administra el liderazgo de colaboradores,
pero no permite que un líder se promueva a sí mismo ni que cree administradores.

## 3. Reglas que no deben duplicarse

1. Cálculo de día laborable y modalidad.
2. Ventana de marcado y tolerancia.
3. Clasificación de presente y tardanza.
4. Una asistencia por persona y día.
5. Cálculo y congelamiento de horas por registro.
6. Distribución de prácticas y voluntariado.
7. Excepciones por feriado, permiso o día adicional.
8. Permisos de lectura y edición por rol.
9. Evidencia privada y permisos firmados.
10. Proyección de contratos y horas pendientes.

Cuando una regla ya exista en SQL debe consumirse desde allí. Si hoy solo vive
en JavaScript, debe extraerse a un módulo compartido o moverse al backend antes
de crear una segunda implementación.

## 4. Seguridad

- `acceso_panel` autoriza la entrada al dominio administrativo.
- `rol` define si la cuenta es `visor`, `editor` o `direccion`.
- `nivel` sigue controlando la visibilidad personal por área en el dashboard.
- Las cuentas creadas con DNI + PIN conservan `acceso_panel = false`.
- Conocer la URL o alterar el HTML no concede permisos en la base.
- Marcado propio continúa reservado para Dirección.

## 5. Estrategia de pruebas por módulo

Cada módulo migrado debe aprobar:

1. comparación de conteos con `asistencia.html`;
2. prueba de visor, editor y Dirección;
3. intento directo sin `acceso_panel`;
4. prueba en escritorio y móvil;
5. altas, cambios y errores de red;
6. verificación de que no se alteraron certificados;
7. retorno operativo al módulo anterior si aparece una regresión.

## 6. Criterio para retirar `asistencia.html`

El panel anterior solo podrá retirarse cuando todos sus módulos tengan
equivalente funcional en el dashboard, las pruebas comparativas no encuentren
diferencias, exista respaldo reciente y Dirección apruebe el cambio. Hasta ese
momento funciona como contingencia, no como código para duplicar.
