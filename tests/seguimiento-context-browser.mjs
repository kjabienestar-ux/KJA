import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,date} from './helpers/seguimiento-fixture.mjs';
import {assertAdminSurface} from './helpers/admin-surface-assertions.mjs';
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
      if(url.endsWith('/functions/v1/dash-entrega'))return route.fulfill({json:{ok:true,ruta:'ensayo/salida.jpg',token:'ensayo'}});
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
    assert.deepEqual(loading.fills,['rgb(231, 231, 231)']);assert.deepEqual(loading.animations,['kja-loading-wave']);
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
    const firstPerson=page.locator('.seg-person-list .seg-person[data-person]').first();
    const avatar=firstPerson.locator('.kja-person-avatar');
    assert.equal(await avatar.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(233, 223, 209)');
    if(width===1440)await firstPerson.screenshot({path:path.join(out,'identidad-seguimiento.png')});
    await page.screenshot({path:path.join(out,`data-${width}.png`)});
    const panorama=page.locator('#seg-panorama'), summary=panorama.locator('summary');
    const media=await page.context().newCDPSession(page);
    const surface=panorama;
    for(const [preference,expected] of [['reduce','rgb(255, 253, 249)'],['no-preference','rgba(255, 253, 249, 0.88)']]){
      await media.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:preference}]});
      assert.equal(await surface.evaluate(el=>getComputedStyle(el).backgroundColor),expected);
    }
    await media.send('Emulation.setEmulatedMedia',{features:[]});
    await media.detach();
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await panorama.evaluate(el=>el.open),true);
    if(width===1440)await panorama.screenshot({path:path.join(out,'panorama-abierto.png')});
    await page.keyboard.press('Space');
    assert.equal(await panorama.evaluate(el=>el.open),false);
    assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
    const loadedHeight=await page.locator('#seg-summary').evaluate(node=>node.getBoundingClientRect().height);
    await page.locator('#seg-search').fill('sin-coincidencia-ensayo');
    const noMatch=page.locator('#seg-workspace .seg-empty');
    await noMatch.getByRole('heading',{name:'Sin coincidencias'}).waitFor();
    await noMatch.getByRole('button',{name:'Ver todo el equipo'}).press('Enter');
    assert.equal(await page.locator('#seg-search').inputValue(),'');
    assert.equal(await page.locator('#seg-search').evaluate(el=>el===document.activeElement),true);
    await page.locator('#seg-search').fill('maria');
    await page.locator('[data-seg="person"][data-person="1"]').first().click();
    await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=540;canvas.height=260;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#eee9df';ctx.fillRect(0,0,540,260);
      ctx.fillStyle='#52493f';ctx.textAlign='center';ctx.font='25px system-ui';ctx.fillText('Archivo de prueba',270,136);
      seguimientoLab.reviewImage=canvas.toDataURL();
    });
    const mediaRetry=page.locator('[data-seg="media-retry"]');
    await mediaRetry.click();
    await page.getByRole('button',{name:'Archivo siguiente'}).click();
    await page.getByText('Archivo 2 de 2',{exact:true}).waitFor();
    const observe=page.locator('[data-seg="observe"]');
    await observe.click();
    await page.getByText('Explica qué debe corregir (al menos 3 caracteres).').waitFor();
    const note=page.locator('#seg-note');
    assert.equal(await note.evaluate(el=>el===document.activeElement),true);
    await note.fill('Adjunta una captura donde se lea la fecha del reporte.');
    assert.equal(await page.locator('#seg-action-status').textContent(),'');
    assert.equal(await note.evaluate(el=>getComputedStyle(el).outlineColor),'rgb(82, 121, 102)');
    if(width===1440)await page.locator('.seg-decision').screenshot({path:path.join(out,'revision-evidencia.png')});
    await observe.click();
    await page.locator('#seg-message').getByText('Corrección solicitada.',{exact:true}).waitFor();
    await page.getByRole('tab',{name:/Facebook/}).click();
    await page.locator('[data-seg="approve"]').click();
    await page.locator('#seg-message').getByText('Evidencia aprobada.',{exact:true}).waitFor();
    const decisions=await page.evaluate(()=>seguimientoLab.calls.filter(c=>c.name==='dash_admin_revisar_entrega').map(c=>[c.args.p_entrega,c.args.p_estado,c.args.p_nota]));
    assert.deepEqual(decisions,[[11,'observada','Adjunta una captura donde se lea la fecha del reporte.'],[12,'aprobada',null]]);
    await page.locator('.seg-manage > summary').click();
    const upload=page.locator('[data-seg="upload"]');
    await upload.click();
    const composer=page.locator('#admin-evidence-modal');
    await composer.waitFor();
    assert.equal(await page.locator('#admin-evidence-submit').isDisabled(),true);
    const sample=Buffer.from(await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#eee9df';ctx.fillRect(0,0,320,160);
      ctx.fillStyle='#38312b';ctx.textAlign='center';ctx.font='22px system-ui';ctx.fillText('Imagen de prueba',160,88);
      return canvas.toDataURL().split(',')[1];
    }),'base64');
    await page.locator('#admin-evidence-files').setInputFiles({name:'salida-prueba.png',mimeType:'image/png',buffer:sample});
    await page.locator('#admin-evidence-previews .admin-evidence-preview').first().waitFor();
    const confirm=page.locator('#admin-evidence-submit');
    assert.equal(await confirm.isEnabled(),true);
    await assertAdminSurface(composer.locator('.admin-evidence-sheet'));
    assert.equal(await confirm.evaluate(async el=>{const end=performance.now()+800,want='rgb(147, 71, 47)';while(performance.now()<end&&getComputedStyle(el).backgroundColor!==want)await new Promise(requestAnimationFrame);return getComputedStyle(el).backgroundColor}),'rgb(147, 71, 47)');
    await page.locator('#admin-evidence-exit-time').fill('13:00');
    if(width===1440)await composer.locator('[role=dialog]').screenshot({path:path.join(out,'cargar-evidencia.png')});
    await page.locator('#admin-evidence-exit-time').fill('');
    await confirm.click();
    await composer.getByText('Indica la hora que se ve en la foto de salida.').waitFor();
    assert.equal(await page.evaluate(()=>seguimientoLab.calls.filter(c=>c.name==='fixture-upload').length),0);
    await page.locator('#admin-evidence-exit-time').fill('13:00');
    assert.equal(await page.locator('#admin-evidence-picker').isVisible(),false);
    await composer.getByRole('button',{name:'Quitar imagen 1'}).click();
    assert.equal(await page.locator('#admin-evidence-picker').isVisible(),true);
    assert.equal(await confirm.isDisabled(),true);
    await page.locator('#admin-evidence-files').setInputFiles({name:'salida-prueba.png',mimeType:'image/png',buffer:sample});
    await page.evaluate(()=>{seguimientoLab.data.dash_admin_confirmar_salida_tardia={ok:true}});
    await confirm.click();
    await composer.waitFor({state:'hidden'});
    const calls=await page.evaluate(()=>seguimientoLab.calls.filter(c=>c.name==='dash_admin_confirmar_salida_tardia'));
    assert.equal(calls.length,1);
    assert.equal(calls[0].args.p_hora_salida,'13:00');
    assert.equal(calls[0].args.p_colaborador,1);
    assert.equal(await composer.isHidden(),true);
    await page.getByRole('button',{name:'Volver al listado',exact:true}).click();
    await page.locator('#seg-search').focus();
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
    await page.getByRole('heading',{name:'No hay colaboradores para esta fecha.',exact:true}).waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').count(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{KJASeguimiento.reset();seguimientoLab.mode='hold';void KJASeguimiento.load()});
    await page.locator('#admin-seguimiento-section .kja-sk-block').first().waitFor();
    assert.equal(await page.locator('#admin-seguimiento-section .kja-sk-block').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
    // The shared review dialog is also used outside the Seguimiento case viewer.
    await page.evaluate(review=>{
      APP.adminReview=review;
      openAdminReviewPerson(1);
    },data.dash_admin_revision_entregas);
    const dialog=page.locator('#admin-review-modal');
    await assertAdminSurface(dialog.locator('.admin-review-sheet'));
    const correction=dialog.locator('#admin-review-observe');
    const reviewNote=dialog.locator('#admin-review-observation');
    await correction.click();
    assert.equal(await reviewNote.getAttribute('aria-invalid'),'true');
    await reviewNote.fill('Verifica la fecha de la segunda imagen.');
    await dialog.getByRole('button',{name:'Archivo 2 de 2'}).click();
    await dialog.getByAltText(/imagen 2/).waitFor();
    assert.equal(await reviewNote.inputValue(),'Verifica la fecha de la segunda imagen.');
    if(width===1440)await dialog.locator('[role=dialog]').screenshot({path:path.join(out,'cierres-revision.png')});
    const tabs=dialog.getByRole('tab');
    await tabs.first().focus();await tabs.first().press('End');
    assert.equal(await tabs.last().getAttribute('aria-selected'),'true');
    assert.equal(await reviewNote.inputValue(),'');
    await tabs.last().press('Escape');
    await page.evaluate(()=>{
      APP.access.rol='lider';APP.identity.isLeader=true;
      APP.adminReview.solo_lectura=true;APP.adminReview.puede_revisar=false;
      openAdminReviewPerson(1);
    });
    await dialog.getByText('Solo lectura',{exact:true}).waitFor();
    assert.equal(await reviewNote.isVisible(),false);
    assert.equal(await correction.isVisible(),false);
    assert.equal(await dialog.locator('#admin-review-approve').isVisible(),false);
    await dialog.getByRole('button',{name:'Archivo 2 de 2'}).click();
    await dialog.getByAltText(/imagen 2/).waitFor();
    const gallery=dialog.locator('#admin-review-gallery');
    async function assertInsideGallery(selector){
      const frame=await gallery.boundingBox(),control=await gallery.locator(selector).boundingBox();
      assert.ok(control && control.height>0 && control.width>0 && control.y>=frame.y && control.y+control.height<=frame.y+frame.height+1,selector+' queda fuera del visor a '+width+' px');
    }
    await assertInsideGallery('.admin-review-media > span');
    await assertInsideGallery('.admin-review-media > a');
    if(width===1440)await dialog.locator('[role=dialog]').screenshot({path:path.join(out,'cierres-consulta.png')});
    await page.evaluate(()=>{
      APP.adminReview.entregas[0].archivos[1]={path:'11/anexo.pdf',mime:'application/pdf'};
      return renderAdminReviewDelivery(APP.adminReview.entregas[0].id,1);
    });
    await assertInsideGallery('.admin-review-media.is-pdf footer a');
    await assertInsideGallery('.admin-review-media.is-pdf iframe');
    await dialog.getByRole('tab').first().press('Escape');
    await page.evaluate(async()=>{
      APP.access.rol='direccion';
      APP.adminTeam={personas:[{id:1,nombre:'María Díaz',area:'Marketing',dias_libres_saldo:3}]};
      seguimientoLab.mode='data';
      seguimientoLab.data.dash_admin_dias_libres_pagina={ok:true,persona:{saldo:3},movimientos:[],total:0};
      await openAdminDaysOff(1);
    });
    const days=page.locator('#admin-days-off-modal');
    await assertAdminSurface(days.locator('.admin-days-off-sheet'));
    await days.getByRole('radio',{name:'Agregar'}).press('ArrowRight');
    assert.equal(await days.getByRole('radio',{name:'Descontar'}).getAttribute('aria-checked'),'true');
    await days.getByLabel('Cantidad').fill('2');
    await days.getByLabel('Motivo').fill('Ajuste de prueba');
    await page.keyboard.press('Shift+Tab');
    if(width===1440)await days.getByRole('dialog').screenshot({path:path.join(out,'dias-libres.png')});
    await days.getByRole('button',{name:'Cancelar'}).click();
    assert.equal(await days.isVisible(),false);
    assert.deepEqual(errors,[]);
    results.push({width,height,loading,loadedSummaryHeight:loadedHeight,errors,realSupabaseRequests:0,states:['slow','data','refresh','refresh-error','initial-error','retry','empty','reduced-motion']});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
  console.log('Portal completo en escritorio: cuatro tamaños, ocho estados, dos tarjetas en una fila completa, cero errores JavaScript. Backend simulado solo dentro de Playwright.');
}finally{await browser.close()}
