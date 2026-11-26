import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';

const origin='http://localhost:3000',out=path.resolve('.tmp/kja-051-polish');fs.mkdirSync(out,{recursive:true});
const data=adminDataFixture();
data.dash_admin_lista={ok:true,fecha:today,puede_editar:true,personas:data.dash_admin_cierres.personas.map(p=>({...p,modalidad:'virtual',hora_entrada:'08:00',hora_salida:'13:00',horas:5}))};
data.dash_admin_asignaciones_calendario={ok:true,dias:[]};
const [year,monthNumber]=today.split('-').map(Number),calendarMonth=new Date(Date.UTC(year,monthNumber-2,1)).toISOString().slice(0,7);
data.dash_historial={ok:true,horas:15,calendario_contrato:{contrato_inicio:'2020-01-01',contrato_fin_referencia:null},dias:[
  {estado:'P'},{estado:'T'},{estado:'J'},{estado:'P',aplica_comparticiones:true,comparticiones_vencidas:true},{estado:'P',cierre_estado:'incompleta'},{lab:false}
].map((day,i)=>({fecha:calendarMonth+'-'+String(i+1).padStart(2,'0'),lab:true,aplica_comparticiones:false,...day}))};
data.dash_equipo_dia_detalle={ok:true,estado:'J',cierre:{estado:'justificado'},horas:0};
const fixture=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};');
const adapter='const rpc=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=rpc(...args);p.abortSignal=()=>p;return p;};';
const browser=await chromium.launch({channel:'msedge'});
const transparent='rgba(0, 0, 0, 0)',green='rgb(82, 121, 102)',cream='rgb(255, 253, 249)',ink='rgb(92, 86, 79)';
const style=(loc,props,pseudo=null)=>loc.evaluate((n,{props,pseudo})=>Object.fromEntries(props.map(p=>[p,getComputedStyle(n,pseudo)[p]])),{props,pseudo});
const focus=async loc=>assert.deepEqual(await style(loc,['outlineColor','outlineWidth','outlineOffset']),{outlineColor:green,outlineWidth:'2px',outlineOffset:'2px'});
try{
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
    const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    // External QR loading is blocked in the fixture. Simulate the library's
    // error callback from the beginning, as Access may prepare it off-screen.
    await page.addInitScript(()=>{window.QRCode={toCanvas:(_canvas,_text,_options,cb)=>cb(Error('QR sin conexión en el ensayo'))};});
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';'+fixture+adapter});
      return url.startsWith(origin+'/')&&route.request().method()==='GET'?route.continue():route.fulfill({body:''});
    });
    const response=await page.goto(origin+'/dashboard');assert.equal((await response.text()).trim(),fs.readFileSync('dashboard.html','utf8').trim());
    await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
    const go=async(name,id)=>{await page.locator(`[data-lateral-section="${name}"]`).click();await page.locator(`#${id}[aria-busy="false"]`).waitFor();};
    await go('lista','admin-list-section');
    const legacy=page.locator('#admin-area-trigger'),picker=page.locator('#admin-area-custom-select .area-picker-trigger');
    assert.equal(await legacy.isVisible(),false);assert.equal(await legacy.getAttribute('aria-hidden'),'true');assert.equal(await picker.isVisible(),true);
    assert.equal(await page.locator('#admin-area-custom-select button:is(#admin-area-trigger,.area-picker-trigger):visible').count(),1);
    await picker.click();await page.locator('#list-area-picker-popup').waitFor({state:'visible'});await page.locator('#list-area-picker-popup input').press('Escape');assert.equal(await picker.evaluate(n=>document.activeElement===n),true);
    if(width===1440)await page.screenshot({path:path.join(out,'lista.png')});

    await go('seguimiento','admin-seguimiento-section');
    const wrap=page.locator('#admin-seguimiento-section .seg-search'),search=wrap.locator('input');
    assert.equal((await style(wrap,['backgroundColor'])).backgroundColor,cream);
    assert.deepEqual(await style(search,['backgroundColor','boxShadow','borderTopWidth']),{backgroundColor:transparent,boxShadow:'none',borderTopWidth:'0px'});
    assert.equal((await style(search,['color'],'::placeholder')).color,ink);
    await search.focus();await focus(wrap);assert.equal((await style(search,['outlineStyle'])).outlineStyle,'none');
    await search.fill('Ana');await search.fill('');await search.blur();
    if(width===1440)await page.screenshot({path:path.join(out,'seguimiento.png')});

    await go('asignaciones','admin-assignments-section');
    const action=page.locator('#assignment-create-toggle');await action.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(180);
    const checkAction=async expected=>{
      const s=await style(action,['boxShadow','backgroundImage','backgroundColor','transform','animationName','transitionProperty']);
      assert.equal(s.boxShadow,'none');assert.equal(s.backgroundImage,'none');assert.equal(s.transform,'none');assert.equal(s.animationName,'none');
      assert.equal(s.backgroundColor,expected);assert.match(s.transitionProperty,/background-color/);assert.doesNotMatch(s.transitionProperty,/all|box-shadow|transform/);
    };
    await checkAction('rgb(147, 71, 47)');await action.hover();await page.waitForTimeout(180);await checkAction('rgb(133, 64, 39)');
    for(let i=0;i<3;i++){await page.waitForTimeout(100);await checkAction('rgb(133, 64, 39)');}
    if(width===1440)await page.screenshot({path:path.join(out,'asignaciones-hover.png')});
    await page.mouse.down();await page.waitForTimeout(180);await checkAction('rgb(120, 59, 39)');await page.mouse.move(0,0);await page.mouse.up();await page.waitForTimeout(180);await checkAction('rgb(147, 71, 47)');

    await go('mes','admin-month-section');
    const month=page.locator('#admin-month-value'),monthWrap=page.locator('#admin-month-section .admin-month-picker');
    assert.equal((await style(monthWrap,['backgroundColor'])).backgroundColor,cream);
    assert.deepEqual(await style(month,['backgroundColor','boxShadow','borderTopWidth']),{backgroundColor:transparent,boxShadow:'none',borderTopWidth:'0px'});
    await month.focus();await focus(monthWrap);assert.equal((await style(month,['outlineStyle'])).outlineStyle,'none');await month.blur();
    if(width===1440)await page.screenshot({path:path.join(out,'mes.png')});
    const checkBox=async id=>{
      const box=page.locator('#'+id);await box.focus();await box.press('Tab');await page.keyboard.press('Shift+Tab');
      assert.equal(await box.evaluate(n=>document.activeElement===n&&n.matches(':focus-visible')),true);await focus(box);
      const s=await style(box,['width','height','minHeight','boxShadow']);assert.deepEqual(s,{width:'18px',height:'18px',minHeight:'18px',boxShadow:'none'});
      await box.check();assert.equal(await box.isChecked(),true);await page.waitForTimeout(180);assert.equal((await style(box,['backgroundColor'])).backgroundColor,'rgb(147, 71, 47)');
      await box.uncheck();assert.equal(await box.isChecked(),false);await page.waitForTimeout(180);assert.equal((await style(box,['backgroundColor'])).backgroundColor,cream);
    };
    await checkBox('admin-month-inactive');if(width===1440)await page.screenshot({path:path.join(out,'checkbox-focus.png')});
    const openCal=page.locator('[data-person-calendar]').first();await openCal.click();
    const calendar=page.locator('#admin-person-calendar-dialog');await calendar.waitFor({state:'visible'});
    await calendar.locator('.pc-day').first().waitFor();await calendar.locator('[data-pc-shift="-1"]').click();
    await calendar.locator(`[data-pc-month][value]`).waitFor();
    await calendar.locator('.pc-day.j').waitFor();
    assert.equal(await calendar.locator('.pc-legend-admin-justified').isVisible(),true);
    assert.equal(await calendar.locator('.pc-legend-justified').isVisible(),false);
    const expected={p:['rgb(232, 240, 232)','rgb(54, 94, 74)'],t:['rgb(255, 243, 212)','rgb(128, 82, 16)'],j:['rgb(241, 235, 254)','rgb(98, 59, 132)'],missing:['rgb(253, 235, 238)','rgb(146, 51, 68)'],incomplete:['rgb(253, 235, 238)','rgb(146, 51, 68)']};
    for(const [tone,[backgroundColor,color]] of Object.entries(expected)){
      const day=calendar.locator('.pc-day.'+tone).first();assert.deepEqual(await style(day,['backgroundColor','color']),{backgroundColor,color});
      await day.hover();await page.waitForTimeout(180);assert.deepEqual(await style(day,['backgroundColor','color']),{backgroundColor,color});
      // The first incident is initially selected by the calendar; hover must
      // preserve its persistent selected border rather than the hover border.
      assert.equal((await style(day,['borderTopColor'])).borderTopColor,await day.getAttribute('aria-pressed')==='true'?'rgb(147, 71, 47)':ink);
    }
    const justified=calendar.locator('.pc-day.j');await justified.press('Enter');assert.equal(await calendar.evaluate(n=>n.open),true);assert.equal(await justified.getAttribute('aria-pressed'),'true');
    await calendar.locator('.pc-state.j').waitFor();assert.deepEqual(await style(calendar.locator('.pc-state.j'),['backgroundColor','color']),{backgroundColor:expected.j[0],color:expected.j[1]});
    await justified.focus();await justified.press('Tab');await page.keyboard.press('Shift+Tab');await focus(justified);
    await calendar.locator('[data-pc-month]').focus();await page.waitForTimeout(180);assert.equal((await style(justified,['outlineStyle'])).outlineStyle,'none');
    assert.equal((await style(justified,['borderTopColor'])).borderTopColor,'rgb(147, 71, 47)');
    if(width===1440)await page.screenshot({path:path.join(out,'calendario-individual.png')});
    await page.keyboard.press('Escape');await calendar.waitFor({state:'hidden'});
    await go('colaboradores','admin-people-section');await page.locator('.pw-more-filters summary').click();await checkBox('admin-people-inactive');
    await go('contratos','admin-contracts-section');await checkBox('admin-contract-inactive');await checkBox('admin-contract-pending');
    await go('marcado','admin-access-section');
    await page.evaluate(()=>{window.loadKjaMapLibrary=async()=>{throw Error('Mapa sin conexión en el ensayo');};});
    await page.locator('#aw-tab-reglas').click();
    const office=page.locator('#admin-office-search'),officeWrap=page.locator('.admin-office-search>span');
    const tolerance=page.locator('#admin-access-tolerance'),toleranceWrap=page.locator('.admin-policy-number>span:last-child');
    for(const [input,container] of [[office,officeWrap],[tolerance,toleranceWrap]]){
      assert.equal((await style(container,['backgroundColor'])).backgroundColor,cream);
      assert.deepEqual(await style(input,['backgroundColor','boxShadow','borderTopWidth']),{backgroundColor:transparent,boxShadow:'none',borderTopWidth:'0px'});
      await input.focus();await focus(container);assert.equal((await style(input,['outlineStyle'])).outlineStyle,'none');await input.blur();
    }
    assert.equal((await style(page.locator('.admin-policy-number i'),['color'])).color,ink);
    assert.equal((await style(page.locator('label[for="admin-office-lat"]>span'),['color'])).color,ink);
    if(width===1440){await office.focus();await page.screenshot({path:path.join(out,'acceso-busqueda.png')});}
    await page.locator('#aw-tab-enlaces').click();
    const address=page.locator('#admin-portal-url'),routeWrap=address.locator('..'),copy=routeWrap.locator('button');
    assert.equal((await style(routeWrap,['backgroundColor'])).backgroundColor,cream);
    assert.deepEqual(await style(address,['backgroundColor','boxShadow','borderTopWidth']),{backgroundColor:transparent,boxShadow:'none',borderTopWidth:'0px'});
    await address.focus();await focus(routeWrap);assert.equal((await style(address,['outlineStyle'])).outlineStyle,'none');
    await address.press('Tab');assert.equal(await copy.evaluate(n=>document.activeElement===n),true);
    assert.deepEqual(await style(copy,['outlineColor','outlineOffset','outlineWidth']),{outlineColor:'rgb(255, 255, 255)',outlineOffset:'-4px',outlineWidth:'2px'});
    assert.equal((await style(routeWrap,['outlineStyle'])).outlineStyle,'none');
    if(width===1440)await page.screenshot({path:path.join(out,'acceso-enlaces.png')});
    assert.deepEqual(errors,[]);console.log(`${width}px: filtros, calendario individual, casillas, acciones y campos de Acceso OK`);await page.close();
  }
}finally{await browser.close();}
