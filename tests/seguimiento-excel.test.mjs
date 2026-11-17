import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
function setup(){const dom=new JSDOM('<div id="root"><div class="seg-toolbar"></div></div>',{runScripts:'outside-only'});const w=dom.window;w.TextEncoder=TextEncoder;vm.runInContext(fs.readFileSync('assets/js/facebook-report-excel.js','utf8'),dom.getInternalVMContext());vm.runInContext(fs.readFileSync('assets/js/seguimiento-excel.js','utf8'),dom.getInternalVMContext());return {w,api:w.KJASeguimientoExcel}}
test('reutiliza menú y calendarios; cambio de período sincroniza fechas y bloqueo',()=>{
  const dom=new JSDOM('<div id="root"><div class="seg-toolbar"></div></div>',{runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
  const matches=w.Element.prototype.matches;w.Element.prototype.matches=function(s){return s===':popover-open'?false:matches.call(this,s)};
  for(const file of ['dashboard-area-picker.js','dashboard-date-picker.js','seguimiento-excel.js'])vm.runInContext(fs.readFileSync('assets/js/'+file,'utf8'),ctx);
  w.KJASeguimientoExcel.mount(w.document.getElementById('root'),()=>({date:'2026-11-02',allowed:true}),()=>{});
  const box=w.document.querySelector('details');box.open=true;box.dispatchEvent(new w.Event('toggle'));
  assert.ok(w.document.querySelector('#seg-x-mode').hidden);
  const trigger=box.querySelector('.area-picker-trigger');trigger.click();
  const popup=w.document.getElementById('seg-period-popup');assert.equal(popup.hidden,false);
  [...popup.querySelectorAll('[role="option"]')].find(b=>b.textContent==='Rango personalizado').click();
  assert.equal(w.document.getElementById('seg-x-mode').value,'range');
  assert.equal(w.document.getElementById('seg-x-to').closest('label').hidden,true);
  const from=w.document.querySelector('[aria-controls="seg-from-popup"]');from.click();
  const calendar=w.document.getElementById('seg-from-popup');assert.equal(calendar.hidden,false);
  calendar.querySelector('[data-date="2026-11-03"]').click();
  assert.equal(calendar.querySelector('.kja-date-apply').disabled,true);
  calendar.querySelector('[data-date="2026-11-06"]').click();
  assert.equal(calendar.querySelectorAll('.is-in-range').length,4);
  assert.equal(w.document.getElementById('seg-x-from').value,'2026-11-02');
  calendar.querySelector('.kja-date-apply').click();
  assert.equal(w.document.getElementById('seg-x-from').value,'2026-11-03');
  assert.equal(w.document.getElementById('seg-x-to').value,'2026-11-06');
  trigger.click();[...popup.querySelectorAll('[role="option"]')].find(b=>b.textContent==='Un día').click();
  assert.equal(w.document.getElementById('seg-x-to').value,'2026-11-03');
  assert.equal(w.document.getElementById('seg-x-to').disabled,true);
  trigger.click();[...popup.querySelectorAll('[role="option"]')].find(b=>b.textContent==='Semana').click();
  from.click();calendar.querySelector('[data-date="2026-11-04"]').click();
  assert.equal(calendar.querySelectorAll('.is-in-range').length,7);
  calendar.querySelector('.kja-date-apply').click();
  assert.equal(w.document.getElementById('seg-x-from').value,'2026-11-02');
  assert.equal(w.document.getElementById('seg-x-to').value,'2026-11-08');
});
test('rangos de 1, 4, 7 y 9 días; máximo 93',()=>{const {api}=setup();for(const n of [1,4,7,9])assert.equal(api.dates('2026-11-01','2026-11-0'+n).length,n);assert.throws(()=>api.dates('2026-01-01','2026-12-31'));assert.throws(()=>api.dates('2026-11-09','2026-11-01'))});
test('respeta puntualidad, justificación, no programado y ausencia de datos',()=>{const {api}=setup();assert.equal(api.status({entrada_at:'2026-11-01',salida_at:'2026-11-01',entrada_estado:'T'})[0],'Tardanza');assert.equal(api.status({entrada_at:'2026-11-01',salida_at:'2026-11-01',entrada_estado:'P'})[0],'Normal');assert.equal(api.status({entrada_estado:'J'})[0],'Justificado');assert.equal(api.status({labora:false})[0],'No programado');assert.equal(api.status({labora:true})[0],'No marcó');assert.equal(api.status(null)[0],'Sin información')});
test('formato por día y rangos: espacios, identidad en una columna y sin paneles fijos',()=>{
  const {api}=setup();
  for(const count of [1,4,7,9,12]){
    const days=api.dates('2026-11-01','2026-11-'+String(count).padStart(2,'0'));
    const records=Object.fromEntries(days.map(d=>[d,[{colaborador_id:1,colaborador:'Ana',area:'Ingeniería',labora:true},{colaborador_id:2,colaborador:'Luis',area:'Marketing',labora:true}]]));
    const text=new TextDecoder().decode(api.build(days,records,{scope:'Todas',updated:'prueba'}));
    assert.ok(!text.includes('<pane'));
    assert.match(text,/<row r="6"[^>]*><\/row>/);
    assert.match(text,/<row r="8"[^>]*><\/row>/);
    assert.match(text,/<c r="A9"[^>]*>.*?Colaborador \/ Área<\/t>/);
    assert.ok(text.includes('<rPr><b/>'));assert.ok(text.includes('FF7A857D'));assert.ok(text.includes('Ana\n</t></r>'));
    assert.match(text,/<row r="11"[^>]*><\/row>/); // Separación entre áreas.
    assert.ok(text.includes('horizontal="center" vertical="center"'));
    assert.ok(!text.includes('Detalle 10-12'));
    assert.ok(!text.includes('sheet2.xml'));
    if(count>1)assert.ok(text.includes('01/11\nDO'));
    if(count===12)assert.ok(text.includes('12/11\nJU'));
  }
});
test('amarillo distingue tardanza y salida requerida pendiente sin alterar excepciones',()=>{
  const {api}=setup();
  const p={entrada_at:'2026-11-02T13:00:00Z',entrada_estado:'P'};
  assert.equal(api.status(p)[0],'Sin salida');assert.equal(api.status(p)[1],5);
  assert.equal(api.status({...p,entrada_estado:'T'})[0],'Tardanza / Sin salida');
  assert.equal(api.status({...p,salida_at:'2026-11-02T18:00:00Z'})[0],'Normal');
  assert.equal(api.status({...p,cierre:{requiere_salida:false}})[0],'Normal');
  const days=api.dates('2026-08-01','2026-11-01');
  const records=Object.fromEntries(days.map(d=>[d,[{...p,colaborador_id:1,colaborador:'Ana',area:'Ingeniería'}]]));
  const text=new TextDecoder().decode(api.build(days,records,{scope:'Todas',updated:'prueba'}));
  assert.ok(!text.includes('sheet2.xml'));assert.ok(text.includes('01/11\nDO'));
  for(const name of ['LU','MA','MI','JU','VI','SA','DO'])assert.ok(text.includes('\n'+name));
});
test('genera ZIP OOXML, horas Lima, estilos y texto seguro sin fórmulas',()=>{const {api}=setup();const bytes=api.build(['2026-11-02'],{'2026-11-02':[{colaborador_id:1,colaborador:'=HYPERLINK("x")',area:'A & B',labora:true,entrada_at:'2026-11-02T13:00:00Z',entrada_estado:'P'}]},{scope:'Todas',updated:'prueba'});assert.equal(bytes[0],80);const text=new TextDecoder().decode(bytes);assert.ok(text.includes('08:00'));assert.ok(text.includes('Salida pendiente'));assert.ok(text.includes('A &amp; B'));assert.ok(text.includes('DFF1E5'));assert.ok(!text.includes('<f>'));assert.ok(!text.includes('state="frozen"'));assert.ok(text.includes('horizontal="center"'));assert.ok(text.includes('Área</t>'));assert.ok(text.includes('Colaborador / Área'))});
test('descarga filtrada y bloqueo de error parcial o sesión cambiada',async()=>{const {w,api}=setup();let ctx={date:'2026-11-02',area:'2',query:'Jose',owner:'a',allowed:true},fail=false,change=false,blobs=[];w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};api.mount(w.document.getElementById('root'),()=>ctx,async name=>{if(change)ctx={...ctx,owner:'b'};if(fail)return {error:{}};return {data:{ok:true,fecha:'2026-11-02',filas:[{colaborador_id:1,colaborador:'José',area_id:2,labora:true,entrada_estado:'T',entrada_at:'2026-11-02T13:20:00Z'},{colaborador_id:2,colaborador:'Otro',area_id:1,labora:true}],personas:[]}}});w.document.querySelector('#seg-x-from').value='2026-11-02';const btn=w.document.querySelector('button');await btn.onclick();assert.equal(blobs.length,1);fail=true;await btn.onclick();assert.equal(blobs.length,1);assert.match(w.document.querySelector('#seg-x-status').textContent,/No se pudo/);fail=false;change=true;await btn.onclick();assert.equal(blobs.length,1);assert.match(w.document.querySelector('#seg-x-status').textContent,/Cambió/)});
