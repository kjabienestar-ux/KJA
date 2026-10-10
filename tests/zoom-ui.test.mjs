import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const html=fs.readFileSync('dashboard.html','utf8'),source=fs.readFileSync('assets/js/dashboard-zoom.js','utf8'),model=fs.readFileSync('assets/js/zoom-model.js','utf8');
const id='11111111-1111-4111-8111-111111111111';
const sample={id,topic:'Reunión <script>alert(1)</script>',status:'ready',type:3,revision:1,zoom_id:'97271980453',audience:'areas',area_ids:[1]};
function setup({admin=false,rpc,invoke}={}){
 const elements=new Map();let opened=[],invocations=[];
 function el(id){if(elements.has(id))return elements.get(id);const e={id,hidden:false,value:'',textContent:'',innerHTML:'',disabled:false,open:false,listeners:{},dataset:{},setAttribute(){},focus(){},scrollIntoView(){},reset(){},close(){this.open=false;},showModal(){this.open=true;},querySelector(selector){return el(id+':'+selector);},querySelectorAll(){return [];},addEventListener(name,fn){this.listeners[name]=fn;}};elements.set(id,e);return e;}
 for(const match of html.matchAll(/\bid="([^"]+)"/g))el(match[1]);
 const window={location:{assign:url=>opened.push(url)},open:()=>({opener:{},location:{replace:url=>opened.push(url)},close:()=>opened.push('closed')})};
 const APP={identity:{hasPersonal:!admin,isSystem:admin},access:{rol:admin?'direccion':'visor',acceso_panel:admin},view:'zoom'};
 const data={ok:true,admin,meetings:[sample],areas:admin?[{id:1,nombre:'Marketing'}]:[],people:[],now:'2026-10-09T13:00:00Z'};
 const db={rpc:rpc||(async()=>({data})),functions:{invoke:async(name,{body})=>{invocations.push(body);return invoke?invoke(body):{data:{ok:true,url:'https://zoom.us/j/97271980453',hosts:[{id:'host',name:'Anfitrión',email:'host@example.com',type:2}]}};}}};
 const context=vm.createContext({window,document:{hidden:false,getElementById:id=>elements.get(id)||null},APP,db,URL,Intl,Date,console,crypto:webcrypto,setInterval:()=>1,clearInterval(){}});
 vm.runInContext(model,context);vm.runInContext(source,context);
 return {el,window,APP,invocations,opened,load:()=>window.KJAZoom.load()};
}
test('todos los elementos requeridos existen en el HTML real',()=>{
 const ids=[...source.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),id);
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const zoomIds=all.filter(x=>x.startsWith('zoom-'));assert.equal(new Set(zoomIds).size,zoomIds.length);
});
test('colaborador ve acceso de participante, no gestión, y el texto se escapa',async()=>{
 const s=setup();await s.load();const output=s.el('zoom-list').innerHTML;
 assert.ok(output.includes('data-zoom="join"'));assert.equal(output.includes('data-zoom="start"'),false);assert.equal(output.includes('<script>'),false);
 assert.equal(s.el('zoom-new').hidden,true);assert.equal(s.el('zoom-import').hidden,true);
 await s.el('zoom-list').listeners.click({target:{closest:()=>({dataset:{id,zoom:'join'}})}});
 assert.deepEqual(s.opened,['https://zoom.us/j/97271980453']);assert.equal(s.invocations[0].action,'join');
});
test('administrador puede abrir edición preservando programación y cancelar exige diálogo',async()=>{
 const s=setup({admin:true});await s.load();
 assert.equal(s.el('zoom-new').hidden,false);assert.ok(s.el('zoom-list').innerHTML.includes('data-zoom="edit"'));assert.match(s.el('zoom-list').innerHTML,/zoom-primary zoom-join.*data-zoom="start"/);assert.match(s.el('zoom-daily-flow').textContent,/Abrir todas las salas/);
 await s.el('zoom-list').listeners.click({target:{closest:()=>({dataset:{id,zoom:'edit'}})}});
 assert.equal(s.el('zoom-form').hidden,false);assert.equal(s.el('zoom-schedule').value,'keep');
 await s.el('zoom-list').listeners.click({target:{closest:()=>({dataset:{id,zoom:'cancel'}})}});
 assert.equal(s.el('zoom-cancel-dialog').open,true);assert.equal(s.invocations.length,0);
});
test('respuesta pendiente de otra sesión se descarta al salir',async()=>{
 let resolve;const s=setup({rpc:()=>new Promise(r=>resolve=r)});const pending=s.load();s.window.KJAZoom.reset();
 resolve({data:{ok:true,admin:true,meetings:[sample],areas:[],people:[],now:'2026-10-09T13:00:00Z'}});await pending;
 assert.equal(s.el('zoom-list').innerHTML,'');assert.equal(s.el('zoom-new').hidden,true);assert.equal(s.el('nav-zoom').hidden,true);
});
test('un enlace de respuesta inseguro no se abre',async()=>{
 const s=setup({invoke:async()=>({data:{ok:true,url:'https://zoom.us.evil.test/j/1'}})});await s.load();
 await s.el('zoom-list').listeners.click({target:{closest:()=>({dataset:{id,zoom:'join'}})}});
 assert.deepEqual(s.opened,['closed']);assert.match(s.el('zoom-message').textContent,/no es válido/);
});
test('error de migración tiene mensaje recuperable y no muestra reuniones ficticias',async()=>{
 const s=setup({rpc:async()=>({error:{code:'PGRST202'}})});await s.load();assert.match(s.el('zoom-message').textContent,/pendiente de activación/);assert.equal(s.el('zoom-list').innerHTML,'');
});

test('reunión recurrente conserva el acceso aunque no haya próximas fechas devueltas por Zoom',async()=>{
 const s=setup({rpc:async()=>({data:{ok:true,admin:false,meetings:[{...sample,type:8,occurrences:[]}],areas:[],people:[],now:'2026-10-09T13:00:00Z'}})});
 await s.load();assert.ok(s.el('zoom-list').innerHTML.includes('data-zoom="join"'));
 assert.match(s.el('zoom-daily-flow').textContent,/reunión principal/);
 assert.match(s.el('zoom-daily-flow').textContent,/si esa opción está habilitada/);
});

test('agenda semanal ordena fechas de Lima, conserva una serie y permite navegar',async()=>{
 const dates=['2026-10-10T13:00:00Z','2026-10-05T13:00:00Z','2026-10-12T13:00:00Z'];
 const s=setup({rpc:async()=>({data:{ok:true,admin:false,meetings:[{...sample,type:8,occurrences:dates.map(start_time=>({start_time,duration:60}))}],now:'2026-10-09T13:00:00Z'}})});
 await s.load();
 const list=s.el('zoom-week-list').innerHTML;
 assert.match(list,/lunes, 5/);assert.match(list,/sábado, 10/);assert.equal((list.match(/zoom-week-session/g)||[]).length,2);
 assert.equal(list.includes('<script>'),false);
 s.el('zoom-week-next').onclick();assert.match(s.el('zoom-week-list').innerHTML,/lunes, 12/);
 assert.equal((s.el('zoom-week-list').innerHTML.match(/zoom-week-session/g)||[]).length,1);
 s.el('zoom-week-today').onclick();assert.equal(s.el('zoom-week-list').innerHTML,list);
 s.window.KJAZoom.reset();assert.equal(s.el('zoom-week').hidden,true);assert.equal(s.el('zoom-week-list').innerHTML,'');
});
test('semana usa lunes local, excluye eliminadas y no inventa recurrencias',()=>{
 const context=vm.createContext({Intl,Date,URL});vm.runInContext(model,context);const m=context.KJAZoomModel;
 const rows=[{...sample,type:8,occurrences:[
 {start_time:'2026-10-05T04:59:00Z'}, // domingo en Lima
 {start_time:'2026-10-05T05:00:00Z'},
 {start_time:'2026-10-05T05:00:00Z'},
 {start_time:'2026-10-06T13:00:00Z',status:'deleted'},
 {start_time:'invalid'}]}];
 assert.equal(m.weekSessions(rows,Date.parse('2026-10-05T05:00:00Z')).days.flatMap(d=>d.sessions).length,1);
 assert.equal(m.weekSessions(rows,Date.parse('2026-10-05T04:59:00Z')).days[6].sessions.length,1);
 assert.equal(m.weekSessions([{...sample,type:8,occurrences:[]}]).days.flatMap(d=>d.sessions).length,0);
});

test('acceso flotante abre modal y usa join incluso para administración',async()=>{
 const s=setup({admin:true});await s.load();
 await s.el('zoom-home-access').onclick();
 assert.equal(s.el('zoom-quick-dialog').open,true);
 assert.match(s.el('zoom-quick-list').innerHTML,/Unirme/);
 assert.equal(s.el('zoom-quick-list').innerHTML.includes('<script>'),false);
 await s.el('zoom-quick-list').listeners.click({target:{closest:()=>({dataset:{quickId:id}})}});
 assert.equal(s.invocations.at(-1).action,'join');
 s.el('zoom-quick-close').onclick();assert.equal(s.el('zoom-quick-dialog').open,false);
});
test('salir borra reuniones del modal y oculta acceso flotante',async()=>{
 const s=setup();await s.load();await s.el('zoom-home-access').onclick();
 s.window.KJAZoom.reset();
 assert.equal(s.el('zoom-quick-dialog').open,false);
 assert.equal(s.el('zoom-quick-list').innerHTML,'');
 assert.equal(s.el('zoom-home-access').hidden,true);
});
