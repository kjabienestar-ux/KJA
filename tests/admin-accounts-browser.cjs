const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE||'C:/Users/piero/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),out=path.join(root,'output/kja-037');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('dashboard.html','utf8'),doc=new JSDOM(source).window.document;
const sidebar=doc.querySelector('.sidebar');sidebar.querySelectorAll('[data-view]').forEach(b=>{b.hidden=!['gestion','reclutamiento','admin-cuentas','cert-cuentas','zoom','marketing'].includes(b.dataset.view);});sidebar.querySelectorAll('.side-nav-divider').forEach(x=>x.hidden=!['admin-nav-divider','sys-nav-divider'].includes(x.id));
const view=doc.querySelector('#view-admin-cuentas');view.hidden=false;
const fixture=`
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
window.APP={sessionUid:id(1),access:{superadmin:true,acceso_panel:true},view:'admin-cuentas'};
window.$=id=>document.getElementById(id);
window.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.lab={fail:false,calls:[],rows:[
{id:id(1),nombre:'Piero',email:'piero@example.test',rol:'direccion',estado:'activa',superadmin:true,puesto:1},
{id:id(2),nombre:'Yeiser',email:'yeiser@example.test',rol:'direccion',estado:'activa',superadmin:true,puesto:2},
{id:id(3),nombre:'Erika Moreno',email:'erika@example.test',rol:'direccion',estado:'activa',superadmin:false},
{id:id(4),nombre:'Fabrizio Ibáñez',email:'fabrizio@example.test',rol:'editor',estado:'activa',superadmin:false},
{id:id(5),nombre:'Cuenta suspendida',email:'suspendida@example.test',rol:'visor',estado:'suspendida',superadmin:false},
{id:id(6),nombre:'Cuenta archivada',email:'archivo@example.test',rol:'visor',estado:'archivada',superadmin:false}
]};
window.db={rpc:async name=>lab.fail?{error:{code:'offline'}}:{data:name==='dash_arranque'?{inicio:{ok:true},acceso:APP.access}:{ok:true,cuentas:lab.rows,historial:[{accion:'suspender',resultado:'completada',actor:'Piero',cuenta:'Cuenta suspendida',motivo:'Acceso en revisión',creado_at:'2026-11-13T15:00:00Z'}]}},auth:{getSession:async()=>({data:{session:{user:{id:APP.sessionUid}}}})},functions:{invoke:async(name,{body})=>{
 lab.calls.push({...body,password:body.password?'[omitted]':undefined,current_password:body.current_password?'[omitted]':undefined});
 if(lab.fail)return {error:{context:{json:async()=>({error:'Error de ensayo. Puedes reintentar.'})}}};
 if(body.action==='buscar')return {data:{ok:true,existe:body.email==='existing@example.test',id:id(8),confirmada:true,tiene_perfil:false,tecnica:false}};
 const person=lab.rows.find(p=>p.id===body.id);
 if(body.action==='suspender')person.estado='suspendida';if(body.action==='reactivar')person.estado='activa';
 if(body.action==='archivar'){if(body.confirmar_email!==person.email)return {error:{context:{json:async()=>({error:'Escribe el correo de la cuenta para archivar.'})}}};person.estado='archivada';}
 if(body.action==='restaurar')person.estado='suspendida';
 if(body.action==='crear')lab.rows.push({id:id(8),nombre:body.nombre,email:body.email,rol:body.rol,estado:'activa',superadmin:false});
 return {data:{ok:true}};
}}};
window.goView=v=>{APP.view=v;if(v==='gestion')document.querySelector('#view-admin-cuentas').hidden=true;};
window.toast=()=>{};window.logout=()=>{lab.loggedOut=true;};window.openPortal=()=>{};
`;
const pageHtml=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${[...doc.querySelectorAll('link[rel=stylesheet]')].map(x=>x.outerHTML).join('')}<style>body{margin:0}.portal{display:block!important}.workspace{margin-left:230px!important;padding:0!important;min-height:100vh}.sidebar{width:230px!important}#view-admin-cuentas{display:block}#portal{background:#fbf7f1}</style></head><body><div id="portal" class="portal admin-wide" data-role="sistemas" data-access="direccion">${sidebar.outerHTML}<main class="workspace">${view.outerHTML}</main></div><script>${fixture}</script><script src="/assets/js/dashboard-admin-accounts.js"></script><script>KJAAdminAccounts.bootstrap(true);KJAAdminAccounts.load();</script></body></html>`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/full'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(source);}
 if(url.pathname==='/fixture'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(pageHtml);}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[];
 try{
  for(const width of [1280,1366,1440]){
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   await page.goto(base+'/fixture');await page.getByRole('heading',{name:'Erika Moreno'}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow '+width);
   await page.screenshot({path:path.join(out,'cuentas-'+width+'.png'),fullPage:true});
   const superCard=page.locator('.aa-card').filter({has:page.getByRole('heading',{name:'Piero',exact:true})});assert.equal(await superCard.getByRole('button',{name:'Suspender acceso'}).count(),0);
   await page.getByRole('button',{name:'Crear administrador',exact:true}).click();await page.getByLabel('Nombre',{exact:true}).fill('Nueva administradora');await page.getByLabel('Correo de acceso').fill('new@example.test');
   await page.getByRole('button',{name:'Comprobar correo'}).click();await page.getByText('Correo disponible para una nueva cuenta.').waitFor();
   assert.equal(await page.getByLabel('Permiso administrativo').inputValue(),'visor');
   await page.getByLabel('Contraseña inicial',{exact:true}).fill('Private password for test');await page.getByLabel('Confirmar contraseña',{exact:true}).fill('Different password');await page.getByLabel('Motivo',{exact:true}).fill('Alta de ensayo');
   await page.locator('#aa-save').click();await page.getByText('Las contraseñas no coinciden.').waitFor();
   await page.getByLabel('Confirmar contraseña',{exact:true}).fill('Private password for test');await page.locator('#aa-save').click();await page.getByRole('heading',{name:'Nueva administradora',exact:true}).waitFor();
   assert.equal(await page.locator('#aa-password').count(),0);
   const erika=page.locator('.aa-card').filter({has:page.getByRole('heading',{name:'Erika Moreno',exact:true})});
   await erika.getByRole('button',{name:'Restablecer contraseña'}).click();await page.getByLabel('Nueva contraseña',{exact:true}).fill('Private password for test');await page.keyboard.press('Escape');assert.equal(await page.locator('#aa-password').count(),0);assert.equal(await erika.getByRole('button',{name:'Restablecer contraseña'}).evaluate(el=>el===document.activeElement),true);
   await erika.getByRole('button',{name:'Suspender acceso'}).click();await page.getByLabel('Motivo',{exact:true}).fill('Suspensión de ensayo');await page.locator('#aa-save').click();await erika.waitFor({state:'detached'});
   await page.getByRole('button',{name:/Suspendidas y archivadas/}).click();
   const suspended=page.locator('.aa-card').filter({has:page.getByRole('heading',{name:'Erika Moreno',exact:true})});await suspended.locator('summary').click();await suspended.getByRole('button',{name:'Archivar cuenta'}).click();await page.getByLabel('Escribe el correo').fill('wrong@example.test');await page.getByLabel('Motivo',{exact:true}).fill('Archivo de ensayo');await page.locator('#aa-save').click();await page.getByText('Escribe el correo de la cuenta para archivar.',{exact:true}).waitFor();
   await page.getByLabel('Escribe el correo').fill('erika@example.test');await page.locator('#aa-save').click();await suspended.getByText('Archivada',{exact:true}).waitFor();
   await suspended.getByRole('button',{name:'Restaurar como suspendida'}).click();await page.getByLabel('Motivo',{exact:true}).fill('Restauración de ensayo');await page.locator('#aa-save').click();await suspended.getByRole('button',{name:'Reactivar acceso'}).waitFor();
   await page.getByRole('button',{name:/Activas/}).click();await page.getByRole('button',{name:'Delegar mi rol',exact:true}).click();await page.getByLabel('Nuevo superadministrador').selectOption('00000000-0000-0000-0000-000000000004');await page.getByLabel('Confirma tu contraseña actual').fill('Current private password');await page.getByLabel('Motivo',{exact:true}).fill('Relevo de ensayo');await page.screenshot({path:path.join(out,'delegacion-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');
   await page.evaluate(()=>lab.fail=true);await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByText('Las cuentas no están disponibles.',{exact:false}).waitFor();assert.equal(await page.locator('.aa-card').count(),0);
   await page.evaluate(()=>{lab.fail=false;});await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('heading',{name:'Fabrizio Ibáñez'}).waitFor();
   await page.evaluate(()=>KJAAdminAccounts.bootstrap(false));assert.equal(await page.locator('#nav-admin-cuentas').isHidden(),true);
   assert.deepEqual(errors,[]);results.push({width,passed:true,errors});await page.close();
  }
  const full=await browser.newPage({viewport:{width:1440,height:1000}}),fullErrors=[];full.on('pageerror',e=>fullErrors.push(e.message));
  await full.route('**/*',route=>{
   if(route.request().url().includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:`(()=>{${fixture}
    window.db.rpc=async name=>({data:name==='dash_arranque'?{inicio:{ok:true,perfil:{nombre:'Piero',nivel:'sistemas'},colaborador:null},acceso:{rol:'direccion',acceso_panel:true,superadmin:true}}:name==='dash_admin_cuentas'?{ok:true,cuentas:lab.rows,historial:[]}:{ok:true,fecha:'2026-11-13',personas:[],areas:[],datos:[],filas:[],dias:[],totales:{},cuentas:[],eventos:[],solicitudes:[],asignaciones:[],entregas:[],requisitos:[]}});
    window.db.auth.getSession=async()=>({data:{session:{user:{id:id(1),user_metadata:{}},access_token:'fixture'}}});
    window.db.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}});
    window.db.from=()=>{const q={then:r=>Promise.resolve({data:[],error:null}).then(r)};for(const name of ['select','eq','order','in','gte','lte','limit','maybeSingle','single'])q[name]=()=>q;return q;};
    window.db.channel=()=>{const q={on:()=>q,subscribe:()=>q};return q;};window.db.removeChannel=async()=>{};
    window.db.storage={from:()=>({createSignedUrl:async()=>({data:null}),createSignedUrls:async()=>({data:[]})})};
    window.supabase={createClient:()=>window.db};
   })();`});
   return route.request().url().startsWith(base)?route.continue():route.abort();
  });
  await full.goto(base+'/full');await full.locator('#nav-admin-cuentas').waitFor({state:'visible'});await full.locator('#nav-admin-cuentas').click();await full.getByRole('heading',{name:'Erika Moreno',exact:true}).waitFor();
  assert.equal(await full.locator('#view-admin-cuentas').isVisible(),true);assert.equal(await full.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await full.screenshot({path:path.join(out,'integracion-dashboard-1440.png'),fullPage:true});
  assert.deepEqual(fullErrors,[]);results.push({integration:'full-dashboard',passed:true,errors:fullErrors});await full.close();
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
