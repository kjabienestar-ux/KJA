// Narrow, documented exceptions for non-component graphics and alternative
// platform rendering. These never excuse a generic field, text or button.
import path from 'node:path';
import postcss from 'postcss';
const base=file=>path.posix.basename(file.replaceAll('\\','/'));
export function externalModule(selector,file){
  // A global institutional announcement is mounted on document.body and can
  // appear independently of the active portal page. It is not a Gestión card.
  return base(file)==='dashboard-announcement.css'&&postcss.list.comma(selector).every(s=>/^\.kja-(?:announcement-[\w-]+|ann-dot(?:--done)?)(?:[\s.:#\[]|$)/.test(s.trim()));
}
export function outsideAdmin(selector,file=''){
  if(file&&externalModule(selector,file))return true;
  // Positive restrictions in EVERY alternative. A view mentioned only inside
  // :is/:not/:has is not sufficient proof.
  return postcss.list.comma(selector).every(s=>{
    let depth=0,positive='';for(let i=0;i<s.length;i++){
      if(depth===0&&s.startsWith(':not(.admin-wide)',i)){positive+=':not(.admin-wide)';i+=':not(.admin-wide)'.length-1;continue;}
      const c=s[i];if(c==='('){depth++;continue;}if(c===')'){depth--;continue;}if(depth===0)positive+=c;
    }
    return /#view-(?:inicio|perfil|cert-cuentas|marketing|equipo|zoom|asistencia|reclutamiento)(?![\w-])/i.test(positive)||
      /\[data-view\s*=\s*["']?(?:inicio|perfil|cert-cuentas|marketing|equipo|zoom|asistencia|reclutamiento)["']?\]/i.test(positive)||
      /(?:#portal|\.portal)(?=[.#:\[])[^\s>+~]*:not\(\.admin-wide\)/.test(positive);
  });
}
export function exceptionReason(file,selector,prop,value,at=[]){
  const name=base(file),all=predicate=>postcss.list.comma(selector).every(s=>predicate(s.trim()));
  if(name==='dashboard-admin-layout.css'&&prop==='--area-pastel'&&all(s=>/^#portal \.admin-role-area(?:\:nth-child\([^)]*\))?$/.test(s)))return 'area-identity-palette';
  if(name==='dashboard-admin-control.css'&&prop==='--area-color'&&all(s=>/^#portal #admin-control-section \.area-theme-[\w-]+$/.test(s)))return 'area-identity-palette';
  if(name==='dashboard-admin-control.css'&&all(s=>/^#portal #admin-control-section \.area-theme-[\w-]+ \.control-area-icon$/.test(s))&&/^(?:color|background|border-color)$/.test(prop))return 'area-identity-graphics';
  if(name==='dashboard-admin-control.css'&&/var\(--area-color,/.test(value)&&all(s=>s.includes('#admin-control-section'))&&/^(?:color|background|border-color|box-shadow)$/.test(prop))return 'area-identity-graphics';
  if(['dashboard.css','dashboard-close-workspace.css','dashboard-assignments-workspace.css'].includes(name)&&all(s=>/(?:\.admin-close-area-badge|\.asg-(?:opt|trigger)-avatar)\.tone-[\w-]+\b/.test(s))&&/^(?:color|background|border(?:-color)?)$/.test(prop))return 'area-identity-palette';
  if(name==='dashboard-admin-asignaciones.css'&&all(s=>/^body:has\(#portal\.admin-wide\) :is\(\.asg-opt-avatar,\.asg-trigger-avatar\)\.tone-[\w-]+$/.test(s))&&/^(?:color|background|border-color)$/.test(prop))return 'area-identity-palette';
  if(name==='dashboard-close-workspace.css'&&all(s=>/^#portal #admin-close-section \.admin-close-area-badge:is\(\.tone-[\w-]+,\.tone-[\w-]+\)$/.test(s))&&/^(?:color|background|border-color)$/.test(prop))return 'area-identity-palette';
  if(name==='dashboard-ranking.css'&&/^(?:background|box-shadow|border|border-bottom|--c)$/.test(prop)&&all(s=>/(?:\[data-medal=|\.rk-medal\b|\.rk-podium\b|\.rk-pd-[gsb]\b|\.rk-crown\b|\.rk-ring\.rk-tone-na)/.test(s)))return 'ranking-medal-graphics';
  if(name==='dashboard-glass.css'&&at.some(s=>/^@supports /.test(s)||/^@media .*\b(?:prefers-reduced-transparency|forced-colors|print)\b/.test(s))&&/^(?:--glass-surface|--glass-edge|background)$/.test(prop)&&all(s=>/^#portal\.admin-wide(?:\s+\.workspace)?$/.test(s)))return 'platform-fallback';
  if(name==='dashboard-skeleton.css'&&selector.trim()===':is(html[data-theme="dark"],body.dark-theme,.theme-dark) .kja-skeleton-host'&&/^--kja-sk-(?:base|glow|card|line)$/.test(prop))return 'excluded-dark-theme';
  if(name==='dashboard.css'&&prop==='--admin-ambient-background'&&all(s=>/^\.portal\.admin-wide(?:\[data-time-phase=["'][\w-]+["']\])?$/.test(s)))return 'ambient-shell';
  // Shared compatibility fallback for browsers without glass or for a user
  // requesting reduced transparency. The historic personal view is included.
  if(name==='dashboard.css'&&selector.replace(/\s+/g,'')==='.day-card,.progress-card,.month-card,.week-strip,.calendar-card,.profile-identity,.profile-data,.team-list,.team-summary,.admin-section-nav,.admin-kpi,.admin-panel,.admin-modules,.portal-rail'&&prop==='background'&&value==='#f8fbfe'&&at.some(x=>x.startsWith('@supports not ')||x.includes('prefers-reduced-transparency:reduce')))return 'platform-fallback';
  // Both consumers of this alias are now inside the fallback of the shared
  // focus shadow; retaining it preserves the non-desktop appearance.
  if(name==='dashboard-admin-control.css'&&selector.trim()==='#portal #admin-control-section'&&prop==='--control-primary-ring'&&value.replace(/\s/g,'')==='rgba(25,109,97,.15)')return 'legacy-focus-fallback';
  // An image/video matte or overlay must remain readable regardless of the
  // evidence's own colors. These are not the ordinary dialog surfaces.
  if(name==='dashboard.css'&&prop==='background'){
    const mattes={'.admin-review-gallery>a':'#071a34','.admin-evidence-preview':'#09244c','.admin-review-media':'#071a34','.admin-review-media video':'#061629','.admin-review-gallery>a span':'rgba(6,26,56,.88)','.admin-review-gallery>a>svg':'rgba(6,26,56,.88)','.admin-evidence-preview button':'rgba(6,26,56,.9)','.admin-review-media>span':'rgba(6,26,56,.88)','.admin-review-media>a':'rgba(6,26,56,.88)'};
    if(mattes[selector.trim()]===value)return 'evidence-media-matte';
  }
  if(name==='dashboard-month-day-detail.css'&&selector.trim()==='.md-media'&&prop==='box-shadow'&&value==='inset 0 0 0 1px rgba(255, 255, 255, 0.05)')return 'evidence-media-matte';
  if(name==='dashboard-admin-seguimiento.css'){
    if(selector.trim()==='#admin-seguimiento-section .seg-gallery'&&prop==='background'&&value==='repeating-conic-gradient(#f0ede6 0% 25%,#f4f1eb 0% 50%) 50% / 18px 18px')return 'evidence-transparency-grid';
    if(selector.trim()==='#admin-seguimiento-section .seg-gallery>img'&&prop==='outline'&&value==='1px solid #0000001a')return 'evidence-image-outline';
  }
  if(name==='dashboard-days-off.css'){
    if(selector.trim()==='.admin-leave-hero::after'&&prop==='background'&&value==='radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(16, 185, 129, 0.1) 50%, transparent 72%)')return 'illustration-effects';
    if(selector.trim()==='.admin-leave-hero .day-off-hero-img'&&prop==='filter'&&value==='drop-shadow(0 8px 20px rgba(7, 90, 188, 0.2))')return 'illustration-effects';
  }
  if(name==='dashboard-facebook-report.css'&&selector.trim()==='#portal #admin-facebook-section.fbr .fbr-fbico'&&prop==='color'&&value==='#1877f2')return 'external-brand';
  // Pure-white canvases for machine-readable QR codes, not the surrounding UI.
  if(/^(?:dashboard\.css|dashboard-access-workbench\.css)$/.test(name)&&/^(?:background|background-color)$/.test(prop)&&/^#(?:fff|ffffff)$|^white$/i.test(value)&&all(s=>/\.admin-qr-canvas(?:\s+canvas)?$/.test(s)))return 'qr-canvas';
  return null;
}
