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
