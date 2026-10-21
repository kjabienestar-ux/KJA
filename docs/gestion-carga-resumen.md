# Carga del resumen operativo

El resumen esperaba nueve consultas de asistencia, solicitudes, cierres, equipo, mes, control y roles, además de la firma de fotos. Una consulta secundaria lenta mantenía el skeleton de toda la sección.

Ahora el primer render espera únicamente colaboradores activos, marcas de hoy y cierres de hoy. Las solicitudes de horario, solicitudes agrupadas y control diario se actualizan independientemente después. Las fotos tampoco bloquean ese render. Mes, equipo/contratos y roles se consultan al abrir sus secciones existentes; sus accesos muestran «Consultar» mientras no se solicitan esos cálculos.

Las entradas simultáneas comparten la carga principal. Cada consulta del resumen tiene un límite de 12 segundos para que un fallo permita reintentar. Las respuestas tardías comprueban versión de carga, cuenta, rol y acceso al panel. No se persisten datos del resumen en almacenamiento del navegador.

Mientras la revisión de evidencias está pendiente no se afirma «Todo bajo control». Un fallo secundario no oculta la asistencia ya disponible. No se modifican saldos, solicitudes ni registros de asistencia.

Validación: 19 pruebas locales de carga progresiva, solicitudes, gráficos y skeletons aprobadas con Node 22. Cubren consultas secundarias sin resolver, cargas duplicadas, cambio de cuenta, fallo y espera agotada del núcleo y render de estados parciales. No se midió la latencia de la sesión de producción; no se dispone de una sesión administrativa conectada. Esta entrega requiere publicar los archivos para cambiar el comportamiento del sitio público.

Comando:

```powershell
node --test tests/admin-overview-loading.test.mjs tests/overview-charts.test.mjs tests/dashboard-skeleton.test.mjs tests/leave-review.test.mjs
```
