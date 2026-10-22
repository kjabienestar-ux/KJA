import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const code=read('assets/js/dashboard-avatar.js');
const html=read('dashboard.html');
function setup(){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://kja.test/'});
  const {window}=dom;
  vm.runInContext(code,dom.getInternalVMContext());
  return {window,document:window.document,avatar:window.KJADashboardAvatar};
}

test('filters the female given names in the imported team and handles accents and explicit gender',()=>{
  const {avatar}=setup();
  const team=read('supabase/dashboard_33_carga_masiva_horarios_comparticiones.sql');
  const expectedFemale=new Set([1,2,3,4,5,6,12,13,16,18,22,24,26,27,28,29,30,31,32]);
  const people=[...team.matchAll(/\((\d+), '([^']+)', (?:'\d+'|null),/g)];
  assert.equal(people.length,34);
  for(const [,id,nombre] of people)assert.equal(avatar.isFemale({nombre}),expectedFemale.has(Number(id)),nombre);
  assert.equal(avatar.isFemale({nombre:'  MARÍA del Carmen '}),true);
  assert.equal(avatar.isFemale({nombre:'José María García'}),false);
  assert.equal(avatar.isFemale({nombre:'Andrea',genero:'masculino'}),false);
  assert.equal(avatar.isFemale({nombre:'Nombre desconocido',sexo:'F'}),true);
  assert.equal(avatar.isFemale({nombre:'Desconocido'}),false);
});

test('all decorative characters switch together and reset when another user signs in',()=>{
  const {avatar,document}=setup();
  const photos=document.querySelector('#profile-avatar').outerHTML;
  avatar.sync(document,{nombre:'Liesel Palomino'});
  const figures=[...document.querySelectorAll('img[data-dashboard-character]')];
  assert.ok(figures.length>=12);
  for(const img of figures)assert.equal(img.getAttribute('src'),avatar.source({nombre:'Liesel'},img.dataset.dashboardCharacter));
  const journey=[...document.querySelectorAll('.journey-figure')].map(img=>img.getAttribute('src'));
  assert.deepEqual(journey,[
    'images/nosotros/avatar-women-transparent.webp',
    'images/nosotros/avatar-women-evidence.webp',
    'images/nosotros/avatar-women-exit.webp'
  ]);
  assert.match(document.getElementById('portal').style.getPropertyValue('--dashboard-history-character'),/avatar-women-transparent.webp/);
  assert.equal(document.querySelector('#profile-avatar').outerHTML,photos);
  assert.equal(avatar.source({nombre:'Doris Inga'},'history.png'),'images/nosotros/avatar-women-transparent.webp');
  avatar.sync(document,{nombre:'Yeiser Jamber Avila Medina'});
  for(const img of figures)assert.equal(img.getAttribute('src'),img.dataset.dashboardCharacter);
  assert.equal(document.getElementById('portal').style.getPropertyValue('--dashboard-history-character'),'');
  assert.equal(avatar.source({nombre:'Ronny'},'late.png'),'late.png');
});

test('attendance receipts choose different poses for punctual and late women and retain that pose after refresh',()=>{
  const {window,document,avatar}=setup();
  const js=read('assets/js/dashboard.js');
  const receipt=js.slice(js.indexOf('function showMarkReceipt('),js.indexOf('\nfunction openMarkStatus('));
  Object.assign(window,{
    APP:{inicio:{colaborador:{nombre:'Camila Cruz'},dia:{fecha:'2026-10-21'}}},
    $:id=>document.getElementById(id),
    fmtTime:value=>value||'',isoLima:()=> '2026-10-21',cap:value=>value,
    setMarkFlow:()=>{}
  });
  window.eval(receipt);
  const person=document.getElementById('receipt-person');
  for(const [estado,suffix] of [['P','on-time'],['T','late']]){
    window.showMarkReceipt({estado,hora:'07:15'},true);
    assert.equal(person.getAttribute('src'),`images/nosotros/avatar-women-${suffix}.webp`);
    avatar.sync(document,window.APP.inicio.colaborador);
    assert.equal(person.getAttribute('src'),`images/nosotros/avatar-women-${suffix}.webp`);
  }
  window.APP.inicio.colaborador.nombre='Yeiser Avila';
  window.showMarkReceipt({estado:'P',hora:'07:15'},true);
  assert.equal(person.getAttribute('src'),'images/dashboard/attendance-on-time.png');
});

test('every personal illustration is wired, including dynamic history and attendance receipts',()=>{
  const {document}=setup();
  for(const img of document.querySelectorAll('img')){
    if(/images\/dashboard\/(attendance-(phone|exit|late)\.png|evidence-worker\.png|asistencia-3d\.webp|day-off-rest\.png)$/.test(img.getAttribute('src')||'')){
      assert.equal(img.dataset.dashboardCharacter,img.getAttribute('src'));
    }
  }
  const js=read('assets/js/dashboard.js');
  assert.match(js,/KJADashboardAvatar\?\.source\(APP.inicio\?\.colaborador,'images\/dashboard\/attendance-history.png'\)/);
  assert.match(js,/KJADashboardAvatar\?\.source\(APP.inicio\?\.colaborador,receiptFigure\)/);
  assert.ok(html.indexOf('dashboard-avatar.js')<html.indexOf('dashboard.js?v='));
  for(const file of ['avatar-women-transparent.webp','avatar-women-evidence.webp','avatar-women-exit.webp','avatar-women-on-time.webp','avatar-women-late.webp']){
    const webp=fs.readFileSync(new URL(`../images/nosotros/${file}`,import.meta.url));
    assert.equal(webp.toString('ascii',8,12),'WEBP');
    assert.ok(webp.length<50*1024);
    assert.equal(webp.toString('ascii',12,16),'VP8X');
    assert.ok(webp[20]&0x10,`${file} must contain an alpha channel`);
  }
});
