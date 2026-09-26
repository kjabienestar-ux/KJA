import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/dashboard-pausa-activa.js','utf8');
export const flush=()=>new Promise(resolve=>setImmediate(resolve));
export function createServer(){
  const server={elapsed:0,used:[],session:null,requests:[],offline:false,sequence:0};
  const time=()=>Date.parse('2026-09-26T15:00:00Z')+server.elapsed;
  server.snapshot=()=>({ok:true,version:2,colaborador_id:42,fecha:'2026-09-26',ahora:new Date(time()).toISOString(),pausas:[...server.used],sesion:server.session?{...server.session}:null});
  server.rpc=async(name,args={})=>{
    server.requests.push({name,args});
    if(server.offline)return {error:{message:'offline'}};
    if(server.session?.estado==='en_curso'&&Date.parse(server.session.fin_at)<=time())server.session.estado='completada';
    if(name==='dash_iniciar_pausa'&&server.session?.estado!=='en_curso'){
      if(server.used.includes(args.p_break_id))return {data:{ok:false,motivo:'consumida'}};
      server.used.push(args.p_break_id);
      server.session={id:String(++server.sequence),pausa:args.p_break_id,estado:'en_curso',inicio_at:new Date(time()).toISOString(),fin_at:new Date(time()+(args.p_break_id==='movilidad'?1200000:600000)).toISOString()};
    }
    if(name==='dash_cerrar_pausa'){
      if(server.session?.id!==args.p_sesion)return {data:{ok:false,motivo:'sesion_no_disponible'}};
      if(server.session.estado==='en_curso'){
        if(!args.p_abandonar)return {data:{ok:false,motivo:'tiempo_pendiente'}};
        server.session.estado='abandonada';
      }
    }
    if(name.startsWith('dash_admin_reset')){server.used=[];server.session=null;}
    if(name==='dash_admin_pausas_diarias')return {data:{ok:true,filas:[]}};
    return {data:server.snapshot()};
  };
  return server;
}
export function createTab(server,{rpc=server.rpc,init=true}={}){
  const nodes=new Map(),events=new Map(),intervals=new Map();let serial=0;
  const node=key=>{
    if(!nodes.has(key)){
      const classes=new Set();
      nodes.set(key,{hidden:true,style:{},dataset:{},innerHTML:'',textContent:'',offsetWidth:100,
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);return on;}},
        querySelector:node,querySelectorAll:()=>[],removeAttribute(){},setAttribute(){},appendChild(){}});
    }return nodes.get(key);
  };
  const listen=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  const document={readyState:'loading',hidden:false,body:node('body'),getElementById:key=>key==='welcome-sub'?null:node(key),querySelector:node,querySelectorAll:()=>[],addEventListener:listen};
  const window={APP:{inicio:{colaborador:{id:42},dia:{marcado:true}}},addEventListener:listen,toast:msg=>window.message=msg,confirm:()=>true,location:{hash:''}};
  const context={window,document,db:{rpc},console,performance:{now:()=>server.elapsed},setTimeout(){},setInterval(fn,ms){const id=++serial;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)};
  vm.runInNewContext(source,context);
  const event=(name,value={})=>(events.get(name)||[]).forEach(fn=>fn(value));
  if(init)event('DOMContentLoaded');
  return {api:window.KJA_PAUSAS,node,nodes,events,intervals,document,window,event,
    async tick(){for(const {fn,ms} of [...intervals.values()])if(ms===1000)fn();await flush();},
    async advance(ms){server.elapsed+=ms;await this.tick();}};
}
