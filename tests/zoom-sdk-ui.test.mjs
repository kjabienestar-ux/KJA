import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('zoom-sala.html','utf8'),source=fs.readFileSync('assets/js/zoom-sala.js','utf8');
const wait=()=>new Promise(r=>setTimeout(r,20));
async function until(fn){for(let i=0;i<100&&!fn();i++)await wait();assert.ok(fn(),'La condición no se confirmó');}
async function setup({mobile=false,identity=true,status=1,openedStatus=2,rooms=true,rejectOpen=false,syncOnly=false}={}){
 const nodes=new Map();
 class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.disabled=false;this._text='';}
 append(...els){this.children.push(...els);}
 replaceChildren(...els){this.children=els;this._text='';}
 set textContent(v){this._text=v;}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
 querySelector(selector){if(selector==='summary'){this.summary??=new Element('summary');return this.summary;}return this.querySelectorAll(selector)[0]||new Element(selector);}
 querySelectorAll(selector){if(this===nodes.get('sdk-lobby'))return [...nodes.get('sdk-meetings').querySelectorAll(selector),nodes.get('sdk-grant').querySelector('button')];return this.children.flatMap(c=>[...(c.tagName===selector.toUpperCase()?[c]:[]),...c.querySelectorAll(selector)]);}
 click(){if(!this.disabled)this.onclick?.();}focus(){}
 }
 for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element());
 nodes.get('sdk-grant').append(new Element('button'));
 const head=new Element('head');
 const document={head,hidden:false,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),querySelector:s=>{const [id,tag]=s.split(' ');return nodes.get(id.slice(1)).querySelector(tag);}};
 const timers=new Set(),intervals=new Set();
 const w={document,navigator:{userAgent:'Desktop',platform:'Win32',maxTouchPoints:0},location:{href:'https://portal.example/zoom-sala.html'},URL,
 setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms===1500?1:ms);timers.add(t);return t;},clearTimeout,
 setInterval:(fn,ms)=>{const t=setInterval(fn,ms);intervals.add(t);return t;},clearInterval,addEventListener(){}};
 w.window=w;const dom={window:{close(){for(const t of timers)clearTimeout(t);for(const t of intervals)clearInterval(t);}}},calls=[];

 if(mobile)Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});
 w.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:identity?{id:'u'}:null}}),onAuthStateChange:()=>{}},
 functions:{invoke:async(_name,{body})=>{calls.push(body.action);return {data:body.action==='sdk-list'?{ok:true,admin:false,configured:true,meetings:[{id:'test',topic:'Ensayo',pilot:true,operators:[]}]}:{ok:true,meetingNumber:'12345678901',signature:'jwt',zak:'zak',passWord:'pass',userName:'Test'}};}}})};
 w.ZoomMtg={setZoomJSLib(){},preLoadWasm(){},prepareWebSDK(){},init(o){o.success();},join(o){calls.push('join');o.success();},
 getBreakoutRooms(o){o.success({rooms:rooms?[{name:'Ingeniería'}]:[]});},getBreakoutRoomStatus(o){if(!syncOnly)o.success({result:{status}});return status;},
 openBreakoutRooms(o){calls.push('open');if(rejectOpen){o.error();return;}status=openedStatus;o.success();}};
 const append=w.document.head.append.bind(w.document.head);
 w.document.head.append=(el)=>{append(el);if(el.tagName==='SCRIPT')queueMicrotask(()=>el.onload());};
 vm.runInNewContext(source,w);await wait();return {w,dom,calls};
}
test('SDK: no session does not request authorization or download SDK',async()=>{
 const s=await setup({identity:false});try{assert.deepEqual(s.calls,[]);assert.match(s.w.document.getElementById('sdk-message').textContent,/Inicia sesión/);}finally{s.dom.window.close();}
});
test('SDK: iPhone inicia integrado y solicita abrir una sola vez',async()=>{
 const s=await setup({mobile:true});try{
 const b=s.w.document.querySelector('#sdk-meetings button');assert.equal(b.disabled,false);b.click();await wait();await wait();
 assert.deepEqual(s.calls,['sdk-list','sdk-start','join','open']);
 assert.match(s.w.document.getElementById('sdk-live-status').textContent,/Abiertas/);
 }finally{s.dom.window.close();}
});
test('SDK: callback exitoso sin estado abierto no anuncia éxito',async()=>{
 const s=await setup({openedStatus:1});try{
 s.w.document.querySelector('#sdk-meetings button').click();await wait();await wait();await wait();
 await until(()=>/aún no confirma/.test(s.w.document.getElementById('sdk-live-status').textContent));
 assert.equal(s.calls.filter(c=>c==='open').length,1);
 assert.match(s.w.document.getElementById('sdk-live-status').textContent,/aún no confirma/);
 }finally{s.dom.window.close();}
});
for(const scenario of [{status:2},{rooms:false},{rejectOpen:true}])test('SDK: apertura segura '+JSON.stringify(scenario),async()=>{
 const s=await setup(scenario);try{
 s.w.document.querySelector('#sdk-meetings button').click();await wait();await wait();await wait();
 assert.equal(s.calls.filter(c=>c==='open').length,scenario.rejectOpen?1:0);
 assert.equal(s.w.document.getElementById('sdk-lobby').hidden,true);
 if(scenario.rejectOpen)assert.match(s.w.document.getElementById('sdk-live-status').textContent,/rechazó/);
 if(scenario.rooms===false)await until(()=>/no se pudieron preparar/.test(s.w.document.getElementById('sdk-live-status').textContent));
 if(scenario.rooms===false)assert.match(s.w.document.getElementById('sdk-live-status').textContent,/no se pudieron preparar/);
 }finally{s.dom.window.close();}
});

test('SDK: consulta manual indica progreso, evita duplicados y actualiza estado real',async()=>{
 const s=await setup({status:2});try{
 s.w.document.querySelector('#sdk-meetings button').click();await wait();await wait();
 const check=s.w.document.getElementById('sdk-check');assert.equal(check.disabled,false);
 let resolve,calls=0;s.w.ZoomMtg.getBreakoutRooms=o=>{calls++;resolve=o.success;};
 s.w.ZoomMtg.getBreakoutRoomStatus=o=>{o.success({result:{status:4}});return 4;};
 check.click();check.click();assert.equal(calls,1);assert.equal(check.disabled,true);
 assert.match(check.textContent,/Consultando/);assert.match(s.w.document.getElementById('sdk-live-status').textContent,/Consultando/);
 resolve({rooms:[{name:'Ingeniería'}]});await wait();
 assert.match(s.w.document.getElementById('sdk-live-status').textContent,/Cerradas/);
 assert.equal(check.disabled,false);assert.equal(s.w.document.getElementById('sdk-open').disabled,false);
 }finally{s.dom.window.close();}
});
test('SDK: conserva soporte de retorno numérico sin callback',async()=>{
 const s=await setup({syncOnly:true,status:2});try{
 s.w.document.querySelector('#sdk-meetings button').click();await wait();await wait();
 assert.match(s.w.document.getElementById('sdk-live-status').textContent,/Abiertas/);assert.equal(s.calls.includes('open'),false);
 }finally{s.dom.window.close();}
});
