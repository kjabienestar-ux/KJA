import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,date} from './helpers/seguimiento-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.KJA_LOCAL_ORIGIN||'http://localhost:3000';
const out=path.resolve('.tmp/kja-040');fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const data=JSON.parse(JSON.stringify(fixtureData()).replaceAll(date,today));
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8');
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const request=route.request(),url=request.url();
      if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';\n'+fake});
      if(url.startsWith(origin+'/'))return route.continue();
      if(request.resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:''});
      if(request.resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:''});
      return route.fulfill({contentType:'application/json',body:'{"ok":false}'});
    });
    await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded'});
    await page.locator('#admin-overview-section[aria-busy="false"]').waitFor({timeout:15000});
    await page.evaluate(()=>{seguimientoLab.calls=[];seguimientoLab.mode='hold'});
    await page.locator('[data-lateral-section="seguimiento"]').click();
    try{await page.locator('#admin-seguimiento-section .kja-sk-block').first().waitFor({timeout:15000})}catch(error){
      await page.screenshot({path:path.join(out,'startup-failure.png')});
      console.error(JSON.stringify({errors,state:await page.evaluate(()=>({view:typeof APP!=='undefined'?APP.view:null,section:typeof APP!=='undefined'?APP.adminSection:null,calls:window.seguimientoLab?.calls,access:document.getElementById('access')?.textContent,body:document.body.textContent.slice(-500)}))}));throw error;
    }
    const loading=await page.locator('#admin-seguimiento-section').evaluate(root=>({
      fills:[...new Set([...root.querySelectorAll('.kja-sk-block')].map(node=>getComputedStyle(node).backgroundColor))],
      animations:[...new Set([...root.querySelectorAll('.kja-sk-block')].map(node=>getComputedStyle(node,'::after').animationName))],
      overflow:root.scrollWidth>root.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth,
      headings:[...root.querySelectorAll('h2,h3')].map(node=>({text:node.textContent,visibility:getComputedStyle(node).visibility})),
      summaryHeight:root.querySelector('#seg-summary').getBoundingClientRect().height
    }));
    assert.deepEqual(loading.fills,['rgb(231, 231, 231)']);assert.deepEqual(loading.animations,['none']);
    assert.equal(loading.overflow,false);assert.equal(loading.pageOverflow,false);
    assert.ok(loading.headings.every(heading=>heading.visibility==='visible'));
    const checkSummary=async()=>{
      const layout=await page.locator('#seg-summary').evaluate(summary=>({
        bounds:summary.getBoundingClientRect().toJSON(),
        cards:[...summary.children].map(card=>card.getBoundingClientRect().toJSON()),
        hours:summary.querySelectorAll('.seg-hours').length
      }));
      assert.equal(layout.hours,0);assert.equal(layout.cards.length,2);
      assert.ok(Math.abs(layout.cards[0].top-layout.cards[1].top)<1,'tarjetas en la misma fila');
      assert.ok(Math.abs(layout.cards[0].left-layout.bounds.left)<1);
      assert.ok(Math.abs(layout.cards[1].right-layout.bounds.right)<1,'fila a todo el ancho');
    };
    await checkSummary();
    assert.equal(await page.getByText('No se pudo actualizar la administración. Vuelve a intentarlo.',{exact:true}).isVisible(),false);
    await page.screenshot({path:path.join(out,`loading-${width}.png`)});
    await page.locator('#seg-panorama>summary').click();
    assert.ok(await page.locator('#seg-areas .kja-sk-block').count()>0);
    await page.locator('#seg-panorama>summary').click();
    const coreCalls=()=>page.evaluate(()=>seguimientoLab.calls.filter(call=>Object.hasOwn(seguimientoLab.data,call.name)).length);
    assert.equal(await coreCalls(),4);
    await page.locator('#admin-refresh').click();assert.equal(await coreCalls(),4);
    await page.evaluate(()=>seguimientoLab.release());
    await page.locator('#admin-seguimiento-section[aria-busy="false"] .seg-person[data-person]').first().waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').count(),0);
    await checkSummary();
    await page.waitForFunction(()=>!document.getElementById('admin-seguimiento-section').classList.contains('kja-content-fade'));
    await page.evaluate(()=>{document.getElementById('admin-seguimiento-section').scrollTop=0});
    await page.screenshot({path:path.join(out,`data-${width}.png`)});
    const loadedHeight=await page.locator('#seg-summary').evaluate(node=>node.getBoundingClientRect().height);
    await page.locator('#seg-search').fill('maria');
    const old=await page.locator('#seg-workspace').innerHTML();
    await page.evaluate(()=>{seguimientoLab.mode='hold';void KJASeguimiento.load()});
    await page.locator('#admin-seguimiento-section.is-context-refreshing').waitFor();
    assert.equal(await page.locator('#seg-workspace').innerHTML(),old);
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'seg-search');
    await page.evaluate(()=>seguimientoLab.release());
    await page.locator('#admin-seguimiento-section[aria-busy="false"]').waitFor();
    await page.evaluate(()=>{seguimientoLab.mode='error';void KJASeguimiento.load()});
    await page.getByText('No se pudo actualizar.',{exact:false}).waitFor();
    assert.equal(await page.locator('#seg-export').isEnabled(),false);
    assert.equal(await page.locator('#seg-workspace').innerHTML(),old);
    await page.evaluate(()=>{KJASeguimiento.reset();void KJASeguimiento.load()});
    await page.getByRole('heading',{name:'Información no disponible',exact:true}).waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').count(),0);
    await page.evaluate(()=>{seguimientoLab.mode='data'});
    await page.locator('#admin-seguimiento-section [data-seg="reload"]').click();
    await page.locator('#admin-seguimiento-section[aria-busy="false"] .seg-person[data-person]').first().waitFor();
    await page.evaluate(()=>{KJASeguimiento.reset();seguimientoLab.data.dash_admin_cierres.personas=[];seguimientoLab.data.dash_admin_control_diario.filas=[];seguimientoLab.data.dash_admin_revision_entregas.entregas=[];void KJASeguimiento.load()});
    await page.getByRole('heading',{name:'No hay personas en esta consulta',exact:true}).waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{KJASeguimiento.reset();seguimientoLab.mode='hold';void KJASeguimiento.load()});
    await page.locator('#admin-seguimiento-section .kja-sk-block').first().waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    assert.deepEqual(errors,[]);
    results.push({width,height,loading,loadedSummaryHeight:loadedHeight,errors,realSupabaseRequests:0,states:['slow','data','refresh','refresh-error','initial-error','retry','empty','reduced-motion']});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
  console.log('Portal completo en escritorio: cuatro tamaños, ocho estados, dos tarjetas en una fila completa, cero errores JavaScript. Backend simulado solo dentro de Playwright.');
}finally{await browser.close()}
