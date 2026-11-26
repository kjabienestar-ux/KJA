// Migrate named module palettes by purpose (not by proximity of RGB values).
// The second argument is the exact previous declaration, preserving other
// portal views and existing mobile layout. No geometry or operational code.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import postcss from 'postcss';
import {desktopPossible} from './check-admin-colors.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const common={ink:'text-primary',body:'text-primary',muted:'text-secondary',faint:'text-secondary',line:'divider-subtle','line-2':'divider-subtle',side:'surface-opaque',accent:'action-primary','accent-2':'action-primary-hover','accent-soft':'surface-accent-tint','head-ink':'text-primary','head-line':'divider-subtle',yes:'status-text','yes-soft':'status-bg','yes-ink':'status-text',no:'status-error-text','no-soft':'status-error-bg','no-ink':'status-error-text',mid:'status-warning-text','mid-soft':'status-warning-bg','mid-ink':'status-warning-text','info-soft':'status-info-bg','info-ink':'status-info-text','na-soft':'status-neutral-bg','na-ink':'status-neutral-text'};
const role={ink:'text-primary',muted:'text-secondary',line:'divider-subtle','line-hover':'field-border',accent:'action-primary','accent-hover':'action-primary-hover',surface:'surface-opaque','card-bg':'surface-opaque',tint:'surface-hover',edge:'divider-subtle'};
const asg={teal:'action-primary','teal-hover':'action-primary-hover','teal-dark':'action-primary-pressed','teal-bg':'surface-hover','teal-tint':'surface-accent-tint','teal-border':'surface-border','teal-strong':'field-border',ink:'text-primary','ink-soft':'text-primary',muted:'text-secondary',faint:'text-secondary',line:'divider-subtle','line-strong':'field-border',field:'surface-opaque',surface:'surface-opaque',shadow:'surface-card-shadow',soft:'surface-hover',clay:'action-primary','clay-bg':'surface-accent-tint',sage:'status-text','sage-bg':'status-bg',slate:'status-info-text','slate-bg':'status-info-bg',ochre:'status-warning-text','ochre-bg':'status-warning-bg'};
const control={ink:'text-primary',body:'text-primary',muted:'text-secondary',subtle:'text-secondary',border:'field-border','card-border':'divider-subtle','card-border-hover':'surface-border',primary:'action-primary','primary-hover':'action-primary-hover'};
const prefix=(p,map)=>Object.fromEntries(Object.entries(map).map(([k,v])=>['--'+p+'-'+k,v]));
const manifest={
  'dashboard-skeleton.css':{scope:/^\.kja-skeleton-host(?:\.kja-context-view)?$/,'--kja-sk-base':'loading-neutral','--kja-sk-glow':'loading-shine','--kja-sk-card':'surface-opaque','--kja-sk-line':'divider-subtle'},
  'dashboard-people-workspace.css':{scope:/#admin-people-section\b/,...prefix('people',{...role,primary:'action-primary','primary-hover':'action-primary-hover','primary-soft':'surface-accent-tint','field-bg':'surface-opaque','field-focus':'surface-opaque','card-shadow':'surface-card-shadow','card-hover-shadow':'surface-card-shadow'})},
  'dashboard-admin-accounts.css':{scope:/^\.(?:admin-accounts|aa-dialog)$/,...prefix('aa',{ink:'text-primary',muted:'text-secondary',accent:'action-primary',line:'surface-border',paper:'surface-opaque'}),'box-shadow':'surface-dialog-shadow'},
  'dashboard-roles.css':{scope:/(?:#admin-roles-section\b|^\.admin-role-dialog$)/,...prefix('role',role)},
  'dashboard-contracts.css':{scope:/#admin-contracts-section\b/,...prefix('contract',{...role,'primary-soft':'surface-accent-tint','field-bg':'surface-opaque','field-focus':'surface-accent-tint','card-shadow':'surface-card-shadow','card-hover-shadow':'surface-card-shadow'})},
  'dashboard-close-workspace.css':{scope:/#admin-close-section\b/,...prefix('close',role)},
  'dashboard-review.css':{scope:/^#admin-(?:review|evidence)-modal$/,...prefix('review',{...role,canvas:'surface-hover',accent:'focus'}),...prefix('upload',role)},
  'dashboard-pasar-lista.css':{scope:/#admin-list-section\b/,...prefix('apl',{...common,vio:'status-justified-text','vio-soft':'status-justified-bg','vio-ink':'status-justified-text'}),...prefix('control',control)},
  'dashboard-facebook-report.css':{scope:/#admin-facebook-section\b/,...prefix('fbr',common)},
  'dashboard-ranking.css':{scope:/#admin-ranking-section\b/,...prefix('rk',{ink:'text-primary',body:'text-primary',muted:'text-secondary',faint:'text-secondary',line:'divider-subtle','line-2':'divider-subtle','head-ink':'text-primary','head-line':'divider-subtle',cream:'surface-opaque',peach:'surface-accent-tint','peach-2':'surface-hover',rust:'action-primary','rust-d':'action-primary-hover',track:'divider-subtle',hi:'status-text','hi-s':'status-bg','hi-i':'status-text',mid:'status-warning-text','mid-s':'status-warning-bg','mid-i':'status-warning-text',lo:'status-error-text','lo-s':'status-error-bg','lo-i':'status-error-text','na-s':'status-neutral-bg',gold:'status-warning-text','gold-s':'status-warning-bg','gold-i':'status-warning-text','gold-l':'surface-border',silver:'status-neutral-text','silver-s':'status-neutral-bg','silver-i':'status-neutral-text','silver-l':'surface-border',bronze:'action-primary','bronze-s':'surface-accent-tint','bronze-i':'action-primary-pressed','bronze-l':'surface-border'})},
  'dashboard-admin-asignaciones.css':{scope:/#admin-assignments-section\b/,...prefix('asg',asg)},
  'dashboard-assignments-workspace.css':{scope:/#admin-assignments-section\b/,...prefix('asg',asg)},
  'dashboard-admin-seguimiento.css':{scope:/#admin-seguimiento-section\b/,...prefix('seg',{paper:'surface-opaque',canvas:'surface-canvas',line:'divider-subtle',ink:'text-primary',muted:'text-secondary',accent:'action-primary',soft:'surface-accent-tint',green:'status-text'})},
  'dashboard-month-tramos.css':{scope:/#admin-month-section\b/,...prefix('month',{paper:'surface-opaque',line:'divider-subtle',ink:'text-primary',muted:'text-secondary',accent:'action-primary'})},
  'dashboard-admin-control.css':{scope:/#admin-control-section\b/,...prefix('control',control)},
  'dashboard-operations.css':{scope:/#admin-control-section\b/,...prefix('control',control)},
  'dashboard-claude.css':{scope:/^#portal\.admin-wide$/,'--navy':'text-primary','--blue':'action-primary','--ink':'text-primary','--muted':'text-secondary','--line-soft':'divider-subtle','--claude-canvas':'surface-canvas','--claude-soft':'surface-hover','--claude-line':'divider-subtle'},
  'dashboard-glass.css':{scope:/^#portal\.admin-wide$/,'--glass-surface':'surface-cream','--glass-edge':'surface-border','--glass-shadow':'surface-card-shadow','--claude-line':'divider-subtle',background:'surface-canvas'}
};

export function modulePaletteToken(file,prop,selector){
  const name=path.posix.basename(file.replaceAll('\\','/')),s=selector.trim();
  if(name==='dashboard-skeleton.css'){
    if(['.kja-skeleton-layer','.kja-skeleton-mirror'].includes(s)&&prop==='background')return 'surface-canvas';
    if(s==='.kja-sk-card'&&prop==='box-shadow')return 'surface-card-shadow';
    if(s==='.kja-skeleton-error')return ({color:'text-primary','box-shadow':'surface-dialog-shadow'})[prop]??null;
    if(s==='.kja-skeleton-error-icon')return ({background:'status-error-bg',color:'status-error-text'})[prop]??null;
    if(s==='.kja-skeleton-error h3'&&prop==='color')return 'text-primary';
    if(s==='.kja-skeleton-error p'&&prop==='color')return 'text-secondary';
    if(s==='.kja-skeleton-error button')return ({background:'action-primary',color:'on-action'})[prop]??null;
  }
  if(name==='dashboard-admin-control.css'&&s==='#portal #admin-control-section'&&prop==='background')return 'surface-opaque';
  const m=manifest[name];return m?.scope.test(s)?m[prop]??null:null;
}
export function moduleRoleForProperty(file,prop){
  const name=path.posix.basename(file.replaceAll('\\','/'));
  // The base wash is informational; explicit KPI states define their own role.
  if(name==='dashboard.css'&&prop==='--kpi-wash')return 'status-info-bg';
  return manifest[name]?.[prop]??null;
}
export function reconcileModulePalette(css,file){const tree=postcss.parse(css,{from:file}),changes=[];
  tree.walkDecls(decl=>{
    if(decl.parent.type!=='rule')return;const selector=decl.parent.selector;
    const token=modulePaletteToken(file,decl.prop,selector);if(!token||decl.value.startsWith('var(--kja-')||decl.value==='none')return;
    for(let p=decl.parent;p&&p.type!=='root';p=p.parent){if(p.type==='atrule'&&p.name==='media'&&!desktopPossible(p.params))return;
      if(p.type==='atrule'&&file.endsWith('dashboard-glass.css')&&(p.name==='supports'||p.name==='media'&&/prefers-reduced-transparency|forced-colors|\bprint\b/.test(p.params)))return;
    }
    // Single named role, exactly preserved legacy value (including gradient,
    // shadow or an earlier custom property fallback). No color guessing.
    const old=decl.value;decl.value=`var(--kja-${token}, ${old})`;
    changes.push({selector,prop:decl.prop,old,token});
  });return {css:tree.toString(),changes};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const changes=[];for(const name of Object.keys(manifest)){
    const file='assets/css/paginas/'+name,absolute=path.join(root,file),old=fs.readFileSync(absolute,'utf8'),result=reconcileModulePalette(old,file);
    if(result.changes.length){changes.push({file,uses:result.changes.length});if(process.argv.includes('--write'))fs.writeFileSync(absolute,result.css);}
  }console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'dry-run',total:changes.reduce((n,x)=>n+x.uses,0),changes},null,2));
}
