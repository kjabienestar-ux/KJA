import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const html=fs.readFileSync('dashboard.html','utf8');
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const moduleSource=source.slice(source.indexOf('const ADMIN_LIST_VIEW='),source.indexOf('function toggleAdminListArea('));
const skeleton=fs.readFileSync('assets/js/dashboard-skeleton.js','utf8');
const closeModel=fs.readFileSync('assets/js/dashboard-close-model.js','utf8');
const date='2026-11-19';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(t,{role='direccion',fastTimers=true}={}){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/dashboard'}),w=dom.window;
  t.after(()=>w.close());w.matchMedia=()=>({matches:true});
  w.eval(fs.readFileSync('assets/js/kja-area-group.js','utf8'));
  w.APP={sessionUid:'fixture',access:{rol:role,acceso_panel:true},adminSection:'lista',adminList:null,adminListRequest:0};
  w.$=id=>w.document.getElementById(id);w.isoLima=()=>date;
  w.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  w.cap=s=>s;w.fmtTime=s=>s?String(s).includes('T')?String(s).slice(11,16):String(s).slice(0,5):'—';
  w.profileAvatarMarkup=()=>'<span class="avatar">PF</span>';w.hydrateProfilePhotos=async rows=>rows;w.statusLabel=s=>s;
  w.syncAdminDateDisplay=()=>{};w.renderAdminDateStrip=()=>{};w.toggleAdminAreaMenu=()=>{};
  w.syncAdminAreaCustomSelect=()=>{w.$('admin-area-label').textContent=w.$('admin-list-area').selectedOptions[0]?.textContent||'Todas las áreas';};
  w.adminListMsg=text=>{w.$('admin-list-message').textContent=text;};
  w.$('admin-list-date').value=date;w.$('admin-list-section').hidden=false;
  w.eval(closeModel);w.CLOSE_MODEL=w.KJACloseModel;w.eval(skeleton);
  if(fastTimers){const run=w.DashboardSkeleton.withSkeleton;w.DashboardSkeleton.withSkeleton=(host,kind,fetch,options)=>run(host,kind,fetch,{...options,delay:5,minVisible:15,fade:0});}
  let mode='data',held=[],data=payload();const calls=[];
  function payload(name='Ana de ensayo',canEdit=true){
    const person={id:1,nombre:name,area_id:1,area:'Área de ensayo',modalidad:'virtual',hora_entrada:'14:00',hora_salida:'18:00',horas:4,estado:'P',marcado_at:date+'T13:00:00Z'};
    return {dash_admin_lista:{ok:true,fecha:date,puede_editar:canEdit,personas:[person]},dash_admin_cierres:{ok:true,fecha:date,personas:[{id:1,cierre:{aplica:true,estado:'completa',salida_at:date+'T18:00:00Z'}}]}};
  }
  w.db={rpc:(name,args)=>{
    calls.push({name,args});
    const response=()=>mode==='error'?{error:{message:'offline'}}:{data:structuredClone({...data[name],fecha:args.p_fecha})};
    return mode==='hold'?new Promise(resolve=>held.push({name,resolve,response})):Promise.resolve(response());
  }};
  w.eval(moduleSource);
  return {w,root:w.$('admin-list-section'),calls,load:()=>w.loadAdminAttendance(),
    mode(value){mode=value;},data(value){data=value;},payload,
    release(name){const ready=held.filter(item=>!name||item.name===name);held=held.filter(item=>!ready.includes(item));for(const item of ready)item.resolve(item.response());},
    releaseDate(selected){const count=calls.filter(call=>call.args.p_fecha===selected).length;const ready=held.splice(held.length-count,count);for(const item of ready)item.resolve(item.response());}
  };
}

test('carga lenta conserva contexto y representa solo datos pendientes con formas inertes',async t=>{
  const h=setup(t);h.mode('hold');const pending=h.load();await wait(12);
  assert.match(h.root.textContent,/Personas del día/);assert.match(h.root.textContent,/Jornadas completas/);
  assert.match(h.root.textContent,/Entrada/);assert.match(h.root.textContent,/Evidencia/);
  assert.equal(h.w.$('admin-list-search').disabled,false);assert.equal(h.w.$('admin-area-trigger').disabled,true);
  assert.equal(h.root.querySelector('.kja-skeleton-mirror,.kja-skeleton-layer'),null);
  assert.ok(h.root.querySelector('.apl-loading-row').closest('[inert][aria-hidden="true"]'));
  assert.ok([...h.root.querySelectorAll('.kja-sk-block')].every(node=>node.getAttribute('aria-hidden')==='true'));
  assert.equal(h.root.querySelector('[data-admin-person]'),null);
  assert.equal(h.root.previousElementSibling.textContent,'Cargando Pasar lista.');
  h.mode('data');h.release();assert.equal(await pending,true);
  assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.match(h.root.textContent,/Completa/);
  assert.equal(h.root.getAttribute('aria-busy'),'false');assert.equal(h.calls.length,2);
});

test('asistencia y cierre se revelan juntos aunque una fuente llegue antes',async t=>{
  const h=setup(t);h.mode('hold');const pending=h.load();await wait(12);
  h.release('dash_admin_lista');await wait(10);
  assert.equal(h.root.querySelector('[data-admin-person]'),null);assert.ok(h.root.querySelector('.kja-sk-block'));
  h.mode('data');h.release();await pending;assert.equal(h.root.querySelectorAll('[data-admin-person]').length,1);
});

test('buscar no revela datos antes de cumplir la permanencia mínima del esqueleto',async t=>{
  const h=setup(t,{fastTimers:false});const run=h.w.DashboardSkeleton.withSkeleton;h.w.DashboardSkeleton.withSkeleton=(host,kind,fetch,options)=>run(host,kind,fetch,{...options,delay:5,minVisible:500,fade:0});h.mode('hold');const pending=h.load();for(let i=0;i<100&&!h.root.querySelector('.kja-sk-block');i++)await wait(5);assert.ok(h.root.querySelector('.kja-sk-block'));h.mode('data');h.release();await wait(1);
  h.w.$('admin-list-search').value='Ana';h.w.renderAdminAttendance();
  assert.ok(h.root.querySelector('.kja-sk-block'));assert.equal(h.root.querySelector('[data-admin-person]'),null);
  assert.equal(h.w.$('admin-entry-open').disabled,true);
  await pending;assert.equal(h.root.querySelectorAll('[data-admin-person]').length,1);
});

test('respuesta rápida evita el esqueleto y dos llamadas comparten las mismas consultas',async t=>{
  const h=setup(t,{fastTimers:false});let shown=false;
  const observer=new h.w.MutationObserver(()=>{shown ||= !!h.root.querySelector('.kja-sk-block');});observer.observe(h.root,{subtree:true,childList:true});
  await Promise.all([h.load(),h.load()]);observer.disconnect();
  assert.equal(shown,false);assert.equal(h.calls.length,2);assert.equal(h.w.$('admin-entry-open').disabled,false);
});

test('actualizar conserva filas válidas, búsqueda y foco; bloquea escrituras durante la espera',async t=>{
  const h=setup(t);await h.load();const search=h.w.$('admin-list-search');search.value='Ana';search.focus();
  const row=h.root.querySelector('[data-admin-person]');h.mode('hold');const pending=h.load();await wait(12);
  assert.equal(h.root.querySelector('[data-admin-person]'),row);assert.equal(h.root.querySelector('.kja-sk-block'),null);
  assert.equal(h.w.document.activeElement,search);assert.equal(search.value,'Ana');assert.equal(h.root.querySelector('.apl-mark').disabled,true);
  assert.equal(h.w.$('admin-list-load-status').textContent,'');assert.equal(h.w.$('admin-list-load-status').hidden,true);
  h.mode('data');h.release();await pending;assert.equal(h.w.document.activeElement,search);assert.equal(h.root.querySelector('.apl-mark').disabled,false);
});

test('fallo inicial termina la espera sin ceros falsos y un reintento recupera la lista',async t=>{
  const h=setup(t);h.mode('error');assert.equal(await h.load(),false);
  assert.match(h.root.textContent,/Información no disponible/);assert.equal(h.root.querySelector('.kja-sk-block'),null);
  assert.equal(h.root.querySelector('[data-list-retry]').textContent,'Reintentar');assert.equal(h.root.getAttribute('aria-busy'),'false');
  assert.ok([...h.w.$('admin-list-kpis').querySelectorAll('b')].every(node=>node.textContent==='—'));
  h.mode('data');assert.equal(await h.load(),true);assert.equal(h.root.querySelector('[data-list-retry]'),null);
});

test('actualizar los indicadores conserva el foco del filtro usado con teclado',async t=>{
  const h=setup(t);await h.load();h.root.querySelector('[data-list-filter="entries"]').focus();h.w.renderAdminAttendance();
  assert.equal(h.w.document.activeElement.dataset.listFilter,'entries');
});

test('fallo de actualización identifica los datos anteriores y permite filtrar sin habilitar escrituras',async t=>{
  const h=setup(t);await h.load();h.mode('error');assert.equal(await h.load(),false);
  assert.match(h.root.textContent,/Ana de ensayo/);assert.match(h.w.$('admin-list-message').textContent,/datos anteriores/);
  assert.equal(h.root.querySelector('.apl-mark').disabled,true);assert.equal(h.w.$('admin-entry-open').disabled,true);
  h.w.renderAdminAttendance();assert.match(h.w.$('admin-list-message').textContent,/datos anteriores/);
  h.mode('data');assert.equal(await h.load(),true);assert.equal(h.root.querySelector('.apl-mark').disabled,false);
});

test('cambiar fecha retira datos anteriores y una respuesta tardía no reemplaza la selección nueva',async t=>{
  const h=setup(t);await h.load();h.mode('hold');const old=h.load();
  h.w.$('admin-list-date').value='2026-11-18';const latest=h.load();await wait(12);
  assert.equal(h.root.querySelector('[data-admin-person]'),null);assert.doesNotMatch(h.root.textContent,/Ana de ensayo/);
  h.mode('data');h.data(h.payload('Beatriz de la fecha nueva'));h.releaseDate('2026-11-18');await latest;
  h.data(h.payload('Respuesta anterior'));h.release();await old;
  assert.match(h.root.textContent,/Beatriz de la fecha nueva/);assert.doesNotMatch(h.root.textContent,/Respuesta anterior/);
});

test('sesión nueva invalida el resultado y reiniciar limpia espera, anuncio y respuestas en vuelo',async t=>{
  const h=setup(t);await h.load();h.w.APP.sessionUid='otra-cuenta';h.mode('hold');const pending=h.load();await wait(12);
  assert.doesNotMatch(h.root.textContent,/Ana de ensayo/);h.w.resetAdminAttendanceView();
  h.mode('data');h.release();await pending;
  assert.equal(h.root.querySelector('.kja-sk-block,[data-admin-person]'),null);assert.equal(h.root.getAttribute('aria-busy'),'false');
  assert.notEqual(h.root.previousElementSibling?.getAttribute('role'),'status');
});

test('resultado vacío y permisos de solo lectura se distinguen de una carga',async t=>{
  const h=setup(t,{role:'editor'});h.data(h.payload('Persona de solo lectura',false));await h.load();
  assert.equal(h.root.querySelector('.apl-mark').disabled,true);assert.equal(h.w.$('admin-entry-open').hidden,true);
  const empty=h.payload();empty.dash_admin_lista.personas=[];empty.dash_admin_cierres.personas=[];h.data(empty);await h.load();
  assert.match(h.root.textContent,/No hay colaboradores para esta fecha/);assert.equal(h.root.querySelector('.kja-sk-block'),null);
  assert.equal(h.w.$('admin-list-kpis').querySelector('b').textContent,'0');
});
