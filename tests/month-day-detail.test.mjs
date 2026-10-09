import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(day={fecha:'2026-09-11',laborable:true}){
  const node=()=>({innerHTML:'',isConnected:true,attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},hasAttribute(k){return Object.hasOwn(this.attributes,k);},querySelectorAll(){return []}});
  const host=node(),preview=node();
  host.querySelector=()=>preview;
  const rendered=()=>host.innerHTML+preview.innerHTML;
  const context=vm.createContext({Intl,Date});
  const main=fs.readFileSync('assets/js/dashboard.js','utf8');
  vm.runInContext(main.slice(main.indexOf('function teamDayActivities('),main.indexOf('\nasync function openTeamDay(')),context);
  vm.runInContext(fs.readFileSync('assets/js/dashboard-month-day-detail.js','utf8'),context);
  const queries=[],files=[];
  const options={person:{id:19},day,rpc:(name,args)=>new Promise(resolve=>queries.push({name,args,resolve})),storage:{from:bucket=>({createSignedUrl:(path,seconds)=>new Promise(resolve=>files.push({bucket,path,seconds,resolve}))})}};
  const clickFile=value=>host.onclick({target:{closest:()=>({disabled:false,dataset:{mdFile:value},hasAttribute:key=>key==='data-md-file'})}});
  return {context,host,preview,rendered,clickFile,queries,files,options,mount:()=>context.KJAMonthDayDetail.mount(host,options)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Facebook report detail signs only Facebook files for the chosen person and date',async()=>{
  const x=setup();x.options.facebookOnly=true;
  const session=x.mount();
  assert.equal(x.queries[0].args.p_colaborador,19);
  assert.equal(x.queries[0].args.p_fecha,'2026-09-11');
  x.queries[0].resolve({data:{ok:true,entrada_archivos:[{path:'entry.jpg',mime:'image/jpeg',bucket:'private'}],cierre:{},entregas:[{tipo:'comparticiones',archivos:[{path:'facebook.jpg',mime:'image/jpeg',bucket:'private'}]}]}});
  await session.ready;
  assert.equal(x.files.length,1);assert.equal(x.files[0].path,'facebook.jpg');
  assert.ok(!x.host.innerHTML.includes('md-record-summary'));
  assert.ok(!x.host.innerHTML.includes('Registro de entrada'));
  assert.ok(!x.host.innerHTML.includes('data-md-remove'));
  session.dispose();
});
test('Facebook report without evidence shows an empty state and signs no files',async()=>{
  const x=setup();x.options.facebookOnly=true;
  const session=x.mount();x.queries[0].resolve({data:{ok:true,cierre:{},entregas:[]}});
  await session.ready;
  assert.match(x.host.innerHTML,/No hay evidencia registrada/);
  assert.equal(x.files.length,0);session.dispose();
});
function managementSetup(){
  const x=setup(),actions={innerHTML:'',insertAdjacentHTML(position,html){this.innerHTML=html;}},confirmation={hidden:true},message={textContent:''},cancel={focus(){}};
  x.host.querySelector=selector=>selector.includes('.md-activity-body')?actions:selector==='[data-md-confirm]'?confirmation:selector==='[data-md-status]'?message:selector==='[data-md-cancel-delete]'?cancel:x.preview;
  x.options.canManageFacebook=true;
  const click=(key,value='')=>x.host.onclick({target:{closest:()=>({disabled:false,dataset:{mdRemove:value},hasAttribute:attr=>attr===key})}});
  return {...x,actions,confirmation,message,click};
}
test('admin removal confirms, preserves retry after storage failure, and reloads after success',async()=>{
  const x=managementSetup(),calls=[];
  x.options.request=async body=>{calls.push(body);if(calls.length===1)throw new Error('limpieza_pendiente');return {ok:true};};
  const session=x.mount();
  x.queries[0].resolve({data:{ok:true,cierre:{},entregas:[{id:44,tipo:'comparticiones',archivos:[{path:'fb.jpg',mime:'image/jpeg',bucket:'private'}]}]}});
  await session.ready;
  assert.match(x.actions.innerHTML,/Quitar imagen 1/);
  x.click('data-md-remove','1:0');assert.equal(x.confirmation.hidden,false);assert.equal(calls.length,0);
  x.click('data-md-cancel-delete');assert.equal(x.confirmation.hidden,true);assert.equal(calls.length,0);
  x.click('data-md-remove','1:0');x.click('data-md-confirm-delete');await tick();
  assert.equal(calls[0].entrega,44);assert.equal(calls[0].path,'fb.jpg');assert.match(x.message.textContent,/reintentar/);
  x.click('data-md-confirm-delete');await tick();
  assert.equal(calls.length,2);assert.equal(x.queries.length,2);
  x.queries[1].resolve({data:{ok:true,cierre:{requisitos:[{tipo:'comparticiones',completo:false}]},entregas:[]}});await tick();
  assert.match(x.actions.innerHTML,/data-md-upload/);session.dispose();
});
test('admin upload saves replacement for the exact person and historical date after signed uploads',async()=>{
  const x=managementSetup(),calls=[];
  x.options.prepare=async file=>file;
  x.options.request=async body=>{calls.push(body);return {ruta:'new.jpg',token:'signed'};};
  x.options.storage={from:()=>({uploadToSignedUrl:async(path,token)=>{assert.equal(path,'new.jpg');assert.equal(token,'signed');return {};}})};
  const session=x.mount();
  x.queries[0].resolve({data:{ok:true,cierre:{requisitos:[{tipo:'comparticiones',completo:false}]},entregas:[]}});await session.ready;
  const pending=x.host.onchange({target:{matches:()=>true,files:[{type:'image/jpeg',size:100}]}});await tick();
  assert.equal(calls[0].accion,'admin_cargar');assert.equal(calls[0].colaborador,19);assert.equal(calls[0].fecha,'2026-09-11');
  assert.equal(x.queries[1].name,'dash_admin_confirmar_entrega');assert.deepEqual(Array.from(x.queries[1].args.p_paths),['new.jpg']);
  x.queries[1].resolve({data:{ok:true}});await tick();
  x.queries[2].resolve({data:{ok:true,cierre:{},entregas:[]}});await pending;
  assert.match(x.message.textContent,/guardadas/);session.dispose();
});
const result={ok:true,estado:'P',entrada_at:'2026-09-11T13:00:00Z',salida_at:'2026-09-11T18:00:00Z',horas:5,
  cierre:{aplica_jornada:true,requisitos:[{tipo:'rpe',titulo:'RPE',completo:true,revision_estado:'pendiente'},{tipo:'comparticiones',titulo:'Facebook',completo:false}]},
  entrada_archivos:[{bucket:'asis-evidencias',path:'private/entry',mime:'image/jpeg'}],
  entregas:[{tipo:'rpe',detalle:'Reporte <script>',completado_at:'2026-09-11T17:00:00Z',archivos:[{bucket:'asis-cierre-evidencias',path:'private/report',mime:'application/pdf'}]}]};

test('daily modal shows authorized records, missing activities, review states and private files without exposing paths',async()=>{
  const x=setup(),session=x.mount();
  assert.equal(x.queries[0].name,'dash_equipo_dia_detalle');
  assert.deepEqual({...x.queries[0].args},{p_colaborador:19,p_fecha:'2026-09-11'});
  x.queries[0].resolve({data:result});await session.ready;
  assert.match(x.rendered(),/5.0 h/);assert.match(x.rendered(),/Facebook/);
  assert.match(x.rendered(),/Pendiente de revisión/);
  assert.equal(x.rendered().includes('<script>'),false);assert.match(x.host.innerHTML,/Reporte &lt;script&gt;/);
  assert.equal(x.host.innerHTML.includes('private/'),false);
  assert.equal(x.files[0].seconds,900);assert.equal(x.files[0].path,'private/entry');
  x.files[0].resolve({data:{signedUrl:'https://example.test/entry'}});await tick();
  assert.match(x.preview.innerHTML,/<img src="https:\/\/example.test\/entry"/);
  assert.match(x.preview.innerHTML,/data-md-file="1:0"/);
  assert.match(x.preview.innerHTML,/1 \/ 2/);
  assert.match(x.preview.innerHTML,/Todas las evidencias del día/);
  x.clickFile('1:0');
  assert.equal(x.files[1].bucket,'asis-cierre-evidencias');assert.equal(x.files[1].path,'private/report');
  x.files[1].resolve({data:{signedUrl:'https://example.test/report'}});await tick();
  assert.match(x.preview.innerHTML,/Documento PDF/);
  assert.match(x.preview.innerHTML,/data-md-file="0:0"/);
  assert.match(x.preview.innerHTML,/2 \/ 2/);
  assert.match(x.preview.innerHTML,/rel="noopener noreferrer"/);
});

test('justification waives work requirements but preserves missing Facebook and all deliveries',async()=>{
  const x=setup(),session=x.mount();
  x.queries[0].resolve({data:{...result,estado:'J',entrada_at:null,salida_at:null,entrada_archivos:[],cierre:{aplica_jornada:true,requisitos:[{tipo:'rpe',titulo:'RPE',completo:false},{tipo:'comparticiones',titulo:'Facebook',completo:false}]},entregas:[]}});await session.ready;
  const compliance=x.host.innerHTML.match(/<div class="md-compliance[^]*?<\/div>/)[0];
  assert.match(compliance,/Facebook/);assert.doesNotMatch(compliance,/Registro de entrada|Registro de salida|RPE/);
  assert.match(x.host.innerHTML,/No requerida · justificado/);assert.equal(x.files.length,0);
});

test('no-work dates retain files without pending requirements; multiple deliveries preserve every file',()=>{
  const x=setup();
  const groups=x.context.KJAMonthDayDetail.groupsFor({...result,entregas:[...result.entregas,{tipo:'rpe',detalle:'Otra entrega',archivos:[{path:'second'}]}]},{laborable:false});
  assert.equal(groups.every(g=>g.waived),true);
  const rpe=groups.find(g=>g.key==='rpe');assert.equal(rpe.files.length,2);assert.equal(rpe.entregas.length,2);
});

test('closed modal and replaced requests cannot display old private previews',async()=>{
  const x=setup(),first=x.mount();x.queries[0].resolve({data:result});await first.ready;
  first.dispose();const second=x.mount();
  x.files[0].resolve({data:{signedUrl:'https://example.test/stale'}});await tick();
  assert.equal(x.rendered().includes('<img'),false);
  x.queries[1].resolve({error:{message:'offline'}});await second.ready;
  assert.match(x.host.innerHTML,/No es posible confirmar/);
  assert.equal(x.host.hasAttribute('aria-busy'),false);
  assert.equal(x.host.innerHTML.includes('stale'),false);
});

test('future dates do not request records or private files',async()=>{
  const x=setup();x.options.future=true;const session=x.mount();await session.ready;
  assert.equal(x.queries.length,0);assert.equal(x.files.length,0);assert.match(x.host.innerHTML,/Fecha futura/);
});

test('a detail response after closing cannot render evidence or request signed URLs',async()=>{
  const x=setup(),session=x.mount();session.dispose();const initial=x.host.innerHTML;
  x.queries[0].resolve({data:result});await session.ready;
  assert.equal(x.host.innerHTML,initial);assert.equal(x.files.length,0);
});
