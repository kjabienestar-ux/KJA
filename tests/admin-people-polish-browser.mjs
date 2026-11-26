// KJA-051: the actual desktop directory and the profile it opens. No remote data or writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';

const origin='http://localhost:3000',out=path.resolve('.tmp/kja-051-polish');
fs.mkdirSync(out,{recursive:true});
const data=adminDataFixture();
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};');
const adapter='const rpc=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=rpc(...args);p.abortSignal=()=>p;return p;};';
const styles=(loc,props)=>loc.evaluate((n,p)=>Object.fromEntries(p.map(k=>[k,getComputedStyle(n)[k]])),props);
const cream='rgb(255, 253, 249)',ink='rgb(56, 49, 43)',green='rgb(82, 121, 102)',accent='rgb(147, 71, 47)',tint='rgb(242, 226, 213)';
const browser=await chromium.launch({channel:'msedge'});
try{for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=route.request().url();if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';'+fake+adapter});return u.startsWith(origin+'/')&&route.request().method()==='GET'?route.continue():route.fulfill({body:''});});
  const response=await page.goto(origin+'/dashboard');assert.equal((await response.text()).trim(),fs.readFileSync('dashboard.html','utf8').trim());
  await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
  await page.locator('[data-lateral-section="colaboradores"]').click();await page.locator('#admin-people-section[aria-busy="false"]').waitFor();
  const card=page.locator('.pw-card').first(),profile=card.locator('[data-team-profile]');await card.waitFor();
  assert.deepEqual(await styles(card,['backgroundColor','color','boxShadow']),{backgroundColor:cream,color:ink,boxShadow:'none'});
  assert.ok(parseFloat((await styles(card.locator('.pw-card-data dt').first(),['fontSize'])).fontSize)>=11);
  const more=page.locator('.pw-more-filters>summary');await more.press('Enter');const menu=page.locator('.pw-more-filters>div');await menu.waitFor();
  assert.deepEqual(await styles(menu,['backgroundColor','borderTopLeftRadius']),{backgroundColor:cream,borderTopLeftRadius:'18px'});
  await more.press('Enter');await menu.waitFor({state:'hidden'});
  await page.evaluate(id=>peopleHighlightCard(id),await profile.getAttribute('data-team-profile'));
  await card.waitFor();assert.ok(await card.evaluate(n=>n.classList.contains('pw-card-updated')),'El resaltado permanece en la fila de origen');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.pw-card-updated')).backgroundColor==='rgb(242, 226, 213)',null,{timeout:1000});
  assert.deepEqual(await styles(card,['backgroundColor','animationName']),{backgroundColor:tint,animationName:'none'});
  assert.match((await styles(card,['boxShadow'])).boxShadow,/147, 71, 47/);
  await page.waitForFunction(()=>!document.querySelector('.pw-card-updated'));
  await profile.press('Enter');const dialog=page.locator('#pw-profile-dialog');await dialog.waitFor();
  const firstTab=dialog.getByRole('tab',{name:'Resumen'});await firstTab.press('ArrowRight');const schedule=dialog.getByRole('tab',{name:'Jornada'});
  assert.equal(await schedule.getAttribute('aria-selected'),'true');assert.equal(await schedule.evaluate(n=>document.activeElement===n),true);
  assert.deepEqual(await styles(schedule,['outlineColor','outlineWidth','outlineOffset','borderBottomColor']),{outlineColor:green,outlineWidth:'2px',outlineOffset:'-2px',borderBottomColor:accent});
  assert.deepEqual(await styles(dialog.locator('.pw-modal-head'),['backgroundColor']),{backgroundColor:cream});
  assert.deepEqual(await styles(dialog.locator('.pw-week thead').first(),['backgroundColor']),{backgroundColor:'rgb(240, 236, 229)'});
  assert.ok(parseFloat((await styles(dialog.locator('.pw-week thead').first(),['fontSize'])).fontSize)>=11);
  const geometry=await dialog.evaluate(n=>({width:n.scrollWidth,client:n.clientWidth,rect:n.getBoundingClientRect().toJSON(),body:n.querySelector('.pw-modal-body').scrollWidth,bodyClient:n.querySelector('.pw-modal-body').clientWidth}));
  assert.ok(geometry.width<=geometry.client+1&&geometry.body<=geometry.bodyClient+1&&geometry.rect.left>=0&&geometry.rect.right<=width,JSON.stringify(geometry));
  if(width===1440)await dialog.screenshot({path:path.join(out,'ficha-jornada.png')});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await profile.evaluate(n=>document.activeElement===n),true);
  assert.deepEqual(errors,[]);await page.close();console.log(`${width}px: directorio, filtros, aviso estable, ficha y teclado OK`);
}}finally{await browser.close();}
