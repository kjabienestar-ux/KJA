// KJA-051: reviewed semantic replacements in the remaining explicit desktop rules.
// Never infer a role from the hex alone; file, selector, property and original
// literal must all match, and the rule must inherit the desktop token scope.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import {anchored,explicitDesktop} from './refactor-admin-desktop-tokens.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const bg=/^background(?:-color)?$/, border=/^border(?:-[\w-]+)?$/, ink=/^color$/;
const rows={
  'dashboard-access-workbench.css':[
    [/admin-office-map-retry|admin-office-rule/,bg,{'#fff':'surface-opaque'}],
    [/admin-access-message\.bad/,bg,{'#fff0f3':'status-error-bg'}],
    [/admin-access-message\.bad/,ink,{'#9c3548':'status-error-text'}],
    [/admin-link-security button/,border,{'#af6875':'action-danger'}],
    [/admin-link-security button/,ink,{'#9c3548':'action-danger'}],
    [/admin-office-map-(?:shell|state)/,bg,{'#f5eee6':'surface-canvas'}],
    [/admin-qr-block/,bg,{'#fff':'surface-white'}],
    [/admin-route-link button/,bg,{'#763c29':'action-primary-pressed'}],
    [/admin-route-step/,bg,{'#f2e9df':'surface-hover'}],
    [/aw-pagination button/,border,{'#c7b9ab':'surface-border'}],
    [/aw-history.*aw-notices/,bg,{'rgba(255,253,249,.7)':'surface-cream'}],
    [/admin-access-person:hover/,bg,{'#f5eee6':'surface-hover'}],
  ],
  'dashboard-admin-asignaciones.css':[
    [/assignment-day-summary.*is-pending/,bg,{'#fff7e6':'status-warning-bg'}],
    [/assignment-day-summary.*is-pending/,ink,{'#b45309':'status-warning-text'}],
    [/assignment-day-summary.*is-review/,bg,{'#eef6ff':'status-info-bg'}],
    [/assignment-day-summary.*is-review/,ink,{'#1d4ed8':'status-info-text'}],
    [/assignment-day-summary dl/,bg,{'#f8fafc':'status-neutral-bg'}],
    [/assignment-list-hint b/,ink,{'#334155':'text-primary'}],
    [/asg-loading-row/,bg,{'#fff':'surface-white'}],
    [/asg-loading-row/,border,{'#e6dfd8':'divider-subtle'}],
    [/is-context-loading #assignment-day-summary-stats/,bg,{'#f3eee6':'surface-canvas'}],
    [/kja-context-view .kja-sk-block/,bg,{'#e7e7e7':'loading-neutral'}],
  ],
  'dashboard-admin-month-layout.css':[
    [/admin-month-area-row td/,bg,{'#f5f3ef':'surface-canvas'}],
    [/admin-month-workbench-head .admin-list-kpi/,border,{'#ffffff26':'divider-subtle'}],
  ],
  'dashboard-admin-organization.css':[
    [/admin-contract-doc/,border,{'#c5b19c':'surface-border'}],
    [/admin-contract-progress/,bg,{'#f8f1e8':'surface-hover','#a9583e':'action-primary','#e2d5c7':'surface-border'}],
    [/admin-contract-row|admin-role-row/,bg,{'rgba(255,253,249,.9)':'surface-opaque','#ece7df':'status-neutral-bg'}],
    [/admin-contract-status>b.active|contract-area-toggle\[aria-expanded|admin-contract-action button.*admin-role-manage/,ink,{'#79452f':'action-primary-pressed'}],
    [/admin-team-actions/,bg,{'rgba(255,253,249,.7)':'surface-cream'}],
    [/admin-toggle:has\(input:checked\)/,border,{'#a9583e':'action-primary'}],
    [/admin-role-audit-list i|admin-roles-lock i/,bg,{'#a9583e':'action-primary'}],
    [/admin-role-cell-team/,bg,{'#f8f1e8':'surface-hover'}],
    [/admin-role-filters button\[aria-pressed=true\] b/,bg,{'#ffffff24':'filter-selected-count-bg'}],
    [/admin-role-mark\.is-co/,bg,{'#e8eee2':'status-bg'}],
    [/admin-role-mark\.is-co/,ink,{'#47644c':'status-text'}],
    [/admin-role-mark\.is-vacant/,bg,{'#f3eee7':'status-neutral-bg'}],
    [/admin-role-mark\.is-vacant/,ink,{'#8b7f72':'status-neutral-text'}],
    [/admin-role-mark\.is-vacant|rh-empty/,border,{'#b6a999':'surface-border','#b8a694':'field-border'}],
    [/admin-role-person small:is\(\.waiting,\.warning\)/,ink,{'#9c5c00':'status-warning-text'}],
    [/#view-gestion>:is\(#admin-contracts-section,#admin-roles-section\)/,bg,{'rgba(244,239,231,.75)':'surface-canvas'}],
    [/#view-gestion>:is\(#admin-contracts-section,#admin-roles-section\)/,border,{'#ffffffbd':'surface-border'}],
    [/admin-list-kpis/,bg,{'rgba(255,253,249,.8)':'surface-cream'}],
    [/modal-backdrop/,bg,{'#332b2452':'surface-scrim'}],
    [/admin-contract-row.*admin-role-row.*:hover/,border,{'#c4aa92':'field-border'}],
  ],
  'dashboard-admin-resumen.css':[
    [/admin-overview-section.kja-context-overview/,/^--kja-sk-card$/,{'#fff':'surface-white'}],
  ],
  'dashboard-loading-motion.css':[
    [/kja-skeleton-host/,/^--kja-sk-base$/,{'#e7e7e7':'loading-neutral'}],
    [/kja-sk-block::after/,bg,{'rgba(255,255,255,.65)':'loading-shine'}],
  ],
  'dashboard-pasar-lista.css':[[/apl-cards/,bg,{'#fff':'surface-white'}]],
  'dashboard-people-rows.css':[[/people-pending-row|pw-card/,border,{'#e6dfd8':'divider-subtle'}]],
  'dashboard-people-workbench.css':[
    [/admin-days-off-balance|admin-create-progress/,ink,{'#79432b':'action-primary-pressed','#79452f':'action-primary-pressed'}],
    [/admin-days-off-mode>div/,bg,{'#eee7df':'surface-canvas'}],
    [/admin-create-success/,bg,{'#f2e2d5':'surface-accent-tint'}],
    [/admin-editor-message:not\(:empty\)/,bg,{'#fbeee9':'status-error-bg'}],
    [/admin-editor-message:not\(:empty\)/,ink,{'#8a3228':'status-error-text'}],
    [/admin-editor-tabs button.is-complete/,ink,{white:'on-action'}],
    [/admin-editor-tabs button::before/,bg,{'#ddd3c8':'divider-subtle'}],
    [/admin-editor-tabs button\[aria-current\]/,ink,{'#79452f':'action-primary-pressed'}],
    [/create-success-confetti i/,bg,{'#ad644b':'action-primary','#bc8a54':'chart-pending'}],
    [/create-success-icon/,border,{'#d9c2ae':'surface-border','#c88d73':'action-primary'}],
    [/\[aria-invalid=true\]/,/^(?:border-color|outline)$/,{'#a43d30':'action-danger'}],
    [/pw-editor-profile|admin-editor-inline-action|pw-editor-next|pw-inline-foot|pw-inline-notice/,border,{'#dfc5b1':'surface-border','#cfa98d':'field-border','#b79a83':'field-border'}],
    [/pw-editor-profile|admin-editor-inline-action|admin-schedule-row|pw-editor-next|pw-inline-foot|pw-inline-notice/,bg,{'#fbf4ed':'surface-hover','#faf7f2':'surface-opaque','#f8eee4':'surface-accent-tint'}],
    [/admin-editor-step|pw-card-edit/,bg,{'#fff':'surface-opaque'}],
    [/admin-editor-step:disabled|admin-field-add:disabled/,ink,{'#cfc6bc':'action-disabled-text','#b3a99f':'action-disabled-text'}],
    [/pw-editor-next|pw-inline-notice|pw-inline-summary/,ink,{'#79432b':'action-primary-pressed'}],
    [/pw-inline-editing>.pw-inline-switch/,border,{'#efe8e0':'divider-subtle'}],
    [/pw-shift-day.is-edited/,bg,{'#fffaf5':'surface-hover','#a9583e':'action-primary'}],
    [/pw-segmented/,bg,{'#f0ebe5':'surface-canvas'}],
    [/admin-schedule-grid.*facebook-schedule-grid/,/^scrollbar-color$/,{'#cdbfb1':'field-border'}],
    [/af-options|af-popup|editor-calendar|select::picker/,border,{'#d9c2ae':'surface-border'}],
    [/af-options|select option/,ink,{'#79452f':'action-primary-pressed'}],
    [/facebook-schedule-note|contract-document-drop/,bg,{'#f8f3ec':'surface-hover'}],
    [/admin-areas-panel .area-delete/,bg,{'#fff5f5':'status-error-bg'}],
    [/admin-areas-panel .area-delete/,border,{'#ba6a70':'action-danger'}],
    [/admin-areas-panel .area-delete/,ink,{'#9d3444':'action-danger'}],
    [/admin-people-kpis button/,border,{'#ded6cb':'divider-subtle'}],
    [/person-profile-block thead/,bg,{'#f2ece5':'surface-canvas'}],
    [/\.pw-modal::backdrop/,bg,{'#332b2452':'surface-scrim'}],
    [/admin-field-add:not\(:disabled\):hover.*admin-editor-nav/,bg,{'#f5e8db':'surface-hover'}],
  ],
};

// Complete-value replacements: these are elevations, not colors. Use the
// canonical elevation or no elevation for a flat interactive control.
const shadows={
  'dashboard-admin-asignaciones.css':[[/assignment-cta-btn/,/#91493024/,'none',1]],
  'dashboard-admin-organization.css':[
    [/#view-gestion>:is\(#admin-contracts-section,#admin-roles-section\)/,/#60473009/,'var(--kja-surface-card-shadow)',2],
    [/admin-contract-row|admin-role-row/,/#60473008/,'var(--kja-surface-card-shadow)',2],
  ],
  'dashboard-people-rows.css':[[/pw-workbench .pw-area/,/#33251a08/,'var(--kja-surface-card-shadow)',1]],
  'dashboard-people-workbench.css':[
    [/admin-editor-tabs button\[aria-current\]/,/#f2e2d5/,'0 0 0 4px var(--kja-surface-accent-tint)',1],
    [/pw-segmented button/,/rgba\(35,58,70,.08\)/,'var(--kja-surface-card-shadow)',1],
    [/af-popup.*editor-calendar/,/#30201524/,'var(--kja-selector-menu-shadow)',2],
    [/select::picker/,/#30201526/,'var(--kja-selector-menu-shadow)',1],
    [/^\.pw-modal$/,/#35282035/,'var(--kja-surface-dialog-shadow)',1],
  ],
};

const token=name=>'var(--kja-'+name+')';
const normalize=value=>value.toLowerCase().replace(/\s*([,/])\s*/g,'$1').replace(/\s+/g,' ');
export function reconcileSpecialized(css,file){
  const name=path.basename(file),tree=postcss.parse(css,{from:file});let count=0;
  tree.walkRules(rule=>{
    if(!postcss.list.comma(rule.selector).every(anchored))return;
    let desktop=false;
    for(let p=rule.parent;p&&p.type!=='root';p=p.parent){if(p.type==='atrule'&&p.name==='media'&&explicitDesktop(p.params))desktop=true;}
    if(!desktop)return;
    rule.walkDecls(decl=>{
      if(decl.prop==='box-shadow'){
        const change=(shadows[name]||[]).find(([sel,old])=>sel.test(rule.selector)&&old.test(decl.value));
        if(change){decl.value=change[2];count+=change[3];return;}
      }
      const mappings=(rows[name]||[]).filter(([sel,prop])=>sel.test(rule.selector)&&prop.test(decl.prop));
      if(!mappings.length)return;
      const parsed=valueParser(decl.value);
      parsed.walk(n=>{
        if(n.type!=='word'&&n.type!=='function')return;
        const literal=normalize(n.type==='function'?valueParser.stringify(n):n.value);
        for(const [,,map] of mappings){if(Object.hasOwn(map,literal)){n.type='word';n.value=token(map[literal]);delete n.nodes;count++;return false;}}
        if(n.type==='function'&&n.value.toLowerCase()==='url')return false;
      });
      decl.value=parsed.toString();
    });
  });
  return {css:tree.toString(),count};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const report={};for(const name of new Set([...Object.keys(rows),...Object.keys(shadows)])){
    const file=path.join(root,'assets/css/paginas',name),original=fs.readFileSync(file,'utf8');
    const {css,count}=reconcileSpecialized(original,file);if(!count)continue;
    report[name]=count;if(process.argv.includes('--write'))fs.writeFileSync(file,css);
  }
  console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:Object.values(report).reduce((a,b)=>a+b,0),report},null,2));
}
