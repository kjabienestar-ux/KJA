import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {JSDOM} from 'jsdom';
import {peopleFixtureData,peopleBootstrap,peopleSources} from './helpers/people-workbench-fixture.mjs';
function setup(){
 const html=fs.readFileSync('dashboard.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost'}),w=dom.window,context=dom.getInternalVMContext();
 w.matchMedia=()=>({matches:true});w.CSS={escape:String};w.FIXTURE_TEAM=peopleFixtureData();
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 vm.runInContext(peopleBootstrap,context);for(const source of peopleSources)vm.runInContext(source,context);
 w.renderAdminPeople();return {dom,w,context,state:()=>vm.runInContext('PEOPLE_WORKBENCH',context)};
}

test('future principal is visibly programmed tomorrow while today retains the original Thursday off',async()=>{
 const {dom,w}=setup();try{
  const person=w.APP.adminTeam.personas[0];
  const next=Object.fromEntries(Array.from({length:7},(_,i)=>[String(i+1),i<5?{mod:'virtual',ini:'08:00',fin:'14:00'}:{mod:'no_gestiona'}]));
  person.jornadas=[{id:10,tipo:'principal',desde:'2026-11-05',hasta:'2026-12-31',semana:next,motivo:'Cambio de condiciones'}];
  await w.openPeopleProfile(person.id);w.peopleProfileBody(person,'jornada');
  const holder=w.document.createElement('div');holder.innerHTML=w.peopleProfileBody(person,'jornada');
  assert.equal(w.peopleCurrentPeriod(person),null);
  assert.match(holder.querySelector('[data-pw-current-note]').textContent,/empieza mañana/);
  assert.match(holder.querySelector('.pw-week tbody tr:nth-child(4)').textContent,/JueNo gestiona/);
  const upcoming=holder.querySelector('.pw-upcoming');assert.ok(upcoming);
  assert.match(upcoming.textContent,/Programada/);assert.match(upcoming.textContent,/Empieza mañana/);
  assert.match(upcoming.textContent,/05 nov/);assert.match(upcoming.textContent,/31 dic/);
  assert.match(upcoming.querySelector('tbody tr:nth-child(4)').textContent,/JueVirtual08:0014:00/);
  w.APP.adminTeam.hoy='2026-11-05';person.horario_vigente=next;
  holder.innerHTML=w.peopleProfileBody(person,'jornada');
  assert.equal(holder.querySelector('.pw-upcoming'),null);
  assert.match(holder.querySelector('.pw-week tbody tr:nth-child(4)').textContent,/JueVirtual08:0014:00/);
 }finally{dom.window.close();}
});
test('desktop director separates scope, keeps filters and collapsible areas, escapes identity, and supports read-only',()=>{
 const {dom,w}=setup();try{
  assert.equal(w.$('admin-attendance-export-card').hidden,true);assert.equal(w.$('admin-people-kpis').hidden,false);
  assert.equal(w.document.querySelectorAll('.pw-card').length,5);
  w.$('admin-people-search').value='Lucía';w.renderAdminPeople();assert.equal(w.document.querySelectorAll('.pw-card').length,1);
  assert.equal(w.document.querySelectorAll('.pw-tabs').length,1);assert.equal(w.document.querySelectorAll('#pw-result-count').length,1);
  assert.match(w.$('admin-people-kpis').textContent,/Directorio6/);assert.match(w.$('pw-result-count').textContent,/1 resultados/);
  w.$('admin-people-search').value='';w.APP.adminTeam.personas[0].nombre='<img src=x onerror=alert(1)>';w.renderAdminPeople();assert.equal(w.$('admin-people-list').querySelector('img'),null);
  w.$('admin-people-list').querySelector('[data-pw-collapse]').click();assert.equal(w.$('pw-area-1').hidden,true);
  w.peopleSwitchTab('informes');assert.equal(w.$('admin-attendance-export-card').hidden,false);assert.equal(w.$('admin-people-list').hidden,true);
  w.APP.adminTeam.puede_editar=false;w.peopleSwitchTab('areas');assert.equal(w.$('admin-areas-panel').hidden,true);assert.equal(w.$('pw-areas-readonly').hidden,false);
 }finally{dom.window.close();}
});
test('temporal requires review, sends once, retains form on failure, and indefinite principal is explicit',async()=>{
 const {dom,w,state}=setup();try{
  await w.openPeopleProfile(1,w.$('admin-people-list').querySelector('[data-team-profile]'));
  w.openPeopleShift(w.APP.adminTeam.personas[0],'temporal');
  w.$('pw-shift-from').value='2026-11-09';w.$('pw-shift-until').value='2026-11-21';w.$('pw-shift-reason').value='Acuerdo con Dirección';
  await w.submitPeopleShift({preventDefault(){}});assert.equal(state().shift.review,true);assert.equal(w.fixtureCalls.some(c=>c.name==='dash_admin_guardar_jornada'),false);
  assert.match(w.$('pw-shift-review').textContent,/22 nov/);w.fixtureSaveError=true;
  await w.submitPeopleShift({preventDefault(){}});assert.equal(w.$('pw-shift-dialog').open,true);assert.match(w.$('pw-shift-message').textContent,/Conservamos/);
  assert.equal(w.$('pw-shift-save').disabled,false);assert.equal(state().shift.payload.p_motivo,'Acuerdo con Dirección');
  w.openPeopleShift(w.APP.adminTeam.personas[0],'principal');w.$('pw-shift-indefinite').checked=true;w.$('pw-shift-indefinite').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.$('pw-shift-until').disabled,true);w.$('pw-shift-reason').value='Cambio principal';await w.submitPeopleShift({preventDefault(){}});assert.equal(state().shift.payload.p_hasta,null);
  w.fixtureSaveError=false;const promise=w.submitPeopleShift({preventDefault(){}});await w.submitPeopleShift({preventDefault(){}});await promise;
  assert.equal(w.fixtureCalls.filter(c=>c.name==='dash_admin_guardar_jornada').length,2);
 }finally{dom.window.close();}
});
test('existing identity editor preserves schedule and history; missing capability cannot open a scheduler',async()=>{
 const {dom,w,state}=setup();try{
  await w.openAdminPerson(1);assert.equal(w.$('admin-contract-start').disabled,true);assert.equal(w.$('admin-person-link').disabled,true);
  assert.equal(w.$('admin-person-name').disabled,false);assert.ok([...w.$('admin-schedule-grid').querySelectorAll('select,input')].every(x=>x.disabled));
  w.$('admin-person-name').value='Nombre actualizado';await w.saveAdminPerson({preventDefault(){}});
  assert.equal(w.fixtureCalls.filter(c=>c.name==='dash_admin_guardar_horario_compartir').length,0,'editing identity must not rewrite Facebook agenda');
  w.APP.adminTeam.jornadas_disponibles=false;w.openPeopleShift(w.APP.adminTeam.personas[0],'principal');assert.equal(state().shift,null);
  await w.openPeopleProfile(1);w.APP.adminTeam.puede_editar=false;state().profileTab='jornada';w.renderPeopleProfile();assert.equal(w.$('pw-profile-dialog').querySelector('[data-pw-shift]'),null);
 }finally{dom.window.close();}
});
test('closing the session clears private dialog state and invalidates late profile responses',async()=>{
 const {dom,w,state}=setup();try{
  const pending=[];w.db.rpc=()=>new Promise(resolve=>pending.push(resolve));
  const loading=w.openPeopleProfile(1);w.resetPeopleWorkbench();
  pending.forEach(resolve=>resolve({data:{ok:true,historial:[],horario:{}}}));await loading;
  assert.equal(w.$('pw-profile-dialog').open,false);assert.equal(state().profile,null);assert.deepEqual(Object.keys(state().extra),[]);
 }finally{dom.window.close();}
});
test('colleague calendar resolves principal, temporary, expiry and the previous weeks without rewriting records',()=>{
 const source=fs.readFileSync('assets/js/dashboard.js','utf8');const context=vm.createContext({});
 vm.runInContext(source.slice(source.indexOf('function teammateSchedule('),source.indexOf('function attendanceTeammateAvatar(')),context);
 const person={primera_asistencia:'2026-09-01',horario_semanal:{'1':{mod:'virtual',ini:'08:00',fin:'13:00'}},dias_laborables:[1],jornadas:[
  {tipo:'principal',desde:'2026-11-01',hasta:'2026-11-30',semana:{'1':{mod:'no_gestiona'},'4':{mod:'presencial',ini:'09:00',fin:'14:00'}}},
  {tipo:'temporal',desde:'2026-11-09',hasta:'2026-11-15',semana:{'1':{mod:'virtual',ini:'10:00',fin:'12:00'},'4':{mod:'no_gestiona'}}}
 ]};
 assert.equal(context.teammateSchedule(person,1,'2026-10-26').start,'08:00');
 assert.equal(context.teammateSchedule(person,1,'2026-11-02'),null);
 assert.equal(context.teammateSchedule(person,4,'2026-11-05').start,'09:00');
 assert.equal(context.teammateSchedule(person,1,'2026-11-09').start,'10:00');
 assert.equal(context.teammateSchedule(person,4,'2026-11-12'),null);
 assert.equal(context.teammateSchedule(person,4,'2026-11-19').start,'09:00');
 assert.equal(context.teammateSchedule(person,1,'2026-12-07'),null);
});
test('late legacy-editor responses cannot replace a newer person or their Facebook schedule',async()=>{
 const {dom,w,context}=setup();try{
  const pending=[];w.db.rpc=(name,args)=>new Promise(resolve=>pending.push({name,id:args.p_colab,resolve}));
  const first=w.openAdminPerson(1);w.closeAdminPerson();const second=w.openAdminPerson(2);
  for(const call of pending.filter(x=>x.id===2))call.resolve({data:{ok:true,configurado:true,horario:{'1':{ini:'10:00',fin:'14:00'}},historial:[]}});
  await second;
  for(const call of pending.filter(x=>x.id===1))call.resolve({data:{ok:true,configurado:true,horario:{'1':{ini:'06:00',fin:'11:00'}},historial:[]}});
  await first;assert.equal(w.$('admin-person-id').value,'2');assert.equal(vm.runInContext("ADMIN_FACEBOOK_SCHEDULE.horario['1'].ini",context),'10:00');
 }finally{dom.window.close();}
});

test('profile history is loaded only on its tab and pages retain every row',async()=>{
 const {dom,w}=setup();try{
  const calls=[];w.db.rpc=async(name,args)=>{calls.push({name,args});if(name==='dash_admin_horario_compartir')return {data:{ok:true,configurado:true,horario:{}}};if(name==='dash_admin_historial_colaborador_pagina'){const next=!!args.p_antes;return {data:{ok:true,historial:Array.from({length:next?2:12},(_,i)=>({id:(next?12:0)+i,fecha:'2026-11-01',tipo:'otro',nota:'Prueba'})),siguiente:next?null:{fecha:'2026-11-01',id:'1'}}};}throw Error('unexpected RPC '+name);};
  await w.openPeopleProfile(1);assert.equal(calls.length,1);
  w.$('pw-tab-historial').click();await new Promise(r=>setTimeout(r,0));
  assert.equal(w.$('pw-history-page').querySelectorAll('tbody tr').length,12);assert.equal(calls[1].name,'dash_admin_historial_colaborador_pagina');assert.equal(calls[1].args.p_limite,12);
  w.$('pw-history-page').querySelector('[data-history-page="next"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(w.$('pw-history-page').querySelectorAll('tbody tr').length,2);
  w.$('pw-history-page').querySelector('[data-history-page="previous"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(w.$('pw-history-page').querySelectorAll('tbody tr').length,12);
  assert.equal(calls.some(x=>x.name==='dash_admin_historial_colaborador'),false);
 }finally{dom.window.close();}
});

test('PDF explicitly fetches the complete history instead of exporting the current page',async()=>{
 const {dom,w}=setup();try{
  await w.openPeopleProfile(1);let captured,loaded=false;w.KJAFacebookPDF={load:async()=>{loaded=true}};
  w.loadProfileAttendance=async()=>({ok:true});w.adminProfileSections=(person,extra)=>{captured=extra;return [];};
  w.buildAdminProfilePdf=()=>{assert.equal(loaded,true);return {save:()=>{}}};const original=w.db.rpc;
  w.db.rpc=async(name,args)=>name==='dash_admin_historial_colaborador'?{data:{ok:true,historial:Array.from({length:29},(_,id)=>({id}))}}:original(name,args);
  await w.handlePeopleProfileClick({target:w.$('pw-profile-dialog').querySelector('[data-pw-profile-pdf]')});
  assert.equal(captured.history.historial.length,29);
 }finally{dom.window.close();}
});

test('PDF loader failure reports the problem before querying full history and restores the button',async()=>{
 const {dom,w}=setup();try{await w.openPeopleProfile(1);let queried=false;
 w.KJAFacebookPDF={load:async()=>{throw Error('No se pudo cargar el generador PDF.')}};w.db.rpc=async()=>{queried=true;throw Error('must not read')};
 const button=w.$('pw-profile-dialog').querySelector('[data-pw-profile-pdf]');await w.handlePeopleProfileClick({target:button});
 assert.equal(queried,false);assert.equal(button.disabled,false);assert.match(w.fixtureToasts.at(-1)[0],/generador PDF/);
 }finally{dom.window.close();}
});

test('new collaborator validates each step, retains values, reviews safely and blocks premature submit',async()=>{
 const {dom,w}=setup();try{
  await w.openAdminPerson();
  const next=()=>w.$('admin-create-next').click();
  assert.equal(w.$('admin-person-save').hidden,true);
  next();assert.match(w.$('admin-editor-message').textContent,/nombre completo/);assert.equal(w.document.activeElement.id,'admin-person-name');
  w.$('admin-person-name').value='<Ana Test>';w.$('admin-person-dni').value='123';next();assert.match(w.$('admin-editor-message').textContent,/8 dígitos/);
  w.$('admin-person-dni').value='12345678';next();assert.match(w.$('admin-create-progress').textContent,/Paso 2/);
  w.$('admin-contract-hours').value='-1';next();assert.equal(w.$('admin-contract-hours').getAttribute('aria-invalid'),'true');
  w.$('admin-contract-hours').value='100';w.$('admin-contract-start').value='2026-11-19';w.$('admin-contract-end').value='2026-11-18';next();assert.match(w.$('admin-editor-message').textContent,/anterior/);
  w.$('admin-contract-end').value='2026-12-31';next();assert.match(w.$('admin-create-progress').textContent,/Paso 3/);
  const end=w.document.querySelector('[data-schedule-day="1"] .schedule-end');end.value='07:00';next();assert.match(w.$('admin-editor-message').textContent,/posterior/);
  end.value='13:00';next();assert.match(w.$('admin-create-progress').textContent,/Paso 4/);
  const fb=w.document.querySelector('[data-facebook-day="1"] .facebook-day-end');fb.value='08:00';next();assert.match(w.$('admin-editor-message').textContent,/distintos/);
  fb.value='13:00';next();assert.match(w.$('admin-create-progress').textContent,/Paso 5/);assert.equal(w.$('admin-person-save').hidden,false);
  assert.match(w.$('admin-create-summary').textContent,/<Ana Test>/);assert.equal(w.$('admin-create-summary').querySelector('ana'),null);
  w.$('admin-create-summary').querySelector('[data-create-edit="0"]').click();assert.equal(w.$('admin-person-name').value,'<Ana Test>');
  await w.saveAdminPerson({preventDefault(){}});assert.equal(w.fixtureCalls.some(c=>c.name==='dash_admin_guardar_colaborador'),false);
  w.closeAdminPerson();await w.openAdminPerson();assert.match(w.$('admin-create-progress').textContent,/Paso 1/);assert.equal(w.$('admin-person-name').value,'');
  w.closeAdminPerson();await w.openAdminPerson(1);assert.equal(w.$('admin-create-next').hidden,true);assert.equal(w.$('admin-person-save').hidden,false);
 }finally{dom.window.close();}
});

test('creation retry after Facebook failure updates the created identity instead of inserting twice',async()=>{
 const {dom,w}=setup();try{
  await w.openAdminPerson();w.$('admin-person-name').value='Ana Test';
  for(let i=0;i<4;i++)w.$('admin-create-next').click();
  const payloads=[];let fail=true;
  w.db.rpc=async(name,args)=>{if(name==='dash_admin_guardar_colaborador'){payloads.push(args.p_datos);return {data:{ok:true,id:77,nuevo:args.p_datos.id===null}};}if(name==='dash_admin_guardar_horario_compartir')return fail?{error:{message:'test'}}:{data:{ok:true}};return {data:w.APP.adminTeam};};
  await w.saveAdminPerson({preventDefault(){}});assert.equal(w.$('admin-person-id').value,'77');assert.equal(w.$('admin-person-modal').hidden,false);assert.match(w.$('admin-editor-message').textContent,/ficha se guardó/);
  fail=false;await w.saveAdminPerson({preventDefault(){}});assert.equal(payloads[0].id,null);assert.equal(payloads[1].id,77);assert.equal(w.$('admin-create-success').hidden,false);assert.equal(w.$('admin-person-form').hidden,true);w.$('admin-create-success').querySelector('button').click();assert.equal(w.$('admin-person-modal').hidden,true);
 }finally{dom.window.close();}
});
test('Un directorio formado solo por bajas permite recuperar los registros en ambas vistas',()=>{
  const {dom,w}=setup();
  try{
    for(const p of w.APP.adminTeam.personas)p.activo=false;
    for(const [prefix,render] of [['admin-people',w.renderAdminPeople],['admin-contract',w.renderAdminContracts]]){
      render();
      const list=w.$(prefix+'-list');
      assert.equal(list.querySelector('h3')?.textContent,'Solo hay colaboradores de baja.');
      list.querySelector('button').click();
      assert.equal(w.$(prefix+'-inactive').checked,true);
      assert.equal(w.document.activeElement,w.$(prefix+'-search'));
      assert.equal(list.querySelector('.pw-empty'),null);
    }
  }finally{dom.window.close();}
});
