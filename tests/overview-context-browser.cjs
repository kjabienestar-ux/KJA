const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.KJA_PLAYWRIGHT_MODULE||'playwright');
const {createServer}=require('../scripts/preview-admin-overview.cjs');
const out=path.resolve('.tmp/kja-contexto');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
  try{
    for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
      const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>requests.push(request.url()));
      await page.goto(origin+'/__overview/frame',{waitUntil:'domcontentloaded'});
      await page.locator('#admin-status-list[data-kja-context-loading]').waitFor();
      const initial=await page.evaluate(()=>{
        const host=document.getElementById('admin-overview-section');
        const blocks=[...host.querySelectorAll('.kja-context-layer .kja-sk-block')];
        const panels=[...host.querySelectorAll('.admin-panel,.admin-overview-today')];
        const rect=host.getBoundingClientRect();
        return {fills:[...new Set(blocks.map(node=>getComputedStyle(node).backgroundColor))],
          animated:blocks.some(node=>getComputedStyle(node,'::after').animationName!=='none'),
          gradients:panels.map(node=>getComputedStyle(node).backgroundImage),
          overflow:document.documentElement.scrollWidth>innerWidth,
          height:rect.height,scrollHeight:host.scrollHeight,
          headings:[...host.querySelectorAll('h2')].map(node=>getComputedStyle(node).visibility),
          contexts:host.querySelectorAll('[data-kja-context-loading]').length};
      });
      assert.deepEqual(initial.fills,['rgb(231, 231, 231)']);
      assert.equal(initial.animated,true);assert.ok(initial.gradients.every(value=>value==='none'));
      assert.equal(initial.overflow,false);assert.ok(initial.headings.every(value=>value==='visible'));
      assert.equal(initial.contexts,6);assert.ok(initial.scrollHeight<=initial.height+2,'sin corte vertical '+width);
      await page.screenshot({path:path.join(out,`loading-${width}.png`)});
      await page.evaluate(()=>{void previewOverview('data')});
      await page.waitForFunction(()=>document.getElementById('admin-overview-section').getAttribute('aria-busy')==='false');
      assert.equal(await page.locator('.kja-context-layer').count(),0);
      await page.screenshot({path:path.join(out,`data-${width}.png`)});
      const before=await page.locator('#admin-status-list').innerHTML();
      await page.locator('.admin-panel-foot[data-admin-section="lista"]').focus();
      await page.evaluate(()=>{void previewOverview('refresh')});
      await page.locator('.is-context-refreshing').waitFor();
      assert.equal(await page.locator('#admin-overview-notice').isVisible(),false);
      assert.equal(await page.locator('.admin-overview-today>header').evaluate(n=>getComputedStyle(n,'::after').content),'none');
      assert.equal(await page.locator('#admin-status-list').innerHTML(),before);
      assert.equal(await page.locator('.kja-context-layer').count(),0);
      assert.equal(await page.evaluate(()=>document.activeElement.matches('.admin-panel-foot[data-admin-section="lista"]')),true);
      await page.screenshot({path:path.join(out,`refresh-${width}.png`)});
      await page.waitForFunction(()=>document.getElementById('admin-overview-section').getAttribute('aria-busy')==='false');
      await page.evaluate(()=>{void previewOverview('error')});
      await page.locator('#admin-overview-notice[data-tone="error"]:not([hidden])').waitFor();
      assert.equal(await page.locator('#admin-status-list').innerHTML(),before);
      await page.locator('[data-admin-overview-retry]').click();
      await page.waitForFunction(()=>document.getElementById('admin-overview-section').getAttribute('aria-busy')==='false');
      await page.evaluate(()=>{void previewOverview('partial')});
      await page.locator('#admin-request-list[data-kja-context-loading]').waitFor();
      assert.equal(await page.locator('#admin-status-list[data-kja-context-loading]').count(),0);
      await page.evaluate(()=>{void previewOverview('empty')});
      assert.match(await page.locator('#admin-request-list').innerText(),/No hay solicitudes/);
      assert.equal(await page.locator('.kja-context-layer').count(),0);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(()=>{void previewOverview('loading')});
      await page.locator('#admin-status-list[data-kja-context-loading]').waitFor();
      assert.equal(await page.locator('.kja-sk-block').first().evaluate(node=>getComputedStyle(node,'::after').animationName),'none');
      assert.deepEqual(errors,[]);
      assert.equal(requests.filter(url=>url.includes('supabase')).length,0);
      results.push({width,height,initial,errors,supabaseRequests:0,states:['loading','data','refresh','error','retry','partial','empty','reduced-motion']});
      await page.close();
    }
    fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
    console.log('Escritorio: 1280x720, 1440x900 y 1920x1080; ocho estados por tamaño; sin errores JS ni llamadas a Supabase.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
