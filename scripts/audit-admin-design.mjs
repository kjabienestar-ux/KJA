// Run from the repository root with the local portal serving this checkout.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {adminDataFixture, today} from '../tests/helpers/admin-data-fixture.mjs';
import {sampleIncompleteContrast} from './sample-admin-contrast.mjs';
import {designDigest} from './admin-audit-digest.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.KJA_PLAYWRIGHT_MODULE || 'playwright');
const origin = 'http://localhost:3000';
const output = path.resolve('.tmp/kja-051');
fs.mkdirSync(output, {recursive:true});
const data = adminDataFixture();
data.dash_admin_lista = {ok:true,fecha:today,puede_editar:true,personas:data.dash_admin_cierres.personas.map(p=>({...p,modalidad:'virtual',hora_entrada:'08:00',hora_salida:'13:00',horas:5}))};
const fixture = fs.readFileSync('tests/fixtures/seguimiento-app.js','utf8').replace('window.supabase={createClient:()=>db};','lab.db=db;window.supabase={createClient:()=>db};');
const adapter = 'const rpc=seguimientoLab.db.rpc;seguimientoLab.db.rpc=(...args)=>{const p=rpc(...args);p.abortSignal=()=>p;return p;};';
const sections = {contratos:'contracts',colaboradores:'people',lista:'list',seguimiento:'seguimiento',overview:'overview',asignaciones:'assignments',roles:'roles',mes:'month',facebook:'facebook',ranking:'ranking',marcado:'access'};
const browser = await chromium.launch({channel:'msedge'});
const summary = {digest:designDigest(),browser:browser.version(),viewport:'1440x900',views:{},values:{}};
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.includes('supabase-js')) return route.fulfill({contentType:'text/javascript',body:'window.__SEGUIMIENTO_FIXTURE__='+JSON.stringify({data,date:today})+';'+fixture+adapter});
    if(url.includes('qrcode@')) return route.fulfill({contentType:'text/javascript',body:'window.QRCode={toCanvas:(c,t,o,done)=>done(null)};'});
    return url.startsWith(origin+'/') && route.request().method()==='GET' ? route.continue() : route.fulfill({body:''});
  });
  const response = await page.goto(origin+'/dashboard');
  if(!response.ok() || (await response.text()).trim()!==fs.readFileSync('dashboard.html','utf8').trim()) throw Error('El portal servido difiere de la copia local.');
  await page.locator('#admin-overview-section[aria-busy="false"]').waitFor();
  const sampleContrast=process.argv.includes('--sample-contrast')||process.argv.includes('--check-sampled-contrast');
  const contrastAudit=sampleContrast||process.argv.includes('--audit-contrast')||process.argv.includes('--check-contrast');
  const decoder=sampleContrast?await browser.newPage():null;
  if(contrastAudit)await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const [name,section] of Object.entries(sections)){
    await page.locator('[data-lateral-section="'+name+'"]').click();
    const root=page.locator('#admin-'+section+'-section');
    await root.waitFor();
    await page.waitForFunction(id=>document.getElementById(id)?.getAttribute('aria-busy')==='false',await root.getAttribute('id'));
    await page.waitForTimeout(350);
    const refresh=page.locator('#admin-refresh');
    if(await refresh.isVisible()&&await refresh.isEnabled()){
      const state=await refresh.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,shadow:s.boxShadow};});
      if(state.background!=='rgb(255, 253, 249)'||state.color!=='rgb(54, 94, 74)'||state.shadow!=='none')throw Error(`${name}: Actualizar no usa la acción secundaria: ${JSON.stringify(state)}`);
    }
    const audit=await root.evaluate(node=>{
      const sets={},small=new Map(),painted=new Map();
      for(const el of [node,...node.querySelectorAll('*')]){
        if(!el.getClientRects().length) continue;
        const s=getComputedStyle(el);
        const direct=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).filter(Boolean).join(' ');
        // Unlike the comparable baseline (all computed properties), this extra
        // inventory counts only paint with a visible use. A zero-width border's
        // inherited color is not an additional painted surface.
        if(s.visibility==='visible'&&!el.closest('[hidden],.sr-only,[aria-hidden=true]')){
          const classes=typeof el.className==='string'?el.className:el.getAttribute('class')||'';
          const parent=el.parentElement?.id||el.parentElement?.getAttribute('class')||'';
          const paint=(property,value)=>{if(!value||value==='rgba(0, 0, 0, 0)'||value==='transparent')return;const k=property+'|'+value,row=painted.get(k)??{property,value,count:0,samples:[]};row.count++;if(row.samples.length<5&&!row.samples.some(x=>x.classes===classes&&x.tag===el.tagName&&x.id===el.id))row.samples.push({tag:el.tagName,id:el.id,classes,parent,text:direct.slice(0,45)});painted.set(k,row);};
          if(direct||el.tagName.toLowerCase()==='svg')paint('color',s.color);
          if(s.backgroundColor!=='rgba(0, 0, 0, 0)')paint('backgroundColor',s.backgroundColor);
          if(parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none'&&s.borderTopStyle!=='hidden')paint('borderTopColor',s.borderTopColor);
          if(s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.backgroundImage!=='none'||parseFloat(s.borderTopWidth)>0){
            for(const radius of new Set([s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius]))if(radius!=='0px')paint('radius',radius);
          }
          if(s.boxShadow!=='none')paint('shadow',s.boxShadow);
        }
        if(direct&&parseFloat(s.fontSize)<11&&s.visibility==='visible'&&!el.closest('[aria-hidden=true],svg,.sr-only')){
          const key=[el.tagName,el.id,typeof el.className==='string'?el.className:'',s.fontSize].join('|');
          if(!small.has(key))small.set(key,{tag:el.tagName,id:el.id,classes:typeof el.className==='string'?el.className:'',size:s.fontSize,sample:direct.slice(0,70)});
        }
        for(const [key,props] of Object.entries({colors:['color','backgroundColor','borderTopColor'],radii:['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius'],shadows:['boxShadow'],fonts:['fontSize'],families:['fontFamily'],spacing:['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','columnGap']})){
          const group=sets[key]??=new Set();
          for(const prop of props) group.add(s[prop]);
        }
      }
      return {values:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,[...v].sort()])),smallText:[...small.values()],painted:[...painted.values()]};
    });
    await page.screenshot({path:path.join(output,name+'.png')});
    const metricRegion={contratos:'#admin-contract-kpis',colaboradores:'#admin-people-kpis',lista:'#admin-list-kpis',seguimiento:'#seg-summary'}[name];
    if(metricRegion) await page.locator(metricRegion).screenshot({path:path.join(output,'metric-'+name+'.png')});
    summary.views[name]=audit.values;
    (summary.painted??={})[name]=audit.painted;
    (summary.smallText??={})[name]=audit.smallText;
    if(contrastAudit){
      const report=await root.evaluate(async node=>{
        const result=await window.axe.run(node,{runOnly:{type:'rule',values:['color-contrast']}});
        const summarize=rules=>rules.flatMap(rule=>rule.nodes.map(n=>({target:n.target.join(' '),summary:n.failureSummary??'',checks:[...n.any,...n.all,...n.none].map(c=>({id:c.id,data:c.data,message:c.message}))})));
        return {evaluated:result.passes.length+result.violations.length+result.incomplete.length>0,violations:summarize(result.violations),incomplete:summarize(result.incomplete)};
      });
      (summary.contrast??={})[name]=report;
      if(sampleContrast){
        report.sampled=await sampleIncompleteContrast(page,root,decoder,report.incomplete);
        console.log(name,'· fondos muestreados:',Object.fromEntries(['pass','fail','review'].map(status=>[status,report.sampled.filter(r=>r.status===status).length])));
      }
    }
  }
  for(const key of Object.keys(summary.views.contratos)) summary.values[key]=[...new Set(Object.values(summary.views).flatMap(view=>view[key]))].sort();
  if(designDigest()!==summary.digest)throw Error('El código cambió durante la auditoría; repetir.');
  fs.writeFileSync(path.join(output,'baseline.json'),JSON.stringify(summary,null,2));
  console.log(summary.browser,Object.fromEntries(Object.entries(summary.values).map(([k,v])=>[k,v.length])));
  if(contrastAudit){
    const reports=Object.entries(summary.contrast);
    // axe classifies several one-letter labels and counts as shortTextContent
    // requiring review even when it has calculated their exact ratio. Preserve
    // the review classification but require AA for those measurable labels.
    const shortFailures=r=>r.incomplete.filter(n=>n.checks.some(c=>{
      const d=c.data;if(d?.messageKey!=='shortTextContent'||!Number.isFinite(d.contrastRatio)||!d.fgColor||!d.bgColor)return false;
      const min=parseFloat(d.expectedContrastRatio||'4.5');return d.contrastRatio<min;
    }));
    console.log('Contraste efectivo por vista:',Object.fromEntries(reports.map(([view,r])=>[view,{violaciones:r.violations.length,textosCortosBajoAA:shortFailures(r).length,revisar:r.incomplete.length}])));
    if(process.argv.includes('--check-contrast')&&reports.some(([,r])=>!r.evaluated||r.violations.length||shortFailures(r).length))process.exitCode=1;
    if(process.argv.includes('--check-sampled-contrast')&&reports.some(([,r])=>!r.evaluated||r.violations.length||shortFailures(r).length||r.sampled.some(s=>s.status!=='pass')))process.exitCode=1;
  }
  if(process.argv.includes('--check-captions')){
    // Only the documented 10 px initials in compact avatars may be smaller than 11 px.
    const permitted=(view,item)=>item.size==='10px'&&item.tag==='SPAN'&&
      ((view==='ranking'&&item.classes.split(/\s+/).includes('rk-av-xs'))||
       (view==='marcado'&&item.classes.split(/\s+/).includes('avatar')))&&/^[\p{L}]{1,3}$/u.test(item.sample);
    const unexpected=Object.entries(summary.smallText).flatMap(([view,items])=>items.filter(item=>!permitted(view,item)).map(item=>({view,...item})));
    if(unexpected.length){console.error('Texto informativo inferior a 11 px:',unexpected);process.exitCode=1;}
    else console.log('Tipografía: sin captions informativos inferiores a 11 px en las once vistas.');
  }
} finally {await browser.close();}
