import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {handler} from '../supabase/functions/zoom-reuniones/handler.mjs';
import {ZoomError} from '../supabase/functions/zoom-reuniones/model.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const id='11111111-1111-4111-8111-111111111111';
const remote={id:97271980453,topic:'Marketing',host_id:'host',host_email:'host@example.com',type:2,start_time:'2099-01-01T13:00:00Z',duration:60,join_url:'https://zoom.us/j/97271980453',start_url:'https://zoom.us/s/97271980453?zak=HOST_SECRET'};
function setup(seed=[],override={}){
 const tables={zoom_reuniones:structuredClone(seed),zoom_eventos:[],asis_areas:[{id:1,activo:true}],asis_colaboradores:[{id:1,activo:true}]};
 let failRead=false,posts=0,updates=0;
 const admin={from(name){
  let op='select',values,filters=[],returnRows=false;
  const q={
   select(){returnRows=true;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},
   update(v){op='update';values=v;return q;},insert(v){op='insert';values=v;return q;},
   single(){return Promise.resolve(run(true));},maybeSingle(){return Promise.resolve(run(true));},
   then(resolve,reject){return Promise.resolve(run(false)).then(resolve,reject);}
  };
  function run(single){
   const table=tables[name];
   let selected=table.filter(r=>filters.every(f=>f(r)));
   if(op==='insert'){
    if(name==='zoom_reuniones'&&table.some(r=>r.id===values.id))return {error:{code:'23505'},data:null};
    const row={revision:1,id:name==='zoom_eventos'?table.length+1:undefined,...values};table.push(row);selected=[row];
   }
   if(op==='update'){
    if(values.zoom_id&&tables.zoom_reuniones.some(r=>!selected.includes(r)&&r.zoom_id===values.zoom_id))return {error:{code:'23505'},data:null};
    selected.forEach(r=>Object.assign(r,values));
   }
   return {data:structuredClone(single?(selected[0]||null):selected),error:null};
  }
  return q;
 }};
 const user={auth:{getUser:async()=>({data:{user:{id:'u'}}})},rpc:async()=>({data:true})};
 const zoom={configured:()=>true,host:async()=>({id:'host'}),request:async(path,method='GET')=>{
  if(method==='POST'){posts++;return remote;}
  if(method==='PATCH'){updates++;return null;}
  if(method==='DELETE'){if(override.delete404)throw new ZoomError('No existe',404);return null;}
  if(failRead)throw new ZoomError('Sin confirmación',502);
  return remote;
 }};
 if(override.request)zoom.request=override.request;
 const app=handler({env:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon',createClient:(_url,key)=>key==='service'?admin:user,zoom});
 return {tables,request:body=>app(new Request('http://local',{method:'POST',body:JSON.stringify(body)})),setFailRead:v=>failRead=v,counts:()=>({posts,updates})};
}
const create={action:'create',id,topic:'Marketing',host_id:'host',schedule:'once',start_local:'2099-01-01T08:00',duration:60,audience:'areas',area_ids:[1]};
test('crear registra ID remoto, enlace de participante y bloquea doble envío',async()=>{
 const s=setup();assert.equal((await s.request(create)).status,200);
 const row=s.tables.zoom_reuniones[0];assert.equal(row.status,'ready');assert.equal(row.zoom_id,'97271980453');assert.equal(row.start_url,undefined);assert.equal(row.operation_id,null);
 assert.equal((await s.request(create)).status,409);assert.equal(s.counts().posts,1);assert.equal(s.tables.zoom_eventos[0].result,'completed');
});
test('fallo posterior a crear conserva ID para sincronizar sin duplicar',async()=>{
 const s=setup();s.setFailRead(true);assert.equal((await s.request(create)).status,502);
 let row=s.tables.zoom_reuniones[0];assert.equal(row.status,'error');assert.equal(row.zoom_id,'97271980453');
 s.setFailRead(false);assert.equal((await s.request({action:'sync',id,revision:row.revision})).status,200);assert.equal(s.tables.zoom_reuniones[0].status,'ready');assert.equal(s.counts().posts,1);
});
test('revisión obsoleta y bloqueo vigente impiden mutaciones externas',async()=>{
 const row={id,zoom_id:'97271980453',revision:3,status:'ready'};
 const s=setup([row]);assert.equal((await s.request({...create,action:'update',schedule:'keep',revision:2})).status,409);
 s.tables.zoom_reuniones[0].busy_until=new Date(Date.now()+60000).toISOString();assert.equal((await s.request({...create,action:'update',schedule:'keep',revision:3})).status,409);assert.equal(s.counts().updates,0);
});
test('cancelar sala ya eliminada en Zoom limpia el acceso del portal',async()=>{
 const s=setup([{id,zoom_id:'97271980453',revision:1,status:'ready',join_url:remote.join_url}],{delete404:true});
 assert.equal((await s.request({action:'cancel',id,revision:1})).status,200);assert.equal(s.tables.zoom_reuniones[0].status,'cancelled');assert.equal(s.tables.zoom_reuniones[0].join_url,null);
});
test('participante recibe solo join_url y start se consulta al momento',async()=>{
 const s=setup([{id,zoom_id:'97271980453',revision:1,status:'ready',join_url:remote.join_url}]);
 const join=await (await s.request({action:'join',id})).json();assert.equal(join.url,remote.join_url);assert.equal(JSON.stringify(join).includes('HOST_SECRET'),false);
 const start=await (await s.request({action:'start',id})).json();assert.equal(start.url,remote.start_url);
});
test('archivar solicitud sin ID no llama Zoom y no permite archivar sala vinculada',async()=>{
 let calls=0;const s=setup([{id,revision:1,status:'error'}],{request:()=>{calls++;throw Error();}});
 assert.equal((await s.request({action:'archive',id,revision:1})).status,200);assert.equal(calls,0);
 const linked=setup([{id,zoom_id:'97271980453',revision:1,status:'ready'}]);assert.equal((await linked.request({action:'archive',id,revision:1})).status,409);
});
test('importar una sala ya vinculada no cambia el acceso original',async()=>{
 const first={id:'22222222-2222-4222-8222-222222222222',zoom_id:'97271980453',status:'ready',revision:1,audience:'areas',area_ids:[1]};
 const s=setup([first]);const result=await s.request({action:'import',id,zoom_id:'97271980453',audience:'all'});
 assert.equal(result.status,409);assert.equal(s.tables.zoom_reuniones[0].audience,'areas');assert.equal(s.tables.zoom_reuniones.length,1);
});

test('vincular conserva la reunión y sus salas; iniciar cada día no crea ni reconfigura nada',async()=>{
 const calls=[];
 const meeting={...remote,settings:{breakout_room:{enable:true,rooms:[{name:'INGENIERIA',participants:['person@example.com']},{name:'MARKETING',participants:[]}]}}};
 const original=structuredClone(meeting);
 const s=setup([],{request:async(path,method='GET',body)=>{calls.push({path,method,body});return meeting;}});
 assert.equal((await s.request({action:'import',id,zoom_id:remote.id,audience:'all'})).status,200);
 for(let day=0;day<2;day++){
  const result=await s.request({action:'start',id});assert.equal(result.status,200);
  assert.equal((await result.json()).url,remote.start_url);
 }
 assert.equal(s.tables.zoom_reuniones.length,1);
 assert.ok(calls.every(c=>c.method==='GET'));
 assert.deepEqual(meeting,original);
 assert.equal(JSON.stringify(s.tables).includes('person@example.com'),false);
});
test('editar nombre conservando programación no envía cambios de salas a Zoom',async()=>{
 let payload;
 const s=setup([{id,zoom_id:String(remote.id),revision:1,status:'ready'}],{request:async(path,method='GET',body)=>{if(method==='PATCH'){payload=body;return null;}return remote;}});
 const response=await s.request({action:'update',id,revision:1,topic:'Reunión General KJA',schedule:'keep',audience:'all',settings:{breakout_room:{enable:false,rooms:[]}}});
 assert.equal(response.status,200);assert.deepEqual(payload,{topic:'Reunión General KJA'});
});
