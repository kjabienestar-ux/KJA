import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-admin-entrada.js','utf8');
function harness({confirmations=[{data:{ok:true,modalidad:'presencial',estado:'P'}}],permit={ok:true,permiso:'permit-1',ruta:'private.jpg',token:'signed'},uploadError=null}={}){
  const nodes=new Map(),rpc=[],uploads=[],requests=[];
  const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,dataset:{},textContent:'',setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},reset(){},reportValidity(){return true},querySelectorAll(){return []}});return nodes.get(id);};
  const c={Number,JSON,URL:{revokeObjectURL(){}},APP:{access:{rol:'direccion'}},SUPABASE_URL:'https://example.test',SUPABASE_ANON:'public',
    $:el,document:{activeElement:null,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}}},toast(){},loadAdminAttendance:async()=>{},
    db:{auth:{getSession:async()=>({data:{session:{access_token:'session'}}})},
      rpc:async(name,args)=>{rpc.push({name,args});return confirmations.shift();},
      storage:{from:()=>({uploadToSignedUrl:async(...args)=>{uploads.push(args);return {error:uploadError};}})}},
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>permit};}};
  vm.createContext(c);vm.runInContext(source,c);
  vm.runInContext('ADMIN_ENTRY.file={type:"image/jpeg"};',c);
  el('admin-entry-person').value='7';el('admin-entry-date').value='2026-09-23';el('admin-entry-time').value='08:15';
  el('admin-entry-mode').value='presencial';el('admin-entry-note').value='Foto recibida por Dirección.';
  return {c,el,rpc,uploads,requests,state:()=>vm.runInContext('ADMIN_ENTRY',c),submit:()=>c.submitAdminEntry({preventDefault(){}})};
}
test('admin entry binds chosen person, date, actual time, mode and note to the permit',async()=>{
  const h=harness();await h.submit();
  assert.deepEqual(h.requests[0],{accion:'entrada_direccion',ext:'jpg',colaborador:7,fecha:'2026-09-23',hora:'08:15',modalidad:'presencial',nota:'Foto recibida por Dirección.'});
  assert.equal(h.uploads.length,1);assert.equal(h.rpc[0].name,'dash_admin_confirmar_entrada');
  assert.equal(h.rpc[0].args.p_permiso,'permit-1');assert.equal(h.el('admin-entry-modal').hidden,true);
});
test('ambiguous server response retries the same confirmation without duplicate upload',async()=>{
  const h=harness({confirmations:[{error:{code:'FETCH_ERROR'}},{data:{ok:true,modalidad:'presencial',estado:'P'}}]});
  await h.submit();assert.equal(h.state().uncertain,true);assert.equal(h.el('admin-entry-fields').disabled,true);
  assert.equal(h.el('admin-entry-submit').textContent,'Comprobar registro');assert.ok(h.state().file);
  await h.submit();assert.equal(h.requests.length,1);assert.equal(h.uploads.length,1);
  assert.equal(h.rpc.length,2);assert.equal(h.rpc[0].args.p_permiso,h.rpc[1].args.p_permiso);
});
test('upload failure preserves the file and does not confirm an entry',async()=>{
  const h=harness({uploadError:new Error('offline')});await h.submit();
  assert.equal(h.rpc.length,0);assert.ok(h.state().file);assert.equal(h.state().busy,false);assert.equal(h.state().permit,null);
});
test('old evidence service cannot upload a photo under the administrators own attendance',async()=>{
  const h=harness({permit:{ok:true,ruta:'personal.jpg',token:'token'}});await h.submit();
  assert.equal(h.uploads.length,0);assert.equal(h.rpc.length,0);assert.match(h.el('admin-entry-message').textContent,/no está activada/);
});
test('non-Direction cannot submit and an existing entry is never overwritten',async()=>{
  const denied=harness();denied.c.APP.access.rol='editor';await denied.submit();assert.equal(denied.requests.length,0);
  const h=harness({confirmations:[{data:{ok:false,motivo:'ya_marcado'}}]});await h.submit();
  assert.match(h.el('admin-entry-message').textContent,/No se reemplazó/);assert.ok(h.state().file);
});
test('expired permit permits a new attempt with the same evidence',async()=>{
  const h=harness({confirmations:[{data:{ok:false,motivo:'permiso_vencido'}}]});await h.submit();
  assert.equal(h.state().permit,null);assert.equal(h.state().uncertain,false);assert.ok(h.state().file);
});

const edgeSource=fs.readFileSync('supabase/functions/dash-evidencia/index.ts','utf8')
  .replace(/import \{ createClient \} from [^;]+;/,'').replace('obj: unknown','obj');
function edgeHarness(allowed=true){
  const calls=[],removes=[],signed=[];let handler;
  const c={Response,Request,JSON,String,Deno:{env:{get:()=> 'configured'},serve:fn=>{handler=fn}},
    createClient:(url,key,options)=>options.global?{auth:{getUser:async()=>({data:{user:{id:'director'}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:allowed?{ok:true,permiso:'permit',ruta:'private.jpg'}:{ok:false,motivo:'sin_permiso'}};}}:
      {storage:{from:()=>({remove:async paths=>{removes.push(paths)},createSignedUploadUrl:async path=>{signed.push(path);return {data:{token:'signed'}};}})}}};
  vm.createContext(c);vm.runInContext(edgeSource,c);
  return {calls,removes,signed,send:body=>handler(new Request('https://test.local',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(body)}))};
}
test('edge uses Direction permission and never deletes the collaborators original evidence',async()=>{
  const h=edgeHarness(),response=await h.send({accion:'entrada_direccion',colaborador:7,fecha:'2026-09-23',hora:'08:15',modalidad:'presencial',nota:'Sin celular'});
  assert.equal(response.status,200);assert.equal((await response.json()).permiso,'permit');
  assert.equal(h.calls[0].name,'dash_admin_entrada_permiso');assert.equal(h.calls[0].args.p_colaborador,7);
  assert.equal(h.removes.length,0);assert.equal(h.signed.length,1);
});
test('edge refuses signed upload when server denies role and preserves personal upload flow',async()=>{
  const denied=edgeHarness(false);assert.equal((await denied.send({accion:'entrada_direccion'})).status,403);assert.equal(denied.signed.length,0);
  const personal=edgeHarness();assert.equal((await personal.send({ext:'jpg'})).status,200);assert.equal(personal.calls[0].name,'dash_evidencia_permiso');
});
