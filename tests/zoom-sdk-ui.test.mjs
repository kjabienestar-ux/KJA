import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('zoom-sala.html','utf8'),source=fs.readFileSync('assets/js/zoom-sala.js','utf8');
const wait=()=>new Promise(r=>setTimeout(r,20));
async function setup({mobile=false,identity=true,status=1}={}){
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
 setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.add(t);return t;},clearTimeout,
 setInterval:(fn,ms)=>{const t=setInterval(fn,ms);intervals.add(t);return t;},clearInterval,addEventListener(){}};
 w.window=w;const dom={window:{close(){for(const t of timers)clearTimeout(t);for(const t of intervals)clearInterval(t);}}},calls=[];

 if(mobile)Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});
 w.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:identity?{id:'u'}:null}}),onAuthStateChange:()=>{}},
 functions:{invoke:async(_name,{body})=>{calls.push(body.action);return {data:body.action==='sdk-list'?{ok:true,admin:false,configured:true,meetings:[{id:'test',topic:'Ensayo',pilot:true,operators:[]}]}:{ok:true,meetingNumber:'12345678901',signature:'jwt',zak:'zak',passWord:'pass',userName:'Test'}};}}})};
 w.ZoomMtg={setZoomJSLib(){},preLoadWasm(){},prepareWebSDK(){},init(o){o.success();},join(o){calls.push('join');o.success();},
 getBreakoutRooms(o){o.success({rooms:[{name:'Ingeniería'}]});},getBreakoutRoomStatus(){return status;},
 openBreakoutRooms(o){calls.push('open');o.success();}};
 const append=w.document.head.append.bind(w.document.head);
 w.document.head.append=(el)=>{append(el);if(el.tagName==='SCRIPT')queueMicrotask(()=>el.onload());};
 vm.runInNewContext(source,w);await wait();return {w,dom,calls};
}
test('SDK: no session does not request authorization or download SDK',async()=>{
 const s=await setup({identity:false});try{assert.deepEqual(s.calls,[]);assert.match(s.w.document.getElementById('sdk-message').textContent,/Inicia sesión/);}finally{s.dom.window.close();}
});
test('SDK: mobile pilot cannot start a meeting',async()=>{
 const s=await setup({mobile:true});try{const b=s.w.document.querySelector('#sdk-meetings button');assert.equal(b.disabled,true);b.click();await wait();assert.deepEqual(s.calls,['sdk-list']);}finally{s.dom.window.close();}
});
test('SDK: human starts before rooms can open, status must confirm opened',async()=>{
 const s=await setup();try{
 s.w.document.querySelector('#sdk-meetings button').click();await wait();await wait();
 assert.ok(s.calls.includes('sdk-start'));assert.ok(s.calls.includes('join'));assert.ok(!s.calls.includes('open'));
 assert.match(s.w.document.getElementById('sdk-rooms').textContent,/Ingeniería/);
 const b=s.w.document.getElementById('sdk-open');assert.equal(b.disabled,false);b.click();await wait();
 assert.ok(s.calls.includes('open'));
 // A successful open callback alone must NOT claim that the rooms are open.
 assert.match(s.w.document.getElementById('sdk-live-status').textContent,/Todavía sin abrir/);
 }finally{s.dom.window.close();}
});
