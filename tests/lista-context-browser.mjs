import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,date} from './helpers/seguimiento-fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.KJA_LOCAL_ORIGIN||'http://localhost:3000',out=path.resolve('.tmp/kja-041');fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base=JSON.parse(JSON.stringify(fixtureData()).replaceAll(date,today)),fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8');
const names=['Ana Rojas','Luis Peña','María Díaz','Carlos Vega','Lucía Alejandra Torres con apellido compuesto','Diego Paz'];
function payload(count=6){
  const people=names.slice(0,count).map((nombre,i)=>({id:i+1,nombre,area_id:1,area:'Área de ensayo',modalidad:i%2?'presencial':'virtual',hora_entrada:'14:00',hora_salida:'18:00',horas:4,estado:i===1?'P':i===2?'T':'',marcado_at:i===1||i===2?today+'T13:08:00Z':null,evidencia_path:i===1?'fixture/entrada.webp':null}));
  return {dash_admin_lista:{ok:true,fecha:today,puede_editar:true,personas:people},dash_admin_cierres:{ok:true,fecha:today,personas:people.map((p,i)=>({...p,cierre:{aplica:true,estado:i===1?'completa':i===2?'incompleta':'sin_entrada',entrada_at:p.marcado_at,salida_at:i===1?today+'T18:00:00Z':null,requisitos:[]}}))}};
}
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const data={...base,...payload()};
    await page.route('**/*',route=>{
      const request=route.request(),url=request.url();
      if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';\n'+fake});
      if(url.startsWith(origin+'/'))return route.continue();
      return route.fulfill({contentType:request.resourceType()==='stylesheet'?'text/css':request.resourceType()==='script'?'text/javascript':'application/json',body:['script','stylesheet'].includes(request.resourceType())?'':'{"ok":false}'});
    });
    await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded'});
    await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
    await page.evaluate(()=>{seguimientoLab.mode='hold';seguimientoLab.calls=[]});
    await page.locator('[data-lateral-section="lista"]').click();
    await page.locator('#admin-list-section .kja-sk-block').first().waitFor();
    const loading=await page.locator('#admin-list-section').evaluate(root=>({
      fills:[...new Set([...root.querySelectorAll('.kja-sk-block')].map(node=>getComputedStyle(node).backgroundColor))],
      animations:[...new Set([...root.querySelectorAll('.kja-sk-block')].map(node=>getComputedStyle(node,'::after').animationName))],
      overflow:root.scrollWidth>root.clientWidth+1||document.documentElement.scrollWidth>innerWidth,
      mirror:!!root.querySelector('.kja-skeleton-mirror,.kja-skeleton-layer'),rows:root.querySelectorAll('.apl-loading-row').length,
      firstTop:root.querySelector('.apl-loading-row').getBoundingClientRect().top,
      kpiHeight:root.querySelector('.apl-kpis').getBoundingClientRect().height,
      lastBottom:[...root.querySelectorAll('.apl-loading-row')].at(-1).getBoundingClientRect().bottom,
      stateSeparate:[...root.querySelectorAll('.apl-loading-row')].every(row=>row.querySelector('.apl-name').getBoundingClientRect().right<row.querySelector('.apl-state').getBoundingClientRect().left)
      ,regions:[...root.querySelectorAll(':scope > div')].map(n=>({class:n.className,top:n.getBoundingClientRect().top,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))
    }));
    assert.deepEqual(loading.fills,['rgb(231, 231, 231)']);assert.deepEqual(loading.animations,['none']);
    assert.equal(loading.overflow,false);assert.equal(loading.mirror,false);assert.equal(loading.stateSeparate,true);assert.ok(loading.lastBottom<=height+1);
    assert.equal(await page.locator('#admin-list-search').isEnabled(),true);assert.equal(await page.locator('#admin-area-trigger').isEnabled(),false);
    assert.equal(await page.locator('#admin-entry-open').isEnabled(),false);assert.equal(await page.locator('#admin-date-prev').isEnabled(),true);
    assert.equal(await page.locator('#admin-list-section .apl-kpi').count(),5);assert.equal(await page.locator('#admin-roster [data-admin-person]').count(),0);
    assert.equal(await page.locator('#admin-list-section').evaluate(root=>root.previousElementSibling.textContent),'Cargando Pasar lista.');
    const coreCalls=()=>page.evaluate(()=>seguimientoLab.calls.filter(call=>['dash_admin_lista','dash_admin_cierres'].includes(call.name)).length);
    assert.equal(await coreCalls(),2);
    await page.screenshot({path:path.join(out,`skeleton-${width}.png`)});
    await page.evaluate(()=>{void loadAdminAttendance()});assert.equal(await coreCalls(),2);
    await page.evaluate(()=>seguimientoLab.waiting.shift()());
    assert.equal(await page.locator('#admin-roster [data-admin-person]').count(),0);
    await page.evaluate(()=>seguimientoLab.release());
    await page.locator('#admin-list-section[aria-busy="false"] [data-admin-person]').first().waitFor();
    const loaded=await page.locator('#admin-list-section').evaluate(root=>({firstTop:root.querySelector('[data-admin-person]').getBoundingClientRect().top,kpiHeight:root.querySelector('.apl-kpis').getBoundingClientRect().height,regions:[...root.querySelectorAll(':scope > div')].map(n=>({class:n.className,top:n.getBoundingClientRect().top,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))}));
    if(Math.abs(loading.firstTop-loaded.firstTop)>=3)console.error(JSON.stringify({width,loading,loaded}));
    assert.ok(Math.abs(loading.firstTop-loaded.firstTop)<3,'primer dato conserva la posición reservada');
    assert.ok(Math.abs(loading.kpiHeight-loaded.kpiHeight)<3,'indicadores conservan su altura');
    await page.waitForFunction(()=>!document.getElementById('admin-list-section').classList.contains('kja-content-fade'));
    await page.screenshot({path:path.join(out,`skeleton-data-${width}.png`)});
    await page.locator('#admin-list-search').fill('Ana');
    await page.evaluate(()=>{seguimientoLab.mode='hold';void loadAdminAttendance()});
    await page.locator('#admin-list-section.is-context-refreshing').waitFor();
    assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    assert.deepEqual(await page.locator('.apl-name').allTextContents(),['Ana Rojas']);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'admin-list-search');
    assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),0);
    await page.evaluate(()=>seguimientoLab.release());await page.locator('#admin-list-section[aria-busy="false"]').waitFor();
    await page.evaluate(()=>{seguimientoLab.mode='error';void loadAdminAttendance()});
    await page.getByText('No se pudo actualizar. Se conservan los datos anteriores de esta fecha.',{exact:false}).waitFor();
    assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),0);assert.equal(await page.locator('.apl-name').count(),1);
    await page.evaluate(()=>{seguimientoLab.mode='data'});await page.locator('#admin-list-message [data-list-retry]').click();
    await page.locator('#admin-list-section[aria-busy="false"]').waitFor();assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),4);
    await page.evaluate(()=>{resetAdminAttendanceView();seguimientoLab.mode='error';void loadAdminAttendance()});
    await page.getByText('Información no disponible',{exact:true}).waitFor();assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    await page.evaluate(()=>{seguimientoLab.mode='data'});await page.locator('#admin-roster [data-list-retry]').click();
    await page.locator('#admin-list-section[aria-busy="false"] [data-admin-person]').first().waitFor();
    await page.locator('#admin-list-search').fill('');
    await page.evaluate(data=>{Object.assign(seguimientoLab.data,data)},payload(0));await page.locator('#admin-refresh').click();
    await page.getByText('No hay colaboradores para esta fecha.',{exact:true}).waitFor();assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(data=>{resetAdminAttendanceView();Object.assign(seguimientoLab.data,data);seguimientoLab.mode='hold';void loadAdminAttendance()},payload(1));
    await page.locator('#admin-list-section .kja-sk-block').first().waitFor();
    assert.equal(await page.locator('#admin-list-section .kja-sk-block').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    await page.evaluate(()=>seguimientoLab.release());await page.locator('#admin-list-section[aria-busy="false"] [data-admin-person]').first().waitFor();
    assert.equal(await page.locator('[data-admin-person]').count(),1);assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    assert.deepEqual(errors,[]);results.push({width,height,loading,loaded,states:['slow','partial-dependent','data','refresh','refresh-error','initial-error','retry','empty','reduced-motion','one-person'],errors,realBackendWrites:0});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'skeleton-browser-results.json'),JSON.stringify(results,null,2));
  console.log('Pasar lista: cuatro tamaños de escritorio, gris único estático, geometría estable, diez estados y cero errores JavaScript.');
}finally{await browser.close()}
