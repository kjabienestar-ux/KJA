import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const wait=ms=>new Promise(r=>setTimeout(r,ms)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function setup(t){
 const dom=new JSDOM(fs.readFileSync('dashboard.html','utf8'),{runScripts:'outside-only',url:'http://localhost/dashboard'}),w=dom.window;t.after(()=>w.close());
 w.APP={sessionUid:'test',access:{acceso_panel:true,rol:'direccion'},adminSection:'asignaciones'};w.$=id=>w.document.getElementById(id);w.matchMedia=()=>({matches:true});w.isoLima=()=> '2026-11-20';w.$('admin-close-date').value=w.isoLima();
 w.adminCloseReadScope=date=>JSON.stringify([w.APP.sessionUid,w.APP.access.rol,date]);w.adminCloseMsg=text=>w.$('admin-assignment-message').textContent=text;w.syncAssignmentCalendar=()=>{};
 w.ADMIN_CLOSE_REQUEST=0;w.renderAdminCloseAssignments=()=>{w.$('admin-close-assignment-list').innerHTML='<b>Resultado de ensayo</b>';w.$('admin-close-assignment-count').textContent='1 asignación';w.$('assignment-day-summary-stats').textContent='1';};
 w.eval(fs.readFileSync('assets/js/dashboard-skeleton.js','utf8'));const run=w.DashboardSkeleton.withSkeleton;w.DashboardSkeleton.withSkeleton=(h,k,f,o)=>run(h,k,f,{...o,delay:5,minVisible:20,fade:0});
 w.eval(fs.readFileSync('assets/js/dashboard-assignment-loading.js','utf8'));
 const load=({gate=null,ok=true,role='direccion'}={})=>{w.APP.access.rol=role;const token={};w.ADMIN_CLOSE_FLIGHT=token;const current=()=>w.ADMIN_CLOSE_FLIGHT===token;return w.KJAAssignmentLoading.run(w.adminCloseReadScope(w.$('admin-close-date').value),async()=>{if(gate)await gate.promise;if(ok&&current())w.APP.adminClose={puede_editar:role==='direccion',asignaciones:[{id:1}]};return ok;},current);};
 return {w,load,root:w.$('admin-assignments-section')};
}
test('espera lenta conserva formulario y contexto con formas inertes, sin espejo',async t=>{
 const h=setup(t),g=deferred(),pending=h.load({gate:g});await wait(12);
 assert.ok(h.root.querySelector('.asg-loading-row .kja-sk-block'));assert.equal(h.root.querySelector('.kja-skeleton-mirror'),null);
 assert.match(h.root.textContent,/Asignaciones del día/);assert.match(h.root.textContent,/Pendientes/);assert.equal(h.w.$('admin-close-title').disabled,false);assert.equal(h.w.$('admin-close-assign').disabled,true);
 assert.ok(h.root.querySelector('.asg-loading-row[inert][aria-hidden="true"]'));g.resolve();assert.equal(await pending,true);assert.equal(h.root.querySelector('.kja-sk-block'),null);
 assert.equal(h.w.$('admin-close-assignment-form').inert,false);
});
test('respuesta rápida no muestra formas ni deja estado ocupado',async t=>{
 const h=setup(t);await h.load();assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.root.getAttribute('aria-busy'),'false');
});
test('refresco conserva borrador y foco y bloquea acciones hasta terminar',async t=>{
 const h=setup(t);await h.load();h.w.$('admin-close-title').value='Borrador';h.w.$('admin-close-title').focus();const g=deferred(),pending=h.load({gate:g});await wait(12);
 assert.equal(h.w.$('admin-close-title').value,'Borrador');assert.equal(h.w.document.activeElement.id,'admin-close-title');assert.match(h.root.textContent,/Resultado de ensayo/);assert.equal(h.root.querySelector('.kja-sk-block'),null);assert.equal(h.w.KJAAssignmentLoading.canWrite(),false);g.resolve();await pending;assert.equal(h.w.KJAAssignmentLoading.canWrite(),true);
});
test('fallo de actualización conserva datos anteriores y ofrece reintento',async t=>{
 const h=setup(t);await h.load();assert.equal(await h.load({ok:false}),false);assert.match(h.root.textContent,/datos anteriores/);assert.match(h.root.textContent,/Resultado de ensayo/);assert.equal(h.w.KJAAssignmentLoading.canWrite(),false);assert.ok(h.root.querySelector('.asg-loading-retry'));
});
test('fallo inicial muestra indisponibilidad y no un vacío o cifras cero',async t=>{
 const h=setup(t);await h.load({ok:false});assert.match(h.root.textContent,/Información no disponible/);assert.equal(h.w.$('admin-close-assignment-count').textContent,'Sin consultar');assert.equal(h.root.querySelector('.kja-sk-block'),null);
});
test('cambio de fecha retira resultados del contexto anterior',async t=>{
 const h=setup(t);await h.load();h.w.$('admin-close-date').value='2026-11-19';const g=deferred(),pending=h.load({gate:g});assert.doesNotMatch(h.root.textContent,/Resultado de ensayo/);assert.equal(h.w.APP.adminClose,null);g.resolve();await pending;assert.equal(h.w.$('admin-close-assign').disabled,true);
});
test('reinicio invalida la consulta anterior y retira sus anuncios',async t=>{
 const h=setup(t),g=deferred(),pending=h.load({gate:g});await wait(12);h.w.KJAAssignmentLoading.reset();g.resolve();await pending;assert.equal(h.w.APP.adminClose,null);assert.equal(h.root.getAttribute('aria-busy'),'false');assert.notEqual(h.root.previousElementSibling?.getAttribute('role'),'status');
});
test('solo lectura oculta creación aunque el contexto de espera esté disponible',async t=>{
 const h=setup(t);await h.load({role:'visor'});assert.equal(h.w.$('assignment-create-panel').hidden,true);assert.equal(h.w.$('assignment-create-toggle').hidden,true);
});
