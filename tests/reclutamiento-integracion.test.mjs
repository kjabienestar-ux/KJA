import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = path => fs.readFileSync(path,'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve,20));
test('Formulario real: no confirma errores, evita doble clic y confirma solo el recibo del servidor', async () => {
  const dom = new JSDOM(source('reclutamiento.html'),{url:'https://kja.example/reclutamiento.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  try {
    w.HTMLElement.prototype.scrollIntoView=()=>{};w.alert=msg=>{throw new Error(msg);};
    let calls=0, resolve, fail=true, sent;
    w.KJARecruitmentAPI={
      submit:async(id,datos,file)=>{calls++;sent={id,datos,file};if(fail)throw new Error('Sin conexión');return new Promise(r=>{resolve=r;});},
      message:e=>e.message
    };
    w.eval(source('assets/js/reclutamiento.js'));
    await tick();
    w.switchRecStep(4);assert.equal(d.querySelector('#rec-panel-4').classList.contains('active'),false);
    for(const id of ['chk-rec-fb','chk-rec-horario','chk-rec-entrevista'])d.getElementById(id).checked=true;
    for(const [id,value] of Object.entries({'rec-nombres':'Ana Pérez','rec-dni':'12345678','rec-telefono':'987654321','rec-email':'ana@example.com'}))d.getElementById(id).value=value;
    const file=new w.File(['%PDF-1.7\nTest'],'curriculum.pdf',{type:'application/pdf'});
    Object.defineProperty(d.getElementById('rec-cv-input'),'files',{value:[file]});
    d.getElementById('rec-cv-input').dispatchEvent(new w.Event('change'));
    w.validateStep2AndNext();
    await w.validateStep3AndNext();
    assert.equal(calls,1);assert.equal(d.querySelector('#rec-panel-3').classList.contains('active'),true);
    assert.match(d.getElementById('rec-submit-error').textContent,/Sin conexión/);
    const firstId=sent.id;fail=false;
    const pending=w.validateStep3AndNext();await tick();
    assert.equal(d.getElementById('rec-btn-p3-next').disabled,true);
    await w.validateStep3AndNext();assert.equal(calls,2);
    assert.equal(sent.id,firstId);assert.equal(sent.file.name,'curriculum.pdf');
    assert.match(sent.datos.entrevistaFecha,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(sent.datos.requisitosAceptados,true);
    resolve({id:firstId,codigo:'KJA-REC-2026-TEST',created_at:'2026-10-20T18:00:00Z'});
    await pending;
    assert.equal(d.querySelector('#rec-panel-4').classList.contains('active'),true);
    assert.equal(d.getElementById('rec-res-nombre').textContent,'Ana Pérez');
    assert.equal(d.getElementById('rec-res-codigo').textContent,'KJA-REC-2026-TEST');
    assert.match(d.getElementById('rec-res-cv').textContent,/curriculum.pdf/);
    assert.equal(w.localStorage.getItem('kja_recruitment_candidates'),null);
    assert.equal(d.querySelector('#rec-panel-4 a[href="dashboard.html"]'),null);
    assert.equal(d.querySelectorAll('.rec-receipt').length,1);
    w.switchRecStep(3);assert.equal(d.querySelector('#rec-panel-4').classList.contains('active'),true);
  } finally {w.close();}
});

test('Bandeja real: lectura remota, contenido escapado, revisión y cierre de sesión', async () => {
  const dom=new JSDOM('<section class="view active"><div id="rec-inbox-root"></div></section><span data-rec-pending-count hidden></span>',{url:'https://kja.example',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  try {
    const candidate={id:'10000000-0000-4000-8000-000000000001',codigo:'KJA-REC-TEST',created_at:'2026-10-20T18:00:00Z',estado:'Pendiente',revision:0,datos:{nombres:'<img src=x onerror=alert(1)>',dni:'12345678',emailNotificacion:'ana@example.com',carrera:'Psicología',nivel:'Egresado',modalidad:'Remoto',turno:'Mañana',entrevistaFecha:'2026-10-24',entrevistaHora:'09:30 AM',entrevistaCanal:'Virtual',cvName:'cv.pdf',cvBytes:100,requisitosAceptados:true}};
    let onAuth,authorized=true,saved;
    w.db={auth:{getUser:async()=>({data:{user:{id:'admin'}}}),onAuthStateChange:fn=>{onAuth=fn;}},rpc:async(name,args)=>{
      if(name==='rec_es_admin')return {data:authorized};
      if(name==='rec_listar')return {data:{items:[candidate],total:1,counts:{total:1,pendientes:1,revision:0,aprobados:0}}};
      if(name==='rec_actualizar'){saved=args;return {data:{...candidate,revision:1,estado:args.p_estado}};}
      throw new Error('Unexpected RPC '+name);
    }};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;};
    w.eval(source('assets/js/reclutamiento-api.js'));w.eval(source('assets/js/dashboard-reclutamiento.js'));
    await tick();await w.kjaRecruitment.refresh();
    assert.match(d.getElementById('rec-inbox-rows').textContent,/<img src=x/);
    assert.equal(d.querySelector('#rec-inbox-rows img'),null);
    assert.equal(d.querySelector('[data-rec-pending-count]').textContent,'1');
    d.querySelector('[data-id]').click();
    assert.equal(d.getElementById('rec-inbox-detail').open,true);
    assert.match(d.getElementById('ri-detail-data').textContent,/cv.pdf/);
    d.querySelector('#ri-detail-status [role="option"][data-value="En revisión"]').click();
    d.getElementById('ri-detail-notes').value='Entrevistar';
    d.getElementById('ri-review-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
    assert.equal(saved.p_revision,0);assert.equal(saved.p_estado,'En revisión');assert.equal(saved.p_notas,'Entrevistar');
    assert.match(d.getElementById('ri-detail-message').textContent,/Revisión guardada/);
    assert.match(d.querySelector('.ri-contact-action p').textContent,/no envía mensajes/);
    assert.equal(d.getElementById('ri-current-status').textContent,'En revisión');
    onAuth('SIGNED_OUT');
    assert.equal(d.getElementById('rec-inbox-rows').textContent,'');
    assert.equal(d.getElementById('rec-inbox-detail').open,false);
    assert.equal(d.getElementById('ri-detail-data').textContent,'');
    assert.equal(d.getElementById('ri-detail-notes').value,'');
    authorized=false;await w.kjaRecruitment.refresh();
    assert.match(d.getElementById('rec-inbox-message').textContent,/no tiene permiso/);
    assert.equal(d.getElementById('rec-inbox-rows').textContent,'');
  } finally {w.close();}
});

test('Accesos administrativos y paneles sin IDs duplicados',()=>{
  for(const file of ['reclutamiento.html','dashboard.html','admin.html']){
    const dom=new JSDOM(source(file)),d=dom.window.document;
    const seen=new Set();
    for(const el of d.querySelectorAll('[id]')){assert.equal(seen.has(el.id),false,`${file}: ID duplicado ${el.id}`);seen.add(el.id);}
    if(file!=='reclutamiento.html')assert.ok(d.querySelector('#rec-inbox-root'));
    dom.window.close();
  }
});
