import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('dashboard.html');
const js=read('assets/js/dashboard.js');
const css=read('assets/css/paginas/dashboard-profile-cover.css');
const migration=read('supabase/dashboard_104_portada_perfil.sql');

function slice(from,to){
  const start=js.indexOf(from);
  assert.notEqual(start,-1,from);
  return js.slice(start,js.indexOf(to,start));
}

function element(){
  const classes=new Set();
  return {
    hidden:false,textContent:'',disabled:false,style:{removeProperty(property){delete this[property==='background-image'?'backgroundImage':property]}},
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle:(name,on)=>{(on===undefined?!classes.has(name):on)?classes.add(name):classes.delete(name)}}
  };
}

function harness(hasPersonal=true){
  const nodes=new Map(['profile-cover','profile-cover-edit','profile-cover-dialog-preview','profile-cover-change','profile-cover-remove'].map(id=>[id,element()]));
  const label=element();
  const context=vm.createContext({
    APP:{identity:{hasPersonal},cover:{path:'',url:'',busy:false}},
    $:id=>nodes.get(id)||null,
    document:{querySelector:selector=>selector==='#profile-cover-edit span'?label:null}
  });
  vm.runInContext(slice('function paintProfileCover(','function setProfileCoverBusy('),context);
  return {context,nodes,label};
}

test('the cover paints the signed image and falls back to the colour theme without it',()=>{
  const {context,nodes,label}=harness();
  const cover=nodes.get('profile-cover');
  context.APP.cover.path='7/portada.webp';
  context.paintProfileCover('https://example.test/portada.webp?v=1');
  assert.equal(cover.classList.contains('has-image'),true);
  assert.equal(cover.style.backgroundImage,'url("https://example.test/portada.webp?v=1")');
  assert.equal(nodes.get('profile-cover-remove').hidden,false);
  assert.equal(nodes.get('profile-cover-change').textContent,'Cambiar portada');
  assert.equal(label.textContent,'Cambiar portada');
  context.APP.cover.path='';
  context.paintProfileCover('');
  assert.equal(cover.classList.contains('has-image'),false);
  assert.equal(cover.style.backgroundImage,undefined);
  assert.equal(nodes.get('profile-cover-remove').hidden,true);
  assert.equal(label.textContent,'Agregar portada');
});

test('only linked collaborators can edit the cover; panel-only accounts keep the colour theme',()=>{
  const personal=harness(true);
  personal.context.syncProfileCoverEditor();
  assert.equal(personal.nodes.get('profile-cover-edit').hidden,false);
  assert.equal(personal.nodes.get('profile-cover').classList.contains('is-readonly'),false);
  const panel=harness(false);
  panel.context.syncProfileCoverEditor();
  assert.equal(panel.nodes.get('profile-cover-edit').hidden,true);
  assert.equal(panel.nodes.get('profile-cover').classList.contains('is-readonly'),true);
});

test('profile markup, cropper modes and styles are wired together',()=>{
  for(const id of ['profile-cover','profile-cover-edit','profile-cover-input','profile-cover-dialog','profile-cover-change','profile-cover-remove','profile-cover-message','cropper-help'])
    assert.match(html,new RegExp(`id="${id}"`),id);
  // La clase .profile-cover ya existía en CSS heredado: la portada nueva usa .profile-banner.
  assert.match(html,/class="profile-banner" id="profile-cover"/);
  assert.match(html,/dashboard-profile-cover\.css/);
  assert.match(css,/--cover-ratio:\s*8\s*\/\s*3/);
  // Sin width explícito, max-height + aspect-ratio encogían la portada a la mitad en escritorio.
  assert.match(css,/\.profile-banner \{[^}]*width:\s*100%;[^}]*aspect-ratio:\s*var\(--cover-ratio\)/);
  assert.match(css,/@media \(min-width: 901px\)[\s\S]*display: grid !important/);
  assert.match(css,/@media \(min-width: 1161px\)[\s\S]*--cover-h: clamp\(220px, 20vw, 280px\)/);
  assert.match(css,/#portal\.admin-wide #view-perfil \.profile-banner,\s*#portal\.admin-wide #view-perfil \.profile-aside\s*\{\s*display:\s*none/);
  assert.match(js,/const COVER_W = 1200;/);
  assert.match(js,/const COVER_H = 450;/);
  assert.ok(COVER_RATIO(js)===8/3,'the crop ratio must match the 8:3 banner');
  assert.match(js,/aspectRatio: cropperMode === 'cover' \? COVER_W \/ COVER_H : 1/);
  assert.match(js,/dash_guardar_portada/);
  assert.match(js,/`\$\{colab\}\/portada\.\$\{prepared\.ext\}`/);
});
function COVER_RATIO(source){
  return Number(source.match(/const COVER_W = (\d+);/)[1])/Number(source.match(/const COVER_H = (\d+);/)[1]);
}

test('SQL: each person can only read and write their own cover and the migration is re-runnable',async()=>{
  const db=new PGlite();
  try{
    // Isolated fixtures: no connection to Supabase.
    await db.exec(`
      create role anon; create role authenticated; create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      create table public.asis_colaboradores(id bigint primary key,activo boolean not null default true,foto_path text);
      insert into public.asis_colaboradores(id) values (1),(2);
      create function public.dash_sesion_vigente() returns boolean language sql stable as $$ select true $$;
      create function public.dash_colab() returns bigint language sql stable as $$ select nullif(current_setting('test.colab',true),'')::bigint $$;
      grant usage on schema public to authenticated;
    `);
    await db.exec(migration);
    await db.exec(migration);
    const check=await db.query("select estado from (select case when encontrado = esperado then 'OK' else 'REVISAR' end estado from (select (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dash_mi_portada','dash_guardar_portada','dash_quitar_portada')) encontrado, 3 esperado) q) r");
    assert.equal(check.rows[0].estado,'OK');
    const as=async id=>{await db.exec('reset role');await db.query("select set_config('test.colab',$1,false)",[String(id)]);await db.exec('set role authenticated')};
    await as(1);
    await db.query("insert into storage.objects values('perfil-fotos','1/portada.webp')");
    await db.query("insert into storage.objects values('perfil-fotos','1/portada.jpg')");
    await assert.rejects(db.query("insert into storage.objects values('perfil-fotos','2/portada.webp')"),/row-level security/);
    await assert.rejects(db.query("insert into storage.objects values('perfil-fotos','1/otra.webp')"),/row-level security/);
    await assert.rejects(db.query("insert into storage.objects values('otro-bucket','1/portada.webp')"),/row-level security/);
    assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(r=>r.name),['1/portada.jpg','1/portada.webp']);
    assert.deepEqual((await db.query("select public.dash_guardar_portada('1/portada.webp') as r")).rows[0].r,{ok:true,path:'1/portada.webp'});
    assert.equal((await db.query("select public.dash_guardar_portada('2/portada.webp') as r")).rows[0].r.motivo,'ruta');
    assert.equal((await db.query("select public.dash_guardar_portada('1/avatar.webp') as r")).rows[0].r.motivo,'ruta');
    assert.equal((await db.query('select public.dash_mi_portada() as r')).rows[0].r.path,'1/portada.webp');
    await as(2);
    assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,0,'another person cannot read it');
    assert.equal((await db.query('select public.dash_mi_portada() as r')).rows[0].r.path,null);
    await as(1);
    assert.equal((await db.query('select public.dash_quitar_portada() as r')).rows[0].r.ok,true);
    assert.equal((await db.query('select public.dash_mi_portada() as r')).rows[0].r.path,null);
    await db.query("delete from storage.objects where name='1/portada.webp'");
    assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
    await db.exec('reset role');
    await assert.rejects(db.query("update public.asis_colaboradores set portada_path='2/portada.webp' where id=1"),/portada_path_chk/);
  }finally{await db.close()}
});

test('quick facts come from the loaded profile, are escaped and skip missing values',()=>{
  const box={innerHTML:'x'};
  const context=vm.createContext({
    $:id=>id==='profile-quick'?box:null,
    fmtTime:value=>String(value).slice(0,5),
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    Intl
  });
  vm.runInContext(slice('function renderProfileQuick(','function renderProfile()'),context);
  context.renderProfileQuick({hora_inicio:'08:00:00',hora_fin:'13:00:00',dias_laborables:[1,2,9],contrato_horas:300,contrato_fin_referencia:'2026-12-18'});
  assert.equal((box.innerHTML.match(/class="profile-chip"/g)||[]).length,4);
  assert.match(box.innerHTML,/08:00 — 13:00/);
  assert.match(box.innerHTML,/Lun, Mar/);
  assert.match(box.innerHTML,/300 h/);
  assert.match(box.innerHTML,/Hasta 18 dic/);
  context.renderProfileQuick({dias_laborables:[],contrato_horas:0,nombre:'<b>x</b>'});
  assert.equal(box.innerHTML,'');
  context.renderProfileQuick({dias_laborables:[3],hora_inicio:'<i>',hora_fin:'<u>'});
  assert.doesNotMatch(box.innerHTML,/<i>|<u>/);
  context.renderProfileQuick(null);
  assert.equal(box.innerHTML,'');
});

test('headline, shortcuts and responsive layout are in place',()=>{
  for(const id of ['profile-aside','profile-quick','profile-shortcut-photo','profile-shortcut-cover'])
    assert.match(html,new RegExp(`id="${id}"`),id);
  assert.match(html,/<div class="profile-headline">\s*<h2 id="profile-name">/);
  assert.match(html,/class="profile-headline-meta"><p id="profile-area">/);
  assert.match(js,/\$\('profile-shortcut-photo'\)\.onclick=openProfilePhotoDialog/);
  assert.match(js,/\$\('profile-shortcut-cover'\)\.onclick=openProfileCoverDialog/);
  assert.match(css,/\.profile-layout \{ container-type: inline-size; \}/);
  assert.match(css,/@container \(min-width: 820px\)/);
  assert.match(css,/@container \(min-width: 1100px\)/);
  assert.match(css,/\.profile-aside \{ display: none; \}/);
  assert.match(css,/#portal\.admin-wide #view-perfil \.profile-aside/);
});
