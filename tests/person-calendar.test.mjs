import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(){
  const nodes=new Map();
  const node=()=>({innerHTML:'',hidden:false,value:'',disabled:false,isConnected:true,classList:{add(){}},setAttribute(){},removeAttribute(){},querySelector:s=>get(s),querySelectorAll:()=>[]});
  const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)};
  const host=node(),queue=[],storageQueue=[];
  const context=vm.createContext({console,Intl,Date,db:{storage:{}},isoLima:()=> '2026-10-01'});
  for(const f of ['attendance-calendar-model.js','dashboard-person-calendar.js'])vm.runInContext(fs.readFileSync('assets/js/'+f,'utf8'),context);
  const dashboard=fs.readFileSync('assets/js/dashboard.js','utf8');
  vm.runInContext(dashboard.slice(dashboard.indexOf('function teamDayActivities('),dashboard.indexOf('\nasync function openTeamDay(')),context);
  const options={host,person:{id:1,nombre:'Persona <ejemplo>',dni:'12345678',area:'Área',contrato_inicio:'2026-01-01'},month:'2026-09',today:'2026-10-01',
    rpc:(name,args)=>new Promise(resolve=>queue.push({name,args,resolve})),
    storage:{from:bucket=>({createSignedUrl:(path,seconds)=>new Promise(resolve=>storageQueue.push({bucket,path,seconds,resolve}))})}};
  return {context,host,get,queue,storageQueue,options};
}
const days=[
  {fecha:'2026-09-24',d:24,lab:true,estado:'P',cierre_estado:'incompleta',aplica_comparticiones:true,comparticiones_vencidas:true,comparticiones_completas:false},
  {fecha:'2026-09-25',d:25,lab:true,estado:'J',cierre_estado:'incompleta',aplica_comparticiones:true,comparticiones_completas:true}
];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function click(host,key,value){
  const button={disabled:false,dataset:{[key]:value},hasAttribute:name=>name==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())};
  host.onclick({target:{closest:()=>button}});
}

test('shared calendar matches personal red dates, J and future states and supports year boundaries',()=>{
  const {context}=setup(),model=context.KJAPersonCalendar;
  const values=model.daysView([...days,{...days[0],fecha:'2026-11-01'}],'2026-10-01');
  assert.equal(values[0].view.tone,'missing');assert.equal(values[0].alert,true);
  assert.equal(values[1].view.tone,'j');assert.equal(values[1].alert,false);
  assert.equal(values[2].view.tone,'future');assert.equal(values[2].alert,false);
  assert.equal(model.shift('2026-01',-1),'2025-12');assert.equal(model.shift('2026-12',1),'2027-01');
});
test('loads selected collaborator, opens the last red day, and lists missing work separately from private files',async()=>{
  const x=setup(),pending=x.context.KJAPersonCalendar.mount(x.options);
  assert.equal(x.queue[0].name,'dash_historial');
  assert.deepEqual({...x.queue[0].args},{p_anio:2026,p_mes:9,p_colab:1});
  x.queue.shift().resolve({data:{ok:true,dias:days,horas:6}});await tick();
  assert.equal(x.queue[0].args.p_fecha,'2026-09-24');
  assert.match(x.get('[data-pc-content]').innerHTML,/pc-day missing/);
  assert.match(x.host.innerHTML,/Persona &lt;ejemplo&gt;/);
  x.queue.shift().resolve({data:{ok:true,estado:'P',cierre:{aplica_jornada:true,requisitos:[{tipo:'rpe',titulo:'RPE',completo:false},{tipo:'comparticiones',titulo:'Facebook',completo:true,revision_estado:'pendiente'}]},entregas:[{tipo:'comparticiones',titulo:'Facebook',archivos:[{bucket:'asis-cierre-evidencias',path:'private/a',mime:'image/jpeg'}]}]}});
  await pending;
  const detail=x.get('[data-pc-detail]').innerHTML;
  assert.match(detail,/Registro de entrada/);assert.match(detail,/Registro de salida/);assert.match(detail,/Sin entrega/);assert.match(detail,/Pendiente de revisión/);
  assert.equal(detail.includes('private/a'),false);
  assert.equal(x.storageQueue.length,0);
  click(x.host,'pcFile','1:0');assert.equal(x.storageQueue[0].path,'private/a');assert.equal(x.storageQueue[0].seconds,900);
  x.storageQueue.shift().resolve({data:{signedUrl:'https://example.test/private'}});await tick();
  assert.match(x.get('[data-pc-preview]').innerHTML,/<img/);
});
test('person and month changes reject old calendar requests',async()=>{
  const x=setup(),first=x.context.KJAPersonCalendar.mount(x.options);
  const second=x.context.KJAPersonCalendar.mount({...x.options,person:{id:2,nombre:'Segunda'}});
  x.queue[1].resolve({data:{ok:true,dias:[],horas:0}});await second;
  const current=x.get('[data-pc-content]').innerHTML;
  x.queue[0].resolve({data:{ok:true,dias:days,horas:6}});await first;
  assert.equal(x.get('[data-pc-content]').innerHTML,current);assert.equal(x.queue.length,2);
  click(x.host,'pcShift','-1');assert.equal(x.queue[2].args.p_mes,8);assert.equal(x.queue[2].args.p_colab,2);
  click(x.host,'pcShift','-1');assert.equal(x.queue[3].args.p_mes,7);
  x.queue[3].resolve({data:{ok:true,dias:[]}});await tick();
  const july=x.get('[data-pc-content]').innerHTML;
  x.queue[2].resolve({data:{ok:true,dias:days}});await tick();
  assert.equal(x.get('[data-pc-content]').innerHTML,july);
});
test('J waives missing entry and exit and detail errors never claim missing evidence',async()=>{
  const x=setup(),pending=x.context.KJAPersonCalendar.mount(x.options);
  x.queue.shift().resolve({data:{ok:true,dias:[days[1]]}});await tick();
  x.queue.shift().resolve({data:{ok:true,estado:'J',cierre:{aplica_jornada:true,requisitos:[{tipo:'rpe',completo:false},{tipo:'comparticiones',titulo:'Facebook',completo:true}]}}});
  await pending;
  assert.match(x.get('[data-pc-detail]').innerHTML,/No requerida · justificado/);
  assert.doesNotMatch(x.get('[data-pc-detail]').innerHTML,/Registro de salida|Sin entrega/);
  click(x.host,'pcDay','2026-09-25');
  x.queue.shift().resolve({error:{message:'offline'}});await tick();
  assert.match(x.get('[data-pc-detail]').innerHTML,/No es posible confirmar/);
  assert.match(x.get('[data-pc-detail]').innerHTML,/Reintentar detalle/);
});
test('both team and monthly administration mount the same component',()=>{
  const main=fs.readFileSync('assets/js/dashboard.js','utf8');
  const admin=fs.readFileSync('assets/js/dashboard-admin-mes.js','utf8');
  const html=fs.readFileSync('dashboard.html','utf8');
  assert.match(main,/KJAPersonCalendar.mount\(\{host,person\}\)/);
  assert.match(admin,/data-person-calendar=/);
  assert.match(admin,/KJAPersonCalendar.mount\(\{host,person,month:currentMonthValue\(\),onBack:/);
  assert.match(html,/id="admin-person-calendar"/);
  assert.match(admin,/querySelector\('h3'\)\?\.focus/);
  assert.match(fs.readFileSync('assets/js/dashboard-person-calendar.js','utf8'),/Una entrega no implica que esté aprobada/);
});

test('each collaborator uses server working days, including Saturdays, holidays and contract boundaries',()=>{
  const {context}=setup(),model=context.KJAPersonCalendar;
  const person={contrato_inicio:'2026-09-07',contrato_fin_referencia:'2026-09-25'};
  const rows=[
    {...days[0],fecha:'2026-09-06',lab:false},
    {...days[0],fecha:'2026-09-08',lab:false},
    {...days[0],fecha:'2026-09-12',lab:true},
    {...days[1],fecha:'2026-09-19',lab:false},
    {...days[0],fecha:'2026-09-04',lab:true},
    {...days[0],fecha:'2026-09-26',lab:true},
    days[1],
    {...days[0],fecha:'2026-10-04',lab:false}
  ];
  const values=model.daysView(rows,'2026-10-01',person);
  assert.deepEqual(Array.from(values,v=>v.view.tone),['off','off','missing','off','off','off','j','off']);
  assert.deepEqual(Array.from(values,v=>v.alert),[false,false,true,false,false,false,false,false]);
  assert.match(values[4].view.reason,/anterior/);
  assert.match(values[5].view.reason,/posterior/);
  assert.equal(model.daysView([rows[2]],'2026-10-01',{...person,contrato_fin_referencia:null})[0].view.tone,'missing');
});
test('rest day keeps delivered files but suppresses missing work and Facebook from the incident list',async()=>{
  const x=setup(),pending=x.context.KJAPersonCalendar.mount(x.options);
  x.queue.shift().resolve({data:{ok:true,dias:[{...days[0],lab:false}],calendario_contrato:{contrato_inicio:'2026-01-01',contrato_fin_referencia:null}}});await tick();
  x.queue.shift().resolve({data:{ok:true,cierre:{aplica_jornada:true,requisitos:[{tipo:'rpe',titulo:'RPE',completo:false},{tipo:'comparticiones',titulo:'Facebook',completo:false}]},entregas:[{tipo:'salida',titulo:'Salida',archivos:[{path:'old',bucket:'asis-cierre-evidencias',mime:'image/jpeg'}]}]}});
  await pending;
  assert.match(x.get('[data-pc-content]').innerHTML,/pc-day off/);
  assert.match(x.get('[data-pc-content]').innerHTML,/Fechas para revisar \(0\)/);
  assert.match(x.get('[data-pc-detail]').innerHTML,/Sin jornada exigible/);
  assert.match(x.get('[data-pc-detail]').innerHTML,/Ver archivos \(1\)/);
  assert.doesNotMatch(x.get('[data-pc-detail]').innerHTML,/Registro de entrada|Registro de salida|Sin entrega/);
});
test('contract dates returned by the server apply even when the monthly directory lacks them',async()=>{
  const x=setup(),pending=x.context.KJAPersonCalendar.mount({...x.options,person:{id:1,nombre:'Persona'}});
  x.queue.shift().resolve({data:{ok:true,dias:[days[0]],calendario_contrato:{contrato_inicio:'2026-09-25',contrato_fin_referencia:null}}});await tick();
  x.queue.shift().resolve({data:{ok:true,cierre:{requisitos:[]}}});await pending;
  assert.match(x.get('[data-pc-content]').innerHTML,/pc-day off/);
  assert.match(x.get('[data-pc-detail]').innerHTML,/anterior al inicio/);
});

test('collaborator who worked and fulfilled duties on an unscheduled day shows as present and counts in totals',async()=>{
  const x=setup(),pending=x.context.KJAPersonCalendar.mount({...x.options,month:'2026-10',today:'2026-10-07'});
  const workedDay={
    fecha:'2026-10-03',d:3,lab:false,estado:'P',cierre_estado:'completa',
    marcado_at:'2026-10-03T13:09:00Z',salida_at:'2026-10-03T18:59:00Z',
    aplica_comparticiones:true,comparticiones_completas:true,comparticiones_vencidas:false
  };
  x.queue.shift().resolve({data:{ok:true,dias:[workedDay],horas:5.8,calendario_contrato:{contrato_inicio:'2026-01-01',contrato_fin_referencia:null}}});
  await tick();
  x.queue.shift().resolve({
    data:{
      ok:true,estado:'P',entrada_at:'2026-10-03T13:09:00Z',salida_at:'2026-10-03T18:59:00Z',horas:5.8,
      cierre:{modalidad:'virtual',aplica_jornada:true,requisitos:[{tipo:'comparticiones',titulo:'Facebook',completo:true}]},
      entregas:[{tipo:'comparticiones',titulo:'Facebook',archivos:[{bucket:'asis-cierre-evidencias',path:'fb/1',mime:'image/jpeg'}]}],
      entrada_archivos:[{bucket:'asis-cierre-evidencias',path:'entry/1',mime:'image/jpeg'}]
    }
  });
  await pending;
  const content=x.get('[data-pc-content]').innerHTML;
  assert.match(content,/pc-day p/);
  assert.match(content,/1 presentes · 0 tardanzas · 0 justificados/);
  assert.match(content,/<b>1<\/b> días laborables con Facebook entregado/);
  const detail=x.get('[data-pc-detail]').innerHTML;
  assert.match(detail,/pc-state p/);
  assert.match(detail,/Presente/);
  assert.match(detail,/Sin evidencias pendientes/);
  assert.doesNotMatch(detail,/Sin jornada exigible/);
  assert.match(detail,/08:09/);
  assert.match(detail,/13:59/);
});

test('back button returns to the ledger and closing invalidates a pending calendar request',async()=>{
  const x=setup();let returned=false;
  const pending=x.context.KJAPersonCalendar.mount({...x.options,onBack:()=>{returned=true;x.host._personCalendar=null;x.host.hidden=true;x.host.innerHTML='';}});
  assert.match(x.host.innerHTML,/Volver a Mes completo/);
  click(x.host,'pcBack','');assert.equal(returned,true);
  x.queue.shift().resolve({data:{ok:true,dias:days}});await pending;
  assert.equal(x.host.hidden,true);assert.equal(x.host.innerHTML,'');assert.equal(x.queue.length,0);
});
test('closing admin detail restores focus and scroll without changing filters',()=>{
 const source=fs.readFileSync('assets/js/dashboard-admin-mes.js','utf8');
 const host={_personCalendar:{},hidden:false,innerHTML:'calendar',onclick:()=>{},onchange:()=>{}};
 const ledger={setAttribute(){},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
 const env={$:id=>id==='admin-person-calendar'?host:ledger};
 vm.runInNewContext(source.slice(source.indexOf('function closeAdminPersonCalendar('),source.indexOf('function renderAdminMonthLedger(')),env);
 env.closeAdminPersonCalendar(true);
 assert.equal(host.hidden,true);assert.equal(host._personCalendar,null);assert.equal(host.onclick,null);
 assert.equal(ledger.focused,true);assert.equal(ledger.scrolled,true);
 assert.match(source,/function renderAdminMonthLedger\(\)\{\s*closeAdminPersonCalendar\(\)/);
});
