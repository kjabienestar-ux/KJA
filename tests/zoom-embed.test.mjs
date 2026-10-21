import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
 const nodes=new Map(),events={};
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',contentWindow:{},open:false,showModal(){this.open=true},close(){this.open=false},focus(){},scrollIntoView(){},removeAttribute(name){delete this[name]},requestFullscreen:async()=>{}});return nodes.get(id)};
 const root={location:{origin:'https://example.test'},confirm:()=>true,addEventListener:(name,fn)=>events[name]=fn};
 const context={window:root,document:{getElementById:get},APP:{access:{acceso_panel:true}},encodeURIComponent};
 vm.runInNewContext(fs.readFileSync('assets/js/dashboard-zoom-embed.js','utf8'),context);
 return {root,get,events,context};
}
test('one same-origin SDK frame persists on reopen and refuses replacement by another meeting',()=>{
 const x=setup();x.root.KJAZoomEmbed.open({id:'one',topic:'Reunión'});const f=x.get('zoom-embedded-frame');
 assert.equal(f.src,'zoom-sala.html?embedded=1&meeting=one');
 f.src='unchanged';x.root.KJAZoomEmbed.open({id:'one'});assert.equal(f.src,'unchanged');
 x.root.KJAZoomEmbed.open({id:'two'});assert.equal(f.src,'unchanged');assert.match(x.get('zoom-embedded-status').textContent,/otra reunión/);
});
test('untrusted messages cannot change state; signed-in frame status carries no credentials',()=>{
 const x=setup();x.root.KJAZoomEmbed.open({id:'one'});
 const event={origin:'https://bad.test',source:x.get('zoom-embedded-frame').contentWindow,data:{type:'kja-zoom-state',state:'connected'}};
 x.events.message(event);assert.doesNotMatch(x.get('zoom-embedded-status').textContent,/Conectado/);
 x.events.message({...event,origin:x.root.location.origin,source:{}});assert.doesNotMatch(x.get('zoom-embedded-status').textContent,/Conectado/);
 x.events.message({...event,origin:x.root.location.origin});assert.match(x.get('zoom-embedded-status').textContent,/Conectado/);
});
test('close cancellation retains the meeting; logout reset removes its frame source',()=>{
 const x=setup();x.root.KJAZoomEmbed.open({id:'one'});x.get('zoom-embedded-close').onclick();assert.equal(x.get('zoom-disconnect-dialog').open,true);assert.ok(x.get('zoom-embedded-frame').src);x.get('zoom-disconnect-back').onclick();assert.equal(x.get('zoom-disconnect-dialog').open,false);assert.ok(x.get('zoom-embedded-frame').src);x.get('zoom-embedded-close').onclick();x.get('zoom-disconnect-confirm').onclick();assert.equal(x.get('zoom-disconnect-dialog').open,false);assert.equal(x.get('zoom-embedded-frame').src,undefined);x.root.KJAZoomEmbed.open({id:'one'});
 x.root.KJAZoomEmbed.reset();assert.equal(x.get('zoom-embedded-frame').src,undefined);assert.equal(x.get('zoom-embedded').hidden,true);
 x.context.APP.access.acceso_panel=false;x.root.KJAZoomEmbed.open({id:'two'});assert.equal(x.get('zoom-embedded-frame').src,undefined);
});

test('camera report uses the connected meeting and keeps its SDK frame intact',()=>{
 const x=setup(),reports=[];
 x.root.KJAZoom={openCameraReport:row=>reports.push(row)};
 x.root.KJAZoomEmbed.open({id:'one',topic:'Reunión activa'});
 const frame=x.get('zoom-embedded-frame'),src=frame.src;
 x.root.KJAZoomEmbed.open({id:'two',topic:'Otra reunión'});
 x.get('zoom-embedded-report').onclick();
 assert.equal(reports.length,1);assert.equal(reports[0].id,'one');assert.equal(reports[0].topic,'Reunión activa');
 assert.equal(frame.src,src);assert.equal(x.get('zoom-embedded').hidden,false);
 x.context.APP.access.acceso_panel=false;x.get('zoom-embedded-report').onclick();assert.equal(reports.length,1);
 x.root.KJAZoomEmbed.reset();x.get('zoom-embedded-report').onclick();assert.equal(reports.length,1);
});

test('embedded report request stays in dashboard and rejects messages from other windows',()=>{
 const x=setup(),reports=[];x.root.KJAZoom={openCameraReport:row=>reports.push(row)};
 x.root.KJAZoomEmbed.open({id:'one',topic:'Activa'});const frame=x.get('zoom-embedded-frame'),src=frame.src;
 const event={origin:x.root.location.origin,source:frame.contentWindow,data:{type:'kja-zoom-camera-report'}};
 x.events.message({...event,origin:'https://bad.test'});x.events.message({...event,source:{}});assert.equal(reports.length,0);
 x.events.message(event);assert.equal(reports.length,1);assert.equal(reports[0].id,'one');assert.equal(frame.src,src);
});
test('only dashboard gets microphone policy needed by its same-origin SDK frame',()=>{
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const header=route=>config.headers.filter(h=>h.source===route).flatMap(h=>h.headers).find(h=>h.key==='Permissions-Policy').value;
 assert.match(header('/dashboard.html'),/microphone=\(self\)/);assert.match(header('/(.*)'),/microphone=\(\)/);
 assert.match(header('/dashboard'),/microphone=\(self\)/);
 const html=fs.readFileSync('dashboard.html','utf8');assert.match(html,/allow="camera; microphone; display-capture; autoplay; fullscreen"/);
});
