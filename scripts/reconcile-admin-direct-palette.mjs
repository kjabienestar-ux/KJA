// Reviewed legacy palette families. Apply common semantic roles with the exact
// original color as fallback; never infer a color from numerical RGB distance.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {desktopPossible,scanPortal} from './check-admin-colors.mjs';
import {componentRoleToken,stateRoleToken} from './admin-component-role.mjs';
import {reviewedDeclarationToken} from './admin-reviewed-declarations.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const basename=f=>path.posix.basename(f.replaceAll('\\','/'));
const legacyAdmin=/^(?:assignment-|dashboard-(?:admin-|assignments|contracts|people-|person-editor|close-workspace|control-refined|roles|pasar-lista|ranking|facebook-report|access-workbench|areas\.|overview-modal|month-|attendance-preview|review|days-off|date-picker|person-calendar|operations))/;
const family=/[#.](?:admin[-\w]*|assignment[-\w]*|(?:apl|seg|asg|rk|rh|pw|aw|fbr|md|aa|moonrow|role|contract|pc|adc|kja-context)[-\w]*)\b|#view-gestion\b|#ranking-(?:help|detail-modal)\b/;
const other=/#view-(?:inicio|perfil|cert-cuentas|marketing|equipo|zoom)\b|#portal:not\(\.admin-wide\)|\[data-view\s*=\s*["']?(?:inicio|perfil|cert-cuentas|marketing|equipo|zoom)["']?\]/;
const asset=/qr|map|leaflet|photo|picture|signature|evidence-preview|file-preview|image-preview|logo|confetti|brand|video|canvas/i;
const state=/status|badge|tag|pill|chip|tone|(?:^|[._-])(?:ok|yes|no|bad|warn|error|success|pending|approved|presente|tardanza|justificado|ausente|rejected|done|hi|mid|lo)\b/i;
const control=/\b(?:input|select|textarea)\b|(?:-input|-field|-trigger|-picker|-search|-select|\.af-control)(?![\w-])/i;
const action=/\bbutton\b|\.btn\b|-button\b|-action\b|-primary\b|-retry\b|-submit\b|-link\b|-save\b|cta\b/i;
const accentState=/aria-(?:selected|pressed|checked)=['"]?true|\.is-(?:selected|active|checked)|\.selected\b|\.active\b|:checked|:active/i;
const neutralInk=new Set(['#0f172a','#252523','#403955','#3d3d3a','#1e293b','#334155','#293c39','#45433e','#24241f','#141413','#203248','#293c39','#3d3a36','#4d463e','#51483f','#38312b','#282622','#35312e','#3b3732','#2c3e50','#45433e']);
const mutedInk=new Set(['#64748b','#6c6a64','#94a3b8','#475569','#506278','#6a665f','#706981','#8c839d','#8a96a6','#8a847c','#8e8e93','#a39e95','#a39e96','#69635d','#625e56','#5c564f','#625b54','#68766c','#637168','#627169','#5f5a52','#6a6259','#595750','#526d76','#615b54','#6c6a6a','#8b7f72','#a19a90','#9a928a']);
const white=new Set(['#fff','#ffffff','#fffdf9','#fffefa','#fcfaf7','#faf9fd','#faf9f5','#faf7f2','#f8fafc','#f4f5f0','#f8f9fa','#f7f8fa','#f9fafb','#f7f6f3']);
const pale=new Set(['#f1f5f9','#f1eff7','#eee8f7','#f3eff9','#f5f0e8','#f3eee6','#efe9de','#f0ece5','#f2ece5','#f6eee4','#e8dff4','#f0e2d5','#f2e2d5','#f1ede6','#f5ece1','#f0f4f8','#f9f5f0','#f2f5ef','#f4f1ec']);
const neutralEdge=new Set(['#e2e8f0','#cbd5e1','#e6dfd8','#ded6cb','#e0ddea','#beb4cf','#edf0f3','#dce3ec','#e3e8ee','#d6cdc2','#e0e5dd','#dfe5db','#e7ebe3','#e5dbce','#e6ded4','#e8ded2','#eee7de','#d5c9bd','#d3c9bc','#dce3da','#b8a694','#e8e2dc','#ddd5cb','#e6d3c3','#d9cdc0','#e0d7cc','#c7b9ab','#998b7f','#87796d','#b7aa9c','#d0c4b8','#e6deda','#d0d5dd','#e5e7eb','#e2e2e2','#dce8ea','#d6e4e7']);
const warmAccent=new Set(['#a9583e','#98492e','#93472f','#8e4630','#94492f','#8e432b','#a05d48','#7d3d27','#783b27','#854027','#79452f','#79432b','#653c2d','#5f2f1e']);
const oldRoleAccent=new Set(['#655083','#53406d','#766498','#796493','#655078']);
const oldBlueAccent=new Set(['#075abc','#004fb0','#075565','#043e4a','#196d61','#13554c','#0f766e','#0d9488','#115e59','#197467','#0f4c5c']);
const tones=[
  {text:'status-text',bg:'status-bg',dark:new Set(['#08735a','#08765d','#1e7e59','#059669','#0b7550','#23664c','#35735f','#365e4a','#12a26f','#10b981','#15803d','#166534','#047857']),light:new Set(['#ecfdf5','#e3f6ee','#e8f0e8','#e5f2eb','#dcfce7','#d1fae5','#e6ece0'])},
  {text:'status-warning-text',bg:'status-warning-bg',dark:new Set(['#b45309','#d97706','#94590a','#805210','#805500','#d68a06','#9a7430','#7a5410','#9c5c00','#92400e','#f59e0b']),light:new Set(['#fff0d7','#fffbeb','#fff3d4','#fff1d3','#f3ead6','#fbf3df','#fef3c7','#fff7e6'])},
  {text:'status-error-text',bg:'status-error-bg',dark:new Set(['#922e43','#a03649','#dc2626','#9d3444','#923344','#b3263a','#da3e52','#f43f5e','#993e35','#9c3548','#973e46','#b91c1c','#991b1b','#be123c']),light:new Set(['#fef2f2','#ffe8ed','#fdebee','#fecdd3','#fff0f3','#f7e6e0','#fee2e2','#fce7f3'])},
  {text:'status-info-text',bg:'status-info-bg',dark:new Set(['#1d4ed8','#254d87','#315f7e','#2563eb','#0369a1','#1e40af','#0284c7']),light:new Set(['#eff6ff','#e8f0fe','#eef6ff','#dbeafe','#e0f2fe','#e5e9ec'])},
  {text:'status-justified-text',bg:'status-justified-bg',dark:new Set(['#7c3aed','#6d28d9','#623b84','#5b21b6']),light:new Set(['#f1ebfe','#ede9fe','#f5f3ff'])},
];
export function allowed(file,selector){
  if(other.test(selector)||asset.test(selector)&&/logo|brand|leaflet|confetti/i.test(selector))return false;
  const name=basename(file);if(!legacyAdmin.test(name)&&!['dashboard.css','dashboard-claude.css','dashboard-glass.css','dashboard-skeleton.css','dashboard-person-profile.css','dashboard-holiday.css'].includes(name))return false;
  return postcss.list.comma(selector).every(s=>family.test(s)||/^#?\.?portal\.admin-wide(?:\b|\[|:)/.test(s.trim())&&['dashboard-claude.css','dashboard-glass.css','dashboard.css'].includes(name)||name==='dashboard-areas.css'&&/\barea-picker(?:[-\w]*)\b/.test(s)||name==='dashboard-date-picker.css'&&/\bkja-(?:date|month)(?:[-\w]*)\b/.test(s));
}
const oldNeutralPrimary=new Set(['#1c1c1e','#102b50','#35475f','#183552','#293f33','#173d48','#2a3c54','#173656','#15243a','#30445d','#2c435c','#33475e','#344c65','#31465d','#344c5e','#233b57','#2e4159','#425872','#26354a','#1f2937','#374151','#334155','#243b53']);
const oldNeutralMuted=new Set(['#929dab','#607087','#8794a5','#636366','#8793a4','#8995a5','#706b65','#7a7287','#748296','#6d7f92','#718197','#8492a2','#8391a1','#61758a','#8491a3','#7c8796','#64758a','#66778b','#60758a','#64758c','#76869a','#8895a6','#aeb9c5','#8797aa','#60718a']);
const oldNeutralFill=new Set(['#eae5f4','#edf1f5','#fafbfc','#f2f2f7','#faf8fd','#eee3d7','#f6faff','#f5f8fb','#f5f9fd','#fbfcfd','#fafbfd','#f4effa','#e6ddf1','#f2f0ed','#e5eaf0','#f8fbfd','#f4f7fa','#f7f9fc','#f4f3f0','#f3f1ed','#f5f6f8','#f8f8f6','#f5f5f7','#f1f4f7']);
const oldNeutralEdges=new Set(['#d9c3b3','#d8cfc5','#e5e1dc','#dce3ea','#b8d0ea','#bfd2e8','#bdd1e8','#a9c4e2','#b9cfe7','#cfe1f3','#cbd4df','#d5dfe9','#dce5ef','#d5dde6','#e5eaf0','#e7edf4','#e0e7ee','#e1e6eb','#edf0f4','#dfe6ed','#cfd9e4']);
const legacyFocusEdge=new Set(['#74a7df','#3b82c4','#6d9fd5','#70a5df','#4b8dce','#7eaee1','#1774cf','#766498','#655083','#075abc','#007aff','#197467','#0f4c5c']);
const legacyAccentFiles=/dashboard-(?:areas|date-picker|review|person-editor|close-workspace|people-workspace|roles|contracts|admin-control|month-day-detail|month-tramos|admin-seguimiento|assignments-workspace)\.css$/;
// Legacy neutral values reviewed in the declaration inventory. The lists are
// semantic palettes rather than an RGB-distance or saturation heuristic.
const priorInk=new Set(['#2e435c','#34475f','#3f5269','#243d59','#223b57','#183b5b','#1c3552','#1d3654','#153957','#123b58','#1b3656','#223852','#334960','#243d56','#2b4058','#33506b','#34485f','#263d52','#31475f','#2b3f55','#40546a','#344b65','#243550','#1f2f44','#263449','#49576b','#34455b','#34485b','#253c55','#273950','#3c454f','#3d3d3f']);
const priorMuted=new Set(['#6d7e91','#738398','#687a8f','#7d8ba0','#7c8a9b','#758496','#8291a3','#78889a','#65788d','#68798c','#7d8c9f','#62758a','#617387','#60758b','#8d9bab','#8290a0','#75859a','#66778a','#62768b','#66788d','#697a8c','#8492a3','#7e8c9e','#7b8ca0','#8190a3','#7f8da0','#8291a2','#8795a6','#697b8f','#59687a','#758392','#6f7d8d','#88838d','#8e8e93','#6a6770']);
const priorSurface=new Set(['#f5f7f9','#f5f7fa','#f3f6f9','#f1f5fa','#f2f6fb','#f6f8fc','#f7f8fa','#f7fafc','#f8fbff','#f8f9fc','#f5f8fc','#f8fafb','#f2f6fa','#f4f6f8','#f7f8f9','#fafbff','#f7fbff','#eef2f6','#eef3f7','#f0f3f7','#f2f5f9','#e8edf2','#e9edf2','#ebeff3','#ecf0f4','#e9eff5','#eaf0f5','#edeff3','#f3f3f5','#f2f2f4','#f2f1f0','#f0eeeb','#f1eeea','#f5f2ef','#f8f5f1','#f7f2ed','#f6f1eb','#f2e9df','#eee6dc','#f5ede4','#eae5df','#e5e1dc']);
const priorEdge=new Set(['#dbe4ec','#e4eaf0','#dce4ec','#dbe3ed','#e0e6ed','#d6e0ea','#dce5ed','#d7e1eb','#d6dfe8','#d0dce8','#d8e1ec','#e0e7ef','#e4e9ef','#e7ecf0','#e8edf2','#e8edf3','#dfe6eb','#d8e0e8','#cfdbe7','#e2e7ec','#d8e1e9','#d7e0e8','#d1dce8','#d1dae5','#dfe4eb','#dee5ea','#e9edf2','#d8dfe7','#d6dfe7','#e4e7ec','#e1e4e9','#e4e8ec','#d9dde3','#d0d7e0','#d9dfe6','#e1e5e9','#e7e5e3','#d7d2cd','#d9d3cc','#ded9d3','#d7cbbf','#d8cbbf','#cdbfb2','#e5ddd4']);
export function directPaletteToken(file,selector,prop,value){
  const reviewed=reviewedDeclarationToken(file,selector,prop,value,'color');
  if(reviewed)return reviewed;
  // The attendance preview is mounted exclusively in the admin reports tab.
  // Its table header and states are paired roles; the printable report remains
  // untouched. These mappings also verify the preserved non-desktop fallback.
  if(basename(file)==='dashboard-attendance-preview.css'){
    const s=selector.trim(), c=value.toLowerCase(), fill=/^background(?:-color)?$/.test(prop), edge=/^border(?:-color)?$/.test(prop);
    if(prop==='outline'&&s.includes(':focus-visible')&&c==='#075abc')return 'focus';
    if(s.includes('td.is-punctual'))return fill?'status-bg':prop==='color'?'status-text':null;
    if(s.includes('td.is-late'))return fill?'status-warning-bg':prop==='color'?'status-warning-text':null;
    if(s.includes('td.is-incomplete'))return fill?'status-error-bg':prop==='color'?'status-error-text':null;
    if(s.endsWith('thead th'))return fill?'surface-canvas':prop==='color'?'text-primary':null;
    if(s.includes(':hover')&&fill&&['#e8eef6','#e8dff4'].includes(c))return 'surface-hover';
    if(s.includes('nth-child(odd)')&&fill&&c==='#f6f8fb')return 'surface-canvas';
    if(edge&&['#beb4cf','#dce3ec'].includes(c))return 'field-border';
    if(edge&&c==='#e0ddea')return 'surface-border';
    if(fill&&['#fff','#f1eff7'].includes(c))return 'surface-opaque';
    if(prop==='color'&&c==='#53406d')return 'action-secondary';
    if(prop==='color'&&c==='#595368')return 'text-secondary';
    if(prop==='color'&&['#09244c','#15243a'].includes(c))return 'text-primary';
  }
  if(basename(file)==='assignment-delete.css'){
    if(selector.trim()==='.assignment-delete-actions [data-remove]'&&value==='#b4233b'&&/^(?:background|border-color)$/.test(prop))return 'action-danger';
    if(selector.trim()==='.assignment-delete-dialog [role=status]'&&value==='#a32236'&&prop==='color')return 'status-error-text';
  }
  if(basename(file)==='dashboard-history-pages.css'&&selector.startsWith('#admin-review-modal .admin-review-file-picker')){
    if(prop==='color'&&value==='#fff'&&selector.includes('aria-pressed'))return 'on-action';
    if(/^(?:background|border-color)$/.test(prop)&&value==='#7a4532'&&selector.includes('aria-pressed'))return 'action-primary';
    if(prop==='outline'&&value==='#79442e'&&selector.includes(':focus-visible'))return 'focus';
  }
  if(basename(file)==='dashboard-skeleton.css'){
    if(selector.trim()==='.kja-skeleton-error'&&prop==='border'&&value.replace(/\s+/g,'')==='color-mix(insrgb,#b4231824%,var(--kja-sk-line))')return 'surface-border';
    if(selector.trim()==='.kja-skeleton-error button:focus-visible'&&prop==='outline'&&value.toLowerCase()==='#8dbbff')return 'focus';
  }
  if(!allowed(file,selector))return null;
  const c=value.toLowerCase(),ink=prop==='color',fill=/^(?:background|background-color)$/.test(prop),edge=/^border(?:-[\w-]+)?$/.test(prop)&&!/^border-(?:radius|width|style)$/.test(prop),outline=/^outline(?:-color)?$/.test(prop);
  const normalized=c.replace(/\s+/g,'');
  if(prop==='scrollbar-color'){
    if(['#edf2f6','#f4f5f0','#f1f5f9'].includes(c))return 'surface-canvas';
    if(['#a8b8c8','#a8b5c4','#9eacbe','#94a9bd','#bdcad8','#aebdcb','#d1d1d6','#bac7d5','#c6bbae','#b7aa9c','#d6cdc2','#c7bfd6','#cbd5e1','#a0b3a4','#d1cbdc','#94a3b8'].includes(c)||normalized==='rgba(9,36,76,0.15)')return 'surface-border';
  }
  if(fill&&/::-webkit-scrollbar-thumb/.test(selector)&&/^#[0-9a-f]{3,8}$/i.test(c))return 'surface-border';
  if(fill&&/^rgba\(/.test(normalized)&&!asset.test(selector)&&!/(?:tone-|area-theme|medal|podium|gallery|image|preview|logo|brand)/.test(selector)){
    if(/modal-backdrop|drawer-backdrop|dialog-backdrop/.test(selector)&&/^rgba\((?:37,37,35|9,36,76|2,18,41|15,23,42),/.test(normalized))return 'surface-scrim';
    if(/admin-close-/.test(selector)){
      if(/^rgba\(255,149,0,/.test(normalized))return 'status-warning-bg';
      if(/^rgba\(255,59,48,/.test(normalized))return 'status-error-bg';
      if(/^rgba\(52,199,89,/.test(normalized))return /mode\.presencial/.test(selector)?'surface-accent-tint':'status-bg';
      if(/^rgba\(88,86,214,/.test(normalized)&&/justificad/.test(selector))return 'status-justified-bg';
      if(/^rgba\(0,122,255,/.test(normalized))return /regularizada/.test(selector)?'status-bg':/mode\.virtual/.test(selector)?'status-info-bg':/:hover/.test(selector)?'surface-hover':'surface-opaque';
      if(/^rgba\(142,142,147,/.test(normalized)&&/area-badge/.test(selector))return 'status-neutral-bg';
    }
    if(/^rgba\(255,255,255,(?:0?\.9[267]|0?\.88|0?\.82|0?\.72)\)$/.test(normalized)&&/editor-head|sticky-bar|roles-seat|role-seat|admin-section-nav|admin-view-head/.test(selector))return 'surface-opaque';
    if(/^rgba\(248,250,252,\.76\)$/.test(normalized)&&/role-assignment/.test(selector))return 'surface-opaque';
    if(/^rgba\(255,255,255,(?:0?\.2)\)$/.test(normalized)&&/aria-pressed|filter-count/.test(selector))return 'filter-selected-count-bg';
    if(/^rgba\(255,255,255,\.8\)$/.test(normalized)&&/apl-mark:hover/.test(selector))return 'surface-hover';
  }
  // Legacy blue-grey borders were translucent. Use the semantic edge only
  // for a real border; do not recolor gradients, shadow components or assets.
  if(edge&&!asset.test(selector)&&['rgba(11,35,71,.12)','rgba(11,35,71,.075)','rgba(11,35,71,.13)','rgba(11,35,71,.08)','rgba(15,36,66,.08)'].includes(normalized))return control.test(selector)?'field-border':/border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';
  if(edge&&!/tone-|area-theme|medal|podium|qr-canvas|leaflet|logo/.test(selector)&&/^rgba\((?:11,35,71|9,36,76|20,60,99|20,56,94|13,54,94|15,36,66|64,57,85),\.?\d+\)$/.test(normalized))return control.test(selector)?'field-border':/border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';
  if(edge&&/^rgba\(7,90,188,\.?\d+\)$/.test(normalized)&&/admin-(?:office|entry|month|control|review|evidence|close)/.test(selector)&&!asset.test(selector))return control.test(selector)?'field-border':'surface-border';
  if(!/^#[0-9a-f]{3,8}$/.test(c)&&c!=='white')return null;
  if(prop==='caret-color'&&control.test(selector)&&!asset.test(selector))return 'text-primary';
  if(!(ink||fill||edge||outline||prop==='accent-color'))return /^(?:fill|stroke)$/.test(prop)?stateRoleToken(selector,prop,c):null;
  if(outline&&/:focus(?:-visible|-within)?/.test(selector))return 'focus';
  if(prop==='accent-color'&&(warmAccent.has(c)||oldBlueAccent.has(c)||oldRoleAccent.has(c)))return 'action-primary';
  if(ink&&(c==='#fff'||c==='#ffffff'||c==='white'))return 'on-action';
  if(asset.test(selector))return null;
  if(basename(file)==='dashboard-date-picker.css'){
    if(edge&&['#e2dde9','#eeeaf5'].includes(c))return 'surface-border';
    if(ink&&/:disabled/.test(selector)&&['#ccc7d5','#d6cdc2'].includes(c))return 'action-disabled-text';
    if(c==='#9b5b40'&&(ink||fill))return 'action-primary';
    if(fill&&c==='#dcd0eb'&&/:active/.test(selector))return 'action-neutral-pressed';
  }
  // The old blue/violet variants represent the same operations, not an
  // additional brand. Map by function while keeping area identity and assets.
  const areaIdentity=/tone-|area-theme|area-pastel|--area-color|medal|podium/.test(selector);
  const calendar=/date-picker|date-popup|date-day|date-nav|month-cell|date-warm/.test(selector);
  const statusCode=/(?:\.p\b|\.presente\b|\.t\b|\.tardanza\b|\.j\b|\.justificado\b|\.ng\b|\.incomplete\b|\.ausente\b)/i.test(selector);
  const statusFamily=state.test(selector)||statusCode||/message|reject|approve|warning|legend|state-picker|reasons|is-off|\.registered\b|\.complete\b|\.blocked\b|\.missing\b|(?:status|state)[-\w]*\.danger/.test(selector);
  if(!areaIdentity){
    if(ink&&priorInk.has(c))return 'text-primary';
    if(ink&&priorMuted.has(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-text':statusFamily?'status-neutral-text':'text-secondary';
    if(fill&&priorSurface.has(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-bg':/:hover/.test(selector)?'surface-hover':statusFamily?'status-neutral-bg':control.test(selector)?'surface-opaque':'surface-canvas';
    if(edge&&priorEdge.has(c))return control.test(selector)?'field-border':/border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';
    if(ink&&oldNeutralPrimary.has(c))return 'text-primary';
    if(ink&&oldNeutralMuted.has(c))return /:disabled|\[disabled\]|\.is-off/.test(selector)?'action-disabled-text':statusFamily?'status-neutral-text':'text-secondary';
    if(fill&&oldNeutralFill.has(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-bg':/:hover/.test(selector)?'surface-hover':/avatar/.test(selector)?'person-avatar-bg':statusFamily?'status-neutral-bg':control.test(selector)?'surface-opaque':'surface-canvas';
    if(edge&&oldNeutralEdges.has(c))return control.test(selector)?'field-border':/border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';
    if((edge||outline)&&legacyFocusEdge.has(c)&&/:focus(?:-visible|-within)?/.test(selector))return outline?'focus':control.test(selector)?'field-border':'focus';
    if((edge||ink||fill||prop==='accent-color')&&(legacyAccentFiles.test(basename(file))||calendar||/\.admin-(?:entry|evidence|review|close|office|month|refresh|field|area)/.test(selector))&&(oldRoleAccent.has(c)||oldBlueAccent.has(c)||c==='#007aff')&&!statusFamily){
      if(edge&&(/aria-expanded|aria-selected|has-selection|:focus/.test(selector)))return 'selection-border';
      if(fill&&(action.test(selector)||calendar||accentState.test(selector)))return /:hover/.test(selector)?'action-primary-hover':/:active/.test(selector)?'action-primary-pressed':'action-primary';
      if(ink||edge||prop==='accent-color')return 'action-primary';
    }
    if(statusFamily){
      const justified=/\.j\b|justificad/.test(selector),warn=/\.t\b|warn|pend|tardanza/.test(selector),error=/\.ng\b|reject|danger|incomplete|\.bad\b|ausente|error|\.is-off/.test(selector),positive=/\.p\b|approve|present|success|ready|complete|registered/.test(selector);
      if(['#285f9f','#397fcc','#1d4ed8','#174f84','#075abc'].includes(c)&&ink)return justified?'status-justified-text':'status-info-text';
      if(['#e8f1fb','#eaf3fc','#eff6ff','#e0f2fe'].includes(c)&&fill)return justified?'status-justified-bg':'status-info-bg';
      if(['#a03649','#9b3046','#a33d4d','#d70015','#e11d48','#c23b50','#922e43','#dc2626','#ef4444','#993e35'].includes(c)&&(ink||fill||edge))return 'status-error-text';
      if(['#fff1f2','#ffe9ed','#ffe4e6','#fff4f6','#fef2f2','#ffe8ed','#f6cdd3','#fda4af','#efc5cd'].includes(c)&&(fill||edge))return edge?'surface-border':'status-error-bg';
      if(['#08745c','#08765f','#14532d','#065f46','#08735a','#1aa57e','#15916d','#34c759','#10b981'].includes(c)&&(ink||fill||edge))return 'status-text';
      if(['#e4f7f0','#e5f7f1','#dff4ed','#ecfdf5','#a7f3d0'].includes(c)&&(fill||edge))return edge?'surface-border':'status-bg';
      if(['#986000','#936000','#b25e00','#b45309','#d79320','#d8921d'].includes(c)&&(ink||fill||edge))return 'status-warning-text';
      if(['#fff0d7','#fffbeb','#fef3c7','#f3e2b8','#fde68a'].includes(c)&&(fill||edge))return edge?'surface-border':'status-warning-bg';
      // Explicit status-code selectors never use a generic hue to change the
      // meaning of a business state. Unknown values remain for review.
      if(justified&&edge&&['#397fcc','#075abc'].includes(c))return 'status-justified-text';
    }
    if(ink&&['#8b97a7','#65758a','#738196','#68778b','#758397','#8793a3','#627287','#607287','#6d7d90','#718096','#8a857d','#756884'].includes(c))return statusFamily?'status-neutral-text':'text-secondary';
    if(ink&&['#24374f','#40536b','#435b74','#263f59','#2a3d55','#2b3e56','#183b62','#334a65','#193858','#55456e'].includes(c))return 'text-primary';
    if(ink&&c==='#1d4ed8'&&/\.md-person-context/.test(selector))return 'status-info-text';
    if(fill&&c==='#eff6ff'&&/\.md-person-context/.test(selector))return 'status-info-bg';
    if(ink&&c==='#075abc'&&/admin-request-actions|admin-control-row|assignment-evidence-link|admin-office/.test(selector))return 'action-secondary';
    if(ink&&c==='#168c98'&&/admin-route-card|admin-policy-card/.test(selector))return 'action-primary';
    if(fill&&c==='#168c98'&&/admin-policy-toggle/.test(selector))return 'action-primary';
    if(fill&&c==='#a9583e'&&/assignment-hours-track|kja-date|assignment-calendar/.test(selector))return 'action-primary';
    if(fill&&c==='#0f172a'&&/aria-pressed|is-active|\.active/.test(selector))return 'action-primary';
    if(ink&&['#0b4f87','#0b3f74','#174f84','#123f74','#1e40af','#174776'].includes(c)&&/button|action|link|export|module-value|tabs|file/.test(selector))return 'action-primary';
    if(ink&&['#b42323','#934459','#922e43','#993e35','#9b3046'].includes(c)&&/warn|danger|delete|remove|missing|assignment-row|preview button:hover/.test(selector))return 'action-danger';
    if(ink&&['#8a5708','#805f30','#78350f','#9a6200'].includes(c)&&/warning|amber|exit-note|incomplete-reasons/.test(selector))return 'status-warning-text';
    if((ink||fill)&&['#047857','#08735a','#15803d','#5f7a5a','#1aa57e'].includes(c)&&/kpi|compliance|\.ready|aprobada|registered|complete/.test(selector))return 'status-text';
    if((ink||fill)&&['#bd4257','#c23b50','#e11d48','#b42323','#ff3b30'].includes(c)&&/state|blocked|observed|missing|warning|ng|danger/.test(selector))return 'status-error-text';
    if(fill&&['#e2e8f0','#e8edf3','#f6f8fb','#f0f6fc','#f7f6f9','#ece5f5','#f8f6fc','#deedf0','#eee7dc','#edf2f6','#fbfdff','#f2f5f8','#e7ebf0','#f3f5f7','#eef3f8','#fbfcfe','#fafafc','#faf9f7','#f5f0e6'].includes(c))return /:disabled/.test(selector)?'action-disabled-bg':/:hover/.test(selector)?'surface-hover':accentState.test(selector)?'surface-accent-tint':control.test(selector)?'surface-opaque':'surface-canvas';
    if(fill&&['#e8f3ff','#e9f3ff','#e8f2fc','#e8f2ff'].includes(c)&&/info|icon|radius|requirement/.test(selector))return 'status-info-bg';
    if(fill&&['#fff3df','#fff0d7','#fef3c7'].includes(c)&&/missing|amber|pending|warning|\.t\b/.test(selector))return 'status-warning-bg';
    if(fill&&['#e4f7f0','#e4f7f1','#e6f7f1','#dff4ed','#ecfdf5'].includes(c)&&/approve|aprobada|green|today|draw-preview|office-icon/.test(selector))return /:hover/.test(selector)?'surface-hover':'status-bg';
    if(fill&&['#fff7f8','#fff4f6','#fff0f3','#ffe8ed','#fff1f2'].includes(c)&&/danger|error|message|observada|is-red/.test(selector))return 'status-error-bg';
    if(fill&&['#397fcc','#e8f1fb'].includes(c)&&/\.j\b/.test(selector))return c==='#397fcc'?'status-justified-text':'status-justified-bg';
    if(edge&&['#94a3b8','#efc5cd','#9fbedc','#6fa8df','#d9b9a6','#a8bcdf','#3b82f6','#8eb4d9','#9fc3e8','#dce1e8','#e5e0d9','#e3e3e6','#dcdde0','#d6deea','#a8b5c7','#8b9fb5','#d9d2c6','#b5a797','#ebe6df','#d7cec2','#beb0d1','#9580b1','#ecc9d3','#c3b6d4','#dedbe4','#9ab8d8','#dfe5dc'].includes(c))return /aria-pressed|\.active|aria-selected/.test(selector)?'selection-border':control.test(selector)?'field-border':'surface-border';
  }
  if(ink&&['#263d58','#40536a','#554d66','#09244c','#3d3a36','#344c66','#2d425a','#40536a'].includes(c))return 'text-primary';
  if(ink&&['#807391','#53657b','#455970','#7f8c9d','#718197','#8492a2','#8391a1','#61758a','#67798d','#52657b','#8a96a6','#6d7f92'].includes(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-text':state.test(selector)?'status-neutral-text':'text-secondary';
  if(fill&&['#f7f9fb','#fffefb','#f8fbfe','#faf6ef'].includes(c))return 'surface-opaque';
  if(edge&&['#ccd8e4','#e2e7ed','#dfe5ec','#d9e2eb','#e1e7ed','#edf1f4','#f0edf7','#f1f5f9'].includes(c))return control.test(selector)?'field-border':/border-(?:top|bottom|left|right)/.test(prop)?'divider-subtle':'surface-border';
  if(basename(file)==='dashboard-admin-accounts.css'){
    const account={
      '#9b342e':'action-danger','#ce9b91':'surface-border','#fff7f3':'status-error-bg','#f5eee5':'surface-hover','#e2d5c8':'surface-border','#eee0d2':'person-avatar-bg','#81472f':'person-avatar-text','#eadbcc':'surface-accent-tint','#75452f':'action-primary-pressed','#f4ede5':'surface-canvas','#9c8273':'field-border','#fffefb':'surface-opaque','#b4c2b0':'surface-border','#3e5b3c':'status-text','#f0f5ec':'status-bg','#fff3dc':'status-warning-bg','#79511a':'status-warning-text','#d5b778':'surface-border','#ede9e5':'status-neutral-bg','#5b514a':'status-neutral-text','#c2b6ad':'surface-border','#e8ddd3':'divider-subtle','#b8c5b1':'surface-border','#f1f6ed':'status-bg','#395331':'status-text','#fff3ee':'status-error-bg','#c99b8e':'surface-border','#8c362d':'status-error-text','#faf6ef':'surface-opaque','#f0e5d9':'surface-hover','#7d432d':'action-primary-hover','#f9e1d9':'status-error-bg','#30251f66':'surface-scrim'
    }[c];if(account)return account;
  }
  // Second pass: painted values observed in the desktop scenarios. The
  // indicator's semantic state is independent of its legacy hue.
  if(ink&&/kpi|metric|\.ready|\.vacant|\.danger|\.warning|\.incomplete|\.is-info|banner|status|state|legend|\.day-col|\.admin-month-cell/.test(selector)){
    if(['#1e7046','#1f7a4d','#15803d','#35735f','#08765d'].includes(c))return 'status-text';
    if(['#9c5c00','#9a5b0b','#79520e','#886316','#b45309'].includes(c))return 'status-warning-text';
    if(['#a9384c','#a23d32','#be185d'].includes(c))return 'status-error-text';
    if(c==='#1e3a8a')return 'status-info-text';
  }
  if(fill&&/\.ready|\.vacant|\.admin-month-cell|\.admin-access-health/.test(selector)){
    if(['#e9f6ee','#e5f7f1','#e6f7f1','#e6ede5'].includes(c))return 'status-bg';
    if(c==='#fdf3e2')return 'status-warning-bg';
    if(c==='#f4e1dc')return 'status-error-bg';
  }
  if(ink&&c==='#b9b2a8'&&/is-empty|is-zero/.test(selector))return 'text-secondary';
  if(ink&&c==='#d3cbc0'&&/:disabled|\.is-off/.test(selector))return 'action-disabled-text';
  if(ink&&c==='#c9c1b6'&&/rk-dash/.test(selector))return 'text-secondary';
  if(ink&&['#43546b','#213954','#33475f'].includes(c))return 'text-primary';
  if(ink&&c==='#895132'&&/seg-pilot/.test(selector))return 'action-primary-pressed';
  if(ink&&c==='#653c2d'&&/assignment|type-chip/.test(selector))return 'action-primary';
  if(ink&&c==='#914930'&&/admin-count|button/.test(selector))return 'action-primary';
  if(fill&&c==='#914930'&&/:hover/.test(selector))return 'action-primary-hover';
  if(fill&&c==='#f1e1d7'&&/admin-count/.test(selector))return 'surface-accent-tint';
  if(fill&&['#eeeae3','#eee8de','#e5e2dd','#e8e0d2'].includes(c))return /:hover/.test(selector)?'surface-hover':'surface-canvas';
  if(fill&&c==='#f6f3ec')return 'surface-opaque';
  if(edge&&['#e7e0d6','#d9bca6','#e9e2d9','#dfcfbf','#d9c4af','#e3cfc2','#e0d6ca'].includes(c))return 'surface-border';
  if(ink){if(neutralInk.has(c))return 'text-primary';if(mutedInk.has(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-text':state.test(selector)?'status-neutral-text':'text-secondary';}
  if(fill&&(white.has(c)||c==='white'))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-bg':/:hover/.test(selector)?'surface-hover':accentState.test(selector)&&!state.test(selector)?'surface-accent-tint':'surface-opaque';
  if(fill&&pale.has(c))return /:disabled|\[disabled\]/.test(selector)?'action-disabled-bg':/avatar|initials/.test(selector)?'person-avatar-bg':/justificad|\.is-just|\.j\b/.test(selector)?'status-justified-bg':accentState.test(selector)?'surface-accent-tint':state.test(selector)?'status-neutral-bg':/:hover/.test(selector)?'surface-hover':'surface-canvas';
  if(edge&&neutralEdge.has(c))return control.test(selector)?'field-border':/border-(?:bottom|top|left|right)/.test(prop)&&!action.test(selector)?'divider-subtle':'surface-border';
  const primary=warmAccent.has(c)||oldRoleAccent.has(c)&&/roles|contracts/.test(basename(file))||oldBlueAccent.has(c)&&action.test(selector)&&!state.test(selector);
  if(primary){if(fill&&action.test(selector))return /:hover/.test(selector)?'action-primary-hover':/:active/.test(selector)?'action-primary-pressed':'action-primary';
    if(edge&&/:focus/.test(selector))return control.test(selector)?'field-border':'focus';
    if((ink||edge)&&!state.test(selector))return /tab|aria-selected/.test(selector)&&edge?'tab-indicator-color':'action-primary';}
  for(const t of tones){if(state.test(selector)||/destructiv|danger|delete|remove|error|alert|notice|review|warning|legend|mark|evidence|score|medal|rank|progress|metric/i.test(selector)){
    if(ink&&t.dark.has(c))return t.text;if(fill&&t.light.has(c))return t.bg;if(fill&&t.dark.has(c))return t.text;if(edge&&t.dark.has(c))return t.text;if(edge&&t.light.has(c))return 'surface-border';
  }}
  return stateRoleToken(selector,prop,c)||componentRoleToken(selector,prop,c);
}
export function directPaletteRuleAllowed(rule){for(let p=rule.parent;p&&p.type!=='root';p=p.parent){if(p.type==='atrule'&&(p.name.endsWith('keyframes')||p.name==='media'&&(!desktopPossible(p.params)||/prefers-reduced-transparency|forced-colors|\bprint\b/.test(p.params))))return false;}return true;}
export function reconcileDirectPalette(css,file){const tree=postcss.parse(css,{from:file}),changes=[];tree.walkRules(rule=>{if(!directPaletteRuleAllowed(rule))return;
  for(const decl of rule.nodes){if(decl.type!=='decl'||decl.prop.startsWith('--'))continue;const parsed=valueParser(decl.value);parsed.walk(n=>{if(n.type==='function'&&!/^(?:rgba?|color-mix)$/i.test(n.value))return false;if(n.type!=='word'&&n.type!=='function')return;const old=valueParser.stringify(n),token=directPaletteToken(file,rule.selector,decl.prop,old);if(!token)return false;n.type='word';n.value=`var(--kja-${token}, ${old})`;delete n.nodes;changes.push({selector:rule.selector,prop:decl.prop,old,token});return false;});decl.value=parsed.toString();}});return {css:tree.toString(),changes};}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const changes=[];for(const file of scanPortal().keys()){const absolute=path.join(root,file),old=fs.readFileSync(absolute,'utf8'),result=reconcileDirectPalette(old,file);if(result.changes.length){changes.push({file,uses:result.changes.length});if(process.argv.includes('--write'))fs.writeFileSync(absolute,result.css);}}console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:changes.reduce((n,x)=>n+x.uses,0),changes},null,2));}
