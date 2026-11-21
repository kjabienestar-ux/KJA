/* Vista de revisión local. Usa el DOM, estilos y funciones de producción con
   datos ficticios. No carga sesiones ni se conecta a Supabase. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function frame(){
  const dom=new JSDOM(read('dashboard.html')),doc=dom.window.document;
  const base=doc.createElement('base');base.href='/';doc.head.prepend(base);
  doc.querySelectorAll('script').forEach(script=>script.remove());
  doc.querySelector('#access').remove();
  const portal=doc.querySelector('#portal');portal.hidden=false;portal.removeAttribute('inert');portal.removeAttribute('aria-hidden');
  portal.classList.add('admin-wide');
  Object.assign(portal.dataset,{view:'gestion',adminSection:'overview',adminLateral:'true',adminRail:'icons',access:'direccion',role:'sistemas'});
  doc.body.dataset.adminSection='overview';
  doc.querySelectorAll('.view').forEach(view=>{view.hidden=view.id!=='view-gestion';view.classList.toggle('active',view.id==='view-gestion')});
  const view=doc.querySelector('#view-gestion');view.hidden=false;
  view.querySelectorAll(':scope > [id^="admin-"]').forEach(section=>{section.hidden=section.id!=='admin-overview-section'});
  doc.querySelectorAll('.boot-screen,[id="boot"],#loading-screen').forEach(node=>node.remove());
  doc.querySelector('#admin-role-chip').textContent='Dirección';
  doc.querySelector('#admin-role-chip').hidden=false;
  doc.querySelector('#admin-lateral').hidden=false;
  const breadcrumbs=doc.querySelector('#view-gestion [data-admin-breadcrumb]');breadcrumbs.hidden=false;
  breadcrumbs.innerHTML='<li>Gestión de asistencia</li><li>Operación diaria</li><li aria-current="page">Resumen operativo</li>';
  doc.querySelectorAll('#sidebar button[data-view]').forEach(button=>{button.hidden=!['gestion','marketing','zoom','perfil','reclutamiento','admin-cuentas','cert-cuentas'].includes(button.dataset.view)});
  doc.querySelector('#side-name').textContent='Cuenta de revisión';
  doc.querySelector('#side-role').textContent='Datos ficticios';
  doc.querySelectorAll('[data-lateral-section]').forEach(button=>button.classList.toggle('active',button.dataset.lateralSection==='overview'));
  const source=read('assets/js/dashboard.js');
  const production=source.slice(source.indexOf('function renderAdminOverviewCharts('),source.indexOf('function adminListMsg('))+
    source.slice(source.indexOf('const ADMIN_SECTION_CONTAINERS='),source.indexOf('async function showAdminSection('));
  const fixture=read('tests/fixtures/overview-context-preview.js');
  const script=doc.createElement('script');script.src='/assets/js/dashboard-skeleton.js';doc.body.append(script);
  const app=doc.createElement('script');app.textContent=fixture+'\n'+production+'\npreviewOverview("loading");';doc.body.append(app);
  const style=doc.createElement('style');style.textContent='.portal-boot,.dashboard-boot,#portal-boot,#app-boot{display:none!important}';doc.head.append(style);
  const result=dom.serialize();dom.window.close();return result;
}
const shell=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Revisión local · Resumen operativo</title><style>
body{margin:0;font:14px system-ui;background:#f2f0ec;color:#292927}header{box-sizing:border-box;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 16px;min-height:52px;border-bottom:1px solid #d7d4ce}strong{margin-right:auto;font-weight:500}button{font:inherit;padding:6px 12px;border:1px solid #bcb8b0;border-radius:6px;background:#fff;color:#292927;cursor:pointer}button:focus-visible{outline:3px solid #387ab3;outline-offset:2px}iframe{display:block;border:0;width:100%;height:calc(100vh - 53px)}
</style><header><strong>Resumen operativo · revisión local con datos ficticios</strong><button data-mode="loading">Ver esqueleto</button><button data-mode="data">Ver contenido</button><button data-mode="refresh">Actualizar</button><button data-mode="error">Simular error</button></header><iframe src="/__overview/frame" title="Resumen operativo de escritorio"></iframe><script>
document.querySelectorAll('button').forEach(button=>button.onclick=()=>document.querySelector('iframe').contentWindow.previewOverview(button.dataset.mode));
</script></html>`;
function createServer(){
  return http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__overview'||url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(shell)}
    if(url.pathname==='/__overview/frame'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(frame())}
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
    const file=path.resolve(root,relative==='dashboard'?'dashboard.html':relative);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end()}
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  });
}
if(require.main===module){
  const port=Number(process.env.PORT||3010),server=createServer();
  server.listen(port,'127.0.0.1',()=>console.log(`Revisión local: http://localhost:${port}/__overview`));
}
module.exports={createServer};
