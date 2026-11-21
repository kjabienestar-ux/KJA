import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {adminDataFixture,today} from './helpers/admin-data-fixture.mjs';
const {chromium}=createRequire(import.meta.url)('playwright'),origin='http://localhost:3000',out=path.resolve('.tmp/kja-048');
const fake=fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8'),browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{for(const role of ['direccion','visor'])for(const count of [1,5,6]){
 const data=adminDataFixture(),team=data.dash_admin_equipo;team.puede_editar=role==='direccion';
 team.personas=Array.from({length:count},(_,i)=>({...team.personas[0],id:i+1,nombre:'Persona de ensayo '+(i+1),area_id:1,area:'Equipo de ensayo'}));team.areas=[{id:1,nombre:'Equipo de ensayo',activo:true}];data.dash_admin_instituciones.personas=team.personas;
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const req=route.request(),url=req.url();if(url.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today,role})+';'+fake});if(url.startsWith(origin+'/'))return route.continue();return route.fulfill({body:''});});
 await page.goto(origin+'/dashboard');await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();await page.locator('[data-lateral-section="colaboradores"]').click();await page.locator('#admin-people-section[aria-busy="false"] .pw-card').first().waitFor();
 assert.equal(await page.locator('.pw-card').count(),count);const rects=await page.locator('.pw-card').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));assert.ok(rects.every((r,i)=>!i||r.top>=rects[i-1].bottom-1));
 assert.equal(await page.locator('.pw-card-edit').count(),role==='direccion'?count:0);assert.equal(await page.locator('#admin-new-person').isVisible(),role==='direccion');
 await page.locator('#admin-people-search').fill('ensayo 1');assert.equal(await page.locator('.pw-card').count(),1);assert.equal(await page.locator('#admin-people-search').evaluate(n=>document.activeElement===n),true);
 await page.locator('[data-lateral-section="contratos"]').click();await page.locator('#admin-contracts-section[aria-busy="false"] .admin-contract-row').first().waitFor();
 assert.equal(await page.locator('#admin-contracts-section [data-team-edit]').count(),role==='direccion'?count:0);
 if(role==='visor'){assert.equal(await page.locator('[data-lateral-section="roles"]').isVisible(),false);assert.equal(await page.locator('[data-lateral-section="marcado"]').isVisible(),false);}
 assert.deepEqual(errors,[]);results.push({role,count,rows:true,search:true,permissions:true,errors,realWrites:0});await page.close();
}fs.writeFileSync(path.join(out,'permissions-results.json'),JSON.stringify(results,null,2));console.log('Roles Dirección/visor y grupos de 1, 5 y 6 personas: OK, sin escrituras.');}finally{await browser.close();}
