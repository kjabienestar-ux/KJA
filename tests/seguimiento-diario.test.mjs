import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {fixtureData,bootstrapSource,helperSource,moduleSource,date} from './helpers/seguimiento-fixture.mjs';

function setup({role='direccion',data=fixtureData(),rpc=null,photos=null}={}){
  const dom=new JSDOM('<div id="admin-seguimiento-section"></div><input id="admin-close-date" value="2026-10-01"><input id="admin-close-search" value="Otra consulta"><div id="admin-evidence-modal" hidden></div>',{runScripts:'outside-only',url:'https://fixture.test'});
  const w=dom.window,ctx=dom.getInternalVMContext(),calls=[],signed=[],blobs=[];
  w.setInterval=()=>0;w.Blob=Blob;w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:fixture'};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  vm.runInContext(bootstrapSource,ctx);w.APP.access.rol=role;
  if(photos)w.hydrateProfilePhotos=photos;
  w.db={rpc:async(name,args)=>{
    calls.push({name,args});
    if(rpc)return rpc(name,args);
    if(name==='dash_admin_revisar_entrega'){
      const delivery=data.dash_admin_revision_entregas.entregas.find(d=>d.id===args.p_entrega);
      delivery.revision_estado=args.p_estado;
      data.dash_admin_control_diario.filas.find(r=>r.colaborador_id===delivery.colaborador_id).revision_pendiente--;
      return {data:{ok:true}};
    }
    return {data:structuredClone(data[name])};
  },storage:{from:()=>({createSignedUrl:async(path,seconds)=>{signed.push({path,seconds});return {data:{signedUrl:'https://fixture.test/'+path}}}})}};
  vm.runInContext(helperSource,ctx);vm.runInContext(moduleSource,ctx);
  const click=async selector=>{assert.ok(w.document.querySelector(selector),selector);w.document.querySelector(selector).click();await tick()};
  const input=async(value)=>{const el=w.document.getElementById('seg-search');el.value=value;el.dispatchEvent(new w.Event('input'));await tick()};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
  return {w,dom,ctx,calls,signed,blobs,data,click,input,tick,load:()=>w.KJASeguimiento.load(),root:w.document.getElementById('admin-seguimiento-section')};
}
test('sidebar adds a third destination and preserves original tabs, hashes and unique IDs',()=>{
  const html=fs.readFileSync('dashboard.html','utf8'),dom=new JSDOM(html),doc=dom.window.document;
  for(const key of ['control','cierres','seguimiento']){
    assert.ok(doc.querySelector('[data-lateral-section="'+key+'"]'));
    assert.ok(doc.querySelector('[data-admin-section="'+key+'"]'));
  }
  const ids=[...doc.querySelectorAll('[id]')].map(el=>el.id);
  assert.equal(new Set(ids).size,ids.length);
  const source=fs.readFileSync('assets/js/dashboard.js','utf8');
  assert.match(source,/admin-seguimiento-section.*hidden=APP.adminSection!=='seguimiento'/);
  assert.ok(source.includes("'overview','seguimiento','control'"));
});
test('one request per resource, local filters and independent old screen state',async()=>{
  const h=setup();await Promise.all([h.load(),h.load()]);
  assert.equal(h.calls.length,4);
  await h.input('maria');
  assert.match(h.root.textContent,/María Díaz/);assert.doesNotMatch(h.root.querySelector('.seg-person-list').textContent,/Carla/);
  assert.equal(h.calls.length,4);
  assert.equal(h.w.document.getElementById('admin-close-date').value,'2026-10-01');
  assert.equal(h.w.document.getElementById('admin-close-search').value,'Otra consulta');
  assert.equal(h.w.APP.adminClose,undefined);
});
test('CSV uses the complete authorized date even with no visible results; formula escaping retained',async()=>{
  const data=fixtureData();data.dash_admin_control_diario.filas[0].colaborador='=FORMULA';
  const h=setup({data});await h.load();await h.click('[data-seg="export"]');
  const first=await h.blobs[0].text();
  await h.input('sin coincidencias');assert.equal(h.root.querySelectorAll('.seg-person').length,0);
  assert.equal(h.w.document.getElementById('seg-export').disabled,false);
  await h.click('[data-seg="export"]');
  assert.equal(await h.blobs[1].text(),first);assert.match(first,/'=FORMULA/);
  assert.equal(first.split('\r\n').length,5);assert.doesNotMatch(first,/signedUrl|https:/);
});

test('area, search and queue combine locally while the panorama and daily CSV keep their scope',async()=>{
  const h=setup();await h.load();await h.click('[data-seg="export"]');const daily=await h.blobs[0].text();
  const panorama=h.w.document.getElementById('seg-areas').textContent;
  const area=h.w.document.getElementById('seg-area');area.value='1';area.dispatchEvent(new h.w.Event('change'));await h.tick();
  await h.click('[data-seg="queue"][data-queue="all"]');await h.input('MARIA');
  assert.equal(h.root.querySelectorAll('.seg-person').length,1);
  assert.match(h.root.querySelector('.seg-person-name').textContent,/María Díaz/);
  assert.equal(h.w.document.getElementById('seg-areas').textContent,panorama);
  await h.click('[data-seg="export"]');assert.equal(await h.blobs[1].text(),daily);
  assert.equal(h.calls.length,4);
  await h.click('[data-seg="clear"]');assert.equal(h.root.querySelectorAll('.seg-person').length,4);
});
test('editor/visor only requests Cierres and cannot request private files or export',async()=>{
  for(const role of ['editor','visor']){
    const h=setup({role});await h.load();
    assert.deepEqual(h.calls.map(c=>c.name),['dash_admin_cierres']);
    assert.equal(h.w.document.getElementById('seg-export').hidden,true);
    await h.click('[data-seg="person"][data-person="1"]');
    assert.equal(h.signed.length,0);assert.equal(h.root.querySelector('[data-seg="approve"]'),null);
  }
});
test('partial failures show unavailable review counts, disable daily export and preserve people',async()=>{
  const data=fixtureData(),h=setup({rpc:async name=>name==='dash_admin_revision_entregas'?{error:{message:'offline'}}:{data:structuredClone(data[name])}});
  await h.load();assert.match(h.w.document.getElementById('seg-message').textContent,/Vista parcial/);
  assert.equal(h.w.document.getElementById('seg-export').disabled,true);
  assert.equal(h.root.querySelectorAll('.seg-person').length,3);
  assert.match(h.root.querySelector('.seg-evidence-metrics').textContent,/—/);
  await h.click('[data-seg="person"][data-person="1"]');assert.equal(h.root.querySelector('[data-seg="approve"]'),null);
});
test('changing dates ignores late data and leaves the original date untouched',async()=>{
  const jobs=[],h=setup({rpc:(name,args)=>new Promise(resolve=>jobs.push({name,args,resolve}))});
  const first=h.load();await h.tick();
  const dateInput=h.w.document.getElementById('seg-date');dateInput.value='2026-10-27';dateInput.dispatchEvent(new h.w.Event('change'));await h.tick();
  for(const job of jobs.filter(j=>j.args.p_fecha==='2026-10-27')){
    const data=fixtureData()[job.name];data.fecha='2026-10-27';if(data.entregas)data.entregas=[];
    job.resolve({data});
  }
  await h.tick();
  for(const job of jobs.filter(j=>j.args.p_fecha===date))job.resolve({data:fixtureData()[job.name]});
  await first;
  assert.equal(dateInput.value,'2026-10-27');
  assert.match(h.w.document.getElementById('seg-subtitle').textContent,/27 de octubre/);
  assert.equal(h.w.document.getElementById('admin-close-date').value,'2026-10-01');
});
test('review retains selected delivery after saving and advances only with explicit next action',async()=>{
  const h=setup();await h.load();await h.click('[data-seg="person"][data-person="1"]');
  assert.equal(h.signed.length,2);assert.ok(h.signed.every(c=>c.seconds===900));
  await h.click('[data-seg="approve"]');
  const mutation=h.calls.find(c=>c.name==='dash_admin_revisar_entrega');
  assert.deepEqual(JSON.parse(JSON.stringify(mutation.args)),{p_entrega:11,p_estado:'aprobada',p_nota:null});
  assert.match(h.root.querySelector('.seg-file-heading').textContent,/RPE del día/);
  assert.equal(h.root.querySelector('[data-seg="approve"]'),null);
  assert.equal(h.w.document.getElementById('seg-case-title').textContent,'María Díaz');
  await h.click('[data-seg="next-evidence"]');
  assert.match(h.root.querySelector('.seg-file-heading').textContent,/Facebook/);
  assert.ok(h.root.querySelector('[data-seg="approve"]'));
});
test('correction needs a note; closed non-Facebook cannot be corrected',async()=>{
  const h=setup();await h.load();await h.click('[data-seg="person"][data-person="1"]');await h.click('[data-seg="observe"]');
  assert.equal(h.calls.filter(c=>c.name==='dash_admin_revisar_entrega').length,0);
  assert.match(h.w.document.getElementById('seg-action-status').textContent,/al menos 3/);
  const data=fixtureData();data.dash_admin_revision_entregas.entregas[0].jornada_cerrada=true;
  const closed=setup({data});await closed.load();await closed.click('[data-seg="person"][data-person="1"]');
  assert.equal(closed.root.querySelector('[data-seg="observe"]').disabled,true);
});
test('a session change during loading cannot publish the previous account data',async()=>{
  const jobs=[],h=setup({rpc:name=>new Promise(resolve=>jobs.push({name,resolve}))});
  const load=h.load();await h.tick();h.w.APP.sessionUid='different';
  jobs.forEach(job=>job.resolve({data:fixtureData()[job.name]}));await load;
  assert.doesNotMatch(h.root.textContent,/María Díaz/);
  assert.equal(h.signed.length,0);
});
test('missing requirements have no fabricated files; unsaved note blocks context changes',async()=>{
  const h=setup();await h.load();await h.click('[data-seg="person"][data-person="4"]');
  assert.match(h.w.document.getElementById('seg-gallery').textContent,/Sin archivo entregado/);
  assert.equal(h.signed.length,0);assert.equal(h.root.querySelector('[data-seg="approve"]'),null);
  await h.click('[data-seg="back"]');await h.click('[data-seg="person"][data-person="1"]');
  const note=h.w.document.getElementById('seg-note');note.value='Una observación';note.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  h.w.confirm=()=>false;await h.click('[data-seg="back"]');
  assert.ok(h.w.document.getElementById('seg-case-title'));
});
test('recovery adapter uses the new view date and refresh without moving original filters',async()=>{
  const h=setup({rpc:async()=>({data:{ok:true,regularizada:true}})});let refreshed=0;
  const button={disabled:false,textContent:''};
  await h.w.recoverAdminCloseExit(1,button,{date:'2026-10-17',isCurrent:()=>true,refresh:async()=>{refreshed++}});
  assert.equal(h.calls[0].args.p_fecha,'2026-10-17');assert.equal(refreshed,1);
  assert.equal(h.w.document.getElementById('admin-close-date').value,'2026-10-01');
  assert.equal(button.disabled,false);
});
test('administrative upload captures its context date across modal close and keeps confirmation contract',async()=>{
  const source=fs.readFileSync('assets/js/dashboard-admin-cierre.js','utf8'),calls=[],elements=new Map();let refreshes=0;
  const el=id=>{if(!elements.has(id))elements.set(id,{value:'',disabled:false,querySelector:()=>({textContent:''}),setAttribute(){},focus(){}});return elements.get(id)};
  el('admin-close-date').value='2026-10-01';
  const context={date:'2026-10-17',isCurrent:()=>true,refresh:async()=>{refreshes++}};
  const env={APP:{access:{rol:'direccion'}},ADMIN_EVIDENCE:{personId:1,files:[{}],busy:false,context},
    $:el,adminEvidencePerson:()=>({id:1,cierre:{}}),currentAdminEvidenceRequirement:()=>({kind:'rpe',assignment:null}),
    adminEvidenceMode:()=> 'individuales',adminEvidenceMessage(){},withActionLoader:async(label,fn)=>fn(()=>{}),
    uploadAdminEvidenceFile:async(file,selected,person,date)=>{calls.push(['upload',date]);return 'private/report.jpg'},
    closeAdminEvidence(){env.ADMIN_EVIDENCE={files:[],busy:false}},toast(){},
    db:{rpc:async(name,args)=>{calls.push([name,args]);return {data:{ok:true}}}},
    loadAdminCloses(){throw Error('Must not refresh old view')}
  };
  const ctx=vm.createContext(env);
  vm.runInContext(source.slice(source.indexOf('async function submitAdminEvidence('),source.indexOf('async function submitAdminCloseAssignment(')),ctx);
  await ctx.submitAdminEvidence({preventDefault(){}});
  assert.equal(refreshes,1);assert.equal(calls[0][1],'2026-10-17');
  assert.equal(calls[1][0],'dash_admin_confirmar_entrega');assert.equal(calls[1][1].p_fecha,'2026-10-17');
  assert.equal(calls[2][0],'dash_admin_regularizar_cierre');assert.equal(calls[2][1].p_fecha,'2026-10-17');
  assert.equal(el('admin-close-date').value,'2026-10-01');
});
test('business jornada remains separate from correction and review reasons',async()=>{
  const data=fixtureData();data.dash_admin_cierres.personas[0].cierre.estado='completa';
  data.dash_admin_cierres.personas[0].cierre.salida_at=date+'T18:00:00Z';
  data.dash_admin_control_diario.filas[0].revision_observada=1;
  const h=setup({data});await h.load();await h.click('[data-seg="person"][data-person="1"]');
  assert.match(h.root.querySelector('.seg-state-pair').textContent,/JornadaCompleta/);
  assert.match(h.root.querySelector('.seg-state-pair').textContent,/Pendiente de revisión/);
});
test('nonworking and exempt days do not invent missing RPE or assigned requirements',async()=>{
  const data=fixtureData(),p=data.dash_admin_cierres.personas[2];
  p.cierre.requisitos.push({tipo:'rpe',titulo:'RPE no aplicable',completo:false});
  p.cierre.asignaciones=[{id:50,titulo:'Asignación no aplicable',completo:false}];
  const h=setup({data});await h.load();await h.click('[data-seg="person"][data-person="3"]');
  assert.equal(h.root.querySelectorAll('[role="tab"]').length,1);
  assert.match(h.root.querySelector('[role="tab"]').textContent,/Facebook/);
});

test('private photos load in one batch without replacing the active evidence or unsaved note',async()=>{
  let resolvePhoto;const batches=[];
  const h=setup({photos:people=>{batches.push(people);return new Promise(resolve=>{resolvePhoto=resolve})}});
  await h.load();assert.equal(batches.length,1);assert.equal(batches[0].length,4);
  assert.equal(h.root.querySelectorAll('.seg-avatar img').length,0);
  await h.click('[data-seg="person"][data-person="1"]');
  const gallery=h.w.document.getElementById('seg-gallery'),note=h.w.document.getElementById('seg-note');
  note.value='Observación en curso';note.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  resolvePhoto(batches[0].map(p=>({...p,foto_url:p.id===1?'https://fixture.test/private-avatar?token=temporary':''})));
  await h.tick();
  assert.equal(h.w.document.getElementById('seg-gallery'),gallery);
  assert.equal(h.w.document.getElementById('seg-note'),note);assert.equal(note.value,'Observación en curso');
  const avatar=h.root.querySelector('.seg-person[data-person="1"] .seg-avatar');
  assert.equal(avatar.querySelector('img').getAttribute('data-profile-photo'),'');
  assert.equal(avatar.textContent,'MD');assert.match(avatar.querySelector('img').src,/private-avatar/);
  await h.click('[data-seg="export"]');assert.doesNotMatch(await h.blobs[0].text(),/private-avatar|temporary/);
});

test('late photos from a previous date or account cannot replace the current avatars',async()=>{
  const jobs=[];
  const h=setup({photos:people=>new Promise(resolve=>jobs.push({people,resolve})),rpc:async(name,args)=>{
    const data=fixtureData()[name];data.fecha=args.p_fecha;return {data};
  }});
  await h.load();
  const input=h.w.document.getElementById('seg-date');input.value='2026-10-27';input.dispatchEvent(new h.w.Event('change'));await h.tick();
  assert.equal(jobs.length,2);
  jobs[0].resolve(jobs[0].people.map(p=>({...p,foto_url:'https://fixture.test/stale'})));await h.tick();
  assert.equal(h.root.querySelectorAll('.seg-avatar img').length,0);
  h.w.APP.sessionUid='another-account';
  jobs[1].resolve(jobs[1].people.map(p=>({...p,foto_url:'https://fixture.test/other-owner'})));await h.tick();
  assert.equal(h.root.querySelectorAll('.seg-avatar img').length,0);
});

test('photo permission/network failures preserve initials and keep daily export available',async()=>{
  const h=setup({photos:async()=>{throw Error('storage denied')}});await h.load();await h.tick();
  assert.match(h.root.querySelector('.seg-person[data-person="1"] .seg-avatar').textContent,/MD/);
  assert.equal(h.w.document.getElementById('seg-export').disabled,false);
  assert.equal(h.w.document.getElementById('seg-message').hidden,true);
});

test('shared photo loader reads authorized metadata, signs the private bucket and reuses its cache',async()=>{
  const source=fs.readFileSync('assets/js/dashboard.js','utf8'),requests=[],cache=new Map();
  const ctx=vm.createContext({Date,Map,Set,PROFILE_SIGNED_CACHE:cache,PROFILE_BUCKET:'perfil-fotos',db:{
    from:table=>({select:columns=>({in:async(key,ids)=>{
      requests.push({table,columns,key,ids});return {data:[{id:1,foto_path:'1/avatar.webp',foto_actualizada_at:'2026-10-29'},{id:2,foto_path:null}]};
    }})}),storage:{from:bucket=>({createSignedUrls:async(paths,seconds)=>{
      requests.push({bucket,paths,seconds});return {data:paths.map(()=>({signedUrl:'https://fixture.test/avatar?token=private'}))};
    }})}
  }});
  vm.runInContext(source.slice(source.indexOf('async function hydrateProfilePhotos('),source.indexOf('function profileAvatarMarkup(')),ctx);
  const photos=await ctx.hydrateProfilePhotos([{id:1},{id:2}]);
  assert.equal(requests[0].table,'asis_colaboradores');assert.equal(requests[1].bucket,'perfil-fotos');
  assert.equal(requests[1].seconds,3600);assert.deepEqual(Array.from(requests[1].paths),['1/avatar.webp']);
  assert.match(photos[0].foto_url,/token=private/);assert.equal(photos[1].foto_url,'');
  await ctx.hydrateProfilePhotos(photos);assert.equal(requests.length,2);
  const h=setup({photos:async()=>photos});
  vm.runInContext(source.slice(source.indexOf("document.addEventListener('error',event=>{"),source.indexOf('function setProfilePhotoBusy(')),h.ctx);
  await h.load();await h.tick();
  const image=h.root.querySelector('.seg-avatar img'),avatar=image.parentElement;
  image.dispatchEvent(new h.w.Event('error'));
  assert.equal(avatar.querySelector('img'),null);assert.equal(avatar.textContent,'MD');
});
