const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE || 'playwright');
const root=process.cwd(),out=path.join(root,'output/kja-035');
fs.mkdirSync(out,{recursive:true});
if(!fs.existsSync(path.join(out,'base/dashboard.html')))throw Error('Prepara la base 06b937a en output/kja-035/base antes del ensayo comparativo.');
const fixture=`(()=>{
const day={fecha:'2026-11-10',labora:true,marcado:true,marcado_at:'2026-11-10T13:00:00Z',estado:'P',modalidad:'virtual',hora_entrada:'08:00',hora_salida:'18:00',ahora:'11:00',ventana:'abierta'};
const inicio={ok:true,perfil:{nombre:'Persona de ensayo',nivel:'miembro'},colaborador:{id:42,nombre:'Persona de ensayo',area:'Área ficticia',area_id:1,horario_semanal:[]},dia:day};
window.lab={calls:[],channels:[],session:{user:{id:'00000000-0000-0000-0000-000000000042',user_metadata:{}},access_token:'fixture'}};
const result=name=>name==='dash_arranque'?{inicio,acceso:{rol:'visor',acceso_panel:false}}:name==='dash_inicio'?inicio:name.startsWith('chat_')?[]:name==='dash_mis_pausas'?{ok:true,version:2,colaborador_id:42,fecha:day.fecha,ahora:new Date().toISOString(),pausas:[],sesion:null}:name==='dash_historial'?{ok:true,dias:[],horas:0,meta:160,totales:{},calendario:[]}:name==='dash_mis_notificaciones_revision'?{ok:true,notificaciones:[],no_leidas:0}:{ok:true,fecha:day.fecha,ahora:new Date().toISOString(),dia:day,filas:[],personas:[],areas:[],entregas:[],asignaciones:[],requisitos:[],solicitudes:[],datos:[],estado:'en_curso'};
const db={rpc:async(name,args)=>{window.lab.calls.push({name,at:Date.now()});return {data:result(name),error:null};},auth:{getSession:async()=>({data:{session:lab.session}}),getUser:async()=>({data:{user:lab.session.user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),updateUser:async()=>({})},from(){const q={then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};for(const n of ['select','eq','order','in','gte','lte','limit','maybeSingle','single'])q[n]=()=>q;return q;},channel(name){lab.channels.push(name);const q={on:()=>q,subscribe:()=>q};return q;},removeChannel:async()=>{},storage:{from:()=>({createSignedUrl:async()=>({data:null}),createSignedUrls:async()=>({data:[]})})}};
window.supabase={createClient:()=>db};})();`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let url=new URL(req.url,'http://localhost'),base=url.pathname.startsWith('/base/')?'output/kja-035/base/':'';
  let relative=base?url.pathname.slice(6):url.pathname.slice(1);if(!relative||relative==='dashboard')relative='dashboard.html';
  const file=path.resolve(root,base,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[];
  try{
    for(const [version,url,width] of [['base','/base/dashboard.html',1440],['new','/dashboard.html',1440],['mobile','/dashboard.html',390]]){
      const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],resources=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().startsWith(origin)){try{resources.push({url:new URL(r.url()).pathname,bytes:(await r.body()).length})}catch{}}});
      await page.route('**/*',route=>{
        const url=route.request().url();if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:fixture});
        if(url.startsWith(origin))return route.continue();
        if(route.request().resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:'/* External library disabled in fixture. */'});
        if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:''});
        return route.fulfill({contentType:'application/json',body:'{"ok":false,"motivo":"sin_permiso"}'});
      });
      await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>typeof APP!=='undefined'&&APP.inicio&&document.querySelector('#portal').hidden===false);await page.waitForTimeout(1500);
      if(version!=='base'){
        assert.equal(await page.locator('[data-review-notification-trigger],#admin-message-modal,#admin-pausas-modal,.kja-chat').count(),0);
        // Pauses live in the profile rail, which the normal profile action exposes.
        await page.evaluate(()=>goView('perfil'));await page.locator('#rail-pausa-open').click();
        await page.waitForTimeout(350);await page.screenshot({path:path.join(out,version+'-selection.png'),animations:'disabled'});
        await page.locator('#pausa-card-visual .pausa-card-front').click();await page.locator('[data-start-break="visual"]').click();await page.screenshot({path:path.join(out,version+'-pausa.png')});
        const shown=(await page.locator('#pausa-timer-display').innerText()).split(':').map(Number);
        assert.ok(shown[0]*60+shown[1]<=600&&shown[0]*60+shown[1]>=570,'El contador avanza durante la captura');
        await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>typeof APP!=='undefined'&&APP.inicio&&document.querySelector('#portal').hidden===false);
        await page.evaluate(()=>goView('perfil'));await page.locator('#rail-pausa-open').click();assert.equal(await page.locator('#pausa-timer-display').count(),1);
        await context.setOffline(true);await page.locator('#pausa-btn-confirm-exit').click();await page.locator('#pausa-btn-exit-anyway').click();await page.locator('#pausa-card-movilidad .pausa-card-front').click();await page.locator('[data-start-break="movilidad"]').click();assert.match(await page.locator('#pausa-timer-display').innerText(),/^20:00$/);
        await page.keyboard.press('Escape');await context.setOffline(false);await page.evaluate(()=>goView('inicio'));
      }
      const before=await page.evaluate(()=>lab.calls.length);
      const result={version,width,errors,resources,initialCalls:await page.evaluate(()=>lab.calls),channels:await page.evaluate(()=>lab.channels)};
      results.push(result);
      if(version==='mobile'){await page.screenshot({path:path.join(out,'mobile-home.png')});result.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);}
      // Observe actual five-minute idle traffic concurrently, without production calls.
      if(version!=='mobile')result.idleStart=before;
      result._page=page;result._context=context;
    }
    const quick=process.argv.includes('--quick');
    fs.writeFileSync(path.join(out,quick?'browser-quick-start.json':'browser-start.json'),JSON.stringify(results.map(({_page,_context,...r})=>r),null,2));console.log('Started idle observation');
    for(let i=0;i<(quick?0:5);i++){await new Promise(r=>setTimeout(r,60000));console.log('Idle minute '+(i+1));}
    for(const r of results){
      await r._page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));});
      r.finalCalls=await r._page.evaluate(()=>lab.calls);r.channels=await r._page.evaluate(()=>lab.channels);r.errors=[...r.errors];assert.deepEqual(r.errors,[],r.version+' JavaScript errors');
      if(r.version!=='base')assert.equal(r.finalCalls.filter(c=>/chat_|notificacion|pausa/.test(c.name)).length,0);
      await r._context.close();delete r._page;delete r._context;
    }
    fs.writeFileSync(path.join(out,quick?'browser-quick-results.json':'browser-results.json'),JSON.stringify(results,null,2));console.log('Browser scenarios passed');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
