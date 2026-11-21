import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('playwright'),origin='http://localhost:3000',out=path.resolve('.tmp/kja-048');fs.mkdirSync(out,{recursive:true});
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};');
const patch=`const rpc=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=rpc(...args);p.abortSignal=()=>p;return p;};`;
const cases={
  colaboradores:{root:'admin-people-section',data:'.pw-card',rpc:'dash_admin_equipo'},
  contratos:{root:'admin-contracts-section',data:'.admin-contract-row',rpc:'dash_admin_equipo'},
  roles:{root:'admin-roles-section',data:'.admin-role-row:not(.is-head)',rpc:'dash_admin_roles'},
  mes:{root:'admin-month-section',data:'.admin-month-table tbody tr',rpc:'dash_admin_mes'},
  facebook:{root:'admin-facebook-section',data:'.fbr-hero',rpc:'dash_reporte_facebook'},
  ranking:{root:'admin-ranking-section',data:'.rk-kpi',rpc:'dash_ranking_mes'},
  marcado:{root:'admin-access-section',data:'.admin-access-person',rpc:'dash_admin_marcado'}
};
const selected=process.argv.slice(2).length?process.argv.slice(2):Object.keys(cases),results=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const kind of selected){const spec=cases[kind];for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const request=route.request(),url=request.url();if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data:adminDataFixture(),date:today})+';'+fake+patch});if(url.includes('qrcode@'))return route.fulfill({contentType:'text/javascript',body:'window.QRCode={toCanvas:(canvas,text,options,done)=>done(null)};'});if(url.startsWith(origin+'/'))return route.continue();return route.fulfill({body:''});});
  await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded'});await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
  await page.evaluate(()=>seguimientoLab.mode='hold');await page.locator(`[data-lateral-section="${kind}"]`).click();
  const root=page.locator('#'+spec.root);try{await root.locator('.kja-context-layer .kja-sk-block').first().waitFor({timeout:8000});}catch(e){console.log('ERROR',kind,errors,await root.innerText(),await page.evaluate(k=>({enabled:AdminDataLoading.enabled(k),busy:AdminDataLoading.busy(k)}),kind));await page.screenshot({path:path.join(out,kind+'-missing.png')});throw e;}
  if(kind==='colaboradores')assert.equal(await page.locator('[data-pw-tab=informes]').isEnabled(),false);
  const loading=await root.evaluate(node=>({busy:node.getAttribute('aria-busy'),fills:[...new Set([...node.querySelectorAll('.kja-sk-block')].map(n=>getComputedStyle(n).backgroundColor))],animations:[...new Set([...node.querySelectorAll('.kja-sk-block')].map(n=>getComputedStyle(n,'::after').animationName))],hidden:[...node.querySelectorAll('[data-kja-context-loading]')].every(n=>[...n.children].filter(c=>!c.classList.contains('kja-context-layer')).every(c=>getComputedStyle(c).visibility==='hidden')),overflow:node.scrollWidth>node.clientWidth+1}));
  assert.equal(loading.busy,'true');assert.deepEqual(loading.fills,['rgb(231, 231, 231)']);assert.deepEqual(loading.animations,['kja-loading-wave']);assert.equal(loading.hidden,true);if(loading.overflow){await page.screenshot({path:path.join(out,kind+'-loading-overflow-'+width+'.png')});console.log(await root.evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),client:n.clientWidth,nodes:[...n.querySelectorAll('*')].filter(c=>c.getBoundingClientRect().right>n.getBoundingClientRect().right+2).slice(0,12).map(c=>({id:c.id,cls:c.className,width:c.getBoundingClientRect().width}))})));}assert.equal(loading.overflow,false,kind+' carga sin desbordar');
  const visibleLoadingNotices=await root.evaluate(node=>{
    const walk=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),found=[];let text;
    while(text=walk.nextNode()){
      if(!/^(Actualizando|Consultando|Cargando|Calculando|Preparando)/i.test(text.textContent.trim()))continue;
      const parent=text.parentElement,rect=parent.getBoundingClientRect();
      if(rect.width&&rect.height&&getComputedStyle(parent).visibility==='visible'&&!parent.closest('.sr-only'))found.push(text.textContent.trim());
    }return found;
  });assert.deepEqual(visibleLoadingNotices,[],'solo el esqueleto comunica la carga visual');
  if(width===1440){const block=root.locator('.kja-sk-block').first(),first=await block.evaluate(n=>getComputedStyle(n,'::after').transform);await page.waitForTimeout(120);assert.notEqual(await block.evaluate(n=>getComputedStyle(n,'::after').transform),first,'el reflejo avanza');}
  await page.screenshot({path:path.join(out,`${kind}-loading-${width}.png`)});
  await page.evaluate(()=>seguimientoLab.release());await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();
  if(await root.locator('.adc-retry').count()){console.log(kind,await root.innerText(),errors);throw Error('No cargó '+kind);}
  assert.ok(await root.locator(spec.data).count()>0,'resultado real en '+kind);if(kind==='colaboradores')assert.equal(await page.locator('[data-pw-tab=informes]').isEnabled(),true);
  const overflow=await root.evaluate(n=>n.scrollWidth>n.clientWidth+1);if(overflow){await page.screenshot({path:path.join(out,`${kind}-overflow-${width}.png`)});console.log(await root.evaluate(n=>[...n.querySelectorAll('*')].filter(c=>c.getBoundingClientRect().right>n.getBoundingClientRect().right+2&&!c.closest('.rk-table-wrap')&&getComputedStyle(c).position!=='absolute').slice(0,8).map(c=>({id:c.id,cls:c.className,right:c.getBoundingClientRect().right}))));}assert.equal(overflow,false,kind+' datos sin desbordar');
  await page.screenshot({path:path.join(out,`${kind}-data-${width}.png`)});
  const before=await root.locator(spec.data).first().textContent();
  await page.evaluate(()=>seguimientoLab.mode='hold');await page.locator('#admin-refresh').click();await page.locator('#'+spec.root+'[aria-busy="true"]').waitFor();assert.equal(await root.locator('.adc-notice').innerText(),'');
  assert.equal(await root.locator('.kja-context-layer').count(),0,'actualización conserva contenido');assert.equal(await root.locator(spec.data).first().textContent(),before);
  await page.evaluate(()=>{seguimientoLab.mode='error';for(const done of seguimientoLab.waiting.splice(0))done();});await root.locator('.adc-retry').waitFor();
  assert.equal(await root.locator(spec.data).first().textContent(),before,'fallo conserva los datos de ese contexto');
  await page.evaluate(()=>seguimientoLab.mode='data');await root.locator('.adc-retry').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.equal(await root.locator('.adc-retry').count(),0,'reintento recupera');
  assert.equal(await root.locator('[data-kja-context-loading]').count(),0);assert.equal(await root.locator(spec.data).first().evaluate(n=>!!n.closest('[inert]')),false,'datos recuperados vuelven a ser operables');
  if(kind==='facebook')assert.equal(await page.locator('#fb-report-download').isEnabled(),true,'descargas recuperadas');
  if(kind==='mes')assert.equal(await page.locator('#admin-month-export').isEnabled(),true);
  const extraStates=[];
  if(width===1440){
    // Error sin instantánea válida, distinto de un vacío confirmado.
    await page.evaluate(()=>{APP.sessionUid+='-new';seguimientoLab.mode='error';});await page.locator('#admin-refresh').click();await root.locator('.adc-retry').waitFor();
    assert.equal(await root.locator('.kja-context-layer').count(),0);assert.equal(await root.locator(spec.data).count(),0);assert.match(await root.locator('.adc-notice').innerText(),/Información no disponible/);extraStates.push('initial-error');
    await page.evaluate(()=>seguimientoLab.mode='data');await root.locator('.adc-retry').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.ok(await root.locator(spec.data).count()>0);extraStates.push('initial-retry');
    // Respuesta rápida con contexto nuevo: nunca insertar placeholders.
    await page.evaluate(id=>{APP.sessionUid+='-fast';window.adcSeen=false;window.adcObserver=new MutationObserver(()=>{window.adcSeen||=!!document.getElementById(id).querySelector('.kja-context-layer');});window.adcObserver.observe(document.getElementById(id),{childList:true,subtree:true});},spec.root);
    await page.locator('#admin-refresh').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.equal(await page.evaluate(()=>{adcObserver.disconnect();return adcSeen;}),false);extraStates.push('fast');
    // La configuración local sin guardar sobrevive a actualizar (sin enviar el formulario).
    if(kind==='marcado'){
      await page.locator('#aw-tab-reglas').click();await page.locator('#admin-access-tolerance').fill('27');await page.locator('#admin-refresh').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.equal(await page.locator('#admin-access-tolerance').inputValue(),'27');assert.equal(await page.locator('#admin-access-evidence').isEnabled(),false);await page.locator('#aw-tab-equipo').click();extraStates.push('settings-draft');
    }
    await page.evaluate(k=>{const d=seguimientoLab.data;
      if(['colaboradores','contratos'].includes(k))d.dash_admin_equipo.personas=[];
      if(k==='roles'){d.dash_admin_roles.areas=[];d.dash_admin_roles.resumen={};}
      if(k==='mes')d.dash_admin_mes.personas=[];
      if(k==='facebook')d.dash_reporte_facebook.filas=[];
      if(k==='ranking')d.dash_ranking_mes.filas=[];
      if(k==='marcado'){d.dash_admin_marcado.personas=[];d.dash_admin_marcado.resumen={};}
    },kind);
    await page.locator('#admin-refresh').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.equal(await root.locator('.adc-retry').count(),0);assert.equal(await root.locator('.kja-context-layer').count(),0);extraStates.push('empty');
    await page.screenshot({path:path.join(out,`${kind}-empty.png`)});
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(payload=>{seguimientoLab.data=payload;APP.sessionUid+='-reduce';seguimientoLab.mode='hold';},adminDataFixture());await page.locator('#admin-refresh').click();await root.locator('.kja-context-layer .kja-sk-block').first().waitFor();
    assert.equal(await root.locator('.kja-sk-block').first().evaluate(n=>getComputedStyle(n,'::after').animationName),'none');await page.evaluate(()=>seguimientoLab.release());await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();extraStates.push('reduced-motion');
  }
  const writes=await page.evaluate(()=>seguimientoLab.calls.filter(c=>/guardar|registrar|confirmar|eliminar|reiniciar|rotar|aprobar|rechazar/.test(c.name)));
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);results.push({kind,width,height,loading,refresh:true,error:true,retry:true,extraStates,errors,realWrites:0});
  await page.close();console.log(kind,width,'OK');
}}
const resultFile=path.join(out,'browser-results.json'),old=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):[];
const keys=new Set(results.map(r=>r.kind+'|'+r.width));
fs.writeFileSync(resultFile,JSON.stringify([...old.filter(r=>!keys.has(r.kind+'|'+r.width)),...results],null,2));
}finally{await browser.close();}
