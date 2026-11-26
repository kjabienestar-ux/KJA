// KJA-051: read-only consumer evidence in the local, simulated admin portal.
// A DOM match is evidence of a consumer, not a proof of cascading priority or
// universal reachability. Unobserved selectors must not be deleted on that basis.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import postcss from 'postcss';
import {chromium} from 'playwright';
import {adminDataFixture,today} from '../tests/helpers/admin-data-fixture.mjs';
import {anchored,explicitDesktop} from './refactor-admin-desktop-tokens.mjs';
import {managedFallbackUses} from './reconcile-admin-shared-tokens.mjs';
import {designDigest} from './admin-audit-digest.mjs';
import {outsideAdmin} from './admin-legacy-exceptions.mjs';
import {pendingDeclarations} from './audit-admin-pending-declarations.mjs';
export {outsideAdmin} from './admin-legacy-exceptions.mjs';
export function inventory(registry){
  const groups=new Map();
  for(const [file,entries] of Object.entries(registry))for(const [key,colors] of entries){
    const parts=key.split(' | ')[0].split(' / '),selector=parts.at(-1),at=parts.slice(0,-1);
    const id=JSON.stringify([file,parts]);const g=groups.get(id)??{file,selector,at,uses:0,desktop:at.some(a=>a.startsWith('@media ')&&explicitDesktop(a.slice(7))),anchored:postcss.list.comma(selector).every(anchored)};
    g.uses+=Object.values(colors).reduce((a,b)=>a+b,0);groups.set(id,g);
  }
  return [...groups.values()].map((g,id)=>({...g,id,outside:outsideAdmin(g.selector,g.file)}));
}

async function run(){
  const digest=designDigest();
  const registry=JSON.parse(fs.readFileSync('docs/auditorias/KJA-051/excepciones-colores.json','utf8'));
  const entries=inventory(registry),observed=new Map();
  const managed=new Map();for(const file of Object.keys(registry))for(const [key,count] of managedFallbackUses(fs.readFileSync(file,'utf8'),file))managed.set(key,count);
  for(const entry of entries){entry.managedFallbacks=entry.outside?0:Math.min(entry.uses,managed.get(JSON.stringify([entry.file,[...entry.at,entry.selector]]))??0);}
  const justified=new Map(),exceptionCounts={};
  for(const row of pendingDeclarations({includeJustified:true}).filter(r=>r.reason)){
    const key=JSON.stringify([row.file,[...row.at,row.selector]]);justified.set(key,(justified.get(key)??0)+row.pending);exceptionCounts[row.reason]=(exceptionCounts[row.reason]??0)+row.pending;
  }
  for(const e of entries)e.justified=e.outside?0:Math.min(e.uses-e.managedFallbacks,justified.get(JSON.stringify([e.file,[...e.at,e.selector]]))??0);
  const pending=entries.filter(x=>!x.outside&&!x.at.some(a=>/^@(?:-webkit-)?keyframes /.test(a)));
  const origin='http://localhost:3000',data=adminDataFixture();
  // Synthetic authorization and records are confined to this intercepted
  // browser session. No real account or balance is written.
  data.dash_admin_dias_libres_pagina={ok:true,persona:{saldo:3},movimientos:[],total:0};
  data.dash_admin_dias_libres={ok:true,persona:{saldo:3},movimientos:[]};
  data.dash_admin_cuentas={ok:true,cuentas:[
    {id:'fixture-guardian',nombre:'Dirección de ensayo',email:'direccion@example.test',rol:'direccion',estado:'activa',superadmin:true},
    {id:'fixture-editor',nombre:'Editor de ensayo',email:'editor@example.test',rol:'editor',estado:'activa',superadmin:false},
    {id:'fixture-paused',nombre:'Cuenta suspendida de ensayo',email:'suspendida@example.test',rol:'visor',estado:'suspendida',superadmin:false},
    {id:'fixture-archived',nombre:'Cuenta archivada de ensayo',email:'archivo@example.test',rol:'visor',estado:'archivada',superadmin:false}
  ],historial:[]};
  data.dash_admin_lista={ok:true,fecha:today,puede_editar:true,personas:data.dash_admin_cierres.personas.map(p=>({...p,modalidad:'virtual',hora_entrada:'08:00',hora_salida:'13:00',horas:5}))};
  data.dash_admin_asignaciones_calendario={ok:true,dias:[]};
  data.dash_admin_cierres.puede_editar=true;
  const [year,month]=today.split('-').map(Number),calendarMonth=new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
  data.dash_historial={ok:true,horas:15,calendario_contrato:{contrato_inicio:'2020-01-01',contrato_fin_referencia:null},dias:[{estado:'P'},{estado:'T'},{estado:'J'},{estado:'P',aplica_comparticiones:true,comparticiones_vencidas:true},{estado:'P',cierre_estado:'incompleta'},{lab:false}].map((day,i)=>({fecha:calendarMonth+'-'+String(i+1).padStart(2,'0'),lab:true,aplica_comparticiones:false,...day}))};
  data.dash_equipo_dia_detalle={ok:true,estado:'J',cierre:{estado:'justificado'},horas:0};
  for(const area of data.dash_admin_roles.areas)area.personas=area.personas.map(p=>({...p,asignable:true,cuenta_activa:true}));
  data.dash_admin_roles.areas[0].personas.push(...Array.from({length:5},(_,i)=>({id:100+i,nombre:`Persona de ensayo ${i+1}`,activo:true,asignable:true,tiene_cuenta:true,cuenta_activa:true})));
  const fixture=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};').replace('superadmin:false','superadmin:true');
  const adapter='const rpc=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=rpc(...args);p.abortSignal=()=>p;return p;};';
  const browser=await chromium.launch({channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
    await page.addInitScript(()=>{window.QRCode={toCanvas:(_c,_t,_o,done)=>done(Error('QR sin red en el ensayo'))};});
    await page.route('**/*',route=>{const u=route.request().url();if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';'+fixture+adapter});return u.startsWith(origin+'/')&&route.request().method()==='GET'?route.continue():route.fulfill({body:''});});
    const r=await page.goto(origin+'/dashboard');if(!r.ok()||(await r.text()).trim()!==fs.readFileSync('dashboard.html','utf8').trim())throw Error('El portal servido difiere del repositorio.');
    await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
    const snapshots=[];
    async function visit(label){
      const result=await page.evaluate(groups=>{
        const visibility=new WeakMap(),tokenScope=new WeakMap(),visible=e=>{if(!visibility.has(e)){const s=getComputedStyle(e);visibility.set(e,!!e.getClientRects().length&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[hidden]'));}return visibility.get(e);};
        const token=e=>{if(!tokenScope.has(e))tokenScope.set(e,!!getComputedStyle(e).getPropertyValue('--kja-text-primary').trim());return tokenScope.get(e);};
        const out=[];
        for(const g of groups){
          if(g.at.some(a=>a.startsWith('@media ')&&!matchMedia(a.slice(7)).matches))continue;
          // A pseudo element is owned by the matching originating element, but
          // the audit does not establish whether its content is generated.
          const sel=g.selector.replace(/::[\w-]+(?:\([^)]*\))?(?=\s*(?:,|$))/g,'');
          let nodes;try{nodes=document.querySelectorAll(sel);}catch{out.push([g.id,'unsupported']);continue;}
          let scoped=0,unscoped=0;for(const e of nodes){if(!visible(e))continue;if(token(e))scoped++;else unscoped++;}
          if(scoped||unscoped)out.push([g.id,scoped?'scoped':'',unscoped?'unscoped':'']);
        }
        return out;
      },pending);
      snapshots.push(label);for(const [id,...flags] of result){const o=observed.get(id)??{flags:new Set(),views:new Set()};flags.filter(Boolean).forEach(f=>o.flags.add(f));o.views.add(label);observed.set(id,o);}console.log(label,'·',result.length,'selectores observados/inspeccionables');
    }
    const sections={overview:'overview',seguimiento:'seguimiento',lista:'list',asignaciones:'assignments',colaboradores:'people',contratos:'contracts',roles:'roles',mes:'month',facebook:'facebook',ranking:'ranking',marcado:'access'};
    const escape=async locator=>{await page.keyboard.press('Escape');await locator.waitFor({state:'hidden'});};
    for(const [nav,section] of Object.entries(sections)){
      await page.locator(`[data-lateral-section="${nav}"]`).click();await page.locator(`#admin-${section}-section[aria-busy="false"]`).waitFor();await page.locator('#portal.admin-wide[data-view="gestion"]').waitFor();await visit(nav);
      if(nav==='marcado'){await page.locator('#aw-tab-reglas').click();await visit('marcado-reglas');await page.locator('#aw-tab-enlaces').click();await visit('marcado-enlaces');}
      if(nav==='overview'){
        await page.locator('[data-overview-chart]').first().click();const modal=page.locator('#admin-overview-modal');await modal.waitFor();await visit('resumen-dialogo');await escape(modal);
      }
      if(nav==='lista'){
        await page.locator('#admin-entry-open').click();const modal=page.locator('#admin-entry-dialog');await modal.waitFor();await modal.locator('#admin-entry-date').focus();await visit('lista-registrar-entrada');await modal.getByRole('button',{name:'Cancelar',exact:true}).click();await modal.waitFor({state:'hidden'});
      }
      if(nav==='asignaciones'){
        const panel=page.locator('#assignment-create-panel'),toggle=page.locator('#assignment-create-toggle');
        if(!await panel.isVisible())await toggle.click();await panel.waitFor();await visit('asignaciones-formulario');
        const picker=panel.locator('.asg-picker-trigger');await picker.press('Enter');const popup=page.locator('#assignment-destination-picker');await popup.waitFor();await visit('asignaciones-destinatario');await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
        await panel.locator('[data-kind="sorteo"]').click();await visit('asignaciones-sorteo');
      }
      if(nav==='colaboradores'){
        const filter=page.locator('.pw-more-filters>summary');await filter.press('Enter');await visit('colaboradores-mas-filtros');await filter.press('Enter');
        await page.locator('.pw-card [data-team-profile]').first().click();const profile=page.locator('#pw-profile-dialog');await profile.waitFor();await visit('ficha-resumen');
        for(const label of ['Jornada','Facebook','Contrato','Historial']){await profile.getByRole('tab',{name:label,exact:true}).press('Enter');await visit('ficha-'+label.toLowerCase());}
        await profile.locator('[data-pw-days-off]').click();const days=page.locator('#admin-days-off-modal');await days.waitFor();await days.locator('#admin-days-off-amount').focus();await visit('dias-libres-ajuste');await days.locator('[data-days-off-mode="remove"]').click();await visit('dias-libres-descontar');await escape(days);
        await escape(profile);
        await page.locator('#admin-new-person').click();const editor=page.locator('#admin-person-modal');await editor.waitFor();await editor.locator('#admin-person-name').focus();await visit('alta-identidad');
        const link=editor.locator('#admin-person-link + .af-control .af-trigger');await link.press('Enter');await page.locator('#'+await link.getAttribute('aria-controls')).waitFor();await visit('alta-menu-vinculo');await page.keyboard.press('Escape');
        await editor.getByRole('button',{name:'Cerrar',exact:true}).click();await editor.waitFor({state:'hidden'});
      }
      if(nav==='contratos'){
        await page.locator('#admin-contracts-section [data-team-edit]').first().click();const editor=page.locator('#admin-person-modal');await editor.waitFor();await visit('editar-colaborador');await editor.getByRole('button',{name:'Cerrar',exact:true}).click();await editor.waitFor({state:'hidden'});
      }
      if(nav==='roles'){
        await page.locator('[data-role-manage]').first().click();const role=page.locator('#admin-role-dialog');await role.waitFor();await visit('roles-consultar-area');
        await role.locator('[data-role-edit="lider"]').click();await role.locator('#admin-role-editor-lider .role-picker-trigger').press('Enter');await page.locator('.role-picker-popup').waitFor();await visit('roles-selector-colaborador');await page.keyboard.press('Escape');await role.locator('#admin-role-editor-lider [data-role-edit-cancel]').click();
        await role.locator('[data-role-remove]').click();const confirmation=page.locator('.admin-role-confirm-sheet');await confirmation.waitFor();await confirmation.getByRole('button',{name:'Retirar liderazgo'}).hover();await visit('roles-confirmar-retiro');await escape(confirmation);await escape(role);
      }
      if(nav==='mes'){
        await page.locator('[data-person-calendar]').first().click();const calendar=page.locator('#admin-person-calendar-dialog');await calendar.waitFor();await calendar.locator('.pc-day').first().waitFor();await calendar.locator('[data-pc-shift="-1"]').click();await calendar.locator('.pc-day.j').waitFor();await visit('mes-calendario-individual');await calendar.locator('.pc-day.j').press('Enter');await visit('mes-calendario-detalle');await escape(calendar);
        await page.locator('.month-calendar-menu>summary').click();await page.locator('#admin-month-holidays').click();const modal=page.locator('#admin-month-modal');await modal.waitFor();await modal.locator('#month-holiday-note').focus();await visit('mes-feriados');await escape(modal);
      }
      if(nav==='ranking'){
        await page.locator('#ranking-help-open').press('Enter');const help=page.locator('#ranking-help');await help.waitFor();await help.locator('#ranking-weights input').first().focus();await visit('ranking-ayuda');await escape(help);
        await page.locator('#admin-ranking-section button[data-person]').first().press('Enter');const detail=page.locator('#ranking-detail-modal');await detail.waitFor();await visit('ranking-detalle');await escape(detail);
      }
    }
    // These historical sections are hidden from the new sidebar but remain
    // reachable in the normal authorized dispatcher. Exercise the dispatcher
    // in the same fictional Direction session; no permission state is changed.
    for(const [section,id] of [['control','admin-control-section'],['cierres','admin-close-section']]){
      await page.evaluate(s=>showAdminSection(s),section);await page.locator('#'+id).waitFor();await page.locator('#'+id+'[aria-busy="false"]').waitFor();await visit('historico-'+section);
    }
    await page.locator('#nav-admin-cuentas').click();await page.locator('#aa-list[aria-busy="false"]').waitFor();await visit('cuentas-administrativas');
    await page.locator('#aa-tab-other').click();await visit('cuentas-inactivas');await page.locator('#aa-tab-active').click();
    await page.locator('#aa-new').click();await page.locator('#aa-dialog[open]').waitFor();await visit('cuentas-crear');await page.keyboard.press('Escape');
    const counts={};const results=entries.map(g=>{const o=observed.get(g.id),flags=[...(o?.flags??[])];const evidence=g.outside?'explicit-outside':g.at.some(a=>/^@(?:-webkit-)?keyframes /.test(a))?'keyframe':flags.includes('scoped')&&flags.includes('unscoped')?'observed-mixed':flags.includes('scoped')?'observed-scoped':flags.includes('unscoped')?'observed-unscoped':flags.includes('unsupported')?'unsupported':'not-observed';const group=g.desktop?'desktop':'shared-or-unrestricted';const bucket=counts[group]??={};bucket[evidence]=(bucket[evidence]??0)+g.uses;return {...g,evidence,views:[...(o?.views??[])]};});
    const total=entries.reduce((n,g)=>n+g.uses,0),managedFallbacks=entries.reduce((n,g)=>n+g.managedFallbacks,0),explicitOutside=entries.filter(g=>g.outside).reduce((n,g)=>n+g.uses,0),justifiedExceptions=entries.reduce((n,g)=>n+g.justified,0);
    if(designDigest()!==digest)throw Error('El código cambió durante la auditoría; repetir.');
    const report={digest,viewport:'1440x900',snapshots,counts,total,managedFallbacks,explicitOutside,justifiedExceptions,exceptionCounts,remainingForReview:total-managedFallbacks-explicitOutside-justifiedExceptions,limits:'Observed selector matches only; hidden, hover, focus, pseudo content, @container, @supports, permissions and data variations are not exhaustive. Managed shared fallbacks and named specialty exceptions are retained in the registry.',results};
    const out=path.resolve('.tmp/kja-051/css-consumers.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({total,managedFallbacks,explicitOutside,justifiedExceptions,exceptionCounts,remainingForReview:report.remainingForReview,counts,report:out},null,2));
  }finally{await browser.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await run();
