import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const origin='http://localhost:3000',out=path.resolve('.tmp/kja-050');fs.mkdirSync(out,{recursive:true});
const data=adminDataFixture();
data.dash_admin_lista={ok:true,fecha:today,puede_editar:true,personas:data.dash_admin_cierres.personas.map(p=>({...p,modalidad:'virtual',hora_entrada:'08:00',hora_salida:'13:00',horas:5}))};
data.dash_admin_cierres.puede_editar=true;
data.dash_admin_cierres.asignaciones=[{id:100,titulo:'Informe de ensayo',tipo:'ppt',destino:'Área de ensayo',destinatarios:3,entregados:0,estado_asignacion:'pendiente'}];
data.dash_admin_asignaciones_calendario={ok:true,dias:[{fecha:today,total:1}]};
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};');
const patch='const original=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=original(...args);p.abortSignal=()=>p;return p;};';
const sections={seguimiento:'admin-seguimiento-section',lista:'admin-list-section',asignaciones:'admin-assignments-section',colaboradores:'admin-people-section',contratos:'admin-contracts-section',roles:'admin-roles-section',mes:'admin-month-section',facebook:'admin-facebook-section',ranking:'admin-ranking-section',marcado:'admin-access-section',overview:'admin-overview-section'};
const results=[],browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';'+fake+patch});
    if(url.includes('qrcode@'))return route.fulfill({contentType:'text/javascript',body:'window.QRCode={toCanvas:(c,t,o,done)=>done(null)};'});
    return url.startsWith(origin+'/')?route.continue():route.fulfill({body:''});
  });
  await page.goto(origin+'/dashboard');await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
  for(const [kind,id] of Object.entries(sections)){
    await page.evaluate(()=>seguimientoLab.mode='hold');
    await page.locator(`[data-lateral-section="${kind}"]`).click();
    const root=page.locator('#'+id);await root.waitFor();
    if(kind!=='overview')await root.locator('.kja-sk-block').first().waitFor();
    // Sample real frames across the loading-to-data boundary, including the fade.
    const frames=await page.evaluate(async({id,ids})=>{
      const node=document.getElementById(id),frames=[],start=performance.now();
      seguimientoLab.release();
      while(performance.now()-start<650){
        await new Promise(requestAnimationFrame);
        const heading=node.querySelector('h1,h2'),r=heading?.getBoundingClientRect();
        frames.push({opacity:getComputedStyle(node).opacity,headingOpacity:heading?getComputedStyle(heading).opacity:'1',headingY:r?.y,visible:ids.filter(key=>{const n=document.getElementById(key);return !n.hidden&&getComputedStyle(n).display!=='none';}),overflow:document.documentElement.scrollWidth>innerWidth+1});
      }return frames;
    },{id,ids:Object.values(sections)});
    await page.locator('#'+id+'[aria-busy="false"]').waitFor();
    assert.ok(frames.every(f=>f.opacity==='1'&&f.headingOpacity==='1'),kind+' mantiene marco y título opacos');
    assert.ok(frames.every(f=>f.visible.length===1&&f.visible[0]===id),kind+' sin restos de otra vista');
    assert.ok(frames.every(f=>!f.overflow),kind+' sin desbordamiento de página');
    const ys=frames.map(f=>f.headingY).filter(Number.isFinite);assert.ok(Math.max(...ys)-Math.min(...ys)<=2,kind+' encabezado sin saltos');
    assert.equal(await root.locator('.kja-content-fade,.kja-context-layer,.asg-form-skeleton').count(),0,kind+' limpia capas y revelados');
    await page.screenshot({path:path.join(out,`${kind}-${width}.png`)});
    results.push({kind,width,height,frames:frames.length,stableHeader:true,opaqueFrame:true,singleView:true,cleanAfterLoad:true});
  }
  // Rapid navigation with reads still in flight must not reveal hidden sections.
  await page.evaluate(()=>{seguimientoLab.mode='hold';for(const kind of ['contratos','mes','facebook','seguimiento','colaboradores'])document.querySelector(`[data-lateral-section="${kind}"]`).click();});
  await page.evaluate(()=>seguimientoLab.release());await page.locator('#admin-people-section[aria-busy="false"]').waitFor();
  await page.waitForTimeout(350);
  const visible=await page.evaluate(ids=>ids.filter(id=>{const n=document.getElementById(id);return !n.hidden&&getComputedStyle(n).display!=='none';}),Object.values(sections));
  assert.deepEqual(visible,['admin-people-section']);assert.equal(await page.locator('#admin-people-section .kja-sk-block').count(),0);
  const writes=await page.evaluate(()=>seguimientoLab.calls.filter(c=>/guardar|registrar|confirmar|eliminar|reiniciar|rotar|aprobar|rechazar/.test(c.name)));
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  results.push({width,height,rapidNavigation:true,errors,realWrites:0});await page.close();console.log('Flujos y movimiento',width,'OK');
}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}finally{await browser.close();}
