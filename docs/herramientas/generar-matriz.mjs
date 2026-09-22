import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(docs);
const spec = fs.readFileSync(path.join(docs, '01-requerimientos-portal-asistencia.md'), 'utf8');
const sequenceDoc = fs.readFileSync(path.join(docs, '20-diagramas-secuencia-administracion.md'), 'utf8');
const sources = {
  acceso: ['supabase/functions/dash-entrar/index.ts', 'supabase/dashboard_01_identidad_y_roles.sql', 'assets/js/dashboard.js'],
  personal: ['assets/js/dashboard.js', 'supabase/dashboard_04_portal_asistencia.sql', 'supabase/dashboard_19_cierre_jornada.sql'],
  marcado: ['assets/js/dashboard.js', 'supabase/dashboard_12_marcado_blindado.sql', 'supabase/dashboard_13_modalidad_y_geocerca.sql', 'supabase/dashboard_42_entrada_y_salida_tardia.sql'],
  permisos: ['supabase/dashboard_01_identidad_y_roles.sql', 'supabase/dashboard_03_cerrar_panel.sql', 'assets/js/dashboard.js'],
  compatibilidad: ['vercel.json', 'supabase/dashboard_13_modalidad_y_geocerca.sql', 'docs/07-regresion-cierre-transicion.md'],
  lista: ['assets/js/dashboard.js', 'supabase/dashboard_05_admin_lista.sql'],
  equipo: ['assets/js/dashboard-admin-equipo.js', 'supabase/dashboard_06_admin_equipo.sql', 'supabase/dashboard_66_institucion_colaborador.sql'],
  mes: ['assets/js/dashboard-admin-mes.js', 'supabase/dashboard_07_admin_mes.sql', 'supabase/dashboard_69_alviery_cierre_mensual.sql'],
  configuracion: ['assets/js/dashboard-admin-acceso.js', 'supabase/dashboard_08_admin_marcado.sql', 'supabase/dashboard_12_marcado_blindado.sql', 'supabase/dashboard_14_mapa_oficina_auditable.sql'],
  roles: ['assets/js/dashboard-admin-roles.js', 'supabase/dashboard_09_roles_y_liderazgo.sql', 'supabase/dashboard_51_colideres_tecnicos.sql'],
  solicitudes: ['assets/js/dashboard.js', 'supabase/dashboard_10_fotos_perfil.sql', 'supabase/dashboard_11_solicitudes_personales.sql', 'supabase/dashboard_18_dias_libres.sql'],
  cierre: ['assets/js/dashboard-close-model.js', 'assets/js/dashboard.js', 'supabase/dashboard_19_cierre_jornada.sql', 'supabase/dashboard_36_cierre_automatico_por_evidencia.sql', 'supabase/dashboard_46_conservar_salida_con_pendientes.sql', 'supabase/dashboard_70_rpe_presencial.sql'],
  archivos: ['supabase/functions/dash-entrega/index.ts', 'supabase/dashboard_27_video_corto.sql', 'supabase/dashboard_28_edicion_evidencias_jornada.sql', 'supabase/dashboard_55_documentos_asignaciones.sql'],
  excepciones: ['supabase/dashboard_61_jornadas_justificadas.sql', 'supabase/dashboard_68_alviery_asistencia_comparticiones.sql', 'supabase/dashboard_69_alviery_cierre_mensual.sql', 'supabase/dashboard_70_rpe_presencial.sql'],
  facebook: ['assets/js/facebook-receipt.js', 'supabase/dashboard_48_separar_jornada_y_comparticiones.sql', 'supabase/dashboard_49_vencimiento_comparticiones.sql', 'supabase/dashboard_62_compartir_comprobante.sql', 'supabase/dashboard_63_eliminar_imagen_facebook.sql', 'docs/23-eliminar-imagenes-facebook.md'],
  asignaciones: ['assets/js/dashboard-assignments.js', 'supabase/dashboard_24_sorteo_entregables.sql', 'supabase/dashboard_56_calendario_asignaciones.sql', 'supabase/dashboard_58_eliminar_archivos_asignaciones.sql'],
  supervision: ['assets/js/dashboard-admin-cierre.js', 'assets/js/dashboard-admin-control.js', 'supabase/dashboard_21_revision_evidencias.sql', 'supabase/dashboard_25_impedimentos_cierre.sql', 'supabase/dashboard_34_notificaciones_revision.sql', 'supabase/dashboard_37_carga_evidencias_direccion.sql', 'supabase/dashboard_70_rpe_presencial.sql'],
  ranking: ['assets/js/dashboard-ranking.js', 'assets/js/ranking-model.js', 'supabase/dashboard_70_rpe_presencial.sql', 'docs/21-ranking-mensual.md'],
  reportes: ['assets/js/dashboard-facebook-report.js', 'assets/js/facebook-report-model.js', 'assets/js/facebook-report-excel.js', 'assets/js/facebook-report-pdf.js', 'supabase/dashboard_65_reporte_facebook_hoy.sql', 'docs/24-reportes-facebook.md'],
  chat: ['assets/js/dashboard-chat.js', 'assets/js/chat-images.js', 'supabase/chat_01_mensajes.sql', 'supabase/chat_06_realtime_eventos.sql', 'supabase/chat_07_imagenes.sql', 'docs/chat-imagenes.md'],
  marketing: ['assets/js/dashboard-marketing.js', 'assets/js/marketing-model.js', 'supabase/functions/marketing-publicaciones/index.ts', 'supabase/marketing_02_gemini_cache.sql', 'docs/18-publicaciones-marketing.md'],
  calidad: ['docs/01-requerimientos-portal-asistencia.md', 'docs/07-regresion-cierre-transicion.md', 'package.json'],
};
const testSources = {
  marcado: ['tests/geolocation.test.mjs'],
  equipo: ['tests/person-profile.test.mjs'],
  mes: ['tests/alviery-month-sql-check.mjs'],
  cierre: ['tests/dashboard-close.test.mjs', 'tests/exit-work-order.test.mjs'],
  archivos: ['tests/assignment-documents.test.mjs'],
  excepciones: ['tests/rpe-presencial.test.mjs', 'tests/attendance-sharing-only.test.mjs', 'tests/justified-close.test.mjs'],
  facebook: ['tests/facebook-receipt.test.mjs', 'tests/facebook-delete.test.mjs'],
  asignaciones: ['tests/assignment-panel.test.mjs', 'tests/assignment-delete.test.mjs'],
  supervision: ['tests/dashboard-close.test.mjs'],
  ranking: ['tests/ranking.test.mjs', 'tests/ranking-cumplimiento-sql-check.mjs'],
  reportes: ['tests/facebook-report.test.mjs', 'tests/facebook-pdf.test.mjs'],
  chat: ['tests/chat.test.mjs', 'tests/chat-images.test.mjs'],
  marketing: ['tests/marketing.test.mjs', 'tests/marketing-gemini.test.mjs'],
};
const seqIds = [...sequenceDoc.matchAll(/^## (DS-\d{3})\./gm)].map(m => m[1]);
const plantDoc = fs.readFileSync(path.join(docs, '21-diagramas-secuencia-administracion-plantuml.md'), 'utf8');
const plantIds = [...plantDoc.matchAll(/^## (DS-\d{3})\./gm)].map(m => m[1]);
if (JSON.stringify(seqIds) !== JSON.stringify(plantIds)) throw new Error('Mermaid y PlantUML tienen IDs diferentes');
const mermaidBlocks = [...sequenceDoc.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map(m => m[1]);
const plantBlocks = [...plantDoc.matchAll(/```plantuml\r?\n([\s\S]*?)```/g)].map(m => m[1]);
if (mermaidBlocks.length !== seqIds.length || plantBlocks.length !== seqIds.length) throw new Error('Faltan bloques de secuencia');
for (let i = 0; i < mermaidBlocks.length; i++) {
  const participants = new Set();
  const stack = [];
  const messages = [];
  for (const rawLine of mermaidBlocks[i].split('\n')) {
    const line = rawLine.trim();
    const declaration = line.match(/^(?:actor|participant) (\w+) as /);
    if (declaration) participants.add(declaration[1]);
    if (/^(alt|opt|loop|par)\b/.test(line)) stack.push(line.split(' ')[0]);
    if (/^else\b/.test(line) && !['alt', 'par'].includes(stack.at(-1))) throw new Error(`else inválido: ${seqIds[i]}`);
    if (line === 'end' && !stack.pop()) throw new Error(`end sin apertura: ${seqIds[i]}`);
    const message = line.match(/^(\w+)(--?>>)(\w+):\s*(.*)$/);
    if (message) {
      if (!participants.has(message[1]) || !participants.has(message[3])) throw new Error(`Participante no declarado: ${seqIds[i]}`);
      messages.push(`${message[1]}:${message[3]}:${message[4]}`);
    }
  }
  if (stack.length) throw new Error(`Ramas sin cerrar: ${seqIds[i]}`);
  const mirrored = [...plantBlocks[i].matchAll(/^(\w+)\s+--?>\s+(\w+):\s*(.*)$/gm)].map(m => `${m[1]}:${m[2]}:${m[3].trim()}`);
  if (JSON.stringify(messages) !== JSON.stringify(mirrored)) throw new Error(`Mensajes distintos entre formatos: ${seqIds[i]}`);
}
const seq = (...numbers) => numbers.map(n => `DS-${String(n).padStart(3, '0')}`);
const sourceLink = (file) => `[${file}](../${file})`;
function mapping(type, n) {
  if (type === 'RNF') {
    if (n === 69 || n === 78) return ['excepciones', seq(4, 17, 18)];
    if (n === 70) return ['archivos', seq(8, 16)];
    if (n === 71) return ['calidad', seq(20, 21)];
    if (n === 72) return ['archivos', seq(4, 6, 13, 20, 21)];
    if (n === 73) return ['chat', seq(20)];
    if (n === 74) return ['calidad', seq(19, 20)];
    if (n === 75 || n === 76) return ['marketing', seq(21)];
    if (n === 77) return ['reportes', seq(19)];
    if (n === 80) return ['marcado', seq(13)];
    if (n >= 79) return ['calidad', []];
    if (n <= 12) return ['acceso', seq(12, 13)];
    if (n <= 17) return ['calidad', []];
    if (n <= 22) return ['marcado', seq(13)];
    if (n <= 51) return ['calidad', []];
    if (n === 52) return ['supervision', seq(2, 5, 9, 10, 11)];
    if (n <= 56) return ['mes', seq(3, 19)];
    if (n <= 61) return ['configuracion', seq(10)];
    if (n === 62) return ['compatibilidad', []];
    return ['roles', seq(1, 11)];
  }
  if ([15, 63].includes(n)) return ['calidad', []];
  if (n === 126 || n === 130 || n === 131) return ['marcado', seq(13, ...(n === 130 ? [10] : []))];
  if (n === 127) return ['solicitudes', seq(14)];
  if (n === 128 || n === 129) return ['solicitudes', seq(15)];
  if (n === 164) return ['equipo', seq(9)];
  if (n <= 15) return ['acceso', seq(12)];
  if (n <= 24) return ['personal', seq(14)];
  if (n <= 40) return ['marcado', seq(13)];
  if (n <= 46) return ['personal', seq(14)];
  if (n <= 48) return ['configuracion', seq(10)];
  if (n <= 57) return ['permisos', seq(1)];
  if (n <= 63) return ['compatibilidad', []];
  if (n <= 70) return ['permisos', seq(1)];
  if (n <= 78) return ['lista', seq(2)];
  if (n <= 90) return ['equipo', seq(9)];
  if (n <= 101) return ['mes', seq(3)];
  if (n <= 113) return ['configuracion', seq(10)];
  if (n <= 118) return ['roles', seq(1, 11)];
  if (n <= 124) return ['roles', seq(11)];
  if (n === 125) return ['roles', seq(11, 14)];
  if (n <= 136) return ['cierre', seq(4, 6)];
  if (n <= 139) return ['archivos', seq(4, 5, 6)];
  if (n <= 143) return ['excepciones', seq(4, 6, 17)];
  if (n <= 147) return ['facebook', seq(16, ...(n === 144 ? [17] : []))];
  if (n <= 150) return ['asignaciones', seq(7)];
  if (n === 151) return ['asignaciones', seq(8)];
  if (n === 152) return ['supervision', seq(5)];
  if (n === 153) return ['supervision', seq(6)];
  if (n <= 156) return ['supervision', seq(22, ...(n >= 155 ? [5] : []))];
  if (n <= 159) return ['ranking', seq(18, ...(n === 158 ? [17] : []))];
  if (n <= 163) return ['reportes', seq(19)];
  if (n <= 169) return ['chat', seq(20)];
  if (n <= 175) return ['marketing', seq(21)];
  throw new Error(`Falta asociación para ${type}-${n}`);
}

const rows = [];
for (const line of spec.split('\n')) {
  if (!/^\| (RF|RNF)-\d{3} \|/.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map(s => s.trim());
  const [id, requirement] = cells;
  const [type, number] = id.split('-');
  const [module, sequences] = mapping(type, Number(number));
  const functional = type === 'RF';
  const criterion = cells[functional ? 4 : 2];
  if (!criterion) throw new Error(`Falta criterio para ${id}`);
  rows.push({ id, type, requirement, criterion, module, sequences,
    priority: functional ? cells[2] : 'Por ratificar',
    state: functional ? cells[3] : 'Objetivo; cumplimiento por verificar' });
}
const unique = new Set(rows.map(r => r.id));
if (unique.size !== rows.length) throw new Error('Requisitos duplicados');
for (const type of ['RF', 'RNF']) {
  const matching = rows.filter(r => r.type === type);
  matching.forEach((r, i) => {
    if (r.id !== `${type}-${String(i + 1).padStart(3, '0')}`) throw new Error(`Secuencia de IDs incompleta: ${r.id}`);
  });
}
for (const list of [...Object.values(sources), ...Object.values(testSources)]) {
  for (const file of list) if (!fs.existsSync(path.join(root, file))) throw new Error(`Fuente inexistente: ${file}`);
}
for (const r of rows) for (const id of r.sequences) if (!seqIds.includes(id)) throw new Error(`Diagrama inexistente: ${id}`);

let output = `# Matriz de requerimientos y trazabilidad — Portal KJA

**Versión:** 1.0 · **Fecha:** 22/09/2026 · **Estado:** propuesta para revisión.

Fuente normativa: [requerimientos](01-requerimientos-portal-asistencia.md).
Flujos: [Mermaid](20-diagramas-secuencia-administracion.md) y
[PlantUML](21-diagramas-secuencia-administracion-plantuml.md).

La matriz contiene **${rows.filter(r => r.type === 'RF').length} RF y ${rows.filter(r => r.type === 'RNF').length} RNF**, sin renumerar la base previa.
Cada fila identifica requisito, prioridad, estado documental, fuente por módulo,
diagrama relacionado y caso de aceptación. El criterio AC reproduce el criterio
de la especificación para que la matriz pueda revisarse de forma independiente.

**Verificación de todos los casos: pendiente de ejecución y acta.** Esta revisión
comprueba consistencia documental y referencias locales. Código local no significa
desplegado; Base previa no significa revalidado. Los archivos de pruebas listados
son candidatos por módulo, no evidencia de que cubran o aprueben cada fila.

**N/A** en secuencia indica objetivo transversal, compatibilidad o función futura:
su verificación se realiza por inspección, auditoría o prueba específica. Una
secuencia relacionada aporta contexto; no demuestra que cada regla esté implementada.
HU, CU, sprint, responsable nominal y fecha comprometida quedan sin asignar hasta
la siguiente etapa de planificación y validación con el equipo.

## Fuentes por módulo

Los vínculos de cada fila apuntan a estos grupos. Las migraciones posteriores
pueden reemplazar funciones de las anteriores: leer la cadena y la versión 70
cuando aplique, sin volver a ejecutar todos los SQL indiscriminadamente.

`;
for (const [module, files] of Object.entries(sources)) {
  output += `### ${module}\n\nFuente de implementación o documento de referencia: ${files.map(sourceLink).join(', ')}.\n\n`;
  output += testSources[module] ? `Pruebas locales relacionadas disponibles: ${testSources[module].map(sourceLink).join(', ')}. No ejecutadas en esta revisión documental.\n\n` : 'Validación: inspección y pruebas de aceptación por preparar/ejecutar; no se acredita cobertura automática individual.\n\n';
}
for (const type of ['RF', 'RNF']) {
  output += `## ${type === 'RF' ? 'Requerimientos funcionales' : 'Requerimientos no funcionales'}\n\n`;
  output += '| ID | Requerimiento | Prioridad | Estado documental | Fuente | Secuencia | Caso de aceptación pendiente |\n|---|---|---|---|---|---|---|\n';
  for (const r of rows.filter(r => r.type === type)) {
    output += `| ${r.id} | ${r.requirement} | ${r.priority} | ${r.state} | [${r.module}](#${r.module}) | ${r.sequences.join(', ') || 'N/A'} | **AC-${r.id}:** ${r.criterion} |\n`;
  }
  output += '\n';
}
output += '## Relación inversa: secuencia → requerimientos\n\n| Secuencia | Requerimientos relacionados |\n|---|---|\n';
for (const id of seqIds) output += `| ${id} | ${rows.filter(r => r.sequences.includes(id)).map(r => r.id).join(', ')} |\n`;
output += `
## Registro de validación por completar

Usar una fila por ejecución; conservar fallos y reejecuciones para auditoría.

| Caso AC-RF/AC-RNF | Entorno y versión | Ejecutor | Fecha | Resultado esperado | Resultado real | Evidencia o incidencia |
|---|---|---|---|---|---|---|
| Por asignar | Por registrar | Por asignar | Pendiente | Criterio de la fila | No ejecutado | Pendiente |

Para RNF de rendimiento medir p95 con carga y red descritas; para seguridad
probar llamadas directas con cuentas propias, ajenas y no autorizadas; para
respaldo y recuperación adjuntar un ensayo; para accesibilidad y compatibilidad
registrar dispositivos y navegadores. Un archivo de pruebas existente no sustituye
estos resultados.

## Mantenimiento

Editar primero la especificación y actualizar asociaciones del generador si se
amplía el alcance. Ejecutar desde la raíz:

\`\`\`powershell
node docs/herramientas/generar-matriz.mjs
\`\`\`

El generador valida IDs únicos y consecutivos, criterios no vacíos, fuentes
existentes, diagramas referenciados, participantes, cierre de ramas y equivalencia
de mensajes entre Mermaid y PlantUML. Es una comprobación estructural; no sustituye
un parser completo ni renderiza UML o verifica el sistema y su despliegue.
Revisa las diferencias antes de aceptar una nueva versión.
`;
fs.writeFileSync(path.join(docs, '27-matriz-requerimientos.md'), output, 'utf8');
console.log(`Matriz generada: ${rows.length} requisitos, ${seqIds.length} secuencias y fuentes existentes.`);
