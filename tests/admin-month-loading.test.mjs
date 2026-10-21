import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/dashboard-admin-mes.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve};};
const success=name=>({data:name==='dash_admin_mes'?{ok:true,personas:[{id:1}]}:{ok:true,cierres:[]}});
function setup(rpc,photos=async people=>people){
  const nodes=new Map(),timers=new Map();let timerId=0;
  const env={AbortController,APP:{access:{acceso_panel:true},adminSection:'mes',adminMonthRequest:0},
    $:id=>{if(!nodes.has(id))nodes.set(id,{checked:false,disabled:false,innerHTML:''});return nodes.get(id);},
    activeMonthPrefix:()=> 'admin-month',currentMonthValue:()=>env.month,syncMonthInputs(){},
    month:'2026-10',closeAdminPersonCalendar(){},monthMessage:text=>{env.message=text;},
    db:{rpc:(name,args)=>({abortSignal:signal=>rpc(name,args,signal)})},
    mergeAdminMonthClosures(){},fillMonthFilters(){},renderAdminMonthViews(){env.renders++;},renders:0,
    hydrateProfilePhotos:photos,document:{querySelectorAll:()=>[]},
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(env);
  vm.runInContext('let ADMIN_MONTH_LOAD=null;const ADMIN_MONTH_TIMEOUT_MS=20000;'+source.slice(source.indexOf('async function loadAdminMonth('),source.indexOf('\nfunction renderAdminMonthViews()')),env);
  return {env,nodes,timers};
}

test('renders verified month data without waiting for profile photos',async()=>{
  const photos=deferred(),h=setup(async name=>success(name),()=>photos.promise);
  assert.equal(await h.env.loadAdminMonth(),true);
  assert.equal(h.env.renders,1);
  assert.equal(h.nodes.get('admin-refresh').disabled,false);
  assert.equal(h.timers.size,0);
  photos.resolve([{id:1,foto_url:'signed'}]);
});

test('shares duplicate requests and reuses the completed month',async()=>{
  const pending=deferred();let calls=0;
  const h=setup(async name=>{calls++;await pending.promise;return success(name);});
  const first=h.env.loadAdminMonth(),second=h.env.loadAdminMonth();
  assert.equal(calls,2);pending.resolve();
  assert.equal(await first,true);assert.equal(await second,true);
  await h.env.loadAdminMonth();assert.equal(calls,2);
});

test('timeout releases loading even when transport ignores cancellation, then allows retry',async()=>{
  let ready=false;const signals=[];
  const h=setup((name,args,signal)=>{signals.push(signal);return ready?success(name):new Promise(()=>{});});
  const loading=h.env.loadAdminMonth();
  [...h.timers.values()][0]();
  assert.equal(await loading,false);
  assert.ok(signals.every(signal=>signal.aborted));
  assert.match(h.env.message,/tardó demasiado/);
  assert.equal(h.nodes.get('admin-refresh').disabled,false);
  ready=true;assert.equal(await h.env.loadAdminMonth(),true);
});

test('a superseded month cannot overwrite the current month or release its refresh button',async()=>{
  const pending=deferred(),signals=[];
  const h=setup((name,args,signal)=>{signals.push(signal);return args.p_mes===10?pending.promise:Promise.resolve(success(name));});
  const first=h.env.loadAdminMonth();h.env.month='2026-09';
  const second=h.env.loadAdminMonth();
  assert.ok(signals[0].aborted);
  await first;assert.equal(await second,true);
  pending.resolve(success('dash_admin_mes'));
  await Promise.resolve();
  assert.equal(h.env.APP.adminMonthKey,'2026-09|false');assert.equal(h.env.renders,1);
});

test('transport rejection and missing closures fail safely and allow retry',async()=>{
  for(const fail of [()=>{throw Error('offline');},name=>name==='dash_admin_cierres_mes'?{error:{message:'failed'}}:success(name)]){
    const h=setup(fail);
    assert.equal(await h.env.loadAdminMonth(),false);
    assert.equal(h.env.renders,0);assert.equal(h.env.APP.adminMonth,null);
    assert.equal(h.nodes.get('admin-refresh').disabled,false);assert.equal(h.timers.size,0);
  }
});
