import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-control.js','utf8');
function setup(){
 const elements=new Map(),calls=[];
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},options:[{value:''},{value:'1'}],setAttribute(k,v){this[k]=v},focus(){this.focused=true},querySelector(){return {focus(){}}}});
  return elements.get(id);
 };
 el('admin-control-sort').value='priority';
 const ctx=vm.createContext({APP:{access:{rol:'direccion'},adminControlRequest:0,adminSection:'control'},$:el,Intl,Date,Map,Set,Number,String,Promise,
 esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 initials:v=>v.split(' ').slice(0,2).map(x=>x[0]).join(''),cap:v=>v[0].toUpperCase()+v.slice(1),
 isoLima:()=> '2026-10-03',addIsoDays:(v,d)=>{const date=new Date(v+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+d);return date.toISOString().slice(0,10)},
 toast:(...args)=>calls.push(['toast',...args]),renderAdminCloseStatus:()=>calls.push(['render']),openAdminReviewPerson:(...args)=>calls.push(['review',...args])});
 vm.runInContext(source,ctx);return {ctx,el,calls};
}
const row=(id,extra={})=>({colaborador_id:id,colaborador:'Persona '+id,area:'Salud',area_id:1,labora:true,entrada_at:'2026-10-02T13:00:00Z',salida_at:null,entrada_estado:'P',cierre_estado:'en_curso',revision_pendiente:0,revision_observada:0,evidencias_pendientes:2,horas_validas:0,...extra});
test('queues exclude nonworking people, retain reviews and prioritize corrections',()=>{
 const {ctx,el}=setup();
 const off=row(1,{labora:false,cierre_estado:'no_aplica',entrada_at:null});
 const done=row(2,{cierre_estado:'completa',salida_at:'2026-10-02T20:00:00Z',evidencias_pendientes:0});
 const review={...done,colaborador_id:3,revision_pendiente:1};
 ctx.APP.adminControl={ok:true,filas:[off,done,review,row(4,{revision_observada:1})]};
 assert.deepEqual(Array.from(ctx.adminControlRows(),x=>x.colaborador_id),[4,3]);
 vm.runInContext("ADMIN_CONTROL_QUEUE='review'",ctx);assert.deepEqual(Array.from(ctx.adminControlRows(),x=>x.colaborador_id),[3]);
 vm.runInContext("ADMIN_CONTROL_QUEUE='done'",ctx);assert.equal(ctx.adminControlRows().length,2);
 el('admin-control-state').value='no_aplica';el('admin-control-state').onchange();
 assert.deepEqual(Array.from(ctx.adminControlRows(),x=>x.colaborador_id),[1]);
 assert.doesNotMatch(ctx.adminControlNextStep(off).copy,/Bloquea/);
});
test('requirements preserve Facebook, exempt presencial RPE and exclude cancelled assignments',()=>{
 const {ctx}=setup();
 const person=row(42,{cierre_estado:'incompleta',cierre:{aplica_jornada:true,requiere_rpe:false,rpe_exento_presencial:true,requisitos:[{tipo:'rpe',completo:false},{tipo:'comparticiones',completo:false},{tipo:'salida',completo:true}],asignaciones:[{titulo:'Cancelada',estado:'cancelada',completo:false}]}});
 assert.equal(ctx.adminControlPending(person),1);
 assert.equal(ctx.adminControlTasks(person).some(x=>x.tipo==='rpe'||x.titulo==='Cancelada'),false);
 const justified={...person,entrada_estado:'J',cierre:{...person.cierre,justificado:true,aplica_jornada:false}};
 assert.equal(ctx.adminControlState(justified).key,'justificado');assert.equal(ctx.adminControlTasks(justified).length,1);
 assert.doesNotMatch(ctx.adminControlPendingDetail(justified),/Salida sin registrar/);
 assert.equal(ctx.adminControlNeedsAttention(justified),true);
});
test('accent-insensitive search and inline details escape user text',()=>{
 const {ctx,el}=setup();ctx.APP.adminControl={ok:true,filas:[row(1,{colaborador:'María <script>',impedimentos:[{detalle:'<img onerror="bad">'}]})]};
 el('admin-control-search').value='maria';ctx.renderAdminControl();assert.equal(ctx.adminControlRows().length,1);
 assert.match(el('admin-control-table').innerHTML,/María &lt;script>/);
 el('admin-control-table').onclick({target:{closest:s=>s==='[data-control-detail]'?{dataset:{controlDetail:'1'}}:null}});
 assert.match(el('admin-control-table').innerHTML,/aria-expanded="true"/);
 assert.match(el('admin-control-table').innerHTML,/Aviso del colaborador/);
 assert.doesNotMatch(el('admin-control-table').innerHTML,/<img/);
});
test('direct review carries person and date and focuses visible destination',async()=>{
 const {ctx,el,calls}=setup();ctx.APP.adminControl={ok:true,fecha:'2026-10-02',filas:[row(42,{colaborador:'Gianfranco',revision_pendiente:1})]};
 el('admin-close-search').value='Otro';
 ctx.showAdminSection=async section=>{calls.push(['navigate',section,el('admin-close-date').value,el('admin-close-search').value]);ctx.APP.adminSection=section;ctx.APP.adminClose={ok:true};ctx.APP.adminReview={entregas:[{colaborador_id:42}]};};
 await ctx.openControlClose({disabled:false,dataset:{controlOpenClose:'42',action:'review'}});
 assert.deepEqual(calls[0],['navigate','cierres','2026-10-02','Gianfranco']);assert.equal(calls.find(x=>x[0]==='review')[1],42);
 assert.equal(el('admin-close-status').focused,true);assert.equal(el('admin-close-area').value,'1');
});
test('loading disables export, reports partial data and ignores obsolete responses',async()=>{
 const {ctx,el}=setup(),jobs=[];ctx.db={rpc:(name,args)=>new Promise(resolve=>jobs.push({name,args,resolve}))};
 const first=ctx.loadAdminControl();assert.equal(el('admin-control-export').disabled,true);
 el('admin-control-date').value='2026-10-02';const second=ctx.loadAdminControl();
 jobs[3].resolve({data:{ok:true,fecha:'2026-10-02',filas:[row(42)]}});
 jobs[4].resolve({error:{message:'offline'}});
 jobs[5].resolve({data:{ok:true,personas:[{id:42,cierre:{estado:'incompleta',aplica_jornada:true,requisitos:[{tipo:'salida',completo:false}]}}]}});
 await second;assert.equal(ctx.APP.adminControl.fecha,'2026-10-02');assert.match(el('admin-control-message').textContent,/Vista parcial/);
 jobs.slice(0,3).forEach(job=>job.resolve({error:{message:'old'}}));await first;
 assert.equal(ctx.APP.adminControl.fecha,'2026-10-02');assert.equal(el('admin-control-table')['aria-busy'],'false');
});
test('network errors expose retry and future dates are blocked',async()=>{
 const {ctx,el}=setup();ctx.db={rpc:async()=>{throw new Error('network')}};
 await ctx.loadAdminControl();assert.equal(ctx.APP.adminControl,null);assert.match(el('admin-control-table').innerHTML,/data-control-retry/);
 assert.equal(el('admin-control-export').disabled,true);assert.equal(el('admin-control-next').disabled,true);
 el('admin-control-next').onclick();assert.equal(el('admin-control-date').value,'2026-10-03');
});

test('area chart assigns each person once and segments select their exact records',()=>{
 const {ctx,el}=setup();
 const people=[
 row(1,{revision_pendiente:1}),
 row(2,{revision_observada:1}),
 row(3,{cierre_estado:'completa',evidencias_pendientes:0,salida_at:'2026-10-02T20:00:00Z'}),
 row(4,{labora:false,cierre_estado:'no_aplica',evidencias_pendientes:0,entrada_at:null}),
 row(5,{area_id:2,area:'Ingeniería'})
 ];
 ctx.APP.adminControl={ok:true,filas:people};
 const groups=ctx.adminControlAreaGroups();
 assert.equal(groups.reduce((sum,g)=>sum+g.total,0),5);
 for(const g of groups)assert.equal(g.pending+g.review+g.done+g.clear,g.total);
 assert.equal(groups.find(g=>g.id==='1').review,1);
 ctx.selectAdminControlArea('1','review');
 assert.deepEqual(Array.from(ctx.adminControlRows(),r=>r.colaborador_id),[1]);
 assert.match(el('admin-control-chart-selection').textContent,/Por revisar/);
 ctx.selectAdminControlArea('1','pending');
 assert.deepEqual(Array.from(ctx.adminControlRows(),r=>r.colaborador_id),[2]);
 ctx.selectAdminControlArea('1');
 assert.equal(ctx.adminControlRows().length,4);
 ctx.selectAdminControlArea('');
 assert.equal(ctx.adminControlRows().length,5);
});
test('chart stays date-wide during search and exposes accessible counts',()=>{
 const {ctx,el}=setup();
 ctx.APP.adminControl={ok:true,filas:[row(1),row(2,{area_id:2,area:'Ingeniería'})]};
 el('admin-control-search').value='Persona 1';ctx.renderAdminControl();
 assert.equal(ctx.adminControlRows().length,1);
 assert.equal(ctx.adminControlAreaGroups().length,2);
 assert.match(el('admin-control-areas').innerHTML,/aria-label="Ingeniería: 1 pendientes de 1 personas"/);
 assert.match(el('admin-control-areas').innerHTML,/data-control-chart-state="pending"/);
});
test('unassigned area is distinct from all areas and partial data hides charts',()=>{
 const {ctx,el}=setup();
 ctx.APP.adminControl={ok:true,filas:[row(1,{area_id:null,area:null}),row(2)]};
 ctx.fillAdminControlAreas();
 assert.match(el('admin-control-area').innerHTML,/value="__none"/);
 ctx.selectAdminControlArea('__none');
 assert.deepEqual(Array.from(ctx.adminControlRows(),r=>r.colaborador_id),[1]);
 ctx.APP.adminControl.partial=true;ctx.renderAdminControlAreas();
 assert.match(el('admin-control-areas').innerHTML,/faltan datos por comprobar/);
 assert.doesNotMatch(el('admin-control-areas').innerHTML,/data-control-chart-state/);
});
test('area reveal runs for changed data, not for search or selection',()=>{
 const {ctx,el}=setup();
 ctx.APP.adminControl={ok:true,fecha:'2026-10-03',filas:[row(1),row(2)]};
 ctx.renderAdminControlAreas();
 assert.match(el('admin-control-areas').innerHTML,/is-arriving/);
 ctx.selectAdminControlArea('1','pending');
 assert.doesNotMatch(el('admin-control-areas').innerHTML,/is-arriving/);
 ctx.APP.adminControl.filas.push(row(3));ctx.renderAdminControlAreas();
 assert.match(el('admin-control-areas').innerHTML,/is-arriving/);
});
