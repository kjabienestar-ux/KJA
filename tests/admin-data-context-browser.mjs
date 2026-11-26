import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';
import {assertAdminSurface} from './helpers/admin-surface-assertions.mjs';
const {chromium}=createRequire(import.meta.url)('playwright'),origin=process.env.KJA_LOCAL_ORIGIN||'http://localhost:3000',out=path.resolve('.tmp/kja-048');fs.mkdirSync(out,{recursive:true});
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
async function assertActionStates(page,button,primary=false,neutralPressed='rgb(241, 237, 230)'){
  const expected=primary?['rgb(147, 71, 47)','rgb(133, 64, 39)','rgb(120, 59, 39)']:null;
  await button.scrollIntoViewIfNeeded();
  await page.mouse.move(0,0);
  const before=await button.evaluate(n=>({w:n.offsetWidth,h:n.offsetHeight,color:getComputedStyle(n).backgroundColor}));
  assert.equal(await button.isEnabled(),true);
  if(expected)assert.equal(before.color,expected[0]);
  const waitColor=async color=>{
    const actual=await button.evaluate(async(n,want)=>{
      const end=performance.now()+800;
      while(performance.now()<end&&getComputedStyle(n).backgroundColor!==want)await new Promise(requestAnimationFrame);
      return getComputedStyle(n).backgroundColor;
    },color);
    assert.equal(actual,color,await button.innerText());
  };
  await button.hover();
  await waitColor(primary?expected[1]:'rgb(246, 238, 228)');
  await page.mouse.down();
  await waitColor(primary?expected[2]:neutralPressed);
  await page.mouse.move(0,0);
  await page.mouse.up();
  await waitColor(before.color);
  assert.deepEqual(await button.evaluate(n=>({w:n.offsetWidth,h:n.offsetHeight})),{w:before.w,h:before.h});
}
async function assertTabGroup(page,group,attribute){
  const selected=group.locator('button['+attribute+'=true]').first();
  const other=group.locator('button['+attribute+'=false]:enabled').first();
  assert.deepEqual(await selected.evaluate(n=>{const s=getComputedStyle(n);return {width:s.borderBottomWidth,color:s.borderBottomColor}}),{width:'3px',color:'rgb(147, 71, 47)'});
  await assertActionStates(page,other,false,'rgb(233, 223, 209)');
  assert.equal(await other.getAttribute(attribute),'false');
  await selected.hover();
  assert.equal(await selected.evaluate(n=>getComputedStyle(n).borderBottomColor),'rgb(147, 71, 47)');
  await page.keyboard.press('Tab');await selected.focus();
  assert.deepEqual(await selected.evaluate(n=>{const s=getComputedStyle(n);return {color:s.outlineColor,width:s.outlineWidth,offset:s.outlineOffset}}),{color:'rgb(82, 121, 102)',width:'2px',offset:'-2px'});
}
async function assertAreaSelector(page,trigger){
  await trigger.press('Enter');
  const popup=page.locator('#'+await trigger.getAttribute('aria-controls')),input=popup.getByRole('combobox');
  await popup.waitFor();
  assert.equal(await trigger.getAttribute('aria-expanded'),'true');
  assert.equal(await trigger.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await popup.locator('.area-picker-search').evaluate(async n=>{
    const end=performance.now()+800;
    while(performance.now()<end&&!getComputedStyle(n).boxShadow.includes('0px 0px 8px 3px'))await new Promise(requestAnimationFrame);
  });
  await assertFieldFocus(input,popup.locator('.area-picker-search'));
  const previous=await input.getAttribute('aria-activedescendant');
  if(await popup.getByRole('option').count()>1){
    const original=await popup.getByRole('option',{selected:true}).innerText();
    await input.press('ArrowDown');
    const next=await input.getAttribute('aria-activedescendant');
    assert.notEqual(next,previous);
    const active=popup.locator('#'+next);
    assert.deepEqual(await active.evaluate(n=>{const s=getComputedStyle(n);return {color:s.outlineColor,width:s.outlineWidth,offset:s.outlineOffset}}),{color:'rgb(82, 121, 102)',width:'2px',offset:'-2px'});
    await input.press('Enter');
    await popup.waitFor({state:'hidden'});
    assert.equal(await trigger.evaluate(n=>n.classList.contains('has-selection')),true);
    assert.match(await trigger.evaluate(n=>getComputedStyle(n).boxShadow),/rgb\(147, 71, 47\).*inset|inset.*rgb\(147, 71, 47\)/);
    assert.equal(await trigger.evaluate(n=>getComputedStyle(n).borderColor),'rgb(135, 121, 109)');
    await trigger.press('Enter');
    await popup.waitFor();
    assert.equal(await popup.getByRole('option',{selected:true}).locator('svg').count(),1);
    await popup.getByRole('option',{name:original,exact:true}).click();
    await popup.waitFor({state:'hidden'});
    await trigger.press('Enter');
    await popup.waitFor();
  }
  await input.press('Escape');
  await popup.waitFor({state:'hidden'});
  assert.equal(await trigger.evaluate(n=>document.activeElement===n),true);
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
}
async function assertFieldFocus(field,container=field){
  await field.focus();
  const style=await container.evaluate(n=>{
    const s=getComputedStyle(n);
    return {color:s.outlineColor,width:s.outlineWidth,offset:s.outlineOffset,style:s.outlineStyle,border:s.borderTopColor,shadow:s.boxShadow};
  });
  assert.deepEqual({...style,shadow:undefined},{color:'rgb(82, 121, 102)',width:'2px',offset:'2px',style:'solid',border:'rgb(135, 121, 109)',shadow:undefined});
  assert.match(style.shadow,/rgba\(82, 121, 102, 0\.16\).*0px 0px 8px 3px/);
  if(field!==container)assert.equal(await field.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
}
try{for(const kind of selected){const spec=cases[kind];for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const request=route.request(),url=request.url();if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data:adminDataFixture(),date:today})+';'+fake+patch});if(url.includes('qrcode@'))return route.fulfill({contentType:'text/javascript',body:'window.QRCode={toCanvas:(canvas,text,options,done)=>done(null)};'});if(url.startsWith(origin+'/'))return route.continue();return route.fulfill({body:''});});
  await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded'});await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
  if(kind==='colaboradores'){
    const chart=page.locator('[data-overview-chart]').first(),modal=page.locator('#admin-overview-modal');
    await chart.press('Enter');
    await modal.waitFor();
    await page.waitForFunction(()=>document.activeElement.classList.contains('moonrow-sheet'));
    await assertAdminSurface(modal.locator('.moonrow-sheet'));
    await assertAdminSurface(modal.locator('.moonrow-kpi-card').first(),'card');
    assert.deepEqual(await modal.locator('.moonrow-dark-legend-dot').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor)),['rgb(16, 185, 129)','rgb(244, 63, 94)','rgb(245, 158, 11)']);
    const search=modal.locator('#moonrow-search-input');
    await assertFieldFocus(search);
    const focus=await search.evaluate(n=>({color:getComputedStyle(n).outlineColor,active:document.activeElement.id,token:getComputedStyle(n).getPropertyValue('--kja-focus'),visible:n.matches(':focus-visible'),outline:getComputedStyle(n).outlineStyle}));
    assert.equal(focus.color,'rgb(82, 121, 102)',JSON.stringify(focus));
    if(width===1440)await modal.locator('.moonrow-sheet').screenshot({path:path.join(out,'resumen-detalle.png'),animations:'disabled'});
    await modal.locator('.moonrow-btn-primary').focus();
    await page.keyboard.press('Tab');
    assert.equal(await modal.locator('.moonrow-tab-btn').first().evaluate(n=>n===document.activeElement),true);
    await page.keyboard.press('Escape');
    await modal.waitFor({state:'hidden'});
    assert.equal(await chart.evaluate(n=>n===document.activeElement),true);
  }
  await page.evaluate(()=>seguimientoLab.mode='hold');await page.locator(`[data-lateral-section="${kind}"]`).click();
  const root=page.locator('#'+spec.root);try{await root.locator('.kja-context-layer .kja-sk-block').first().waitFor({timeout:8000});}catch(e){console.log('ERROR',kind,errors,await root.innerText(),await page.evaluate(k=>({enabled:AdminDataLoading.enabled(k),busy:AdminDataLoading.busy(k)}),kind));await page.screenshot({path:path.join(out,kind+'-missing.png')});throw e;}
  if(kind==='colaboradores')assert.equal(await page.locator('[data-pw-tab=informes]').isEnabled(),false);
  if(kind==='facebook'){
    const download=page.locator('#fb-report-download');
    assert.equal(await download.isDisabled(),true);
    assert.deepEqual(await download.evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,color:s.color,opacity:s.opacity}}),{background:'rgb(241, 237, 230)',color:'rgb(92, 86, 79)',opacity:'1'});
  }
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
  if(['contratos','colaboradores'].includes(kind)){
    await assertAreaSelector(page,root.locator('.area-picker-trigger').first());
    if(kind==='colaboradores')await assertTabGroup(page,root.locator('.pw-tabs'),'aria-pressed');
    const search=root.locator(kind==='contratos'?'#admin-contract-search':'#admin-people-search');
    await assertFieldFocus(search,root.locator(kind==='contratos'?'.contracts-search-wrap':'.admin-team-search-wrap'));
    await search.fill('sin-coincidencia-ensayo');
    const empty=root.locator('.pw-empty');
    await empty.getByRole('heading',{name:'Sin coincidencias'}).waitFor();
    if(kind==='contratos')assert.ok(await empty.evaluate(el=>el.getBoundingClientRect().width>=el.parentElement.clientWidth-2));
    if(width===1440)await empty.screenshot({path:path.join(out,kind+'-sin-coincidencias.png')});
    await empty.getByRole('button',{name:'Quitar filtros'}).press('Enter');
    assert.equal(await search.evaluate(el=>el===document.activeElement),true);
    await root.locator(spec.data).first().waitFor();
  }
  if(kind==='colaboradores'){
    const trigger=root.locator('#admin-new-person'),modal=page.locator('#admin-person-modal');
    await assertActionStates(page,trigger,true);
    await trigger.click();
    await modal.waitFor();
    await assertAdminSurface(modal.locator('.admin-editor-sheet'));
    const name=modal.locator('#admin-person-name');
    await assertFieldFocus(name);
    assert.equal(await name.evaluate(n=>getComputedStyle(n).outlineColor),'rgb(82, 121, 102)');
    assert.equal(await name.evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(135, 121, 109)');
    if(width===1440)await modal.locator('.admin-editor-sheet').screenshot({path:path.join(out,'alta-colaborador.png'),animations:'disabled'});
    await modal.getByRole('button',{name:'Cerrar',exact:true}).click();
    await modal.waitFor({state:'hidden'});
  }
  if(kind==='roles'){
    const open=root.locator('[data-role-manage]').first();
    await open.click();
    const area=page.locator('#admin-role-dialog .admin-role-dialog-sheet');
    await assertAdminSurface(area);
    const close=area.getByRole('button',{name:'Cerrar',exact:true});
    await close.focus();
    assert.equal(await area.locator('.admin-role-seat-row').count(),3);
    if(width===1440)await area.screenshot({path:path.join(out,'roles-area.png'),animations:'disabled'});
    const remove=area.locator('[data-role-remove]');
    await remove.click();
    const confirmation=page.locator('.admin-role-confirm-sheet');
    await assertAdminSurface(confirmation);
    const cancel=confirmation.getByRole('button',{name:'Cancelar',exact:true});
    await page.waitForFunction(()=>document.activeElement.id==='admin-role-confirm-cancel');
    const submit=confirmation.getByRole('button',{name:'Retirar liderazgo'});
    assert.equal(await submit.getAttribute('data-kind'),'destructive');
    await submit.hover();
    assert.equal(await submit.evaluate(async n=>{
      const end=performance.now()+800,want='rgb(130, 52, 60)';
      while(performance.now()<end&&getComputedStyle(n).backgroundColor!==want)await new Promise(requestAnimationFrame);
      return getComputedStyle(n).backgroundColor;
    }),'rgb(130, 52, 60)');
    await page.mouse.move(0,0);
    await submit.focus();await page.keyboard.press('Tab');
    assert.equal(await confirmation.getByRole('button',{name:'Cerrar confirmación'}).evaluate(n=>n===document.activeElement),true);
    await cancel.focus();
    if(width===1440)await confirmation.screenshot({path:path.join(out,'roles-confirmar.png'),animations:'disabled'});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement.hasAttribute('data-role-remove'));
    await page.keyboard.press('Escape');
    assert.equal(await open.evaluate(n=>n===document.activeElement),true);
    assert.deepEqual(await page.evaluate(()=>seguimientoLab.calls.filter(c=>c.name==='dash_admin_asignar_lider')),[]);
  }
  if(kind==='contratos'){
    const trigger=root.locator('[data-team-edit]').first(),modal=page.locator('#admin-person-modal');
    await trigger.click();
    await modal.waitFor();
    await assertAdminSurface(modal.locator('.admin-editor-sheet'));
    await assertTabGroup(page,modal.locator('.admin-editor-tabs'),'aria-selected');
    const name=modal.locator('#admin-person-name');
    await assertFieldFocus(name);
    assert.ok(await name.inputValue());
    assert.equal(await name.evaluate(n=>getComputedStyle(n).outlineColor),'rgb(82, 121, 102)');
    if(width===1440)await modal.locator('.admin-editor-sheet').screenshot({path:path.join(out,'editar-colaborador.png'),animations:'disabled'});
    await modal.getByRole('button',{name:'Cerrar',exact:true}).click();
    await modal.waitFor({state:'hidden'});
  }
  if(kind==='marcado'){
    await assertTabGroup(page,root.locator('.aw-tabs'),'aria-selected');
    await page.evaluate(()=>{window.loadKjaMapLibrary=async()=>{throw Error('Mapa sin conexión en el ensayo');};});
    await page.locator('#aw-tab-reglas').click();
    const form=root.locator('#admin-access-settings'), tolerance=form.locator('#admin-access-tolerance');
    await assertAdminSurface(root.locator('.admin-policy-card'),'card');
    assert.equal(await root.locator('.admin-policy-card').evaluate(n=>getComputedStyle(n).backdropFilter),'none');
    await tolerance.fill('121');
    assert.equal(await tolerance.evaluate(el=>el.validity.rangeOverflow),true);
    await tolerance.fill('27');
    await assertActionStates(page,form.locator('#admin-access-save'),true);
    const pin=form.locator('#admin-access-legacy'), original=await pin.isChecked();
    await form.locator('.admin-policy-toggle.legacy').click();
    await page.locator('#admin-refresh').click();
    await root.locator('#admin-access-tolerance:enabled').waitFor();
    await page.locator('#admin-access-section[aria-busy="false"]').waitFor();
    assert.equal(await tolerance.inputValue(),'27');assert.equal(await pin.isChecked(),!original);
    const evidence=form.locator('#admin-access-evidence');
    assert.equal(await evidence.isChecked(),true);assert.equal(await evidence.isDisabled(),true);
    if(!await form.locator('#admin-office-coordinates').evaluate(el=>el.open))await form.locator('.admin-office-coordinates summary').press('Enter');
    await form.locator('#admin-office-lat').fill('91');
    assert.equal(await form.locator('#admin-office-lat').evaluate(el=>el.validity.rangeOverflow),true);
    await page.evaluate(()=>setOfficePoint(-12.05,-77.04,{source:'map'}));
    await page.locator('#admin-refresh').click();
    await page.locator('#admin-access-section[aria-busy="false"]').waitFor();
    assert.match(await form.locator('#admin-office-coordinate').innerText(),/-12.050000, -77.040000/);
    assert.equal(await form.locator('#admin-office-lat').inputValue(),'-12.050000');
    await tolerance.focus();
    const bounds=await form.evaluate(el=>[el.scrollWidth,el.clientWidth]);
    assert.ok(bounds[0]<=bounds[1]+1);
    if(width===1440)await root.locator('.admin-policy-card').screenshot({path:path.join(out,'acceso-reglas.png')});
    await page.locator('#aw-tab-equipo').click();
  }
  if(kind==='mes'){
    const menu=root.locator('.month-calendar-menu');
    await menu.locator('summary').click();
    await root.locator('#admin-month-holidays').click();
    const modal=page.locator('#admin-month-modal'),note=modal.locator('#month-holiday-note');
    await note.waitFor();
    await assertAdminSurface(modal.locator('.admin-month-sheet'));
    await assertFieldFocus(note);
    assert.equal(await note.evaluate(n=>getComputedStyle(n).outlineColor),'rgb(82, 121, 102)');
    await note.fill('Feriado de prueba');
    if(width===1440)await modal.locator('.admin-month-sheet').screenshot({path:path.join(out,'feriados.png'),animations:'disabled'});
    await page.keyboard.press('Escape');
    await modal.waitFor({state:'hidden'});
    if(await menu.getAttribute('open')!==null)await menu.locator('summary').click();
    const search=root.locator('#admin-month-search'),trigger=root.locator('#admin-month-area-trigger');
    const area=root.locator('#admin-month-area'),previous=await area.inputValue();
    await trigger.press('Enter');
    await root.locator('#admin-month-area-options').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await area.inputValue(),previous);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    await search.fill('Sin coincidencia de prueba');
    assert.match(await root.locator('.admin-month-empty').innerText(),/No hay colaboradores/);
    await search.fill('');
    assert.ok(await root.locator('.admin-month-table tbody tr').count()>0);
    await assertFieldFocus(search);
    assert.equal(await search.evaluate(el=>getComputedStyle(el).outlineColor),'rgb(82, 121, 102)');
    if(width===1440)await root.locator('.admin-month-workbench-controls').screenshot({path:path.join(out,'mes-controles.png')});
  }
  if(kind==='ranking'){
    const helpOpen=root.locator('#ranking-help-open'),help=page.locator('#ranking-help');
    await helpOpen.press('Enter');
    await help.waitFor();
    await assertActionStates(page,help.locator('button[type=submit]'),true);
    const field=help.locator('#ranking-weights input').first();
    await assertFieldFocus(field,field.locator('..'));
    assert.equal(await field.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
    if(width===1440)await help.locator('.rk-sim').screenshot({path:path.join(out,'ranking-simulacion.png'),animations:'disabled'});
    await help.locator('button[type=submit]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await help.locator('[data-close-ranking-help][aria-label]').evaluate(n=>n===document.activeElement),true);
    await page.keyboard.press('Escape');
    await help.waitFor({state:'hidden'});
    assert.equal(await helpOpen.evaluate(n=>n===document.activeElement),true);
    const person=root.locator('button[data-person]').first(),detail=page.locator('#ranking-detail-modal');
    await person.press('Enter');
    await detail.waitFor();
    await assertAdminSurface(detail.locator('.rk-modal-sheet'));
    await page.waitForFunction(()=>{const sheet=document.querySelector('#ranking-detail-modal .rk-modal-sheet'),r=sheet.getBoundingClientRect();return sheet.contains(document.elementFromPoint(r.left+24,r.top+40));});
    assert.equal(await detail.locator('.rk-stat').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth+1)),true);
    if(width===1440)await detail.locator('.rk-modal-sheet').screenshot({path:path.join(out,'ranking-detalle.png'),animations:'disabled'});
    await page.keyboard.press('Escape');
    await detail.waitFor({state:'hidden'});
    assert.equal(await person.evaluate(n=>n===document.activeElement),true);
    const search=root.locator('#ranking-search'),area=root.locator('#ranking-area'),trigger=root.locator('#ranking-area-trigger');
    const previous=await area.inputValue(),month=await root.locator('#ranking-month').inputValue();
    await trigger.press('Enter');
    await root.locator('#ranking-area-menu').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await area.inputValue(),previous);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
    const filter=root.locator('#ranking-filters button').nth(1);
    const filterValue=await filter.getAttribute('data-rk-filter');
    await assertActionStates(page,filter,false,'rgb(233, 223, 209)');
    assert.equal(await filter.getAttribute('aria-pressed'),'false');
    await filter.press('Enter');
    const selected=root.locator('#ranking-filters [aria-pressed=true]');
    assert.equal(await selected.getAttribute('data-rk-filter'),filterValue);
    assert.equal(await selected.evaluate(el=>el===document.activeElement),true);
    assert.equal(await selected.evaluate(el=>getComputedStyle(el).outlineColor),'rgb(82, 121, 102)');
    await selected.hover();
    assert.equal(await selected.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 253, 249)');
    assert.equal(await selected.getAttribute('aria-pressed'),'true');
    await search.fill('Sin coincidencia de prueba');
    await assertFieldFocus(search,root.locator('.rk-search'));
    assert.equal(await search.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    const reset=root.locator('[data-rk-reset]');
    await reset.waitFor();
    if(width===1440){
      await root.locator('.rk-ctrl').screenshot({path:path.join(out,'ranking-controles.png')});
      await root.locator('.rk-table-card').screenshot({path:path.join(out,'ranking-filtros.png')});
    }
    await reset.press('Enter');
    assert.equal(await search.inputValue(),'');
    assert.equal(await search.evaluate(el=>el===document.activeElement),true);
    assert.equal(await area.inputValue(),previous);
    assert.equal(await root.locator('#ranking-month').inputValue(),month);
  }
  if(kind==='facebook'){
    await assertAdminSurface(root.locator('.fbr-card:visible').first(),'card');
    const helpOpen=root.locator('#fb-report-help-btn'),help=root.locator('#fb-report-help');
    await assertActionStates(page,helpOpen);
    await helpOpen.press('Enter');
    await help.waitFor();
    if(width===1440)await help.screenshot({path:path.join(out,'facebook-ayuda.png'),animations:'disabled'});
    await page.keyboard.press('Escape');
    await help.waitFor({state:'hidden'});
    assert.equal(await helpOpen.evaluate(n=>n===document.activeElement),true);
    const form=root.locator('#fb-report-form'), kinds=form.locator('#fb-report-kinds');
    const active=kinds.locator('[aria-checked=true]'), previous=await active.getAttribute('data-kind');
    await active.press('End');
    const calendar=form.locator('#fb-calendar-popover');
    await calendar.getByRole('button',{name:'Últimos 7 días'}).press('Enter');
    await page.keyboard.press('Escape');
    assert.equal(await active.getAttribute('data-kind'),previous);
    assert.equal(await form.locator('#fb-report-pick').evaluate(el=>el===document.activeElement),true);
    await kinds.locator('[data-kind=custom]').click();
    await calendar.getByRole('button',{name:'Últimos 7 días'}).click();
    await calendar.getByRole('button',{name:'Aplicar'}).click();
    assert.equal(await active.getAttribute('data-kind'),'custom');
    const from=await form.locator('#fb-report-from').inputValue(), to=await form.locator('#fb-report-to').inputValue();
    assert.equal((Date.parse(to)-Date.parse(from))/86400000,6);
    await page.waitForFunction(()=>!document.getElementById('fb-btn-view-person').disabled);
    await root.locator('#fb-btn-view-person').click();
    const cell=root.locator('button.fb-evidence-cell:visible').first(),drawer=root.locator('#fb-evidence-drawer');
    if(await cell.count()){
      await cell.click();
      await drawer.waitFor();
      if(width===1440)await drawer.screenshot({path:path.join(out,'facebook-visor.png'),animations:'disabled'});
      await page.keyboard.press('Escape');
      await drawer.waitFor({state:'hidden'});
      assert.equal(await cell.evaluate(n=>n===document.activeElement),true);
    }
    const area=form.locator('#fb-report-area'), option=await area.locator('option').nth(1).getAttribute('value');
    await area.selectOption(option);
    if(width===1440)await form.screenshot({path:path.join(out,'facebook-periodo.png')});
    const search=root.locator('#fb-report-search');
    const filter=root.locator('#fb-report-person-filters button').nth(1);
    await assertActionStates(page,filter,false,'rgb(233, 223, 209)');
    assert.equal(await filter.getAttribute('aria-pressed'),'false');
    await filter.click();
    const selected=root.locator('#fb-report-person-filters [aria-pressed=true]');
    await selected.hover();
    assert.equal(await selected.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(147, 71, 47)');
    assert.deepEqual(await selected.locator('em').evaluate(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,color:s.color}}),{background:'rgb(160, 93, 72)',color:'rgb(255, 255, 255)'});
    await search.fill('Lucía Medina');
    const clear=root.getByRole('button',{name:'Quitar filtros'});
    await clear.waitFor();
    await assertFieldFocus(search,root.locator('.fbr-search'));
    if(width===1440)await root.locator('.fbr-tcard').screenshot({path:path.join(out,'facebook-personas.png')});
    await clear.press('Enter');
    assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(el=>el===document.activeElement),true);
    assert.equal(await area.inputValue(),option);assert.equal(await form.locator('#fb-report-from').inputValue(),from);
  }
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
    await page.evaluate(k=>{const d=seguimientoLab.data;
      if(['colaboradores','contratos'].includes(k))d.dash_admin_equipo.personas=[];
      if(k==='roles'){d.dash_admin_roles.areas=[];d.dash_admin_roles.resumen={};}
      if(k==='mes')d.dash_admin_mes.personas=[];
      if(k==='facebook')d.dash_reporte_facebook.filas=[];
      if(k==='ranking')d.dash_ranking_mes.filas=[];
      if(k==='marcado'){d.dash_admin_marcado.personas=[];d.dash_admin_marcado.resumen={};}
    },kind);
    await page.locator('#admin-refresh').click();await page.locator('#'+spec.root+'[aria-busy="false"]').waitFor();assert.equal(await root.locator('.adc-retry').count(),0);assert.equal(await root.locator('.kja-context-layer').count(),0);extraStates.push('empty');
    if(['contratos','colaboradores'].includes(kind)){
      const empty=root.locator('.pw-empty');
      await empty.getByRole('heading',{name:'No hay colaboradores registrados.'}).waitFor();
      assert.equal(await empty.getByRole('button').count(),0);
    }
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
