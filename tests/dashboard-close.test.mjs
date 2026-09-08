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
const edge = fs.readFileSync(new URL('../supabase/functions/dash-entrega/index.ts', import.meta.url), 'utf8');

test('dashboard JavaScript parses', () => {
  assert.doesNotThrow(() => new vm.Script(js));
  assert.doesNotThrow(() => new vm.Script(modelJs));
  assert.doesNotThrow(() => new vm.Script(adminJs));
  assert.doesNotThrow(() => new vm.Script(adminControlJs));
  assert.doesNotThrow(() => new vm.Script(adminMonthJs));
  assert.doesNotThrow(() => new vm.Script(adminTeamJs));
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
  assert.match(js,/function startReviewNotificationSync\(\)/);
  assert.match(js,/function mountReviewNotificationPortal\(\)[\s\S]*?document\.body\.appendChild\(layer\)/);
  assert.match(js,/const layer=mountReviewNotificationPortal\(\)/);
  assert.match(js,/const fresh=await loadReviewNotifications\(\{quiet:true\}\)/);
  assert.match(js,/fresh\?\.unread>0\)await markReviewNotificationsRead\(null\)/);
  assert.match(css,/\.review-notification-badge\{/);
  assert.match(css,/\.review-notification-layer\{position:fixed;z-index:1250/);
  assert.match(css,/@media\(max-width:900px\)\{[\s\S]*?\.review-notification-panel\{width:100%/);
  assert.doesNotMatch(html,/id="time-preview-switch"|id="weather-chip"|class="session-chip"/);
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
});

test('evidence policy respects collage configuration and minimum screenshots', () => {
  const context={};vm.createContext(context);new vm.Script(modelJs).runInContext(context);
  const policy=context.KJACloseModel.evidenceSelectionPolicy;
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
  assert.match(html,/Desde 5 y hasta 50 imágenes/);
  assert.match(edge,/slice\(0, 50\)/);
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
  assert.match(js,/function renderMobileDailyClose\(data,items\)/);
  assert.match(js,/mobile-close-list'\)\.innerHTML=items\.map/);
  assert.match(js,/\$\('mobile-close-list'\)\.addEventListener\('click'/);
  assert.match(js,/\$\('mobile-close-action'\)\.onclick/);
  assert.match(css,/@media\(max-width:900px\), \(hover:none\)\{[\s\S]*?button:active:not\(:disabled\),a:active,\[role="button"\]:active\{transform:none!important\}/);
  assert.match(css,/button,a,\[role="button"\]\{touch-action:manipulation\}/);
  assert.match(css,/\.mobile-close-panel \.day-close-item\{[\s\S]*?min-height:62px/);
  assert.match(css,/identidad legible, pendientes primero y accesos sin vacíos[\s\S]*?\.mobile-portal-home\{[\s\S]*?display:block;[\s\S]*?color:#102f55/);
  assert.match(css,/\.mobile-portal-sheet\{[\s\S]*?position:relative;[\s\S]*?z-index:2;[\s\S]*?min-height:0;[\s\S]*?display:flex;[\s\S]*?margin-top:-38px/);
  assert.match(css,/\.portal\[data-view="inicio"\] \.workspace\{[\s\S]*?position:relative;[\s\S]*?z-index:1/);
  assert.match(css,/\.mobile-close-panel\{order:2;[\s\S]*?\.mobile-quick-grid\{order:3;grid-template-columns:1fr/);
  assert.match(css,/\.mobile-quick-grid button\{[\s\S]*?min-height:82px;[\s\S]*?padding:15px 82px 15px 16px/);
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
