/* QA de geometría con servicios aislados: nunca envía escrituras al backend real. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,date} from './helpers/seguimiento-fixture.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.KJA_LOCAL_ORIGIN||'http://localhost:3000',out=path.resolve('.tmp/kja-045');
fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const data=JSON.parse(JSON.stringify(fixtureData()).replaceAll(date,today));
data.dash_admin_cierres.puede_editar=true;
data.dash_admin_cierres.asignaciones=[];
data.dash_admin_asignaciones_calendario={ok:true,dias:[]};
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8'),results=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const req=route.request(),url=req.url();
      if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';\n'+fake});
      if(url.startsWith(origin+'/'))return route.continue();
      return route.fulfill({contentType:req.resourceType()==='script'?'text/javascript':req.resourceType()==='stylesheet'?'text/css':'application/json',body:['script','stylesheet'].includes(req.resourceType())?'':'{}'});
    });
    await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded'});
    await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
    await page.locator('[data-lateral-section="asignaciones"]').click();
    await page.locator('#admin-assignments-section[aria-busy="false"]').waitFor();
    const geometry=()=>page.locator('#admin-close-assignment-form').evaluate(form=>{
      const body=form.querySelector('.assignment-form-body'),actions=form.querySelector('.assignment-form-actions');
      const rect=n=>n.getBoundingClientRect(),visible=n=>rect(n).width>0&&rect(n).height>0;
      const labels=[...form.querySelectorAll('.admin-close-fields>label:not(.sr-only)')].filter(visible);
      const labelGaps=labels.map(label=>{
        const title=label.querySelector('span'),control=label.querySelector('.assignment-input-icon-wrap,.asg-custom-select,input,textarea');
        return control?rect(control).top-rect(title).bottom:null;
      }).filter(n=>n!==null);
      const children=[...body.children].filter(visible);
      return {bodyBottom:rect(body).bottom,actionsTop:rect(actions).top,
        footerGap:rect(actions).top-rect(body).bottom,
        contentBottom:rect(children.at(-1)).bottom,
        scrollable:body.scrollHeight>body.clientHeight+1,
        fieldGap:getComputedStyle(form.querySelector('.admin-close-fields')).rowGap,labelGaps,
        sectionGaps:children.slice(1).map((n,i)=>rect(n).top-rect(children[i]).bottom),
        overflow:document.documentElement.scrollWidth>innerWidth,
        buttonPosition:getComputedStyle(document.getElementById('admin-close-assign')).position};
    });
    const initial=await geometry();
    assert.equal(initial.scrollable,false);assert.equal(await page.locator('#admin-assignment-date-note').count(),0);assert.equal(initial.overflow,false);assert.equal(initial.buttonPosition,'static');
    assert.equal(initial.fieldGap,'16px');assert.ok(initial.labelGaps.every(n=>n>=7.5));
    assert.ok(initial.sectionGaps.every(n=>n>=23.5));assert.ok(initial.footerGap>=-0.5);
    await page.screenshot({path:path.join(out,`form-${width}.png`)});
    await page.locator('#admin-close-assign').scrollIntoViewIfNeeded();
    const bottom=await geometry();assert.ok(bottom.contentBottom<=bottom.actionsTop-15.5,'contenido fuera del área del botón');
    await page.screenshot({path:path.join(out,`form-bottom-${width}.png`)});
    const picker=page.locator('.asg-picker-trigger'),popup=page.locator('#assignment-destination-picker');
    await picker.press('Enter');
    const query=popup.getByRole('textbox',{name:'Buscar persona o área'});
    await query.fill('sin-coincidencias');
    await popup.getByRole('status').waitFor();
    await query.press('Escape');
    assert.equal(await picker.evaluate(node=>node===document.activeElement),true);
    await picker.press('Enter');
    await query.fill('maria');
    await query.press('ArrowDown');
    await popup.getByRole('option',{name:/María/}).press('Enter');
    assert.equal(await page.locator('#admin-close-target').inputValue(),'1');
    const type=page.locator('#assignment-type-chips'),dest=page.locator('#assignment-target-kind-tabs');
    await type.getByRole('radio',{name:'PPT',exact:true}).press('ArrowRight');
    assert.equal(await page.locator('#admin-close-type').inputValue(),'gpt');
    await dest.getByRole('radio',{name:'Persona',exact:true}).press('ArrowRight');
    assert.equal(await dest.getByRole('radio',{checked:true}).innerText(),'Área');
    assert.equal(await dest.locator('[tabindex="0"]').count(),1);
    await page.locator('[data-kind="sorteo"]').click();
    await page.locator('#admin-close-draw-help').waitFor({state:'visible'});
    await page.locator('#admin-close-instructions').fill('Indicaciones de entrega para comprobar el formulario. '.repeat(10));
    const title=page.locator('#admin-close-title');
    await title.focus();
    const focus=await title.evaluate(n=>{
      const s=getComputedStyle(n);
      return {color:s.outlineColor,width:s.outlineWidth,offset:s.outlineOffset,border:s.borderTopColor};
    });
    assert.deepEqual(focus,{color:'rgb(82, 121, 102)',width:'2px',offset:'2px',border:'rgb(135, 121, 109)'});
    await page.locator('#admin-close-instructions').evaluate(n=>n.style.setProperty('height','200px','important'));
    await page.locator('#admin-close-assign').scrollIntoViewIfNeeded();
    const expanded=await geometry();assert.ok(expanded.contentBottom<=expanded.actionsTop-15.5);assert.ok(expanded.footerGap>=-0.5);assert.equal(expanded.overflow,false);assert.equal(expanded.scrollable,false);
    await page.screenshot({path:path.join(out,`draw-${width}.png`)});
    // Tab desde el último campo debe poder alcanzar la acción sin enviar el formulario.
    await page.locator('#admin-close-instructions').focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('#admin-close-assign').evaluate(n=>document.activeElement===n),true);
    const writes=await page.evaluate(()=>seguimientoLab.calls.filter(c=>/crear|confirmar|cancelar|asignar/.test(c.name)));
    assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    results.push({width,height,initial,bottom,expanded,keyboard:true,realWrites:0,errors});
    if(width===1920){
      await page.locator('[data-kind="persona"]').click();
      await page.locator('#admin-close-instructions').fill('');
      await page.locator('#admin-close-instructions').evaluate(n=>n.style.removeProperty('height'));
      await page.locator('.assignment-form-body').evaluate(n=>n.scrollTop=0);
      await page.locator('#assignment-create-panel').screenshot({path:path.join(out,'formulario-escritorio.png')});
    }
    await page.evaluate(()=>{
      APP.adminClose.asignaciones=[{id:1,titulo:'Entrega de prueba',tipo:'ppt',destino:'Equipo',estado_asignacion:'entregada'}];
      renderAdminCloseAssignments();
    });
    const row=page.locator('#admin-close-assignment-list .admin-close-assignment-row').first();
    assert.equal(await row.locator('.admin-close-assignment-progress').evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
    await row.getByRole('button',{name:/Quitar/}).click({trial:true});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'spacing-results.json'),JSON.stringify(results,null,2));
  console.log('Espaciado: cuatro tamaños, campos/ayudas sin intersección, Sorteo expandido y acceso por teclado. Cero escrituras.');
}finally{await browser.close();}
