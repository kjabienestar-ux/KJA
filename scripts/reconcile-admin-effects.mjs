// Replace complete effects by role. Never replace individual colors inside an
// arbitrary shadow or gradient. Preserve the exact original outside desktop.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import {allowed,directPaletteRuleAllowed} from './reconcile-admin-direct-palette.mjs';
import {scanPortal,literalColors} from './check-admin-colors.mjs';
import {reviewedDeclarationToken} from './admin-reviewed-declarations.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const control=/\b(?:input|textarea|select)\b|(?:field|search|picker-trigger|control|select-trigger|area-picker-trigger|af-trigger)/i;
const popup=/\b(?:[\w-]*(?:popup|popover|menu|listbox))(?=$|[\s.:#>\[])/i;
const dialog=/\b(?:[\w-]*(?:sheet|dialog-content|modal-content|leave-review))(?=$|[\s.:#>\[])/i;
const card=/\b(?:[\w-]*(?:card|panel|toolbar|kpis?|table|summary|ledger|person-list|group|row|section-head|area-overview))(?=$|[\s.:#>\[])/i;
const command=/(?:primary-action|secondary-action|kja-button|assignment-(?:toggle-btn|cta-btn|refresh-btn)|admin-refresh|admin-new-person|admin-attendance-excel|fbr-btn|rk-btn|admin-review-file-action|admin-evidence-submit)/i;
const focus=/:focus(?:-visible|-within)?\b/;
const state=/(?:aria-(?:checked|pressed|selected)|\.is-(?:active|selected)|\.active\b|\.selected\b|[.]on\b|:checked|state-picker|badge|status|legend|metric|medal|podium|avatar|icon|chart|area-theme|area-color|tone-|qr|map|logo|brand|media|preview|evidence-gallery|file-chip|image)/i;
const normalize=s=>s.trim().replace(/\s+/g,' ').replace(/\s*,\s*/g,',');
function target(selector){
  // Only the rightmost compound represents the element being styled. An
  // ancestor called "card" must not turn an inner button into a surface.
  let depth=0,quote='',start=0;
  for(let i=0;i<selector.length;i++){
    const c=selector[i];if(c==='\\'){i++;continue;}
    if(quote){if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
    else if(depth===0&&(/[>+~\s]/.test(c)))start=i+1;
  }
  const t=selector.slice(start).trim();return /^:(?:is|where)\(/.test(t)?'':t;
}
export function effectToken(file,selector,prop,value){
  const reviewed=reviewedDeclarationToken(file,selector,prop,value,'whole');
  if(reviewed)return reviewed;
  if(!allowed(file,selector)||!literalColors(prop,value).length||/announcement|brand|logo|leaflet|confetti/.test(selector))return null;
  if(/assignment-(?:delete|hours)\.css$/.test(file)){
    if(prop==='box-shadow'&&/^\.assignment-(?:delete|hours)-dialog$/.test(selector))return 'surface-dialog-shadow';
    if(prop==='background'&&/^\.assignment-(?:delete|hours)-dialog::backdrop$/.test(selector))return 'surface-scrim';
  }
  if(file.endsWith('dashboard-date-picker.css')){
    if(prop==='background'&&/\.kja-date-warm \.kja-(?:date-day|month-cell)\.is-selected$/.test(selector.trim())&&normalize(value)==='linear-gradient(160deg,#b66448,#94492f)')return 'action-primary';
    if(prop==='box-shadow'&&/\.kja-(?:date-day|month-cell)\.is-selected$/.test(selector.trim())&&/^0 4px 12px rgba\(/.test(value))return 'action-shadow';
    if(prop==='box-shadow'&&/\.kja-date-trigger:is\(\[aria-expanded="true"\],:focus-visible\)$/.test(selector.trim())&&/^0 0 0 [23]px #/.test(value))return 'action-shadow';
  }
  if(prop==='background'&&postcss.list.comma(selector).every(s=>command.test(target(s)))&&/^(?:linear-gradient\(160deg,#b66448,#94492f\)|linear-gradient\(160deg,#a9583e,#8e432b\))$/i.test(normalize(value)))return /:hover/.test(selector)?'action-primary-hover':/:active/.test(selector)?'action-primary-pressed':'action-primary';
  if(prop!=='box-shadow'||/var\(/.test(value)||/^none$/i.test(value))return null;
  const alternatives=postcss.list.comma(selector);
  // All alternatives must represent the same interaction/anatomy.
  if(alternatives.every(s=>focus.test(target(s))&&control.test(target(s)))&&/^0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+[234]px\s/.test(value)&&!/inset/.test(value))return 'field-focus-shadow';
  if(alternatives.some(s=>focus.test(s)||state.test(s)))return null;
  if(alternatives.every(s=>command.test(target(s)))&&!/inset/.test(value))return 'action-shadow';
  if(alternatives.every(s=>popup.test(target(s)))&&!/inset/.test(value))return 'selector-menu-shadow';
  if(alternatives.every(s=>dialog.test(target(s))))return 'surface-dialog-shadow';
  if(alternatives.every(s=>card.test(target(s)))&&!/inset/.test(value)&&/^0(?:px)?\s+[1-9]\d*px\s/.test(value))return 'surface-card-shadow';
  return null;
}
export function reconcileEffects(css,file){
  const tree=postcss.parse(css,{from:file}),changes=[];
  tree.walkRules(rule=>{if(!directPaletteRuleAllowed(rule))return;for(const d of rule.nodes){
    if(d.type!=='decl'||d.value.startsWith('var(--kja-'))continue;
    const token=effectToken(file,rule.selector,d.prop,d.value);if(!token)continue;
    const old=d.value;d.value=`var(--kja-${token}, ${old})`;changes.push({selector:rule.selector,prop:d.prop,old,token});
  }});return {css:tree.toString(),changes};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const changes=[];for(const file of scanPortal().keys()){
    const absolute=path.join(root,file),old=fs.readFileSync(absolute,'utf8'),r=reconcileEffects(old,file);
    if(r.changes.length){changes.push({file,uses:r.changes.length});if(process.argv.includes('--write'))fs.writeFileSync(absolute,r.css);}
  }console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:changes.reduce((n,x)=>n+x.uses,0),changes},null,2));
}
