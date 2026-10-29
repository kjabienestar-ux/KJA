// Vista local reproducible con datos ficticios. No autentica ni llama a Supabase.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fixtureData,bootstrapSource,helperSource,moduleSource} from './helpers/seguimiento-fixture.mjs';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright')}catch{
  playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const {chromium}=playwright;
const root=process.cwd(),out=path.join(root,'output/seguimiento-diario');
fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('dashboard.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dashboardSource=fs.readFileSync('assets/js/dashboard.js','utf8');
const routerSource=dashboardSource.slice(dashboardSource.indexOf('async function showAdminSection('),dashboardSource.indexOf('const ADMIN_CALENDAR='));
const report='<svg xmlns="http://www.w3.org/2000/svg" width="750" height="900"><rect width="750" height="900" fill="#fffefa"/><rect width="750" height="13" fill="#9b573b"/><text x="58" y="80" font-family="Georgia" font-size="33" fill="#352f28">Reporte de actividades</text><text x="58" y="119" font-family="Arial" font-size="16" fill="#6d6559">KJA · Marketing · 28 de octubre de 2026</text><rect x="56" y="153" width="638" height="84" rx="8" fill="#f0e9df"/><text x="76" y="188" font-family="Arial" font-size="18" fill="#352f28">María Díaz</text><text x="76" y="215" font-family="Arial" font-size="15" fill="#6d6559">Modalidad virtual · Jornada de la mañana</text>'+['Planificación de piezas para redes','Revisión de la campaña del equipo','Coordinación de contenidos','Informe de resultados'].map((s,i)=>'<line x1="56" y1="'+(290+i*115)+'" x2="694" y2="'+(290+i*115)+'" stroke="#ded6cb"/><text x="65" y="'+(326+i*115)+'" font-family="Arial" font-size="16" fill="#9b573b">0'+(i+1)+'</text><text x="110" y="'+(326+i*115)+'" font-family="Arial" font-size="18" fill="#352f28">'+s+'</text><text x="110" y="'+(354+i*115)+'" font-family="Arial" font-size="14" fill="#528170">Actividad completada</text>').join('')+'<text x="58" y="845" font-family="Arial" font-size="13" fill="#8b8276">DATOS FICTICIOS · PRUEBA LOCAL DE INTERFAZ</text></svg>';
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/preview'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return}
  if(url.pathname==='/fixture-file.svg'){res.setHeader('Content-Type','image/svg+xml');res.end(report);return}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
  const ext=path.extname(file);res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.KJA_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
const results=[];
try{
  for(const [width,height] of [[1920,1080],[1440,1000],[1280,900],[390,844]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',route=>route.abort());
    await page.goto(origin+'/preview',{waitUntil:'domcontentloaded'});
    await page.addScriptTag({content:bootstrapSource});
    await page.evaluate(data=>{
      window.fixtureData=data;
      window.db={rpc:async(name)=>({data:structuredClone(data[name])}),storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:location.origin+'/fixture-file.svg'}})})}};
      document.getElementById('portal').hidden=false;
      document.getElementById('boot')?.remove();
      document.getElementById('portal').inert=false;
      document.getElementById('portal').removeAttribute('aria-hidden');
      document.getElementById('portal').classList.add('admin-wide');
      Object.assign(document.getElementById('portal').dataset,{view:'gestion',adminSection:'seguimiento',adminLateral:'true'});
      document.body.dataset.adminSection='seguimiento';
      document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-gestion');
      document.getElementById('view-gestion').hidden=false;
      document.getElementById('admin-lateral').hidden=false;
      document.getElementById('admin-control-tab').hidden=false;
      window.withAdminSkeleton=(section,fn)=>fn();
      document.querySelector('[data-lateral-section="seguimiento"]').classList.add('active');
      document.querySelectorAll('.admin-lateral-family').forEach(f=>{if(f.dataset.family!=='operacion')f.classList.add('is-folded')});
      document.getElementById('admin-role-chip').textContent='Dirección';
      window.setInterval=()=>0;
    },fixtureData());
    await page.addScriptTag({content:helperSource});await page.addScriptTag({content:moduleSource});
    await page.addScriptTag({content:routerSource});
    await page.addScriptTag({content:fs.readFileSync('assets/js/dashboard-admin-lateral.js','utf8')});
    await page.evaluate(()=>showAdminSection('seguimiento'));
    await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('.skip-link').forEach(el=>el.remove())});
    await page.screenshot({path:path.join(out,'listado-'+width+'.png'),fullPage:true});
    await page.locator('[data-seg="person"][data-person="1"]').first().click();
    await page.locator('#seg-gallery img').waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(out,'revision-'+width+'.png'),fullPage:true});
    const bounds=await page.evaluate(()=>{
      const root=document.getElementById('admin-seguimiento-section'),box=root.getBoundingClientRect();
      return {pageOverflow:document.documentElement.scrollWidth>innerWidth,sectionOverflow:root.scrollWidth>root.clientWidth+1,width:box.width,height:box.height,background:getComputedStyle(root).backgroundColor};
    });
    results.push({viewportWidth:width,...bounds,errors});
    if(errors.length||bounds.pageOverflow||bounds.sectionOverflow)throw Error(JSON.stringify(results.at(-1)));
    await page.close();
  }
}finally{
  fs.writeFileSync(path.join(out,'verificacion-visual.json'),JSON.stringify(results,null,2));await browser.close();server.close();
}
console.log(JSON.stringify(results));
