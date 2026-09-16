import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/dashboard.js', import.meta.url), 'utf8');
const modelJs = fs.readFileSync(new URL('../assets/js/dashboard-close-model.js', import.meta.url), 'utf8');
const adminJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-cierre.js', import.meta.url), 'utf8');
const adminControlJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-control.js', import.meta.url), 'utf8');
const adminMonthJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-mes.js', import.meta.url), 'utf8');
const adminTeamJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-equipo.js', import.meta.url), 'utf8');
const adminRolesJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-roles.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/paginas/dashboard.css', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/dashboard_19_cierre_jornada.sql', import.meta.url), 'utf8');
const overnightSql = fs.readFileSync(new URL('../supabase/dashboard_20_cierre_ventana_nocturna.sql', import.meta.url), 'utf8');
const reviewSql = fs.readFileSync(new URL('../supabase/dashboard_21_revision_evidencias.sql', import.meta.url), 'utf8');
const leaderReviewSql = fs.readFileSync(new URL('../supabase/dashboard_22_lider_revision_solo_lectura.sql', import.meta.url), 'utf8');
const dailyControlSql = fs.readFileSync(new URL('../supabase/dashboard_23_control_diario.sql', import.meta.url), 'utf8');
const assignmentDrawSql = fs.readFileSync(new URL('../supabase/dashboard_24_sorteo_entregables.sql', import.meta.url), 'utf8');
const issueSql = fs.readFileSync(new URL('../supabase/dashboard_25_impedimentos_cierre.sql', import.meta.url), 'utf8');
const exitPhotoSql = fs.readFileSync(new URL('../supabase/dashboard_26_evidencia_hora_salida.sql', import.meta.url), 'utf8');
const shortVideoSql = fs.readFileSync(new URL('../supabase/dashboard_27_video_corto.sql', import.meta.url), 'utf8');
const evidenceEditSql = fs.readFileSync(new URL('../supabase/dashboard_28_edicion_evidencias_jornada.sql', import.meta.url), 'utf8');
const facebookReceiptSql = fs.readFileSync(new URL('../supabase/dashboard_29_comprobante_comparticiones.sql', import.meta.url), 'utf8');
const whatsappShareSql = fs.readFileSync(new URL('../supabase/dashboard_30_compartir_evidencia_whatsapp.sql', import.meta.url), 'utf8');
const reviewNotesSql = fs.readFileSync(new URL('../supabase/dashboard_31_observaciones_revision.sql', import.meta.url), 'utf8');
const facebookScheduleSql = fs.readFileSync(new URL('../supabase/dashboard_32_horario_comparticiones.sql', import.meta.url), 'utf8');
const reviewNotificationsSql = fs.readFileSync(new URL('../supabase/dashboard_34_notificaciones_revision.sql', import.meta.url), 'utf8');
const expandedFacebookEvidenceSql = fs.readFileSync(new URL('../supabase/dashboard_35_comparticiones_hasta_50.sql', import.meta.url), 'utf8');
const automaticCloseSql = fs.readFileSync(new URL('../supabase/dashboard_36_cierre_automatico_por_evidencia.sql', import.meta.url), 'utf8');
const directionEvidenceSql = fs.readFileSync(new URL('../supabase/dashboard_37_carga_evidencias_direccion.sql', import.meta.url), 'utf8');
const oneFacebookEvidenceSql = fs.readFileSync(new URL('../supabase/dashboard_38_comparticiones_desde_una_imagen.sql', import.meta.url), 'utf8');
const directionAccountsSql = fs.readFileSync(new URL('../supabase/dashboard_39_alta_direccion_fabrizio_erika.sql', import.meta.url), 'utf8');
const deletableReviewNotificationsSql = fs.readFileSync(new URL('../supabase/dashboard_40_eliminar_notificaciones_revision.sql', import.meta.url), 'utf8');
const unifiedNotificationsSql = fs.readFileSync(new URL('../supabase/dashboard_41_centro_notificaciones.sql', import.meta.url), 'utf8');
const lateExitSql = fs.readFileSync(new URL('../supabase/dashboard_42_entrada_y_salida_tardia.sql', import.meta.url), 'utf8');
const repairedExitSql = fs.readFileSync(new URL('../supabase/dashboard_43_reparar_regularizacion_salida.sql', import.meta.url), 'utf8');
const closeSchedulesSql = fs.readFileSync(new URL('../supabase/dashboard_44_horarios_en_cierres.sql', import.meta.url), 'utf8');
const unavailableSeptemberFifthSql = fs.readFileSync(new URL('../supabase/dashboard_45_excluir_05_septiembre.sql', import.meta.url), 'utf8');
const pendingExitSql = fs.readFileSync(new URL('../supabase/dashboard_46_conservar_salida_con_pendientes.sql', import.meta.url), 'utf8');
const assignmentStatusSql = fs.readFileSync(new URL('../supabase/dashboard_47_estado_asignaciones.sql', import.meta.url), 'utf8');
const separatedFacebookSql = fs.readFileSync(new URL('../supabase/dashboard_48_separar_jornada_y_comparticiones.sql', import.meta.url), 'utf8');
const expiredFacebookSql = fs.readFileSync(new URL('../supabase/dashboard_49_vencimiento_comparticiones.sql', import.meta.url), 'utf8');
const visibleDirectionMessagesSql = fs.readFileSync(new URL('../supabase/dashboard_50_mensajes_direccion_visibles.sql', import.meta.url), 'utf8');
const coLeadersSql = fs.readFileSync(new URL('../supabase/dashboard_51_colideres_tecnicos.sql', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/dash-entrega/index.ts', import.meta.url), 'utf8');

test('dashboard JavaScript parses', () => {
  assert.doesNotThrow(() => new vm.Script(js));
  assert.doesNotThrow(() => new vm.Script(modelJs));
  assert.doesNotThrow(() => new vm.Script(adminJs));
  assert.doesNotThrow(() => new vm.Script(adminControlJs));
  assert.doesNotThrow(() => new vm.Script(adminMonthJs));
  assert.doesNotThrow(() => new vm.Script(adminTeamJs));
  assert.doesNotThrow(() => new vm.Script(adminRolesJs));
});

test('each area supports two co-leaders with the same server-side scope as its leader', () => {
  for (const fragment of [
    "check (nivel in ('sistemas','lider','colider','miembro'))",
    "v_limite:=case when new.nivel='lider' then 1 else 2 end",
    'create or replace function public.dash_admin_asignar_colider',
    "'asignar_colider','reemplazar_colider','retirar_colider'",
    "public.dash_nivel() in ('lider','colider')",
    "public.dash_nivel() not in ('lider','colider','sistemas')",
    "'co_lideres',coalesce",
    "'co_lideres_max',2",
    "'roles_por_revisar'",
  ]) assert.ok(coLeadersSql.includes(fragment), `co-leader migration missing: ${fragment}`);
  assert.match(coLeadersSql,/perfil\.nivel='colider'[\s\S]*?v_cantidad>=2/);
  assert.match(coLeadersSql,/create policy "cierre evidencias: lectura autorizada"[\s\S]*?public\.dash_nivel\(\) in \('lider','colider'\)/);
  assert.match(js,/colider:'Co-líder técnico'/);
  assert.match(js,/\['lider','colider'\]\.includes\(p\.nivel\)/);
  assert.match(adminRolesJs,/const coLeaderSlots=\[0,1\]/);
  assert.match(adminRolesJs,/dash_admin_asignar_colider/);
  assert.match(adminRolesJs,/data-colider-save/);
  assert.match(html,/un líder y hasta dos co-líderes técnicos por área/);
  assert.match(html,/dashboard-admin-roles\.js\?v=4/);
  assert.match(css,/\.admin-role-colider-group\{/);
  assert.match(css,/\.admin-role-seat\.is-colider\{/);
  assert.match(adminRolesJs,/const ROLE_COLEADER_OPEN=new Set\(\)/);
  assert.match(adminRolesJs,/data-colider-toggle=/);
  assert.match(adminRolesJs,/aria-expanded=/);
  assert.match(adminRolesJs,/class="admin-role-colider-panel"/);
  assert.match(css,/\.admin-role-colider-panel\[hidden\]\{display:none\}/);
  assert.match(html,/id="admin-role-confirm-modal"[^>]*data-tone="assign"[^>]*hidden/);
  assert.match(html,/class="admin-role-confirm-sheet"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(adminRolesJs,/function confirmRoleAction/);
  assert.match(adminRolesJs,/event\.key==='Escape'/);
  assert.doesNotMatch(adminRolesJs,/\bconfirm\(/);
  assert.match(css,/\.admin-role-confirm-sheet\{/);
  assert.match(css,/@media\(max-width:900px\)\{\.admin-role-confirm-modal\{align-items:flex-end/);
});

test('operational overview prioritizes alerts and summarizes every admin section', () => {
  assert.match(html,/class="admin-overview-today"/);
  assert.match(html,/id="admin-attention-count"/);
  assert.match(html,/id="admin-overview-map-title">Panorama de gestión/);
  for (const section of ['control','cierres','lista','mes','resumen','colaboradores','contratos','roles','marcado']) {
    assert.match(html,new RegExp(`class="admin-overview-module-grid"[\\s\\S]*?data-admin-section="${section}"`));
  }
  assert.match(js,/db\.rpc\('dash_admin_equipo'/);
  assert.match(js,/db\.rpc\('dash_admin_mes'/);
  assert.match(js,/db\.rpc\('dash_admin_control_diario'/);
  assert.match(js,/priorities\.slice\(0,6\)/);
  assert.match(js,/admin-overview-contract-value/);
  assert.match(js,/admin-overview-roles-value/);
  assert.match(css,/\.admin-overview-module-grid\{/);
  assert.match(css,/\.admin-overview-module-grid>button\[hidden\]\{display:none\}/);
  assert.ok(Number(html.match(/dashboard\.js\?v=(\d+)/)?.[1])>=159,'dashboard script must include the operational overview revision or a newer cache version');
  assert.match(html,/dashboard\.css\?v=\d+/);
});

test('month ledger controls and metrics share one responsive workbench', () => {
  assert.match(html,/class="admin-month-workbench"/);
  assert.match(html,/class="admin-month-workbench-head"/);
  assert.match(html,/class="admin-month-workbench-controls"/);
  assert.match(html,/class="admin-month-workbench-head"[\s\S]*?id="admin-month-kpis" aria-live="polite"[\s\S]*?id="admin-month-export"/);
  assert.match(html,/id="admin-month-prev"[^>]*>[\s\S]*?<svg/);
  assert.match(html,/id="admin-month-holidays"[^>]*>[\s\S]*?Gestionar feriados/);
  assert.match(adminMonthJs,/admin-list-kpi \$\{item\[2\]\}/);
  assert.match(css,/\.admin-month-workbench\{/);
  assert.match(css,/\.admin-month-workbench-head \.admin-month-kpis\{/);
  assert.match(css,/\.admin-month-workbench-head \.admin-list-kpi\.danger b\{/);
  assert.match(css,/\.portal\[data-time-phase\] \.admin-month-workbench \.admin-month-workbench-head \.admin-list-kpi\{/);
  assert.match(css,/background:#173d69/);
  assert.match(css,/@media\(max-width:760px\)\{\.admin-month-workbench-head/);
  assert.match(html,/id="admin-month-area-trigger"[\s\S]*?role="combobox"[\s\S]*?aria-controls="admin-month-area-options"/);
  assert.match(html,/id="admin-month-area-options"[\s\S]*?role="listbox"[\s\S]*?hidden/);
  assert.match(html,/select id="admin-month-area" hidden aria-hidden="true" tabindex="-1"/);
  assert.match(adminMonthJs,/function syncMonthAreaCombobox\(\)/);
  assert.match(adminMonthJs,/select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
  for (const key of ['ArrowDown','ArrowUp','Home','End','Escape']) assert.ok(adminMonthJs.includes(key));
  assert.match(css,/\.admin-month-area-options\[hidden\]\{display:none\}/);
  assert.match(css,/\.admin-month-area-options button\[aria-selected="true"\]/);
  assert.match(html,/dashboard-admin-mes\.js\?v=5/);
});

test('monthly summary prioritizes metrics and table inside a compact workbench', () => {
  assert.match(html,/id="admin-summary-section"[\s\S]*?class="admin-summary-workbench"/);
  assert.match(html,/class="admin-summary-workbench-head"[\s\S]*?id="admin-summary-kpis" aria-live="polite"[\s\S]*?id="admin-summary-export"/);
  assert.match(html,/class="admin-summary-workbench-controls"[\s\S]*?id="admin-summary-value"[\s\S]*?class="admin-month-filters admin-summary-filters"/);
  assert.match(html,/id="admin-summary-prev"[^>]*>[\s\S]*?<svg/);
  assert.doesNotMatch(html,/LECTURA EJECUTIVA/);
  assert.match(css,/\.admin-summary-workbench-head\{/);
  assert.match(css,/\.admin-summary-workbench-head \.admin-summary-hero\{/);
  assert.match(css,/max-height:clamp\(360px,calc\(100dvh - 330px\),680px\)/);
});

test('phase 14 separates Facebook schedule from the workday', () => {
  for (const fragment of [
    'create table if not exists public.asis_comparticiones_horarios',
    'create or replace function public.asis_compartir_programado',
    'create or replace function public.asis_compartir_fecha_activa',
    'create or replace function public.dash_admin_horario_compartir',
    'create or replace function public.dash_admin_guardar_horario_compartir',
    "'{solo_comparticiones}'",
    "'fuera_horario_compartir'",
    'not public.asis_labora(v_persona,v_fecha)',
  ]) assert.ok(facebookScheduleSql.includes(fragment), `Facebook schedule migration missing: ${fragment}`);
  assert.match(facebookScheduleSql,/then coalesce\(\(select public\.asis_labora/);
  assert.match(facebookScheduleSql,/p_requisito<>'comparticiones' then return public\.dash_entrega_permiso_base_32/);
  assert.match(facebookScheduleSql,/public\.asis_compartir_fin_at\(v_colab,v_fecha\)<=v_hasta_at/);
  assert.match(html,/id="admin-facebook-schedule-grid"/);
  assert.match(css,/\.facebook-schedule-block\{/);
  assert.match(css,/\.facebook-day-toggle:after\{/);
  assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.facebook-schedule-row\{/);
  assert.match(adminTeamJs,/dash_admin_horario_compartir/);
  assert.match(adminTeamJs,/dash_admin_guardar_horario_compartir/);
  assert.match(adminTeamJs,/class="facebook-time-field"/);
  assert.match(js,/data\.solo_comparticiones/);
  assert.match(js,/HORARIO DE FACEBOOK/);
});

test('dashboard has unique ids and the complete close workflow', () => {
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);

  for (const id of [
    'welcome-area',
    'day-close',
    'day-close-checklist',
    'daily-evidence-editor',
    'daily-evidence-file',
    'day-close-button',
    'day-close-guide',
    'day-close-guide-title',
    'daily-exit-modal',
    'daily-exit-confirm',
    'admin-close-section',
    'admin-close-assignment-form',
    'daily-evidence-collage-option',
    'admin-review-modal',
    'admin-review-gallery',
    'admin-review-observe',
    'admin-review-approve',
    'admin-evidence-modal',
    'admin-evidence-requirement-list',
    'admin-evidence-files',
    'admin-evidence-submit',
    'admin-control-section',
    'admin-control-date',
    'admin-control-kpis',
    'admin-control-table',
    'daily-issue-toggle',
    'daily-issue-form',
    'daily-issue-detail',
    'daily-issue-submit',
    'mobile-close-panel',
    'mobile-close-list',
    'mobile-close-count',
    'mobile-close-action',
    'facebook-share-modal',
    'facebook-share-gallery',
  ]) assert.ok(ids.includes(id), `missing #${id}`);

  assert.match(html, /id="daily-evidence-file"[^>]*\bmultiple\b/);
  assert.match(html, /id="daily-evidence-editor"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /class="daily-evidence-sheet"/);
  assert.match(html, /class="daily-exit-sheet"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /<html\s+lang="es">/);
});

test('phase 3 daily control is Direction-only, read-only and exportable', () => {
  for (const fragment of [
    'create or replace function public.dash_admin_control_diario',
    "public.asis_rol() is distinct from 'direccion'",
    "'evidencias_pendientes'",
    "'revision_pendiente'",
    "'revision_observada'",
    "'horas_validas'",
    "'solo_direccion', true",
  ]) assert.ok(dailyControlSql.includes(fragment), `daily control migration missing: ${fragment}`);
  assert.doesNotMatch(dailyControlSql,/create policy|insert into|update public\.asis_|delete from/);
  assert.match(js,/section==='control'&&APP\.access\.rol!=='direccion'/);
  assert.match(adminControlJs,/dash_admin_control_diario/);
  assert.match(adminControlJs,/exportAdminControl/);
  assert.match(adminControlJs,/data-control-open-close/);
  assert.doesNotMatch(dailyControlSql,/'path'|'archivos'/);
  assert.match(css,/\.portal\.admin-wide #admin-control-section\{[\s\S]*?grid-template-rows:auto auto auto auto minmax\(0,1fr\);[\s\S]*?overflow:hidden/);
  assert.match(css,/\.portal\.admin-wide #admin-control-section>\.admin-control-table\{[\s\S]*?overflow-y:auto/);
});

test('phase 4 assignment draw previews a fair rotation before creating rows', () => {
  for (const fragment of [
    'create or replace function public.dash_admin_previsualizar_sorteo',
    'create or replace function public.dash_admin_confirmar_sorteo',
    "public.asis_rol() is distinct from 'direccion'",
    'count(x.id) filter',
    'p_fecha - 30',
    'pg_advisory_xact_lock(p_area)',
    'from unnest(p_colaboradores) elegido(id)',
  ]) assert.ok(assignmentDrawSql.includes(fragment), `assignment draw migration missing: ${fragment}`);
  assert.match(adminJs,/dash_admin_previsualizar_sorteo/);
  assert.match(adminJs,/dash_admin_confirmar_sorteo/);
  assert.match(adminJs,/function renderAdminDrawPreview/);
  assert.match(html,/id="admin-close-draw-preview"[^>]*hidden/);
  assert.match(html,/id="admin-close-draw-option"/);
});

test('phase 5 records impediments without completing evidence or unlocking exit', () => {
  for (const fragment of [
    'create table if not exists public.asis_cierre_impedimentos',
    'create or replace function public.dash_reportar_impedimento',
    'create or replace function public.dash_mis_impedimentos_cierre',
    'create or replace function public.dash_supervision_impedimentos',
    "public.asis_rol()='direccion'",
    "public.dash_nivel()='lider'",
    'c.area_id=public.dash_area()',
    'create trigger asis_resolver_impedimento_entrega_trg',
  ]) assert.ok(issueSql.includes(fragment), `impediment migration missing: ${fragment}`);
  assert.doesNotMatch(issueSql,/update public\.asis_registros[\s\S]*salida_at|horas_validas\s*=|estado\s*=\s*'completa'/);
  assert.match(js,/dash_mis_impedimentos_cierre/);
  assert.match(js,/dash_reportar_impedimento/);
  assert.match(js,/db\.rpc\('dash_supervision_impedimentos',\{p_fecha:today\}\)/);
  assert.match(adminControlJs,/dash_supervision_impedimentos/);
  assert.match(adminControlJs,/Impedimento informado/);
  assert.match(css,/\.daily-issue\{[\s\S]*?border:[^;]*#f0d5a6/);
  assert.match(css,/\.team-evidence-state\.reported/);
});

test('exit photo is a server-enforced requirement limited to the exit window', () => {
  for (const fragment of [
    "check (requisito in ('comparticiones','rpe','salida','asignado'))",
    "'tipo','salida'",
    "'bloqueado',not v_ok and not v_disponible",
    "p_requisito<>'salida'",
    "coalesce(cardinality(p_paths),0)<>1",
    "requisito='salida' and estado='completo'",
    "return public.dash_marcar_salida_base_26(p_dispositivo)",
    'now()<v_fin_at-make_interval(mins=>v_cfg.salida_anticipacion_min)',
  ]) assert.ok(exitPhotoSql.includes(fragment), `exit photo migration missing: ${fragment}`);
  assert.match(js,/salida:'<svg/);
  assert.match(js,/requirement==='salida'\?'JPG, PNG o WebP/);
  assert.match(js,/DAILY_EVIDENCE\.requirement==='salida'\|\|/);
  assert.match(js,/daily-evidence-file'\)\.multiple=requirement!=='salida'/);
  assert.match(adminJs,/function adminReviewTitle\(item\)/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-item\.type-comparticiones/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-item\.type-rpe/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-item\.type-salida/);
});

test('phase 7 adds one private, size-limited optional video to RPE or assigned work', () => {
  for (const fragment of [
    "p_requisito not in ('rpe','asignado')",
    'create or replace function public.dash_video_permiso',
    'create or replace function public.dash_adjuntar_video',
    "v_mime not in ('video/mp4','video/webm')",
    'v_bytes not between 1 and 8388608',
    'asis_entrega_un_video_idx',
    "public.dash_nivel()='lider'",
  ]) assert.ok(shortVideoSql.includes(fragment), `short video migration missing: ${fragment}`);
  assert.match(html,/id="daily-video-file"[^>]*accept="video\/mp4,video\/webm"/);
  assert.match(js,/duration>30/);
  assert.match(js,/file\.size>8\*1024\*1024/);
  assert.match(js,/db\.rpc\('dash_adjuntar_video'/);
  assert.match(edge,/body\.tipo === "video"/);
  assert.match(edge,/dash_video_permiso/);
  assert.match(edge,/jpg\|webp\|mp4\|webm/);
  assert.match(adminJs,/<video src=/);
});

test('phase 8 lets the owner replace evidence only while their workday is open', () => {
  for (const fragment of [
    'create table if not exists public.asis_entrega_reemplazos',
    'create or replace function public.dash_evidencia_editable',
    'create or replace function public.dash_mi_entrega_editable',
    'now() between v_reg.marcado_at and v_fin_at',
    'create or replace function public.dash_reemplazo_permiso',
    'create or replace function public.dash_reemplazar_entrega',
    "set estado='anulado'",
    'puede_editar_evidencias',
    "'fuera_horario_edicion'",
    'perform pg_advisory_xact_lock(v_colab)',
    'p_conservar_paths text[]',
    'drop constraint if exists asis_entrega_archivos_path_key',
  ]) assert.ok(evidenceEditSql.includes(fragment), `evidence edit migration missing: ${fragment}`);
  assert.match(js,/complete&&!!item\.editable/);
  assert.match(js,/editing\?'dash_reemplazar_entrega':'dash_confirmar_entrega'/);
  assert.match(js,/La edición sólo está disponible durante tu horario de trabajo/);
  assert.match(js,/db\.rpc\('dash_mi_entrega_editable'/);
  assert.match(js,/data-remove-existing-file/);
  assert.match(js,/p_conservar_paths:/);
  assert.match(html,/id="daily-evidence-edit-note"[^>]*hidden/);
  assert.match(html,/Quita con × sólo las incorrectas/);
  assert.match(edge,/body\.accion === "reemplazar"/);
  assert.match(edge,/dash_reemplazo_permiso/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-item\.is-editable/);
  assert.match(css,/\.daily-evidence-edit-note\{/);
  assert.match(css,/\.daily-evidence-preview\.is-existing em/);
});

test('completed Facebook evidence keeps identity details inside its private receipt', () => {
  for (const fragment of [
    'dash_cierre_resumen_colab_base_29',
    "e.requisito='comparticiones'",
    "e.estado='completo'",
    "jsonb_build_object('registrado_at',v_registrado_at)",
    'max(e.completado_at)',
  ]) assert.ok(facebookReceiptSql.includes(fragment), `Facebook receipt migration missing: ${fragment}`);
  const dailyItemSource=js.slice(js.indexOf('function dailyCloseItemMarkup'),js.indexOf('function renderMobileDailyClose'));
  assert.match(js,/const facebookReceipt=complete&&item\.tipo==='comparticiones'/);
  assert.doesNotMatch(dailyItemSource,/class="facebook-share-receipt"|COMPARTIDO POR|HORA REGISTRADA/);
  assert.match(js,/APP\.inicio\?\.colaborador\?\.dni/);
  assert.match(css,/\.day-close-item\.has-facebook-receipt\{/);
  assert.match(css,/\.day-close-check-badge\{/);
});

test('Facebook receipt previews compact, ordered private images', () => {
  for (const fragment of [
    'create or replace function public.dash_mi_comprobante_comparticiones()',
    'public.dash_sesion_vigente()',
    "e.requisito='comparticiones'",
    "e.estado='completo'",
    "'registrado_at',v_entrega.completado_at",
    "'area',coalesce(v_area,'Sin área')",
    "'archivos',v_archivos",
    'grant execute on function public.dash_mi_comprobante_comparticiones()',
  ]) assert.ok(whatsappShareSql.includes(fragment), `Facebook receipt migration missing: ${fragment}`);
  assert.match(html,/id="facebook-share-modal"[^>]*hidden/);
  assert.match(html,/id="facebook-share-gallery"[^>]*aria-live="polite"/);
  assert.match(html,/Comprobante de evidencias/);
  assert.doesNotMatch(html,/Compartir y elegir WhatsApp|Enviar evidencias por WhatsApp/);
  assert.match(js,/data-facebook-share-open/);
  assert.match(js,/db\.rpc\('dash_mi_comprobante_comparticiones'\)/);
  assert.match(js,/createSignedUrl\(file\.path,900\)/);
  assert.match(js,/toca para ampliar/);
  assert.doesNotMatch(js,/navigator\.share|wa\.me|submitFacebookShare|downloadFacebookShareFiles/);
  assert.match(css,/\.facebook-share-workspace\{[\s\S]*?grid-template-columns:/);
  assert.match(css,/\.facebook-share-modal \.modal-backdrop\{[\s\S]*?background:transparent!important[\s\S]*?backdrop-filter:blur\(5px\)/);
  assert.match(css,/\.facebook-share-gallery\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.facebook-share-gallery img\{[\s\S]*?object-fit:contain/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.facebook-share-gallery\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('phase 2 review is private, auditable and reopens observed evidence safely', () => {
  for (const fragment of [
    'add column if not exists revision_estado',
    'create table if not exists public.asis_entrega_revisiones',
    'create or replace function public.dash_admin_revision_entregas',
    'create or replace function public.dash_admin_revisar_entrega',
    'create or replace function public.dash_mis_revisiones_cierre',
    "public.asis_rol() is distinct from 'direccion'",
    "then 'anulado' else estado end",
    "return jsonb_build_object('ok', false, 'motivo', 'jornada_cerrada')",
    "public.dash_colab() = split_part(name, '/', 4)::bigint",
  ]) assert.ok(reviewSql.includes(fragment), `phase 2 migration missing: ${fragment}`);
  assert.match(adminJs,/dash_admin_revision_entregas/);
  assert.match(adminJs,/createSignedUrl\(file\.path,900\)/);
  assert.match(adminJs,/dash_admin_revisar_entrega/);
  assert.match(js,/dash_mis_revisiones_cierre/);
  assert.ok(html.indexOf('id="admin-close-status"') < html.indexOf('class="admin-close-grid"'), 'evidence review must appear before assignment management');
  assert.match(html,/Evidencias y cierre del equipo/);
  assert.match(html,/Selecciona “por revisar” o “Ver evidencias”/);
  assert.match(adminJs,/'Ver evidencias'/);
  assert.match(css,/\.admin-close-review-trigger\{[^}]*background:#eff6ff/);
  assert.match(css,/\.portal\.admin-wide #view-gestion>#admin-close-section,[\s\S]*?overflow-y:auto/);
  assert.match(css,/\.admin-review-decision footer\{[^}]*position:sticky[^}]*bottom:-22px/);
  assert.match(adminJs,/function adminReviewTime\(value\)/);
  assert.match(adminJs,/Enviado \$\{adminReviewTime\(delivery\.completado_at\)\}/);
  assert.match(adminJs,/p_nota:note\|\|null/);
  assert.doesNotMatch(adminJs,/disabled=reviewed\|\|closed\|\|!canDecide/);
  assert.match(html,/Observación de Dirección/);
  assert.match(reviewNotesSql,/revision_nota = v_nota/);
  assert.match(reviewNotesSql,/nota, actor_id[\s\S]*v_nota, auth\.uid\(\)/);
  assert.match(reviewNotesSql,/if p_estado = 'observada' and v_salida is not null/);
  assert.match(js,/Corrección solicitada:/);
});

test('technical leaders get read-only evidence access limited to their own area', () => {
  for (const fragment of [
    "public.dash_nivel() = 'lider'",
    'c.area_id = v_area',
    "'puede_revisar', v_es_direccion",
    "'solo_lectura', v_es_lider",
    "public.puede_ver_colab(split_part(name, '/', 4)::bigint)",
  ]) assert.ok(leaderReviewSql.includes(fragment), `leader review migration missing: ${fragment}`);
  assert.doesNotMatch(leaderReviewSql,/create or replace function public\.dash_admin_revisar_entrega/);
  assert.match(js,/db\.rpc\('dash_admin_revision_entregas',\{p_fecha:today\}\)/);
  assert.match(js,/data-team-review/);
  assert.match(adminJs,/APP\.identity\.isLeader&&APP\.adminReview\?\.solo_lectura===true/);
  assert.match(adminJs,/APP\.access\.rol!=='direccion'\|\|APP\.adminReview\?\.puede_revisar!==true/);
  assert.match(adminJs,/function adminReviewDate\(value\)/);
  assert.doesNotMatch(adminJs,/\$\{dates\(person\.fecha\)\}/);
  assert.match(html,/id="admin-review-access"[^>]*hidden/);
});

test('review decisions create private, readable notifications for the evidence owner', () => {
  for (const fragment of [
    'add column leida_at timestamptz',
    'create or replace function public.dash_mis_notificaciones_revision',
    'create or replace function public.dash_marcar_notificaciones_revision',
    'entrega.colaborador_id = v_colab',
    'revision.leida_at is null',
    "'no_leidas', v_no_leidas",
  ]) assert.ok(reviewNotificationsSql.includes(fragment), `notification migration missing: ${fragment}`);
  assert.match(reviewNotificationsSql,/update public\.asis_entrega_revisiones[\s\S]*?set leida_at = creado_at/);
  assert.match(reviewNotificationsSql,/revoke all on function public\.dash_mis_notificaciones_revision/);
  assert.match(reviewNotificationsSql,/grant execute on function public\.dash_marcar_notificaciones_revision\(bigint\[\]\) to authenticated/);
  assert.match(reviewNotesSql,/revision_nota = v_nota/);
  assert.match(html,/data-review-notification-trigger/);
  assert.match(html,/id="review-notification-panel"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(js,/dash_mis_notificaciones_revision/);
  assert.match(js,/dash_marcar_notificaciones_revision/);
  assert.match(js,/dash_eliminar_notificacion_revision/);
  assert.match(js,/data-delete-review-notification/);
  assert.match(js,/has-direction-message/);
  assert.match(js,/function reviewNotificationDayKey\(value\)/);
  assert.match(js,/function reviewNotificationDayLabel\(key,value\)/);
  assert.match(js,/function reviewNotificationListMarkup\(items\)/);
  assert.match(js,/class="review-notification-day"/);
  assert.match(js,/Falta activar la eliminación de notificaciones en Supabase/);
  assert.match(js,/function startReviewNotificationSync\(\)/);
  assert.match(js,/function mountReviewNotificationPortal\(\)[\s\S]*?document\.body\.appendChild\(layer\)/);
  assert.match(js,/const layer=mountReviewNotificationPortal\(\)/);
  assert.match(js,/const fresh=await loadReviewNotifications\(\{quiet:true\}\)/);
  assert.match(js,/fresh\?\.unread>0\)await markReviewNotificationsRead\(null\)/);
  assert.match(css,/\.review-notification-badge\{/);
  assert.match(css,/\.review-notification-layer\{position:fixed;z-index:1250/);
  assert.match(css,/@media\(max-width:900px\)\{[\s\S]*?\.review-notification-panel\{width:100%/);
  assert.match(css,/\.review-notification-item>\.review-notification-delete\{/);
  assert.match(css,/\.review-notification-day>h3\{/);
  assert.match(css,/\.review-notification-copy p\.has-direction-message\{[\s\S]*?background:/);
  assert.match(html,/id="review-notification-list" role="region" aria-label="Historial de notificaciones"/);
  assert.doesNotMatch(html,/id="time-preview-switch"|id="weather-chip"|class="session-chip"/);
  for (const fragment of [
    'add column if not exists ocultada_por_colaborador_at timestamptz',
    'create or replace function public.dash_eliminar_notificacion_revision',
    'revision.ocultada_por_colaborador_at is null',
    'entrega.colaborador_id = v_colab',
    'grant execute on function public.dash_eliminar_notificacion_revision(bigint) to authenticated',
  ]) assert.ok(deletableReviewNotificationsSql.includes(fragment), `deletable notification migration missing: ${fragment}`);
});

test('direction messages, review notes and assignments share one private notification inbox', () => {
  for (const fragment of [
    'create table if not exists public.asis_notificaciones',
    "'revision_aprobada','revision_observada','mensaje_direccion','asignacion'",
    'create or replace function public.dash_admin_enviar_mensaje',
    'create or replace function public.dash_notificar_revision_trg()',
    'create or replace function public.dash_notificar_asignacion_trg()',
    'new.nota',
    "'asignacion:' || new.id::text || ':colaborador:' || colaborador.id::text",
    'from public.asis_notificaciones notificacion',
    'colaborador_id = public.dash_colab()',
    'alter publication supabase_realtime add table public.asis_notificaciones',
  ]) assert.ok(unifiedNotificationsSql.includes(fragment), `unified notification migration missing: ${fragment}`);
  assert.match(unifiedNotificationsSql,/public\.asis_rol\(\) is distinct from 'direccion'/);
  assert.match(unifiedNotificationsSql,/grant execute on function public\.dash_admin_enviar_mensaje\(bigint, text, text\) to authenticated/);

  assert.match(html,/id="admin-message-modal"[^>]*hidden/);
  assert.match(html,/id="admin-message-form"/);
  assert.match(html,/id="admin-message-body"[^>]*minlength="3"[^>]*maxlength="700"/);
  assert.match(adminJs,/data-admin-message-person/);
  assert.match(adminJs,/db\.rpc\('dash_admin_enviar_mensaje'/);
  assert.match(adminJs,/function openAdminMessage\(personId,trigger=null\)/);
  assert.match(adminJs,/function submitAdminMessage\(event\)/);

  assert.match(js,/function playNotificationSound\(\)/);
  assert.match(js,/function announceFreshNotifications\(items\)/);
  assert.match(js,/table:'asis_notificaciones'/);
  assert.match(js,/first\.tipo==='asignacion'\?'Nueva asignación'/);
  assert.match(js,/document\.title=unread/);
  assert.match(css,/\.review-notification-item\[data-state="message"\]/);
  assert.match(css,/\.review-notification-item\[data-state="assignment"\]/);
  assert.match(css,/\.admin-close-message-trigger\{/);
  assert.match(adminJs,/<span>Jornada<\/span><span>Mensaje<\/span>/);
  assert.match(adminJs,/data-label="Mensaje" class="admin-close-message-cell"/);
  assert.match(css,/\.admin-close-message-cell\{/);
  assert.match(css,/\.admin-message-sheet\{/);
});

test('notification sound is reinforced and protected from clipping', () => {
  assert.match(js,/exponentialRampToValueAtTime\(\.18,now\+\.015\)/);
  assert.match(js,/createDynamicsCompressor/);
  assert.match(js,/duration:\.28,level:\.9,type:'triangle'/);
  assert.match(html,/dashboard\.js\?v=170/);
});

test('every user notification visibly identifies the Direction message and sender', () => {
  for (const fragment of [
    'update public.asis_notificaciones notificacion',
    "notificacion.dedupe_key='revision:'||revision.id::text",
    'create or replace function public.dash_notificar_revision_trg',
    'nullif(btrim(v_entrega.revision_nota)',
    'create or replace function public.dash_mis_notificaciones_revision',
    "'remitente',item.remitente",
    'left join public.asis_perfiles perfil on perfil.id=notificacion.actor_id',
  ]) assert.ok(visibleDirectionMessagesSql.includes(fragment), `visible Direction message migration missing: ${fragment}`);
  assert.match(js,/const messageLabel=assignment\?'Indicaciones de Dirección':observed\?'Observación de Dirección':'Mensaje de Dirección'/);
  assert.match(js,/const messageHeading=sender\?`\$\{messageLabel\} · \$\{sender\}`:messageLabel/);
  assert.match(js,/class="has-direction-message\$\{hasMessage\?'':' is-system-message'\}"/);
  assert.match(js,/\$\{esc\(messageHeading\)\}<\/span>\$\{esc\(copy\)\}/);
});

test('admin close evidence progress survives an incomplete close summary', () => {
  assert.match(adminJs,/function adminCloseEvidenceProgress\(person,reviews=\[\]\)/);
  assert.match(adminJs,/if\(person\?\.labora&&close\.aplica_jornada!==false\)expected\.add\('requisito:rpe'\)/);
  assert.match(adminJs,/if\(close\.aplica_comparticiones===true\)expected\.add\('requisito:comparticiones'\)/);
  assert.match(adminJs,/if\(item\.estado==='completo'\)complete\.add\(key\);else complete\.delete\(key\)/);
  assert.match(adminJs,/progress=adminCloseEvidenceProgress\(person,personReviews\)/);
  assert.doesNotMatch(adminJs,/globalDone\+assignedDone/);
  const helperStart=adminJs.indexOf('function adminCloseEvidenceKey');
  const helperEnd=adminJs.indexOf('\n\nfunction adminCloseMsg',helperStart);
  const helperContext={};
  vm.runInNewContext(adminJs.slice(helperStart,helperEnd),helperContext);
  const complete=helperContext.adminCloseEvidenceProgress(
    {labora:true,cierre:{}},
    [
      {id:10,requisito:'comparticiones',estado:'completo'},
      {id:11,requisito:'rpe',estado:'completo'},
    ],
  );
  assert.equal(complete.done,2);
  assert.equal(complete.total,2);
  const corrected=helperContext.adminCloseEvidenceProgress(
    {labora:true,cierre:{}},
    [
      {id:10,requisito:'comparticiones',estado:'completo'},
      {id:11,requisito:'rpe',estado:'completo'},
      {id:12,requisito:'rpe',estado:'anulado'},
    ],
  );
  assert.equal(corrected.done,1);
  assert.equal(corrected.total,2);
  const awaitingExit=helperContext.adminCloseEvidenceProgress(
    {labora:true,cierre:{entrada_at:'2026-09-09T13:00:00Z',salida_at:null,aplica_jornada:true}},
    [
      {id:20,requisito:'comparticiones',estado:'completo'},
      {id:21,requisito:'rpe',estado:'completo'},
    ],
  );
  assert.equal(awaitingExit.done,2);
  assert.equal(awaitingExit.total,3);
  assert.match(adminJs,/globals\.push\(\{kind:'salida',assignment:null,title:'Evidencia de hora de salida'/);
  assert.match(adminJs,/adminEvidenceMissing\(person,personReviews\)/);
});

test('migration enforces evidence before exit and preserves history', () => {
  for (const fragment of [
    'add column if not exists salida_at',
    'create or replace function public.dash_cierre_hoy()',
    'create or replace function public.dash_confirmar_entrega(',
    'create or replace function public.dash_marcar_salida(',
    'create or replace function public.dash_admin_cierres(',
    'create or replace function public.dash_equipo_cierres_hoy()',
    'create or replace function public.dash_admin_cierres_mes(',
    'create table if not exists public.asis_carga_permisos',
    'perform pg_advisory_xact_lock(v_colab)',
    'create or replace function public.dash_admin_asignar_entregable(',
    "'requisitos_pendientes'",
    "date '2026-09-07'",
    'horas_programadas = horas',
  ]) assert.ok(sql.includes(fragment), `migration missing: ${fragment}`);
});

test('daily evidence upload uses an authenticated, private bucket flow', () => {
  assert.ok(edge.includes('usuario.auth.getUser(jwt)'));
  assert.ok(edge.includes('dash_entrega_permiso'));
  assert.ok(edge.includes('createSignedUploadUrl'));
  assert.ok(edge.includes('asis-cierre-evidencias'));
  assert.ok(edge.includes('body.accion === "limpiar"'));
  assert.ok(edge.includes('2 * 60 * 60 * 1000'));
  assert.ok(edge.includes('.is("vinculado_at", null)'));
});

test('close-state model maps colors, validity and legacy attendance consistently', () => {
  const context={};vm.createContext(context);new vm.Script(modelJs).runInContext(context);
  const model=context.KJACloseModel;
  assert.equal(model.stateTone('completa'),'complete');
  assert.equal(model.stateTone('regularizada'),'complete');
  assert.equal(model.stateTone('incompleta'),'incomplete');
  assert.equal(model.stateTone('lista_para_salir'),'ready');
  assert.deepEqual({...model.attendancePresentation({estado:'P'},{aplica:true,estado:'incompleta',entrada_at:'2026-09-07T14:00:00Z'})},{state:'incompleta',label:'Incompleta',complete:false,incomplete:true,hasEntry:true});
  assert.equal(model.attendancePresentation({estado:'P'},null).complete,true);
  assert.equal(model.stateLabel('regularizada'),'Completa');
});

test('exit evidence closes the workday automatically and safely repairs equivalent history', () => {
  for (const fragment of [
    'create table if not exists public.asis_cierre_regularizaciones_auto',
    'rename to dash_confirmar_entrega_base_36',
    "public.dash_marcar_salida('cierre_automatico_por_evidencia')",
    "'salida_registrada',true",
    "entrega.requisito='salida'",
    "r.fecha<(now() at time zone 'America/Lima')::date",
    "coalesce((cierre.resumen->>'pendientes_salida')::integer,1)=0",
    'e.completado_at>=r.marcado_at',
    'cierre_regularizado=true',
    "salida_origen='dashboard'",
  ]) assert.ok(automaticCloseSql.includes(fragment), `automatic close migration missing: ${fragment}`);
  assert.match(automaticCloseSql,/salida_at=a\.salida_recuperada_at/);
  assert.match(automaticCloseSql,/on conflict\(registro_id\) do nothing/);
  assert.match(js,/const exitRecorded=!editing&&data\.salida_registrada===true/);
  assert.match(js,/const autoExit=exitRecorded&&\['completa','regularizada'\]\.includes\(data\.resumen\?\.estado\)/);
  assert.match(js,/autoExit\?'Salida registrada\. Tu jornada está completa\.'/);
});

test('Direction can upload missing evidence for a collaborator with audit and private storage', () => {
  for (const fragment of [
    'create table if not exists public.asis_entregas_direccion',
    'create or replace function public.dash_admin_entrega_permiso',
    'create or replace function public.dash_admin_confirmar_entrega',
    "public.asis_rol() is distinct from 'direccion'",
    "revision_estado,revisado_at,revisado_por",
    "'aprobada',now(),auth.uid()",
    'insert into public.asis_entrega_revisiones',
    "salida_origen='panel'",
    'salida_por=auth.uid()',
    'cierre_regularizado=true',
    "'cargada_por_direccion',auditoria.id is not null",
  ]) assert.ok(directionEvidenceSql.includes(fragment), `Direction evidence migration missing: ${fragment}`);
  assert.match(directionEvidenceSql,/p_hora_salida time default null/);
  assert.match(directionEvidenceSql,/length\(coalesce\(v_detalle,''\)\)<3/);
  assert.match(directionEvidenceSql,/coalesce\(a\.salida_reportada_at,e\.completado_at\)/);
  assert.match(edge,/body\.accion === "admin_cargar"/);
  assert.match(edge,/"dash_admin_entrega_permiso"/);
  assert.match(adminJs,/data-admin-upload-person/);
  assert.match(adminJs,/dash_admin_confirmar_entrega/);
  assert.match(adminJs,/accion:'admin_cargar'/);
  assert.match(adminJs,/aria-pressed="\$\{String\(active\)\}"/);
  assert.match(adminJs,/collageInput\.disabled=!collageAllowed/);
  assert.match(adminJs,/\$\('admin-evidence-exit-time'\)\.value=''/);
  assert.match(adminJs,/canUpload=canReview&&\(\$\('admin-close-date'\)\.value\|\|isoLima\(\)\)<=isoLima\(\)/);
  assert.match(html,/id="admin-evidence-modal"[^>]*hidden/);
  assert.match(html,/Hora visible en la foto de salida/);
  assert.match(css,/\.admin-evidence-workspace\{[^}]*grid-template-columns:280px/);
  assert.match(css,/\.admin-close-upload-trigger\{min-height:44px/);
  assert.match(css,/\.admin-evidence-preview button\{[^}]*width:44px;height:44px/);
  assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.admin-evidence-workspace\{display:block/);
});

test('phase 42 restores entry visibility and supports audited late exits', () => {
  for (const fragment of [
    'salida_gracia_min=greatest(salida_gracia_min,60)',
    'create or replace function public.dash_admin_cierres',
    "'entrada_at',registro.marcado_at",
    "'registro_encontrado',registro.id is not null",
    'create or replace function public.dash_admin_regularizar_cierre',
    "v_resumen->>'aplica_jornada'",
    "v_resumen->>'pendientes_salida'",
    'create or replace function public.dash_admin_confirmar_salida_tardia',
    "entrega.requisito<>'comparticiones'",
    "salida_origen='panel'",
    'salida_por=auth.uid()',
    'cierre_regularizado=true',
  ]) assert.ok(lateExitSql.includes(fragment), `late exit migration missing: ${fragment}`);
  assert.match(adminJs,/const rpc=isLateExit\?'dash_admin_confirmar_salida_tardia':'dash_admin_confirmar_entrega'/);
  assert.match(adminJs,/db\.rpc\('dash_admin_regularizar_cierre'/);
  assert.match(adminJs,/dashboard_42_entrada_y_salida_tardia\.sql/);
});

test('phase 43 repairs already uploaded exits from direct evidence state', () => {
  for (const fragment of [
    'create or replace function public.dash_admin_regularizar_cierre_impl',
    "entrega.requisito='rpe'",
    "entrega.requisito='comparticiones'",
    "entrega.requisito='salida'",
    'join public.asis_entregas_direccion auditoria',
    "salida_at=v_salida_at",
    'v_actualizada:=found',
    'perform public.dash_admin_regularizar_cierre_impl(',
    "registro.salida_at is null",
  ]) assert.ok(repairedExitSql.includes(fragment), `repaired exit migration missing: ${fragment}`);
  assert.doesNotMatch(repairedExitSql,/v_resumen->>'pendientes_salida'/);
  assert.match(adminJs,/function adminCloseResolvedState\(person,progress,date\)/);
  assert.match(adminJs,/if\(close\.salida_at\)\{[\s\S]*?if\(close\.estado==='incompleta'\)return 'incompleta';[\s\S]*?return close\.estado==='regularizada'\?'regularizada':'completa'/);
  assert.match(adminJs,/state=adminCloseResolvedState\(person,progress,selectedDate\)/);
});

test('close rows show each scheduled range and tint non-working days', () => {
  for (const fragment of [
    'rename to dash_admin_cierres_base_44',
    "'hora_inicio_programada',public.asis_hora_entrada(colaborador,p_fecha)",
    "'hora_salida_programada',public.asis_hora_salida(colaborador,p_fecha)",
  ]) assert.ok(closeSchedulesSql.includes(fragment), `close schedule migration missing: ${fragment}`);
  assert.match(adminJs,/function adminCloseClock\(value\)/);
  assert.match(adminJs,/function adminCloseSchedule\(person\)/);
  assert.match(adminJs,/admin-close-person\$\{person\.labora\?'':' is-off'\}/);
  assert.match(adminJs,/class="admin-close-person-schedule"/);
  assert.match(css,/\.admin-close-person\.is-off\{background:#fff2f4/);
  assert.match(css,/\.admin-close-person-schedule\{font-variant-numeric:tabular-nums/);
});

test('September 5 is excluded globally without deleting attendance history', () => {
  for (const fragment of [
    "fecha=date '2026-09-05'",
    "ambito='empresa'",
    "tipo='laborable_extra'",
    "date '2026-09-05',",
    "'Sistema de asistencia aun no disponible'",
    'create or replace function public.asis_compartir_programado',
    "and e.ambito='empresa'",
    "then false",
    "then 'OK'",
  ]) assert.ok(unavailableSeptemberFifthSql.includes(fragment), `September 5 correction missing: ${fragment}`);
  assert.doesNotMatch(unavailableSeptemberFifthSql,/delete\s+from\s+public\.asis_(registros|entregas_diarias)/i);
});

test('exit evidence keeps its time while other evidence remains pending', () => {
  for (const fragment of [
    'rename to dash_confirmar_entrega_base_46',
    "p_requisito is distinct from 'salida'",
    "and entrega.requisito='salida'",
    'v_salida_at not between v_desde_at and v_hasta_at',
    'set salida_at=v_salida_at',
    "v_resultado-'salida_motivo'",
    'rename to dash_cierre_resumen_colab_base_46',
    "(v_resultado->>'pendientes')::integer",
    "to_jsonb('incompleta'::text)",
    'Salida recuperada desde la evidencia registrada por el colaborador.',
    "colaborador.nombre ilike '%Mauricio%Obregon%'",
  ]) assert.ok(pendingExitSql.includes(fragment), `pending exit correction missing: ${fragment}`);
  assert.match(adminJs,/if\(close\.estado==='incompleta'\)return 'incompleta'/);
  assert.match(js,/const exitRecorded=!editing&&data\.salida_registrada===true/);
  assert.match(js,/La jornada seguirá incompleta hasta adjuntar las demás evidencias/);
});

test('workday state is independent from the configured Facebook window', () => {
  for (const fragment of [
    'rename to dash_cierre_resumen_colab_base_48',
    "requisito.item->>'tipo'<>'comparticiones'",
    "'{pendientes_jornada}'",
    "'{comparticiones_pendientes}'",
    "v_estado:='lista_para_salir'",
    'create or replace function public.dash_marcar_salida',
    "entrega.requisito='rpe'",
    'public.asis_asignaciones_diarias',
  ]) assert.ok(separatedFacebookSql.includes(fragment), `separated Facebook migration missing: ${fragment}`);
  assert.doesNotMatch(separatedFacebookSql,/asis_compartir_programado[\s\S]*?v_pendientes:=v_pendientes\+1/);
  assert.match(adminJs,/if\(close\.aplica_comparticiones===true\)expected\.add\('requisito:comparticiones'\)/);
  assert.doesNotMatch(adminJs,/progress\.total>0&&progress\.done<progress\.total\)\)return 'incompleta'/);
  assert.match(js,/Jornada laboral cerrada/);
  assert.match(js,/Facebook continúa pendiente en su horario independiente/);
  assert.match(js,/Facebook seguirá pendiente hasta que abra su horario independiente/);
});

test('a missed Facebook window makes the day incomplete only after its deadline', () => {
  for (const fragment of [
    'rename to dash_cierre_resumen_colab_base_49',
    'public.asis_compartir_fin_at(p_colaborador,p_fecha)',
    'now()>v_compartir_hasta',
    "'{comparticiones_vencidas}'",
    "'{estado}'",
    "to_jsonb('incompleta'::text)",
  ]) assert.ok(expiredFacebookSql.includes(fragment), `expired Facebook migration missing: ${fragment}`);
  assert.match(js,/if\(data\.comparticiones_vencidas\)return \{stage:'incomplete',title:'Compartición no entregada'/);
  assert.match(js,/La jornada laboral cerró, pero la compartición obligatoria no se entregó dentro de su horario/);
  assert.match(js,/Jornada incompleta · El horario de Facebook terminó sin registrar las capturas/);
  assert.match(js,/data\.comparticiones_vencidas\?'Compartición incompleta'/);
  assert.match(js,/data\.comparticiones_vencidas\?'Plazo finalizado'/);
});

test('assignment panel reports live completion and review states', () => {
  for (const fragment of [
    'rename to dash_admin_cierres_base_47',
    "'destinatarios'",
    "'entregados'",
    "'aprobados'",
    "'observados'",
    "'estado_asignacion'",
    "then 'aprobada'",
    "then 'observada'",
    "then 'entregada'",
    "then 'parcial'",
    "else 'pendiente'",
    "entrega.asignacion_id=asignacion.id",
  ]) assert.ok(assignmentStatusSql.includes(fragment), `assignment status migration missing: ${fragment}`);
  assert.match(html,/id="admin-close-assignments-refresh"/);
  assert.match(html,/id="admin-close-assignment-count" aria-live="polite"/);
  assert.match(adminJs,/function adminCloseAssignmentPresentation\(item\)/);
  assert.match(adminJs,/item\.estado_asignacion\|\|'pendiente'/);
  assert.match(adminJs,/setInterval\(\(\)=>\{if\(\['cierres','asignaciones'\]\.includes\(APP\.adminSection\)/);
  assert.match(adminJs,/loadAdminCloses\(\{quiet:true\}\)/);
  assert.match(css,/\.admin-assignment-state\.aprobada\{/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{/);
});

test('evidence policy respects collage configuration and minimum screenshots', () => {
  const context={};vm.createContext(context);new vm.Script(modelJs).runInContext(context);
  const policy=context.KJACloseModel.evidenceSelectionPolicy;
  assert.equal(policy({requirement:'comparticiones',mode:'individuales',count:1,min:1,max:50,collageAllowed:true}).ok,true);
  assert.equal(policy({requirement:'comparticiones',mode:'collage',count:1,min:5,collageAllowed:false}).reason,'collage_no_permitido');
  assert.equal(policy({requirement:'comparticiones',mode:'individuales',count:4,min:5,collageAllowed:true}).reason,'minimo');
  assert.equal(policy({requirement:'comparticiones',mode:'individuales',count:5,min:5,collageAllowed:false}).ok,true);
  assert.equal(policy({requirement:'comparticiones',mode:'individuales',count:42,min:5,max:50,collageAllowed:false}).ok,true);
  assert.equal(policy({requirement:'comparticiones',mode:'individuales',count:51,min:5,max:50,collageAllowed:false}).reason,'maximo');
  assert.equal(policy({requirement:'rpe',mode:null,count:1}).ok,true);
  assert.equal(policy({requirement:'rpe',mode:null,count:6}).reason,'maximo');
});

test('Facebook accepts large evidence sets without weakening other upload limits', () => {
  for (const fragment of [
    'check (orden between 1 and 50)',
    'v_total not between 1 and 50',
    'v_total<v_cfg.comparticiones_min or v_total>50',
    'v_nuevas not between 0 and 50',
    'v_conservadas not between 0 and 50',
    'v_imagenes<v_cfg.comparticiones_min or v_imagenes>50',
    'public.asis_compartir_fecha_activa(v_colab)',
    'public.asis_compartir_en_ventana(v_colab,v_fecha)',
  ]) assert.ok(expandedFacebookEvidenceSql.includes(fragment), `expanded Facebook evidence migration missing: ${fragment}`);
  assert.match(expandedFacebookEvidenceSql,/if coalesce\(p_requisito,''\)<>'comparticiones' then[\s\S]*?dash_confirmar_entrega_base_32/);
  assert.match(expandedFacebookEvidenceSql,/dash_reemplazar_entrega_base_35/);
  assert.match(js,/const FACEBOOK_EVIDENCE_MAX = 50/);
  assert.match(js,/for\(let index=0;index<selected\.length;index\+\+\)/);
  assert.match(js,/sourceBytes>300\*1024\*1024/);
  assert.match(html,/Desde 1 y hasta 50 imágenes/);
  assert.match(edge,/slice\(0, 50\)/);
});

test('Facebook requires only one image after phase 38', () => {
  assert.match(oneFacebookEvidenceSql,/alter column comparticiones_min set default 1/);
  assert.match(oneFacebookEvidenceSql,/set comparticiones_min=1/);
  assert.match(js,/comparticiones_min\|\|1/);
  assert.match(adminJs,/comparticiones_min\|\|1/);
  assert.doesNotMatch(js,/comparticiones_min\|\|5/);
  assert.doesNotMatch(adminJs,/Entre 5 y 50 capturas/);
});

test('phase 39 creates separate confirmed Direction accounts without changing personal PIN identities', () => {
  for (const fragment of [
    "('fabrizio@kja.com'::text,'72026017'::text)",
    "('erika@kja.com'::text,'71338491'::text)",
    'usuario.email_confirmed_at is not null',
    "perfil.rol='direccion'",
    "nivel='sistemas'",
    'acceso_panel=true',
    "v_uid,v_nombre,'direccion',true,null,'sistemas',true",
    'colaborador_id=null',
  ]) assert.ok(directionAccountsSql.includes(fragment), `Direction account migration missing: ${fragment}`);
  assert.doesNotMatch(directionAccountsSql,/delete\s+from\s+(public\.)?asis_/i);
  assert.doesNotMatch(directionAccountsSql,/update\s+public\.dash_sesiones/i);
  assert.doesNotMatch(directionAccountsSql,/where\s+perfil\.colaborador_id=v_colaborador/i);
  assert.doesNotMatch(directionAccountsSql,/kja2026/i);
});

test('all operational surfaces request closure-aware data', () => {
  assert.match(js,/dash_equipo_cierres_hoy/);
  assert.match(js,/dash_admin_cierres/);
  assert.match(adminMonthJs,/dash_admin_cierres_mes/);
  assert.match(adminMonthJs,/cierre_estado==='incompleta'/);
  assert.match(js,/closeError\|\|!closeData\?\.ok/);
  assert.match(adminMonthJs,/closeError\|\|!closeData\?\.ok/);
});

test('overnight close windows compare full timestamps instead of wrapped clock times', () => {
  assert.match(overnightSql,/create or replace function public\.asis_cierre_fin_at/);
  assert.match(overnightSql,/create or replace function public\.asis_cierre_fecha_activa/);
  assert.match(overnightSql,/v_now between v_desde_at and v_hasta_at/);
  assert.match(overnightSql,/now\(\) > public\.asis_cierre_fin_at/);
  assert.doesNotMatch(overnightSql,/v_ahora between v_desde and v_hasta/);
});

test('daily pending panel is visible before entry and evidence opens without inline page growth', () => {
  assert.match(js,/classList\.add\('has-daily-close'\)/);
  assert.match(js,/if\(!data\.entrada_at\)return \{stage:'entry'/);
  assert.match(js,/guideElement\.dataset\.stage=guide\.stage/);
  assert.match(js,/classList\.add\('daily-evidence-open'\)/);
  assert.match(js,/function mountDailyEvidencePortal\(\)/);
  assert.match(js,/document\.body\.append\(editor\)/);
  assert.match(js,/aria-controls="daily-evidence-editor"/);
  assert.doesNotMatch(js,/daily-evidence-editor'\)\.scrollIntoView/);
  assert.match(js,/\$\('day-close-button'\)\.onclick=\(\)=>APP\.cierre\?\.entrada_at\?openDailyExitModal\(\):handleMarkAction\(\)/);
  assert.doesNotMatch(js,/confirm\('Se registrará tu hora de salida/);
  assert.doesNotMatch(html,/asistencia-capybara\.png/);
  assert.match(css,/\.day-card\.has-daily-close \.day-action\{display:none!important\}/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-layout\{[\s\S]*?grid-template-columns:1fr/);
  assert.match(css,/\.day-close-guide\{[\s\S]*?--journey-progress:\.5/);
  assert.doesNotMatch(css,/\.day-card\.has-daily-close \.day-close\{[\s\S]*?max-height:334px/);
  assert.match(css,/\.daily-evidence-editor\{[\s\S]*?position:fixed[\s\S]*?z-index:1000/);
  assert.match(css,/\.daily-evidence-sheet\{[\s\S]*?max-height:min\(760px,calc\(100dvh - 40px\)\)/);
  assert.match(html,/id="daily-evidence-process"[\s\S]*?id="daily-upload-step-confirm"/);
  assert.match(js,/setDailyEvidenceProcess\('upload'/);
  assert.match(js,/setDailyEvidenceProcess\('success'/);
  assert.match(js,/Subiendo \$\{index\+1\} de \$\{DAILY_EVIDENCE\.files\.length\}/);
  assert.match(css,/@keyframes daily-check-draw/);
  assert.match(css,/\.portal\[data-time-phase\] \.today-layout \.day-card\.has-daily-close \.day-close\{[\s\S]*?var\(--ambient-strong\)/);
  assert.match(css,/Rediseño editorial del checklist/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-checklist\{[\s\S]*?background:rgba\(255,255,255,\.34\)/);
  assert.match(css,/Iconos del checklist con acabado de app iOS/);
  assert.match(css,/type-comparticiones:not\(\.is-complete\) \.day-close-check\{[\s\S]*?linear-gradient\(155deg,#54a4ff/);
  assert.match(css,/type-rpe:not\(\.is-complete\) \.day-close-check,[\s\S]*?linear-gradient\(155deg,#ffc85c/);
  assert.match(css,/type-salida:not\(\.is-complete\) \.day-close-check\{[\s\S]*?linear-gradient\(155deg,#62d7e4/);
  assert.match(css,/\.day-card\.has-daily-close \.day-close-item\.is-complete\{[\s\S]*?rgba\(36,166,138,\.13\)/);
});

test('mobile home exposes the same pending closure actions without tap zoom', () => {
  assert.match(html,/id="mobile-close-panel"[^>]*aria-labelledby="mobile-close-title"/);
  assert.match(html,/id="mcv2-banner"[^>]*role="status"[\s\S]*?id="mobile-close-banner-progress"/);
  assert.match(html,/class="mcv2-banner-figure"[^>]*src="images\/dashboard\/asistencia-3d\.webp"/);
  assert.doesNotMatch(html,/mcv2-banner-cta/);
  assert.doesNotMatch(html,/mcv2-journey|Ruta de tu jornada/);
  assert.match(html,/id="mobile-close-footer" hidden/);
  assert.match(html,/id="mobile-today-summary" role="status" aria-live="polite"/);
  assert.match(html,/ENTRADA REGISTRADA[\s\S]*?id="mobile-today-start"[\s\S]*?SALIDA REGISTRADA[\s\S]*?id="mobile-today-end"/);
  assert.match(js,/function renderMobileDailyClose\(data,items\)/);
  assert.match(js,/function renderMobileTimeRecord\(\{entryAt=null,exitAt=null,scheduledExit=null\}=\{\}\)/);
  assert.match(js,/renderMobileTimeRecord\(\{entryAt:data\.entrada_at,exitAt:data\.salida_at,scheduledExit:data\.hora_salida_programada\}\)/);
  assert.match(js,/mobile-close-banner-title'[\s\S]*?mobile-close-banner-progress/);
  assert.match(js,/data-daily-action="entry"[\s\S]*?aria-controls="mark-modal"/);
  assert.match(js,/mobile-close-list'[\s\S]*?dailyAction==='entry'[\s\S]*?handleMarkAction\(\)/);
  assert.match(js,/mobile-close-list'\)\.innerHTML=items\.map/);
  assert.match(js,/\$\('mobile-close-list'\)\.addEventListener\('click'/);
  assert.match(js,/\$\('mobile-close-action'\)\.onclick/);
  assert.match(js,/mobile-close-footer'\)\.hidden=action\.hidden\|\|action\.disabled\|\|action\.dataset\.action!=='exit'/);
  assert.match(css,/@media\(max-width:900px\), \(hover:none\)\{[\s\S]*?button:active:not\(:disabled\),a:active,\[role="button"\]:active\{transform:none!important\}/);
  assert.match(css,/button,a,\[role="button"\]\{touch-action:manipulation\}/);
  assert.match(css,/\.mobile-close-panel \.day-close-item\{[\s\S]*?min-height:62px/);
  assert.match(css,/\.mcv2-checklist::before\{[\s\S]*?border-left:1px dashed/);
  assert.match(css,/Cierre compacto:[\s\S]*?\.mcv2-time-cards\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.mcv2-footer\[hidden\],\.mcv2-footer-status\{display:none\}/);
  assert.match(css,/\.mcv2-head-left>div\{min-width:0;padding-right:94px\}/);
  assert.match(css,/\.mcv2-state-pill\{[\s\S]*?position:absolute;[\s\S]*?top:0;[\s\S]*?right:0/);
  assert.match(html,/id="mobile-month-prev"[\s\S]*?id="mobile-month-title"[\s\S]*?id="mobile-month-next"/);
  assert.match(js,/mobile-month-prev'\)\.onclick=\(\)=>\$\('month-prev'\)\.click\(\)/);
  assert.match(css,/#view-asistencia>\.attendance-topbar,[\s\S]*?#view-asistencia>\.attendance-stats\{display:none\}/);
  assert.match(css,/\.portal:not\(\[data-view="inicio"\]\) \.time-ambience\{position:fixed;transition:none\}/);
  assert.match(css,/#view-asistencia \.mobile-inline-home\{[\s\S]*?position:absolute;[\s\S]*?top:14px;[\s\S]*?right:14px/);
  assert.match(css,/grid-template-areas:"icon copy arrow" "icon state arrow"/);
  assert.match(css,/identidad legible, pendientes primero y accesos sin vacíos[\s\S]*?\.mobile-portal-home\{[\s\S]*?display:block;[\s\S]*?color:#102f55/);
  assert.match(css,/\.mobile-portal-sheet\{[\s\S]*?position:relative;[\s\S]*?z-index:2;[\s\S]*?min-height:0;[\s\S]*?display:flex;[\s\S]*?margin-top:-38px/);
  assert.match(css,/\.portal\[data-view="inicio"\] \.workspace\{[\s\S]*?position:relative;[\s\S]*?z-index:1/);
  assert.match(css,/Accesos móviles: dos columnas estables[\s\S]*?\.mobile-quick-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.mobile-quick-grid button\{[\s\S]*?min-height:124px;[\s\S]*?contain:layout paint;[\s\S]*?transform:none!important/);
  assert.match(css,/\.mobile-quick-grid button\.is-grid-orphan\{[\s\S]*?grid-column:1\/-1/);
  assert.match(css,/Safari amplía automáticamente[\s\S]*?textarea\{font-size:16px!important\}/);
  assert.match(js,/function syncMobileQuickGrid\(\)[\s\S]*?cards\.length%2===1[\s\S]*?classList\.add\('is-grid-orphan'\)/);
});

test('the rail announcement opens an accessible full-screen viewer', () => {
  assert.match(html,/id="rail-announcement-open"[\s\S]*?aria-controls="announcement-viewer"/);
  assert.match(html,/id="announcement-viewer"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(js,/function closeAnnouncementViewer\(\)/);
  assert.match(js,/if\(event\.key==='Escape'\).*closeAnnouncementViewer/);
  assert.match(css,/\.announcement-viewer-stage\{[\s\S]*?overflow:auto/);
  assert.match(css,/@media\(max-width:650px\)\{[\s\S]*?height:100dvh/);
  assert.doesNotMatch(css,/\.rail-announcement-media:hover\{[^}]*transform:/);
});

test('desktop header replaces date chrome with live monthly attendance progress', () => {
  assert.match(html,/class="dashboard-month-progress"/);
  assert.match(html,/id="dashboard-month-days"/);
  assert.doesNotMatch(html,/id="dashboard-month-rate"|id="dashboard-month-note"/);
  assert.doesNotMatch(html,/class="month-card"|id="month-rate"|id="month-days-visual"/);
  assert.match(html,/id="hours-accredited-detail"/);
  assert.match(html,/id="hours-goal-detail"/);
  assert.match(html,/id="hours-progress-track"[^>]*role="progressbar"[^>]*aria-valuenow="0"/);
  assert.match(html,/id="day-date" hidden/);
  assert.match(html,/id="day-status" hidden/);
  assert.match(js,/function renderDashboardMonthProgress\(h\)/);
  assert.match(js,/renderDashboardMonthProgress\(h\)/);
  assert.match(js,/state=incomplete\?'incomplete':day\.futuro\?'future'/);
  assert.match(js,/jornada incompleta':'jornadas incompletas'/);
  assert.match(js,/<em aria-hidden="true">!<\/em>/);
  assert.match(css,/\.dashboard-month-day\.today/);
  assert.match(css,/\.dashboard-month-day\.incomplete\.today/);
  assert.match(css,/grid-template-areas:"schedule close" "progress progress"/);
  assert.match(css,/grid-template-columns:minmax\(230px,\.58fr\) minmax\(300px,1\.42fr\) auto/);
  assert.match(css,/\.today-layout \.hours-progress-map/);
  assert.match(css,/\.hours-progress-map \.progress-track i\{[\s\S]*?width:100%/);
  assert.match(js,/hours-progress-track'\)\.setAttribute\('aria-valuenow'/);
  assert.match(css,/border-bottom:0!important/);
});

test('request evidence viewer does not collide with Direction missing-evidence uploader', () => {
  assert.match(js,/async function openAdminStoredEvidence\(path,bucket='asis-evidencias'\)/);
  assert.match(js,/openAdminStoredEvidence\(evidence\.dataset\.requestEvidence,REQUEST_BUCKET\)/);
  assert.match(adminJs,/function openAdminMissingEvidence\(personId,trigger=null\)/);
  assert.match(adminJs,/openAdminMissingEvidence\(upload\.dataset\.adminUploadPerson,upload\)/);
  assert.doesNotMatch(js,/function openAdminEvidence\(/);
  assert.doesNotMatch(adminJs,/function openAdminEvidence\(/);
});

test('stored request evidence opens in an accessible in-dashboard modal', () => {
  assert.match(html,/id="stored-evidence-viewer"[^>]*hidden/);
  assert.match(html,/class="announcement-viewer-sheet stored-evidence-viewer-sheet"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html,/id="stored-evidence-image"[^>]*hidden/);
  assert.match(html,/id="stored-evidence-retry"/);
  assert.match(js,/modal\.hidden=false;document\.body\.classList\.add\('stored-evidence-viewer-open'\)/);
  assert.match(js,/image\.src=data\.signedUrl/);
  assert.match(js,/function closeStoredEvidenceViewer/);
  assert.match(js,/if\(closeStoredEvidenceViewer\(\)\)return/);
  assert.doesNotMatch(js,/window\.open\(/);
  assert.match(css,/body\.stored-evidence-viewer-open\{overflow:hidden\}/);
  assert.match(css,/\.stored-evidence-viewer-stage img\{[\s\S]*?object-fit:contain/);
});
