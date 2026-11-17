// Ensayo de escritorio con el dashboard y exportadores reales; RPC ficticios, sin sesión remota.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixtureData,bootstrapSource,helperSource,moduleSource,date} from './helpers/seguimiento-fixture.mjs';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {chromium}=playwright;
const root=process.cwd(),out=path.join(root,'output/kja-039/descargas-unificadas');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('dashboard.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dashboardSource=fs.readFileSync('assets/js/dashboard.js','utf8');
const routerSource=dashboardSource.slice(dashboardSource.indexOf('async function showAdminSection('),dashboardSource.indexOf('const ADMIN_CALENDAR='));
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/preview'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:process.env.KJA_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
const results=[];
try{
  for(const [width,height] of [[1440,1000],[1280,900],[1366,768],[1280,600]]){
    const page=await browser.newPage({viewport:{width,height},acceptDownloads:true}),errors=[],downloads=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
    await page.route('https://**',route=>route.abort());
    await page.goto('http://127.0.0.1:'+server.address().port+'/preview');
    await page.addScriptTag({content:bootstrapSource});
    await page.evaluate(data=>{
      window.fixtureData=data;window.fixtureDelay=0;window.fixtureFail=false;
      window.db={rpc:async(name,args)=>{
        if(window.fixtureDelay)await new Promise(r=>setTimeout(r,window.fixtureDelay));
        if(window.fixtureFail)return {error:{message:'offline'}};
        const result=structuredClone(data[name]);result.fecha=args.p_fecha;return {data:result};
      }};
      const portal=document.getElementById('portal');portal.hidden=false;portal.inert=false;portal.removeAttribute('aria-hidden');portal.classList.add('admin-wide');
      Object.assign(portal.dataset,{view:'gestion',adminSection:'seguimiento',adminLateral:'true'});document.body.dataset.adminSection='seguimiento';document.getElementById('boot')?.remove();
      document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-gestion');document.getElementById('admin-lateral').hidden=false;document.getElementById('admin-control-tab').hidden=false;
      window.withAdminSkeleton=(section,fn)=>fn();window.setInterval=()=>0;
      document.querySelector('[data-lateral-section="seguimiento"]').classList.add('active');
      document.querySelectorAll('.admin-lateral-family').forEach(f=>{if(f.dataset.family!=='operacion')f.classList.add('is-folded');});document.getElementById('admin-role-chip').textContent='Dirección';
      document.querySelectorAll('.skip-link').forEach(el=>el.remove());
    },fixtureData());
    await page.addScriptTag({content:helperSource});
    for(const file of ['dashboard-area-picker.js','dashboard-date-picker.js','facebook-report-excel.js','seguimiento-excel.js'])await page.addScriptTag({content:fs.readFileSync('assets/js/'+file,'utf8')});
    await page.addScriptTag({content:moduleSource});await page.addScriptTag({content:routerSource});await page.addScriptTag({content:fs.readFileSync('assets/js/dashboard-admin-lateral.js','utf8')});
    await page.evaluate(()=>showAdminSection('seguimiento'));
    const dialog=page.locator('#seg-download-dialog'),shots=[];
    const shot=async label=>{
      const bounds=await dialog.evaluate(d=>{
        const r=d.getBoundingClientRect();
        const controlsOutside=d.open?[...d.querySelectorAll('button')].filter(b=>b.getClientRects().length).filter(b=>{const box=b.getBoundingClientRect();return box.top<0||box.bottom>innerHeight||box.left<r.left||box.right>r.right;}).map(b=>b.textContent.trim()||b.getAttribute('aria-label')):[];
        return {open:d.open,x:r.x,y:r.y,width:r.width,height:r.height,overflow:d.scrollWidth>d.clientWidth+1,verticalOverflow:d.open&&d.scrollHeight>d.clientHeight+1,clipped:d.open&&(r.top<0||r.bottom>innerHeight),controlsOutside};
      });
      assert.equal(bounds.overflow,false,label+' horizontal');assert.equal(bounds.verticalOverflow,false,label+' contenido vertical');assert.equal(bounds.clipped,false,label+' vertical');assert.deepEqual(bounds.controlsOutside,[],label+' acciones fuera de vista');
      if(width===1440)await page.screenshot({path:path.join(out,label+'.png')});shots.push({label,...bounds});
    };
    await shot('01-boton');assert.equal(await page.locator('.seg-excel').count(),0);
    await page.locator('#seg-export').click();await shot('02-elegir-archivo');
    await page.locator('[data-download="xlsx"]').click();await shot('03-excel-dia');
    const trigger=dialog.locator('.kja-date-trigger'),calendar=dialog.locator('#seg-from-popup');
    assert.equal(await trigger.isVisible(),false);assert.equal(await calendar.isVisible(),true);assert.equal(await page.locator('#seg-x-download').isDisabled(),true);
    await calendar.locator('[data-nav="-1"]').click();await calendar.locator('[data-nav="-1"]').click();
    assert.equal(await calendar.locator('.kja-date-title').innerText(),'Agosto 2026');await shot('03b-calendario-seis-filas');
    await page.locator('#seg-search').evaluate(input=>{input.value='Nombre de búsqueda extenso '.repeat(12);input.dispatchEvent(new Event('input'));});await shot('03c-filtro-largo-seis-filas');
    await page.locator('#seg-search').evaluate(input=>{input.value='';input.dispatchEvent(new Event('input'));});
    await calendar.locator('[data-nav="1"]').click();await calendar.locator('[data-nav="1"]').click();
    await calendar.locator('[data-date="2026-10-27"]').focus();await page.keyboard.press('Space');
    assert.equal(await calendar.locator('[data-date="2026-10-27"]').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('#seg-x-from').inputValue(),date);await calendar.locator('.kja-date-close').click();assert.equal(await page.locator('#seg-x-from').inputValue(),date);assert.equal(await calendar.isVisible(),true);
    await dialog.locator('[data-period="week"]').click();assert.equal(await calendar.isVisible(),true);await calendar.locator('[data-date="2026-10-19"]').click();await shot('04-excel-semana');await calendar.locator('.kja-date-apply').click();assert.equal(await calendar.isVisible(),true);assert.equal(await page.locator('#seg-x-download').isDisabled(),false);
    assert.equal(await page.locator('#seg-x-from').inputValue(),'2026-10-19');assert.equal(await page.locator('#seg-x-to').inputValue(),'2026-10-25');
    await dialog.locator('[data-period="range"]').click();assert.equal(await page.locator('#seg-x-download').isDisabled(),true);await calendar.locator('[data-date="2026-10-20"]').click();await calendar.locator('[data-date="2026-10-27"]').click();await shot('05-excel-rango');await calendar.locator('.kja-date-apply').click();assert.equal(await calendar.isVisible(),true);
    await page.evaluate(()=>window.fixtureDelay=450);let pendingDownload=page.waitForEvent('download');await page.locator('#seg-x-download').click();await shot('06-preparando');
    const xlsx=await pendingDownload;const bytes=fs.readFileSync(await xlsx.path());assert.equal(bytes.subarray(0,2).toString(),'PK');assert.ok(bytes.includes(Buffer.from('Detalle de asistencia')));await shot('07-descargado');
    await page.locator('#seg-x-download').click();await page.locator('#seg-export').click();await page.locator('[data-download="csv"]').click();await shot('08-csv');
    assert.equal(await calendar.isVisible(),true);await calendar.locator('[data-date="2026-10-27"]').click();await calendar.locator('.kja-date-apply').click();
    pendingDownload=page.waitForEvent('download');await page.locator('#seg-x-download').click();const csv=await pendingDownload;const text=fs.readFileSync(await csv.path(),'utf8');assert.ok(text.includes('2026-10-27'));assert.ok(text.includes('Jorge Ruiz'));assert.equal(await page.locator('#seg-date').inputValue(),date);
    await page.locator('#seg-x-download').click();await page.evaluate(()=>{window.fixtureFail=true;window.fixtureDelay=0;});await page.locator('#seg-export').click();await page.locator('[data-download="xlsx"]').click();await calendar.locator('[data-date="2026-10-28"]').click();await calendar.locator('.kja-date-apply').click();await page.locator('#seg-x-download').click();await page.locator('#seg-download-dialog[data-stage="error"]').waitFor();await shot('09-error');
    await page.evaluate(()=>window.fixtureFail=false);pendingDownload=page.waitForEvent('download');await page.locator('#seg-x-download').click();await pendingDownload;
    await page.locator('#seg-x-download').click();
    await page.locator('#seg-search').fill('sin coincidencias');await page.locator('#seg-export').click();await page.locator('[data-download="xlsx"]').click();await calendar.locator('[data-date="2026-10-28"]').click();await calendar.locator('.kja-date-apply').click();await page.locator('#seg-x-download').click();await page.locator('#seg-download-dialog[data-stage="empty"]').waitFor();await shot('10-sin-datos');
    await page.locator('#seg-x-download').click();await dialog.locator('[data-period="range"]').click();await page.locator('#seg-x-from').evaluate(input=>{input.value='2026-01-01';input.dispatchEvent(new Event('change'));});await shot('11-rango-invalido');assert.equal(await page.locator('#seg-x-download').isDisabled(),true);
    await calendar.locator('[data-nav="-1"]').click();await calendar.locator('[data-nav="-1"]').click();await shot('11b-rango-invalido-seis-filas');
    await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#seg-export').evaluate(el=>el===document.activeElement),true);
    await page.locator('#seg-search').fill('');await page.locator('#seg-export').click();await page.locator('[data-download="xlsx"]').click();assert.equal(await calendar.isVisible(),true);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
    await page.evaluate(()=>window.fixtureDelay=600);await page.locator('#seg-export').click();await page.locator('[data-download="xlsx"]').click();await calendar.locator('[data-date="2026-10-28"]').click();await calendar.locator('.kja-date-apply').click();await page.locator('#seg-x-download').click();await dialog.locator('.seg-d-close').click();await page.waitForTimeout(700);assert.equal(downloads.length,3);
    assert.equal(errors.length,0,errors.join('\n'));results.push({width,height,shots,downloads,errors});await page.close();
  }
  fs.writeFileSync(path.join(out,'verificacion.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({width,height,shots,downloads,errors})=>({width,height,maxModalHeight:Math.max(...shots.map(s=>s.height)),verticalOverflow:shots.some(s=>s.verticalOverflow),downloads,errors})),null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
