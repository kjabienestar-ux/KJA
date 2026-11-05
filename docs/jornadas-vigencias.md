# Jornadas con vigencia — operación y activación

Estado: implementado y verificado localmente en KJA-028, 2026-11-04. **Piero informó la ejecución del SQL 132; capacidad y lectura real parcial verificadas en el portal. Sin despliegue de recursos locales comprobado ni prueba operativa completa.** Identificador de seguimiento: KJA-028. Diseño basado en la propuesta A de Colaboradores (KJA-027).

## Uso desde Colaboradores

Equipo muestra tarjetas por área, búsqueda, filtros y ficha. Informes mantiene su selección de personas independiente de los filtros del directorio. Áreas conserva sus operaciones y permisos. La ficha separa Resumen, Jornada, Contrato e Historial. Jornada distingue el horario vigente de hoy del próximo cambio programado; antes de su inicio sigue mostrando el anterior, aunque un jueves futuro ya esté programado en el calendario.

En Jornada, «Actualizar jornada» programa un principal y «Horario temporal» programa una excepción. Ambos flujos solicitan fechas, semana completa y motivo; luego presentan una revisión antes de confirmar. La fecha inicial mínima es mañana según el servidor, zona America/Lima. No se reemplaza una jornada que ya está transcurriendo.

| Regla | Principal | Temporal |
|---|---|---|
| Fin | Fecha inclusiva o «Fin indeterminado» | Fecha inclusiva obligatoria |
| Al vencer | Sin jornada exigible hasta otro principal | Retorna al principal vigente ese día |
| Semana | Sustituye los siete días desde su inicio | Sustituye los siete días durante el intervalo |
| Historial | Se conserva con motivo, autor y fechas | Se conserva, aunque haya vencido |

El fin de jornada principal no cambia automáticamente el estado activo ni el acceso de la persona. «Actualizar jornada» administra días, horas y modalidades: no sustituye una gestión completa de contratos, metas o documentos. No recalcula ni modifica horas previas, metas, saldos o marcas almacenadas. Las estimaciones y exigencias de fechas futuras sí usan la jornada aplicable.

Ejemplo: principal lunes–miércoles; temporal jueves–sábado del 9 al 21. Hasta el 8 rige el principal, del 9 al 21 el temporal y desde el 22 el principal vigente. Si se programó un principal nuevo desde el 16, el temporal sigue hasta el 21 y el 22 se aplica ese principal nuevo.

## Conservación y resolución por fecha

La primera programación guarda una copia de referencia de la configuración original en `asis_jornadas_base`. Cada acuerdo se registra en `asis_jornadas_vigencias`; no se sobrescribe la ficha histórica. Para una fecha se resuelve: temporal aplicable; de lo contrario, último principal iniciado; antes de la primera vigencia, configuración original y reglas anteriores. Un principal vencido sin sucesor devuelve todos los días sin gestión.

Los períodos nuevos tienen los siete días explícitos, incluidos los que no gestionan. El principal siguiente acota únicamente la parte futura del precedente. El pasado de las vigencias no se edita. Esto conserva la interpretación anterior a la nueva programación; **no reconstruye horarios históricos que ya se hayan sobrescrito antes de instalar esta función**.

Se adaptan las funciones de día laborable, entrada/salida, modalidad, vínculo y horas programadas; el libro mensual; calendario personal; directorio; horarios de compañeros y cierre de Mi equipo. Los envoltorios mantienen la autorización de sus funciones anteriores. El calendario personal reconoce las fechas versionadas para no recortarlas por el antiguo fin referencial del contrato. La ficha y la hoja de horarios exportada muestran la jornada actual; los detalles diarios siguen la fecha consultada.

La agenda de Facebook permanece independiente, incluso cuando antes heredaba días u horas del horario original. Guardar solo identidad ya no vuelve a guardar su agenda sin cambios. Los compañeros reciben períodos y semanas para consultar horarios; no reciben motivos ni autores administrativos.

## Validaciones y límites del primer alcance

- Sesión vigente y permiso existente de edición, también en servidor. Tablas privadas, sin escritura directa para usuarios del portal.
- Guardado atómico, bloqueo por persona y comprobación de versión. Una pantalla desactualizada obliga a recargar antes de guardar.
- Inicio futuro, fin ordenado, al menos un día con gestión, horas válidas con salida posterior a entrada. Nuevos turnos que cruzan medianoche no se admiten en este alcance; los anteriores se conservan.
- Principal con fin de hasta diez años; temporal de hasta 366 días. No se permiten temporales superpuestos ni un temporal fuera de la vigencia principal finalizada.
- Nuevos principales se agregan en orden cronológico. No se insertan por delante de otro principal ya programado ni se acorta un principal antes del fin de un temporal existente.
- Se rechaza una programación que afecte fechas con registros o ajustes puntuales SQL. Para principal se revisan también las fechas posteriores a su fin, porque el vencimiento cambia su condición laborable. Se protegen además excepciones de gestión posteriores a ese fin.
- La edición anterior de personas conserva identidad y condiciones documentales, pero no puede sobrescribir horario, vínculo o inicio histórico. El servidor rechaza cambios efectivos por clientes antiguos; una normalización equivalente conserva la representación original.
- No hay cancelación, edición retroactiva ni reconstrucción automática de acuerdos previos. Requieren un alcance posterior explícito. Las excepciones SQL existentes se mantienen y los conflictos se resuelven antes de programar.

## Activación y comprobación operativa

Estado comprobado en sesión de Piero: principal del 05/11 al 31/12, lunes a viernes 08:00–14:00; Mes completo reconoce el jueves 05/11 como programado. Solo lectura, sin modificar sus datos. Falta comprobar marcado y demás escenarios reales.

Archivo: `supabase/dashboard_132_jornadas_vigencias.sql`. Debe revisarse contra la base real, con respaldo y con la cadena de funciones previa instalada, incluida `dashboard_128_documento_contrato.sql` y los ajustes de horarios puntuales anteriores. El número 128 también existe en un script de traslado individual: no confundirlo con la dependencia de documento contractual.

1. Inventariar funciones desplegadas, permisos, modificaciones particulares y ajustes puntuales vigentes. Las pruebas locales usan PostgreSQL aislado con funciones reales seleccionadas y envoltorios de autorización simulados; no acreditan el esquema remoto completo.
2. Revisar y ejecutar el SQL 132 en un entorno de ensayo con esa cadena. El script es transaccional y admite una segunda aplicación sin volver a envolver las funciones. No omitir dependencias para forzar su ejecución.
3. Comparar antes/después, con sesiones autorizadas y sin permiso: meses anteriores, registros, evidencias, horas gestionadas, metas, saldos, agenda Facebook y exportaciones. Programar casos de principal finito, indeterminado y temporal, comprobando inicio, fin y día siguiente.
4. Publicar los recursos de interfaz y repetir la comprobación con datos de ensayo. `dash_admin_equipo` anuncia `jornadas_disponibles`; sin esa capacidad la interfaz mantiene deshabilitada la programación y explica la activación pendiente.

No ejecutar escrituras de ensayo sobre personas reales sin un caso acordado. La auditoría inicial y las pruebas automatizadas usan datos ficticios; la comprobación posterior de Piero fue de solo lectura en su sesión real. La revisión visual se limita a escritorio, conforme a la instrucción vigente de Piero.

## Evidencia local

`npm run test:colaboradores`: 58/58. `npm run test:calendario`: 26/26. Integración aislada: límites inclusivos, principal vencido e indeterminado, retorno temporal, vínculo mixto, permisos, conflicto de versión, compatibilidad puntual y conservación de datos. Auditoría visual y limitaciones: [KJA-028](revisiones/KJA-028-auditoria-colaboradores.md).
