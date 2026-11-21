import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const html=fs.readFileSync('dashboard.html','utf8');
const skeleton=fs.readFileSync('assets/js/dashboard-skeleton.js','utf8');
const source=fs.readFileSync('assets/js/dashboard.js','utf8');
const loader=source.slice(source.indexOf('async function loadAdminHub(){'),source.indexOf('function adminListMsg('));
const wrapper=source.slice(source.indexOf('const ADMIN_SECTION_CONTAINERS='),source.indexOf('async function showAdminSection('));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}};
function setup(t){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;
  t.after(()=>w.close());
  w.matchMedia=()=>({matches:true});
  w.APP={sessionUid:'first',access:{rol:'direccion',acceso_panel:true}};
  w.$=id=>w.document.getElementById(id);w.isoLima=()=> '2026-11-19';
  w.cap=s=>s;w.esc=s=>String(s??'');w.toast=()=>{};
  w.renderAdminOverviewCharts=()=>{w.$('admin-overview-charts').innerHTML='<article>Indicadores recibidos</article>'};
  w.groupAdminLeaveRequests=()=>[];w.renderAdminRequestGroup=()=>'';w.syncAdminLeaveReview=()=>{};
  w.profileAvatarMarkup=()=>'<span aria-hidden="true">PF</span>';
  w.hydrateProfilePhotos=async people=>people;
  w.eval(skeleton);w.eval(loader);w.eval(wrapper);
  const host=w.$('admin-overview-section');
  const options={delay:0,minVisible:0,fade:0};
  const run=fn=>w.withAdminSkeleton('overview',fn,options);
  return {w,host,run};
}
function queries(w){
  const names=['asis_colaboradores','asis_registros','dash_admin_cierres','asis_solicitudes_horario','dash_admin_solicitudes_agrupadas','dash_admin_control_diario'];
  const gates=Object.fromEntries(names.map(name=>[name,deferred()])),calls=[];
  const query=name=>{calls.push(name);return gates[name].promise};
  w.db={rpc:name=>query(name),from(name){const q={then:(ok,bad)=>query(name).then(ok,bad)};for(const method of ['select','eq','order'])q[method]=()=>q;return q}};
  const core=()=>{
    gates.asis_colaboradores.resolve({data:[{id:1,nombre:'Persona ficticia',asis_areas:{nombre:'Área de ensayo'}}]});
    gates.asis_registros.resolve({data:[]});gates.dash_admin_cierres.resolve({data:{ok:true,personas:[]}});
  };
  const secondary=()=>{
    gates.asis_solicitudes_horario.resolve({data:[]});gates.dash_admin_solicitudes_agrupadas.resolve({data:{ok:true,solicitudes:[]}});gates.dash_admin_control_diario.resolve({data:{ok:true,filas:[]}});
  };
  return {gates,calls,core,secondary};
}

test('primera carga conserva encabezados y acción independiente sin espejo de pantalla',async t=>{
  const {w,host,run}=setup(t),gate=deferred();
  const loading=run(()=>gate.promise);await wait(10);
  assert.match(host.textContent,/Estado general del equipo/);assert.match(host.textContent,/Requieren atención/);
  assert.equal(host.querySelector('.kja-skeleton-mirror,.kja-skeleton-layer'),null);
  assert.equal(host.querySelectorAll('[data-kja-context-loading]').length,6);
  assert.ok([...host.querySelectorAll('[data-kja-context-loading]')].every(node=>node.getAttribute('aria-hidden')==='true'));
  assert.equal(host.querySelector('.admin-panel-foot[data-admin-section="lista"]').disabled,false);
  assert.equal(w.$('admin-request-refresh').disabled,true);
  assert.equal(host.querySelector('#admin-overview-date').hasAttribute('data-kja-context-loading'),false);
  assert.equal(host.previousElementSibling.getAttribute('role'),'status');
  assert.equal(host.querySelectorAll('.kja-context-layer [id],.kja-context-layer button').length,0);
  gate.resolve(true);await loading;
  assert.equal(host.querySelectorAll('[data-kja-context-loading]').length,0);
  assert.equal(w.$('admin-attention-count').hasAttribute('aria-hidden'),false);
  assert.equal(w.$('admin-request-refresh').disabled,false);
  assert.equal(host.getAttribute('aria-busy'),'false');
});

test('respuesta rápida no monta placeholders ni deja controles bloqueados',async t=>{
  const {w,host}=setup(t);
  await w.withAdminSkeleton('overview',async()=>true,{delay:30,minVisible:0,fade:0});
  assert.equal(host.querySelector('.kja-context-layer'),null);
  assert.equal(w.$('admin-request-refresh').disabled,false);
});

test('los datos recibidos durante la espera permanecen al desmontar los placeholders',async t=>{
  const {w,host,run}=setup(t),gate=deferred();
  const loading=run(()=>gate.promise);await wait(10);
  w.$('admin-status-list').innerHTML='<p>Resultado real de la consulta ficticia</p>';
  gate.resolve(true);await loading;
  assert.match(w.$('admin-status-list').textContent,/Resultado real/);
  assert.equal(host.querySelector('.kja-context-layer'),null);
});

test('datos base se revelan sin esperar solicitudes; el bloque pendiente se libera al resolver',async t=>{
  const {w,host,run}=setup(t),q=queries(w);
  const loading=run(()=>w.loadAdminHub());await wait(10);q.core();await loading;
  assert.match(w.$('admin-status-list').textContent,/Persona ficticia/);
  assert.equal(w.$('admin-status-list').hasAttribute('data-kja-context-loading'),false);
  assert.equal(w.$('admin-request-list').getAttribute('aria-busy'),'true');
  assert.equal(w.$('admin-request-count').hasAttribute('data-kja-context-loading'),true);
  q.secondary();await wait(15);
  assert.equal(host.querySelector('.kja-context-layer'),null);
  assert.match(w.$('admin-request-list').textContent,/No hay solicitudes pendientes/);
  assert.equal(w.$('admin-request-list').getAttribute('aria-busy'),'false');
  assert.equal(q.calls.length,6);
});

test('actualización mantiene resultados y conserva los anteriores si falla',async t=>{
  const {w,host,run}=setup(t),q=queries(w);const first=run(()=>w.loadAdminHub());q.core();await first;q.secondary();await wait(10);
  const before=w.$('admin-status-list').innerHTML,gate=deferred();
  const loading=run(async()=>{await gate.promise;w.renderAdminHubError(true);return false});await wait(10);
  assert.equal(host.classList.contains('is-context-refreshing'),true);
  assert.equal(w.$('admin-status-list').innerHTML,before);
  assert.equal(host.querySelector('.kja-context-layer'),null);
  gate.resolve();assert.equal(await loading,false);
  assert.equal(w.$('admin-status-list').innerHTML,before);
  assert.match(w.$('admin-overview-notice').textContent,/últimos datos recibidos/);
  assert.equal(host.getAttribute('aria-busy'),'false');
  assert.equal(w.$('admin-request-refresh').disabled,false);
});

test('un contexto nuevo retira inmediatamente identidades anteriores',async t=>{
  const {w,run}=setup(t),q=queries(w);const first=run(()=>w.loadAdminHub());q.core();await first;q.secondary();await wait(10);
  w.APP.sessionUid='another';const gate=deferred();const loading=run(()=>gate.promise);
  assert.equal(w.$('admin-status-list').textContent,'');
  assert.equal(w.$('admin-overview-date').textContent,'Operación de hoy');
  gate.resolve(true);await loading;
});

test('actualizar conserva solicitudes recibidas hasta completar su consulta independiente',async t=>{
  const {w,run}=setup(t),first=queries(w);const initial=run(()=>w.loadAdminHub());first.core();await initial;
  first.gates.asis_solicitudes_horario.resolve({data:[{id:1,colaborador_id:1,horario_nuevo:'Horario de ensayo'}]});first.secondary();await wait(10);
  assert.match(w.$('admin-request-list').textContent,/Horario de ensayo/);
  const second=queries(w),refresh=run(()=>w.loadAdminHub());second.core();await refresh;
  assert.match(w.$('admin-request-list').textContent,/Horario de ensayo/);
  assert.equal(w.$('admin-request-list').hasAttribute('data-kja-context-loading'),false);
  assert.equal(w.$('admin-overview-notice').hidden,true);
  second.secondary();await wait(10);
  assert.match(w.$('admin-request-list').textContent,/No hay solicitudes pendientes/);
  assert.equal(w.$('admin-overview-notice').hidden,true);
});

test('fallo de primera carga termina el esqueleto y el reintento recupera contenido',async t=>{
  const {w,host,run}=setup(t);let attempts=0;
  const fetch=async()=>{if(++attempts===1)throw new Error('Fallo de ensayo');w.$('admin-status-list').textContent='Recuperado';return true};
  assert.equal(await run(fetch),false);
  assert.equal(host.querySelector('.kja-context-layer'),null);
  assert.equal(host.getAttribute('aria-busy'),'false');
  host.querySelector('.kja-context-error button').click();await wait(15);
  assert.equal(attempts,2);assert.equal(w.$('admin-status-list').textContent,'Recuperado');
  assert.equal(host.querySelector('.kja-context-error'),null);
});
