import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,date} from './helpers/seguimiento-fixture.mjs';
import {assertAdminSurface} from './helpers/admin-surface-assertions.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.KJA_LOCAL_ORIGIN||'http://localhost:3000',out=path.resolve('.tmp/kja-041');fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base=JSON.parse(JSON.stringify(fixtureData()).replaceAll(date,today)),fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8');
const names=['Ana Rojas','Luis Peña','María Díaz','Carlos Vega','Lucía Alejandra Torres con apellido compuesto','Diego Paz'];
function payload(count=6){
  const people=names.slice(0,count).map((nombre,i)=>({id:i+1,nombre,area_id:1,area:'Área de ensayo',modalidad:i%2?'presencial':'virtual',hora_entrada:'14:00',hora_salida:'18:00',horas:4,estado:i===1?'P':i===2?'T':'',marcado_at:i===1||i===2?today+'T13:08:00Z':null,evidencia_path:i===1?'fixture/entrada.webp':null}));
  return {dash_admin_equipo:{ok:true,personas:people},dash_admin_lista:{ok:true,fecha:today,puede_editar:true,personas:people},dash_admin_cierres:{ok:true,fecha:today,personas:people.map((p,i)=>({...p,cierre:{aplica:true,estado:i===1?'completa':i===2?'incompleta':'sin_entrada',entrada_at:p.marcado_at,salida_at:i===1?today+'T18:00:00Z':null,requisitos:[]}}))}};
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
    if(width===1440)await page.locator('.apl-loading-row').first().screenshot({path:path.join(out,'carga-inicial-fila.png')});
    assert.deepEqual(loading.fills,['rgb(231, 231, 231)']);assert.deepEqual(loading.animations,['kja-loading-wave']);
    assert.equal(loading.overflow,false);assert.equal(loading.mirror,false);assert.equal(loading.stateSeparate,true);assert.ok(loading.lastBottom<=height+1);
    assert.equal(await page.locator('#admin-list-search').isEnabled(),true);assert.equal(await page.locator('.kja-list-area-picker .area-picker-trigger').isEnabled(),false);
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
    const groupToggle=page.locator('#admin-roster .kja-area-trigger').first();
    const media=await page.context().newCDPSession(page);
    const surface=page.locator('#admin-roster .kja-area-group').first();
    for(const [preference,expected] of [['reduce','rgb(255, 253, 249)'],['no-preference','rgba(255, 253, 249, 0.88)']]){
      await media.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:preference}]});
      assert.equal(await surface.evaluate(el=>getComputedStyle(el).backgroundColor),expected);
    }
    await media.send('Emulation.setEmulatedMedia',{features:[]});
    await media.detach();
    await groupToggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await groupToggle.getAttribute('aria-expanded'),'false');
    assert.equal(await groupToggle.evaluate(b=>document.getElementById(b.getAttribute('aria-controls')).hidden),true);
    await page.keyboard.press('Enter');
    assert.equal(await groupToggle.getAttribute('aria-expanded'),'true');
    assert.equal(await groupToggle.evaluate(b=>b===document.activeElement),true);
    const loaded=await page.locator('#admin-list-section').evaluate(root=>({firstTop:root.querySelector('[data-admin-person]').getBoundingClientRect().top,kpiHeight:root.querySelector('.apl-kpis').getBoundingClientRect().height,regions:[...root.querySelectorAll(':scope > div')].map(n=>({class:n.className,top:n.getBoundingClientRect().top,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width}))}));
    if(Math.abs(loading.firstTop-loaded.firstTop)>=3)console.error(JSON.stringify({width,loading,loaded}));
    assert.ok(Math.abs(loading.firstTop-loaded.firstTop)<3,'primer dato conserva la posición reservada');
    assert.ok(Math.abs(loading.kpiHeight-loaded.kpiHeight)<3,'indicadores conservan su altura');
    await page.waitForFunction(()=>!document.getElementById('admin-list-section').classList.contains('kja-content-fade'));
    await page.screenshot({path:path.join(out,`skeleton-data-${width}.png`)});
    await page.locator('#admin-entry-open').click();
    const personField=page.locator('#admin-entry-person');
    await page.evaluate(()=>seguimientoLab.release());
    await personField.selectOption('1');
    await personField.press('Tab');
    const dateField=page.locator('#admin-entry-date');
    assert.equal(await dateField.evaluate(el=>el===document.activeElement),true);
    assert.equal(await dateField.evaluate(el=>getComputedStyle(el).outlineColor),'rgb(82, 121, 102)');
    assert.equal(await dateField.evaluate(el=>getComputedStyle(el).boxShadow),'rgba(82, 121, 102, 0.16) 0px 0px 8px 3px');
    if(width===1440)await page.locator('.admin-entry-details').screenshot({path:path.join(out,'campos-entrada.png')});
    const evidence=page.locator('#admin-entry-picker');
    const fileInput=evidence.locator('input');
    await page.locator('#admin-entry-note').focus();
    await page.keyboard.press('Tab');
    assert.equal(await fileInput.evaluate(el=>el===document.activeElement),true);
    assert.equal(await evidence.evaluate(el=>getComputedStyle(el).outlineColor),'rgb(82, 121, 102)');
    if(width===1440)await evidence.screenshot({path:path.join(out,'evidencia-vacia.png')});
    const sample=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=240;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#f2ede4';ctx.fillRect(0,0,480,240);
      ctx.fillStyle='#52493f';ctx.font='26px system-ui';ctx.textAlign='center';ctx.fillText('Imagen de prueba',240,126);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await fileInput.setInputFiles({name:'archivo.txt',mimeType:'text/plain',buffer:Buffer.from('prueba')});
    await page.locator('#admin-entry-message').getByText('Elige una imagen JPG, PNG o WebP de hasta 25 MB.').waitFor();
    assert.equal(await page.locator('#admin-entry-submit').isDisabled(),true);
    for(const name of ['primera.png','reemplazo.png']){
      await fileInput.setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(sample,'base64')});
      await page.locator('#admin-entry-file-status').getByText(name,{exact:false}).waitFor();
      assert.equal(await page.locator('#admin-entry-preview').isVisible(),true);
    }
    assert.equal(await page.locator('#admin-entry-image-action').evaluate(el=>getComputedStyle(el).color),'rgb(56, 49, 43)');
    if(width===1440)await evidence.screenshot({path:path.join(out,'evidencia-adjunta.png')});
    await page.locator('#admin-entry-time').fill('08:00');
    await page.locator('#admin-entry-mode').selectOption('presencial');
    await page.locator('#admin-entry-note').fill('Registro de prueba para revisar el formulario.');
    const submit=page.locator('#admin-entry-submit');
    assert.equal(await submit.isEnabled(),true);
    await assertAdminSurface(page.locator('#admin-entry-dialog'));
    assert.equal(await submit.evaluate(async el=>{const end=performance.now()+800,want='rgb(147, 71, 47)';while(performance.now()<end&&getComputedStyle(el).backgroundColor!==want)await new Promise(requestAnimationFrame);return getComputedStyle(el).backgroundColor}),'rgb(147, 71, 47)');
    assert.equal(await page.locator('#admin-entry-form').evaluate(form=>form.checkValidity()),true);
    if(width===1440)await page.locator('#admin-entry-dialog').screenshot({path:path.join(out,'registrar-entrada.png')});
    await page.getByRole('button',{name:'Cancelar',exact:true}).filter({visible:true}).click();
    const completed=page.locator('.apl-card:has(.kja-status[data-tone="ok"])').first();
    assert.equal(await completed.locator('.kja-status').evaluate(el=>getComputedStyle(el).color),'rgb(54, 94, 74)');
    const avatar=completed.locator('.apl-card-head > .avatar');
    assert.equal(await avatar.innerText(),'LP');
    assert.equal(await avatar.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(233, 223, 209)');
    if(width===1440)await completed.locator('.apl-card-head').screenshot({path:path.join(out,'identidad-lista.png')});
    const present=completed.getByRole('button',{name:'Presente',exact:true});
    assert.equal(await present.getAttribute('aria-pressed'),'true');
    assert.equal(await present.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(54, 94, 74)');
    if(width===1440)await completed.screenshot({path:path.join(out,'marcas-asistencia.png')});
    const listSearch=page.locator('#admin-list-search');
    await listSearch.fill('Alondra');
    const empty=page.locator('#admin-roster .kja-list-empty');
    await empty.getByText('Sin coincidencias',{exact:true}).waitFor();
    const dateBeforeReset=await page.locator('#admin-list-date').inputValue();
    if(width===1440)await empty.screenshot({path:path.join(out,'sin-coincidencias.png')});
    await empty.getByRole('button',{name:'Quitar filtros'}).press('Enter');
    assert.equal(await listSearch.inputValue(),'');
    assert.equal(await listSearch.evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('#admin-list-date').inputValue(),dateBeforeReset);
    await completed.waitFor();
    await listSearch.fill('Ana');
    await page.evaluate(()=>{seguimientoLab.mode='hold';void loadAdminAttendance()});
    await page.locator('#admin-list-section.is-context-refreshing').waitFor();
    assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    if(width===1440)await page.locator('.apl-card[data-admin-person]').first().screenshot({path:path.join(out,'actualizando-fila.png')});
    assert.deepEqual(await page.locator('.apl-name').allTextContents(),['Ana Rojas']);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'admin-list-search');
    assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),0);
    await page.evaluate(()=>seguimientoLab.release());await page.locator('#admin-list-section[aria-busy="false"]').waitFor();
    await page.evaluate(()=>{seguimientoLab.mode='error';void loadAdminAttendance()});
    await page.getByText('No se pudo actualizar la lista',{exact:true}).waitFor();
    if(width===1440)await page.locator('#admin-list-message').screenshot({path:path.join(out,'actualizacion-fallida.png')});
    assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),0);assert.equal(await page.locator('.apl-name').count(),1);
    await page.evaluate(()=>{seguimientoLab.mode='data'});await page.locator('#admin-list-message [data-list-retry]').click();
    await page.locator('#admin-list-section[aria-busy="false"]').waitFor();assert.equal(await page.locator('.apl-mark:not(:disabled)').count(),4);
    await page.evaluate(()=>{resetAdminAttendanceView();seguimientoLab.mode='error';void loadAdminAttendance()});
    await page.getByText('Información no disponible',{exact:true}).waitFor();assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    const retry=page.locator('#admin-roster [data-list-retry]');
    assert.equal(await retry.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(147, 71, 47)');
    if(width===1440)await page.locator('#admin-roster .apl-empty').screenshot({path:path.join(out,'boton-reintentar.png')});
    await page.evaluate(()=>{seguimientoLab.mode='data'});await retry.focus();await retry.press('Enter');
    await page.locator('#admin-list-section[aria-busy="false"] [data-admin-person]').first().waitFor();
    await page.locator('#admin-list-search').fill('');
    await page.evaluate(data=>{Object.assign(seguimientoLab.data,data)},payload(0));await page.locator('#admin-refresh').click();
    await page.getByText('No hay colaboradores para esta fecha.',{exact:true}).waitFor();assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    assert.equal(await empty.getByRole('button').count(),0);
    if(width===1440)await empty.screenshot({path:path.join(out,'fecha-vacia.png')});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(data=>{resetAdminAttendanceView();Object.assign(seguimientoLab.data,data);seguimientoLab.mode='hold';void loadAdminAttendance()},payload(1));
    await page.locator('#admin-list-section .kja-sk-block').first().waitFor();
    assert.equal(await page.locator('#admin-list-section .kja-sk-block').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    await page.evaluate(()=>seguimientoLab.release());await page.locator('#admin-list-section[aria-busy="false"] [data-admin-person]').first().waitFor();
    assert.equal(await page.locator('[data-admin-person]').count(),1);assert.equal(await page.locator('#admin-list-section .kja-sk-block').count(),0);
    const areaButton=page.locator('.kja-list-area-picker .area-picker-trigger');
    const areaPopup=page.locator('#list-area-picker-popup');
    const search=areaPopup.getByRole('combobox');
    const previousDate=await page.locator('#admin-list-date').inputValue();
    await areaButton.click();
    await search.fill('area de ensayo');
    assert.equal(await areaPopup.getByRole('option').count(),1);
    await search.press('Enter');
    assert.equal(await page.locator('#admin-list-area').inputValue(),'1');
    assert.equal(await areaButton.evaluate(el=>el===document.activeElement),true);
    await areaButton.click();
    if(width===1440)await areaPopup.screenshot({path:path.join(out,'filtro-area.png')});
    await search.fill('Todas');
    await search.press('Enter');
    assert.equal(await page.locator('#admin-list-area').inputValue(),'');
    assert.equal(await page.locator('#admin-list-date').inputValue(),previousDate);
    const calendarButton=page.locator('.kja-list-date .kja-date-trigger');
    const calendar=page.locator('#kja-list-date-popup');
    await calendarButton.click();
    assert.equal(await calendar.isVisible(),true);
    assert.equal(await calendar.locator('[aria-pressed="true"]').evaluate(el=>el===document.activeElement),true);
    assert.equal(await calendar.locator('[data-nav="1"]').isDisabled(),true);
    if(width===1440)await calendar.screenshot({path:path.join(out,'calendario-compartido.png')});
    await page.keyboard.press('Escape');
    assert.equal(await calendarButton.evaluate(el=>el===document.activeElement),true);
    await calendarButton.click();
    await calendar.locator('[data-nav="-1"]').click();
    const day=calendar.locator('[data-date]:not(:disabled)').first();
    const chosen=await day.getAttribute('data-date');
    await day.click();
    assert.equal(await page.locator('#admin-list-date').inputValue(),chosen);
    assert.equal(await calendar.isVisible(),false);
    assert.deepEqual(errors,[]);results.push({width,height,loading,loaded,states:['slow','partial-dependent','data','refresh','refresh-error','initial-error','retry','empty','reduced-motion','one-person'],errors,realBackendWrites:0});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'skeleton-browser-results.json'),JSON.stringify(results,null,2));
  console.log('Pasar lista: cuatro tamaños de escritorio, gris único con reflejo, geometría estable, diez estados y cero errores JavaScript.');
}finally{await browser.close()}
