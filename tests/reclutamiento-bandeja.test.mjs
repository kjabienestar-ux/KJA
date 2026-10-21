import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html=fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const moduleSource=fs.readFileSync(new URL('../assets/js/dashboard-reclutamiento.js',import.meta.url),'utf8');

test('el menú, el acceso móvil y la sección existen y cargan sus dependencias locales',()=>{
  const dom=new JSDOM(html),doc=dom.window.document;
  for(const id of ['nav-reclutamiento','mobile-action-reclutamiento','admin-recruitment-tab']){
    assert.ok(doc.getElementById(id));
    assert.equal(doc.getElementById(id).hidden,true);
  }
  assert.ok(doc.querySelector('#workspace > #view-reclutamiento #rec-inbox-root'));
  const scripts=[...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src').split('?')[0]);
  assert.ok(scripts.indexOf('assets/js/reclutamiento-api.js')<scripts.indexOf('assets/js/dashboard.js'));
  assert.ok(scripts.indexOf('assets/js/dashboard-reclutamiento.js')>scripts.indexOf('assets/js/dashboard.js'));
  for(const src of scripts.filter(s=>s.includes('reclutamiento')))assert.ok(fs.existsSync(new URL(`../${src}`,import.meta.url)));
  dom.window.close();
});

test('solo Dirección ve los accesos y una navegación directa sin permiso se rechaza',()=>{
  const dom=new JSDOM(html),doc=dom.window.document;
  const context={APP:{access:{rol:'direccion',acceso_panel:true}},$:id=>doc.getElementById(id),window:{kjaRecruitment:{refresh(){},clear(){}}},toast(){context.denied=true;}};
  vm.createContext(context);
  vm.runInContext(main.slice(main.indexOf('function syncRecruitmentNavigation(){'),main.indexOf("document.querySelectorAll('[data-view]').forEach")),context);
  context.syncRecruitmentNavigation();
  assert.equal(doc.getElementById('nav-reclutamiento').hidden,false);
  assert.equal(doc.getElementById('mobile-action-reclutamiento').hidden,false);
  context.APP.access.rol='editor';context.syncRecruitmentNavigation();
  assert.equal(doc.getElementById('nav-reclutamiento').hidden,true);
  context.goView('reclutamiento');assert.equal(context.denied,true);
  context.APP.access={rol:'direccion',acceso_panel:false};context.syncRecruitmentNavigation();
  assert.equal(doc.getElementById('nav-reclutamiento').hidden,true);
  dom.window.close();
});

async function inbox(admin){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/dashboard.html'});
  await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
  const calls=[];
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.db={auth:{getUser:async()=>({data:{user:{id:'test'}}})}};
  dom.window.KJARecruitmentAPI={
    message:error=>error.message,
    async rpc(client,name){
      calls.push(name);
      if(name==='rec_es_admin')return admin;
      if(name==='rec_listar')return {items:[{id:'test',codigo:'KJA-TEST',created_at:'2026-10-21T15:00:00Z',estado:'Pendiente',datos:{nombres:'<img src=x onerror=alert(1)>',dni:'12345678',emailNotificacion:'test@example.com'}}],total:1,counts:{total:1,pendientes:1}};
      throw new Error(`RPC inesperada: ${name}`);
    }
  };
  dom.window.eval(moduleSource);
  await dom.window.kjaRecruitment.refresh();
  return {dom,doc:dom.window.document,calls};
}

test('la bandeja autorizada carga solicitudes y escapa el contenido del postulante',async()=>{
  const {dom,doc,calls}=await inbox(true);
  assert.deepEqual(calls,['rec_es_admin','rec_listar']);
  assert.equal(doc.querySelectorAll('#rec-inbox-rows tr').length,1);
  assert.equal(doc.querySelector('#ri-pending').textContent,'1');
  assert.equal(doc.querySelector('#rec-inbox-rows img'),null);
  assert.match(doc.querySelector('#rec-inbox-rows').textContent,/<img/);
  dom.window.close();
});

test('el servidor deniega la lectura antes de listar para cuentas sin permiso',async()=>{
  const {dom,doc,calls}=await inbox(false);
  assert.deepEqual(calls,['rec_es_admin']);
  assert.match(doc.querySelector('#rec-inbox-message').textContent,/no tiene permiso/);
  assert.equal(doc.querySelectorAll('#rec-inbox-rows tr').length,0);
  dom.window.close();
});

test('el filtro desplegable consulta el estado elegido y se restablece con Limpiar filtros',async()=>{
  const {dom,doc}=await inbox(true);
  const args=[];
  const rpc=dom.window.KJARecruitmentAPI.rpc;
  dom.window.KJARecruitmentAPI.rpc=async(client,name,a)=>{if(name==='rec_listar')args.push(a.p_estado);return rpc(client,name,a);};
  assert.equal(doc.getElementById('rec-inbox-filter').dataset.value,'Pendiente');
  doc.getElementById('rec-inbox-filter-trigger').click();
  doc.querySelector('#rec-inbox-filter [role="option"][data-value="Entrevista"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  doc.getElementById('rec-inbox-reset').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(args,['Entrevista','']);
  assert.equal(doc.getElementById('rec-inbox-filter').dataset.value,'');
  assert.equal(doc.getElementById('rec-inbox-filter-trigger').textContent.trim(),'Todos los estados');
  assert.equal(doc.querySelector('[data-count-for=""]').textContent,'1');
  assert.equal(doc.querySelector('[data-count-for="Entrevista"]').hidden,true);
  dom.window.close();
});

test('la bandeja muestra un esqueleto de carga hasta recibir las solicitudes',async()=>{
  const dom=new JSDOM('<div id="rec-inbox-root"></div>',{runScripts:'outside-only',url:'http://localhost/'});
  await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
  dom.window.eval(moduleSource);dom.window.kjaRecruitment.init();
  const doc=dom.window.document,root=doc.getElementById('rec-inbox-root');
  assert.equal(root.classList.contains('is-first-load'),true);
  assert.equal(doc.querySelectorAll('#rec-inbox-rows .ri-skeleton').length,5);
  dom.window.close();
  const loaded=await inbox(true);
  assert.equal(loaded.doc.getElementById('rec-inbox-root').classList.contains('is-first-load'),false);
  assert.equal(loaded.doc.querySelectorAll('#rec-inbox-rows .ri-skeleton').length,0);
  loaded.dom.window.close();
});

test('cada tarjeta resume al postulante sin código ni DNI y el embudo refleja la proporción',async()=>{
  const {dom,doc}=await inbox(true);
  const row=doc.querySelector('#rec-inbox-rows tr.ri-row');
  assert.equal(row.dataset.state,'pending');
  assert.doesNotMatch(row.textContent,/KJA-TEST|12345678|test@example\.com/);
  assert.match(row.querySelector('.ri-meta').textContent,/Sin especialidad registrada/);
  assert.match(row.querySelector('.ri-received').title,/^Recibida el /);
  assert.ok(row.querySelector('.ri-go[aria-label^="Revisar expediente de"]'));
  assert.equal(doc.querySelector('[data-share-for="pendientes"]').style.getPropertyValue('--share'),'100%');
  assert.equal(doc.querySelector('[data-share-for="aprobados"]').style.getPropertyValue('--share'),'0%');
  assert.equal(doc.querySelector('[data-share-label="pendientes"]').textContent,'100%');
  dom.window.close();
});

test('el botón de cada tarjeta indica la acción según el estado',async()=>{
  const {dom,doc}=await inbox(true);
  assert.equal(doc.querySelector('.ri-go').textContent.trim(),'Revisar');
  const expected={'Pendiente':'Revisar','En revisión':'Continuar','Entrevista':'Coordinar','Aprobado':'Ver expediente','No seleccionado':'Ver expediente'};
  dom.window.KJARecruitmentAPI.rpc=async(client,name)=>name==='rec_es_admin'?true:{items:Object.keys(expected).map((estado,i)=>({id:`id-${i}`,codigo:`KJA-${i}`,created_at:'2026-10-21T15:00:00Z',estado,datos:{nombres:`Persona ${i}`}})),total:5,counts:{total:5}};
  await dom.window.kjaRecruitment.refresh();
  const buttons=[...doc.querySelectorAll('.ri-go')];
  assert.deepEqual(buttons.map(b=>b.textContent.trim()),Object.values(expected));
  assert.match(buttons[3].getAttribute("aria-label"),/^Ver expediente de Persona 3$/);
  assert.match(buttons[1].getAttribute("aria-label"),/^Continuar expediente de Persona 1$/);
  dom.window.close();
});
