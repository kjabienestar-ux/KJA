import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read=name=>fs.readFileSync(new URL('../assets/js/'+name,import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function setup(){
 const dom=new JSDOM('<section id="live" hidden><p data-camera-status></p><ul data-camera-list></ul><button data-camera-refresh></button><button data-camera-report></button></section><section id="report" hidden></section>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://portal.example/zoom-sala.html'});
 const w=dom.window,callbacks={},timers=new Map(),intervals=new Map(),calls=[];let count=0;
 w.setTimeout=(fn,ms)=>{timers.set(++count,{fn,ms});return count;};w.clearTimeout=id=>timers.delete(id);
 w.setInterval=(fn,ms)=>{intervals.set(++count,{fn,ms});return count;};w.clearInterval=id=>intervals.delete(id);
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.ZoomMtg={inMeetingServiceListener:(event,fn)=>{assert.equal(callbacks[event],undefined,'duplicate SDK registration');callbacks[event]=fn;}};
 w.eval(read('zoom-camera-model.js'));w.eval(read('zoom-camera-tracker.js'));w.eval(read('zoom-camera-report.js'));
 let respond=()=>({data:{ok:true}}),roster=[{userId:1,userName:'Ana',video:true}],scope='main',rosterRead=null;
 const db={rpc(name,args){calls.push({name,args});return {abortSignal:()=>Promise.resolve().then(()=>respond(name,args))};}};
 const tracker=w.KJAZoomCameraTracker.create({db,call:()=>rosterRead?rosterRead():Promise.resolve({result:{attendeesList:roster}}),scope:()=>scope,host:w.document.getElementById('live')});
 const flush=async ms=>{for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}await tick();};
 return {dom,w,db,calls,callbacks,tracker,flush,intervals,setRespond:fn=>{respond=fn;},setRoster:list=>{roster=list;},setScope:value=>{scope=value;},setRosterRead:fn=>{rosterRead=fn;}};
}

test('tracker binds once and saves fresh explicit SDK states, with stable session and increasing sequence',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());h.tracker.bind();h.tracker.bind();h.tracker.start('meeting');await tick();
 assert.equal(h.calls.filter(c=>c.name==='dash_zoom_camera_start').length,1);
 assert.equal(h.calls.at(-1).args.p_participants[0].state,'on');
 h.setRoster([{userId:1,userName:'Ana',video:false}]);h.callbacks.onUserUpdate();await h.flush(350);
 assert.equal(h.calls.at(-1).args.p_participants[0].state,'off');assert.equal(h.calls.at(-1).args.p_seq,2);
 h.setScope('breakout');h.callbacks.onRoomStatusChange();await h.flush(350);
 assert.equal(h.calls.at(-1).args.p_scope,'breakout');assert.equal(h.calls.at(-1).args.p_participants[0].state,'unknown');
 assert.equal(h.calls.filter(c=>c.name==='dash_zoom_camera_start').length,1);
});

test('disconnects, hidden tabs and offline observers cannot keep reporting stale cameras',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());h.tracker.bind();h.tracker.start('meeting');await tick();
 h.callbacks.onMeetingStatus({status:4});await h.flush(350);
 assert.match(h.w.document.querySelector('[data-camera-list]').textContent,/Sin información/);
 const count=h.calls.length;
 for(const interval of h.intervals.values())interval.fn();await tick();assert.equal(h.calls.length,count);
 h.callbacks.onMeetingStatus({status:2});await h.flush(350);assert.ok(h.calls.length>count);
 Object.defineProperty(h.w.document,'hidden',{configurable:true,value:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
 const hiddenCount=h.calls.length;for(const interval of h.intervals.values())interval.fn();await tick();assert.equal(h.calls.length,hiddenCount);
 Object.defineProperty(h.w.document,'hidden',{configurable:true,value:false});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
 h.w.dispatchEvent(new h.w.Event('offline'));await h.flush(350);assert.equal(h.calls.length,hiddenCount);
 h.w.dispatchEvent(new h.w.Event('online'));await h.flush(350);assert.ok(h.calls.length>hiddenCount);
});

test('actual SDK meetingStatus payload resumes sampling after reconnect and stops on leave',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());h.tracker.bind();h.tracker.start('meeting');await tick();
 h.callbacks.onMeetingStatus({meetingStatus:4});await h.flush(350);
 const disconnected=h.calls.length;for(const interval of h.intervals.values())interval.fn();await tick();assert.equal(h.calls.length,disconnected);
 h.callbacks.onMeetingStatus({meetingStatus:2});await h.flush(350);assert.ok(h.calls.length>disconnected);
 const connected=h.calls.length;h.callbacks.onMeetingStatus({unrelated:true});
 for(const interval of h.intervals.values())interval.fn();await tick();assert.ok(h.calls.length>connected);
 h.callbacks.onMeetingStatus({meetingStatus:3});await tick();assert.equal(h.intervals.size,0);assert.equal(h.calls.at(-1).name,'dash_zoom_camera_stop');
});

test('tracker persists only confirmed local cameras while breakout rooms are open',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());h.setRoster([{userId:1,userName:'Local',video:true},{userId:2,userName:'Otra sala',video:true}]);
 h.setScope({scope:'local',visibleIds:['user:1']});h.tracker.start('meeting');await tick();
 assert.equal(h.calls.at(-1).args.p_scope,'local');assert.deepEqual(Array.from(h.calls.at(-1).args.p_participants,p=>p.state),['on','unknown']);
});

test('late SDK responses after stop cannot create observations, failed persistence is visible',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());let resolve;
 h.setRosterRead(()=>new Promise(done=>{resolve=done;}));h.tracker.start('meeting');await tick();
 await h.tracker.stop();resolve({result:{attendeesList:[{userId:1,video:false}]}});await tick();
 assert.equal(h.calls.filter(c=>c.name==='dash_zoom_camera_sample').length,0);
 assert.equal(h.intervals.size,0);
 const h2=setup();t.after(()=>h2.dom.window.close());h2.setRespond(name=>name==='dash_zoom_camera_sample'?{error:{message:'offline'}}:{data:{ok:true}});
 h2.tracker.start('meeting');await tick();assert.match(h2.w.document.querySelector('[data-camera-status]').textContent,/offline/);
 assert.match(h2.w.document.querySelector('[data-camera-list]').textContent,/Sin información/);
});

test('a roster requested before a hidden-tab round trip is discarded even after visibility resumes',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());let resolve;
 h.setRosterRead(()=>new Promise(done=>{resolve=done;}));h.tracker.start('meeting');await tick();
 Object.defineProperty(h.w.document,'hidden',{configurable:true,value:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
 Object.defineProperty(h.w.document,'hidden',{configurable:true,value:false});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
 resolve({result:{attendeesList:[{userId:1,video:false}]}});await tick();
 assert.equal(h.calls.filter(c=>c.name==='dash_zoom_camera_sample').length,0);
});

test('report ignores superseded responses, renders names as text and clears private rows on close',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());const requests=[];
 h.setRespond((name,args)=>new Promise(resolve=>requests.push({args,resolve})));
 const host=h.w.document.getElementById('report'),report=h.w.KJAZoomCameraReport.mount(host,h.db);
 const first=report.open({id:'one',topic:'Primera'});await tick();const second=report.open({id:'two',topic:'Segunda'});await tick();
 const payload={ok:true,sessions:[{id:'session',started_at:'2026-10-21T12:00:00Z'}],session:{id:'session',started_at:'2026-10-21T12:00:00Z',last_seen_at:'2026-10-21T12:01:00Z',ended_at:'2026-10-21T12:01:00Z'},now:'2026-10-21T12:01:00Z',people:[{id:'user:1',name:'<img src=x onerror=alert(1)>',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:01:00Z',state:'unknown',on_seconds:10,off_seconds:20,unknown_seconds:30,percentage:33.3}]};
 requests[1].resolve({data:payload});await second;
 requests[0].resolve({data:{...payload,people:[]}});await first;
 assert.ok(host.querySelector('table'));assert.equal(host.querySelector('img'),null);assert.match(host.textContent,/<img src=x/);assert.match(host.textContent,/Segunda/);
 report.close();assert.equal(host.hidden,true);assert.equal(host.querySelector('table'),null);
});

test('report timeout exposes retry and missing migration never looks like a successful empty report',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());h.setRespond(()=>new Promise(()=>{}));
 const host=h.w.document.getElementById('report'),report=h.w.KJAZoomCameraReport.mount(host,h.db);
 const loading=report.open({id:'one',topic:'Reunión'});await tick();await h.flush(15000);await loading;
 assert.match(host.textContent,/tardó demasiado/);assert.equal(host.getAttribute('aria-busy'),'false');
 h.setRespond(()=>({error:{code:'PGRST202'}}));host.querySelector('[data-report-refresh]').click();await tick();
 assert.match(host.textContent,/pendiente de activación/);assert.equal(host.querySelector('[data-report-export]').disabled,true);
});

test('report refreshes live data without leaving its page and stops refreshing after close',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());let count=0;
 h.setRespond(()=>({data:{ok:true,sessions:[],session:null,people:[],count:++count}}));
 const report=h.w.KJAZoomCameraReport.mount(h.w.document.getElementById('report'),h.db);
 await report.open({id:'meeting',topic:'Actual'});assert.equal(count,1);
 for(const interval of h.intervals.values())interval.fn();await tick();assert.equal(count,2);
 Object.defineProperty(h.w.document,'hidden',{configurable:true,value:true});for(const interval of h.intervals.values())interval.fn();await tick();assert.equal(count,2);
 report.close();assert.equal(h.intervals.size,0);
});

test('report supports searching by name/ID, filtering by compliance/state, and resetting filters',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());
 const samplePeople=[
  {id:'user:1',name:'Ana Lopez',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'on',on_seconds:240,off_seconds:60,unknown_seconds:0,percentage:80.0},
  {id:'uuid:xyz-2',name:'Carlos Perez',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'off',on_seconds:30,off_seconds:270,unknown_seconds:0,percentage:10.0},
  {id:'user:3',name:'Beatriz Diaz',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'unknown',on_seconds:0,off_seconds:0,unknown_seconds:300,percentage:null}
 ];
 h.setRespond(()=>({data:{ok:true,sessions:[{id:'s1',started_at:'2026-10-21T12:00:00Z'}],session:{id:'s1',started_at:'2026-10-21T12:00:00Z',last_seen_at:'2026-10-21T12:05:00Z'},now:'2026-10-21T12:05:00Z',people:samplePeople}}));
 const host=h.w.document.getElementById('report'),report=h.w.KJAZoomCameraReport.mount(host,h.db);
 await report.open({id:'m1',topic:'Reunión de prueba'});
 assert.equal(host.querySelectorAll('tbody tr').length,3);
 assert.match(host.querySelector('[data-report-count]').textContent,/3 participantes en esta sesión/);

 const search=host.querySelector('[data-report-search]');
 search.value='carlos';search.oninput();
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Carlos Perez/);
 assert.match(host.querySelector('[data-report-count]').textContent,/Mostrando 1 de 3/);

 search.value='xyz-2';search.oninput();
 assert.equal(host.querySelectorAll('tbody tr').length,1);

 search.value='';search.oninput();
 assert.equal(host.querySelectorAll('tbody tr').length,3);

 const filter=host.querySelector('[data-report-filter]');
 filter.value='high';filter.onchange();
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Ana Lopez/);

 filter.value='low';filter.onchange();
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Carlos Perez/);

 filter.value='on';filter.onchange();
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Ana Lopez/);

 filter.value='unknown';filter.onchange();
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Beatriz Diaz/);

 search.value='NoExiste';search.oninput();
 assert.equal(host.querySelectorAll('tbody tr').length,0);
 assert.match(host.textContent,/Ningún participante coincide/);
 host.querySelector('[data-report-clear-filter]').click();
 assert.equal(host.querySelectorAll('tbody tr').length,3);
 assert.equal(search.value,'');
 assert.equal(filter.value,'all');
 report.close();
});

test('report sorts columns dynamically in ascending and descending orders with correct aria-sort',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());
 const samplePeople=[
  {id:'user:1',name:'Zoe Ramos',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'off',on_seconds:10,off_seconds:100,unknown_seconds:0,percentage:9.1},
  {id:'user:2',name:'Alberto Soto',first_seen:'2026-10-21T12:01:00Z',last_seen:'2026-10-21T12:04:00Z',state:'on',on_seconds:200,off_seconds:20,unknown_seconds:0,percentage:90.9}
 ];
 h.setRespond(()=>({data:{ok:true,sessions:[{id:'s1',started_at:'2026-10-21T12:00:00Z'}],session:{id:'s1',started_at:'2026-10-21T12:00:00Z',last_seen_at:'2026-10-21T12:05:00Z'},now:'2026-10-21T12:05:00Z',people:samplePeople}}));
 const host=h.w.document.getElementById('report'),report=h.w.KJAZoomCameraReport.mount(host,h.db);
 await report.open({id:'m1',topic:'Reunión de prueba'});

 const getNames=()=>Array.from(host.querySelectorAll('tbody tr th strong')).map(el=>el.textContent);
 assert.deepEqual(getNames(),['Alberto Soto','Zoe Ramos']);

 const nameHeader=host.querySelector('th[aria-sort]');
 assert.equal(nameHeader.getAttribute('aria-sort'),'ascending');

 const nameBtn=host.querySelector('button[data-sort="name"]');
 nameBtn.click();
 assert.deepEqual(getNames(),['Zoe Ramos','Alberto Soto']);
 assert.equal(host.querySelector('button[data-sort="name"]').closest('th').getAttribute('aria-sort'),'descending');

 const pctBtn=host.querySelector('button[data-sort="percentage"]');
 pctBtn.click();
 assert.deepEqual(getNames(),['Alberto Soto','Zoe Ramos']);
 assert.equal(host.querySelector('button[data-sort="percentage"]').closest('th').getAttribute('aria-sort'),'descending');

 host.querySelector('button[data-sort="percentage"]').click();
 assert.deepEqual(getNames(),['Zoe Ramos','Alberto Soto']);
 assert.equal(host.querySelector('button[data-sort="percentage"]').closest('th').getAttribute('aria-sort'),'ascending');

 report.close();
});

test('search query and filter preferences are preserved on silent auto-refresh',async t=>{
 const h=setup();t.after(()=>h.dom.window.close());let callCount=0;
 const samplePeople=[
  {id:'user:1',name:'Ana Lopez',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'on',on_seconds:240,off_seconds:60,unknown_seconds:0,percentage:80.0},
  {id:'user:2',name:'Carlos Perez',first_seen:'2026-10-21T12:00:00Z',last_seen:'2026-10-21T12:05:00Z',state:'off',on_seconds:30,off_seconds:270,unknown_seconds:0,percentage:10.0}
 ];
 h.setRespond(()=>({data:{ok:true,sessions:[{id:'s1',started_at:'2026-10-21T12:00:00Z'}],session:{id:'s1',started_at:'2026-10-21T12:00:00Z',last_seen_at:'2026-10-21T12:05:00Z'},now:'2026-10-21T12:05:00Z',people:samplePeople,count:++callCount}}));
 const host=h.w.document.getElementById('report'),report=h.w.KJAZoomCameraReport.mount(host,h.db);
 await report.open({id:'m1',topic:'Reunión de prueba'});

 const search=host.querySelector('[data-report-search]');
 search.value='carlos';search.oninput();
 assert.equal(host.querySelectorAll('tbody tr').length,1);

 for(const interval of h.intervals.values())interval.fn();await tick();
 assert.equal(callCount,2);
 assert.equal(host.querySelectorAll('tbody tr').length,1);
 assert.match(host.querySelector('tbody').textContent,/Carlos Perez/);
 assert.equal(search.value,'carlos');

 report.close();
});
