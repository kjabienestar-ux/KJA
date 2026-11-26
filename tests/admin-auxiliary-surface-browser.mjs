// Isolated presentation fixtures: no account, server requests or delete action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const files=['assignment-delete','assignment-hours','dashboard-attendance-preview','kja-admin-tokens'];
const css=files.map(f=>fs.readFileSync('assets/css/paginas/'+f+'.css','utf8')).join('\n');
const markup=`<style>${css}</style><div id="portal" class="admin-wide" data-view="gestion"><main id="view-gestion"><section id="attendance-report-preview" class="attendance-report-preview"><h3>Informe de asistencia</h3><div class="attendance-preview-heading"><button>Ocultar informe</button></div><div class="attendance-preview-scroll"><table><thead><tr><th>Fecha</th><th>Estado</th></tr></thead><tbody><tr><td><button>25 de noviembre</button></td><td class="is-punctual">Puntual</td></tr><tr><td>24 de noviembre</td><td class="is-late">Tarde</td></tr><tr><td>23 de noviembre</td><td class="is-incomplete">Incompleta</td></tr></tbody></table></div></section></main></div><dialog id="assignment-delete-dialog" class="assignment-delete-dialog"><h2>Eliminar asignación</h2><div class="assignment-delete-actions"><button data-back>Conservar asignación</button><button data-remove>Eliminar y liberar espacio</button></div><p role="status">No se confirmó la eliminación</p></dialog>`;
const browser=await chromium.launch({channel:'msedge'});
try{
  for(const [width,height] of [[1024,768],[1280,720],[1440,900],[1920,1080]]){
    const page=await browser.newPage({viewport:{width,height}});
    await page.route('**/*',r=>r.abort());
    await page.setContent(markup);
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const contrast=async selector=>assert.equal(await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'rule',values:['color-contrast']}})).violations.length,selector),0);
    const value=(selector,property)=>page.locator(selector).evaluate((node,property)=>getComputedStyle(node)[property],property);
    assert.equal(await value('.attendance-report-preview','backgroundColor'),'rgb(255, 253, 249)');
    assert.equal(await value('thead th:first-child','color'),'rgb(56, 49, 43)');
    await page.locator('.attendance-preview-heading button').focus();
    assert.equal(await value('.attendance-preview-heading button','outlineColor'),'rgb(82, 121, 102)');
    assert.equal(await value('.attendance-preview-heading button','outlineWidth'),'2px');
    await contrast('.attendance-report-preview');
    await page.locator('#assignment-delete-dialog').evaluate(d=>d.showModal());
    assert.equal(await value('[data-remove]','backgroundColor'),'rgb(151, 62, 70)');
    assert.equal(await value('#assignment-delete-dialog','backgroundColor'),'rgb(255, 253, 249)');
    assert.match(await value('#assignment-delete-dialog','boxShadow'),/rgba\(56, 49, 43, 0\.18\)/);
    await contrast('#assignment-delete-dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#assignment-delete-dialog').evaluate(d=>d.open),false);
    console.log(width+'px: informe, foco y confirmación administrativa con tokens; sin escrituras');
    await page.close();
  }
}finally{await browser.close();}
