import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/js/dashboard.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function geolocation('),source.indexOf('\nfunction formatDistance('));
const pos=(accuracy=30,timestamp=Date.now())=>({coords:{latitude:-12,longitude:-77,accuracy},timestamp});
function run(replies,secure=true){const calls=[],timers=new Map();let i=0;const c={Date,Number,Math,window:{isSecureContext:secure},navigator:{geolocation:{getCurrentPosition(ok,fail,options){calls.push(options);const reply=replies.shift();if(reply?.coords)ok(reply);else fail(reply)}}},setTimeout(fn){timers.set(++i,fn);return i},clearTimeout(id){timers.delete(id)}};vm.createContext(c);vm.runInContext(code,c);return {c,calls,timers}}
test('GPS failure retries network location and cleans timers',async()=>{const h=run([{code:2},pos()]);const r=await h.c.geolocation();assert.equal(r.ok,true);assert.deepEqual(h.calls.map(c=>c.enableHighAccuracy),[true,false]);assert.equal(h.timers.size,0)});
test('denied permission is not requested twice',async()=>{const h=run([{code:1}]);assert.equal((await h.c.geolocation()).motivo,'ubicacion_denegada');assert.equal(h.calls.length,1)});
test('accurate initial position needs no retry',async()=>{const h=run([pos()]);assert.equal((await h.c.geolocation()).ok,true);assert.equal(h.calls.length,1)});
test('imprecise coordinates are not made artificially accurate',async()=>{const h=run([pos(900),pos(800)]);assert.equal((await h.c.geolocation()).accuracy,800)});
test('timeout and insecure context have distinct messages',async()=>{const h=run([{code:3},{code:3}]);assert.equal((await h.c.geolocation()).motivo,'ubicacion_timeout');const blocked=run([],false);assert.equal((await blocked.c.geolocation()).motivo,'ubicacion_insegura');assert.equal(blocked.calls.length,0)});
test('stale position is rejected rather than stamped fresh',async()=>{const h=run([pos(20,Date.now()-180000),pos()]);const r=await h.c.geolocation();assert.equal(r.ok,true);assert.equal(h.calls.length,2)});
test('waiting for permission does not start an application timeout or discard a later position',async()=>{
  const h=run([]);let success,options;
  h.c.navigator.geolocation.getCurrentPosition=(ok,fail,opts)=>{success=ok;options=opts};
  const pending=h.c.geolocation();
  assert.equal(h.timers.size,0);
  assert.equal(options.timeout,25000);
  assert.equal(options.maximumAge,30000);
  success(pos());
  assert.equal((await pending).ok,true);
});
test('recent cached coordinates keep their actual capture time',async()=>{
  const timestamp=Date.now()-20000,h=run([pos(40,timestamp)]);
  const result=await h.c.geolocation();
  assert.equal(result.ok,true);assert.equal(result.capturedAt,timestamp);
});

test('cancelling a stalled GPS request prevents fallback and ignores late coordinates',async()=>{
  const h=run([]),controller=new AbortController();let success,calls=0;
  h.c.navigator.geolocation.getCurrentPosition=ok=>{success=ok;calls++};
  const pending=h.c.geolocation({signal:controller.signal});
  controller.abort();
  assert.equal((await pending).motivo,'ubicacion_cancelada');
  success(pos());
  assert.equal(calls,1);
});

function markHarness(){
  const elements=new Map(),pending=[],requests=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{dataset:{},hidden:false,disabled:false,textContent:'',setAttribute(){},removeAttribute(){}});return elements.get(id)};
  const c={Date,Number,AbortController,window:{isSecureContext:true},navigator:{geolocation:{}},APP:{inicio:{dia:{modalidad:'presencial'}}},MARK_GEO:null,MARK_GEO_REQUEST:null,MARK_GEO_PERMISSION_CHECK:0,MARK_BUSY:false,
    $:element,markMsg(){},syncMarkConfirm(){},markFailureMessage:reason=>reason,
    geolocation:()=>new Promise(resolve=>pending.push(resolve)),
    requestMarkEligibility:()=>new Promise(resolve=>requests.push(resolve))};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function formatDistance('),source.indexOf("$('verify-mark-location').onclick=")),c);
  return {c,element,pending,requests};
}

test('blocked permission is explained on opening without requesting coordinates',async()=>{
  const h=markHarness();h.c.navigator.permissions={query:async()=>({state:'denied'})};
  await h.c.checkMarkLocationPermission();
  assert.equal(h.c.MARK_GEO.motivo,'ubicacion_denegada');
  assert.equal(h.element('mark-mode-title').textContent,'Permiso de ubicación bloqueado');
  assert.equal(h.pending.length,0);
  assert.equal(h.element('verify-mark-location').disabled,false);
});

test('unanswered permission explains the Allow action instead of claiming it is blocked',async()=>{
  const h=markHarness();h.c.navigator.permissions={query:async()=>({state:'prompt'})};
  await h.c.checkMarkLocationPermission();
  assert.equal(h.c.MARK_GEO.error,undefined);
  assert.match(h.element('mark-mode-detail').textContent,/elige Permitir/);
  assert.equal(h.pending.length,0);
});

test('unsupported permission queries do not prevent location verification',async()=>{
  for(const permissions of [undefined,{query:async()=>{throw new Error('unsupported')}}]){
    const h=markHarness();h.c.navigator.permissions=permissions;
    await h.c.checkMarkLocationPermission();
    assert.equal(h.c.MARK_GEO,null);
    const pending=h.c.verifyMarkLocation();h.pending[0]({ok:false,motivo:'ubicacion_timeout'});await pending;
    assert.equal(h.element('mark-mode-title').textContent,'La ubicación está tardando demasiado');
  }
});

test('late permission query cannot replace an active attempt or a closed modal',async()=>{
  for(const action of ['verify','close']){
    const h=markHarness();let resolvePermission;
    h.c.navigator.permissions={query:()=>new Promise(resolve=>{resolvePermission=resolve})};
    const check=h.c.checkMarkLocationPermission();
    let pending;
    if(action==='verify')pending=h.c.verifyMarkLocation();else{h.c.cancelMarkLocation();h.element('mark-modal').hidden=true;}
    resolvePermission({state:'denied'});await check;
    assert.equal(h.c.MARK_GEO,null);
    if(pending){h.pending[0]({ok:false,motivo:'ubicacion_timeout'});await pending;}
  }
});

test('granted site permission does not falsely claim that the device location is available',async()=>{
  const h=markHarness();h.c.navigator.permissions={query:async()=>({state:'granted'})};
  await h.c.checkMarkLocationPermission();assert.equal(h.c.MARK_GEO,null);
  const pending=h.c.verifyMarkLocation();h.pending[0]({ok:false,motivo:'ubicacion_no_disponible'});await pending;
  assert.equal(h.element('mark-mode-title').textContent,'No se pudo obtener tu ubicación');
  assert.equal(h.c.MARK_GEO.verified,false);
});

test('insecure context and missing geolocation show different alerts before verification',async()=>{
  const insecure=markHarness();insecure.c.window.isSecureContext=false;
  await insecure.c.checkMarkLocationPermission();assert.equal(insecure.c.MARK_GEO.motivo,'ubicacion_insegura');
  const unsupported=markHarness();unsupported.c.navigator.geolocation=undefined;
  await unsupported.c.checkMarkLocationPermission();assert.equal(unsupported.c.MARK_GEO.motivo,'ubicacion_no_compatible');
  const h=run([]);h.c.navigator.geolocation=undefined;
  assert.equal((await h.c.geolocation()).motivo,'ubicacion_no_compatible');
});

test('retry replaces stale timeout text and remains cancellable without deleting evidence',async()=>{
  const h=markHarness();h.c.EVIDENCE={url:'photo'};
  h.c.MARK_GEO={error:true,message:'old timeout'};
  const pending=h.c.verifyMarkLocation();
  assert.equal(h.element('mark-mode-title').textContent,'Verificando ubicación…');
  assert.equal(h.element('verify-mark-location').disabled,false);
  assert.equal(h.element('verify-mark-location').textContent,'Cancelar verificación');
  await h.c.verifyMarkLocation();
  assert.equal(h.element('verify-mark-location').textContent,'Verificar ubicación');
  assert.equal(h.c.EVIDENCE.url,'photo');
  h.pending[0]({ok:true});await pending;
  assert.equal(h.requests.length,0);
  assert.equal(h.c.MARK_GEO,null);
});

test('GPS timeout restores retry and a later attempt can validate the location',async()=>{
  const h=markHarness();let pending=h.c.verifyMarkLocation();
  h.pending[0]({ok:false,motivo:'ubicacion_timeout'});await pending;
  assert.equal(h.c.MARK_GEO.error,true);
  assert.equal(h.element('verify-mark-location').textContent,'Verificar ubicación');
  pending=h.c.verifyMarkLocation();
  h.pending[1]({ok:true,accuracy:30,capturedAt:Date.now()});await new Promise(setImmediate);
  h.requests[0]({puede_marcar:true,distancia_m:100});await pending;
  assert.equal(h.c.MARK_GEO.verified,true);
  assert.equal(h.element('mark-mode-title').textContent,'Ubicación verificada');
});

test('late server response cannot overwrite a new attempt after cancellation',async()=>{
  const h=markHarness(),first=h.c.verifyMarkLocation();
  h.pending[0]({ok:true});await new Promise(setImmediate);
  await h.c.verifyMarkLocation();
  const second=h.c.verifyMarkLocation(),current=h.c.MARK_GEO_REQUEST;
  h.requests[0]({puede_marcar:true,distancia_m:10});await first;
  assert.equal(h.c.MARK_GEO,null);
  assert.equal(h.c.MARK_GEO_REQUEST,current);
  assert.equal(h.element('verify-mark-location').textContent,'Cancelar verificación');
  h.pending[1]({ok:false,motivo:'ubicacion_denegada'});await second;
  assert.equal(h.c.MARK_GEO.message,'ubicacion_denegada');
});
