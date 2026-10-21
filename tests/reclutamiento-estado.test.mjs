import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { PGlite } from '@electric-sql/pglite';

const read = path => fs.readFileSync(path, 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Consulta por DNI: validación, carga, cinco estados, vacío, fallo y reintento', async () => {
  const dom = new JSDOM(read('reclutamiento.html'), { url: 'https://kja.example/reclutamiento.html', runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  try {
    const dialog = d.getElementById('rec-status-dialog');
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new w.Event('close')); };
    let calls = 0, resolve, reject;
    w.KJARecruitmentAPI = { status: dni => {
      assert.equal(dni, '01234567');
      calls++;
      return new Promise((res, rej) => { resolve = res; reject = rej; });
    }, message: e => e.message };
    w.eval(read('assets/js/reclutamiento-estado.js'));
    d.querySelector('[data-rec-status-open]').click();
    const input = d.getElementById('rec-status-dni'), form = d.getElementById('rec-status-form'), button = form.querySelector('button');
    const submit = () => form.dispatchEvent(new w.Event('submit', { cancelable: true }));
    for (const value of ['', '123', '1234567a', '123456789']) {
      input.value = value; submit();
      assert.equal(input.getAttribute('aria-invalid'), 'true');
    }
    assert.equal(calls, 0);
    input.value = '01234567';
    input.dispatchEvent(new w.Event('input'));
    for (const estado of ['Pendiente', 'En revisión', 'Entrevista', 'Aprobado', 'No seleccionado']) {
      const before = calls;
      submit(); submit();
      assert.equal(calls, before + 1);
      assert.equal(button.disabled, true);
      assert.equal(input.readOnly, true);
      assert.equal(form.getAttribute('aria-busy'), 'true');
      assert.equal(d.getElementById('rec-status-loading').hidden, false);
      resolve({ estado, created_at: '2026-10-21T02:00:00Z', updated_at: '2026-10-21T15:00:00Z' });
      await tick();
      assert.equal(d.getElementById('rec-status-label').textContent, estado);
      assert.equal(d.getElementById('rec-status-result').hidden, false);
      assert.equal(d.activeElement.id, 'rec-status-result');
      assert.match(d.getElementById('rec-status-created').textContent, /20 de octubre/);
      assert.equal(button.disabled, false);
      assert.equal(form.hasAttribute('aria-busy'), false);
      assert.equal(d.getElementById('rec-status-loading').hidden, true);
    }
    input.dispatchEvent(new w.Event('input'));
    assert.equal(d.getElementById('rec-status-result').hidden, true);
    submit(); resolve(null); await tick();
    assert.match(d.getElementById('rec-status-feedback').textContent, /No encontramos/);
    assert.equal(d.getElementById('rec-status-result').hidden, true);
    submit(); reject(Object.assign(new Error('missing'), { code: 'PGRST202' })); await tick();
    assert.match(d.getElementById('rec-status-error').textContent, /aún no está habilitada/);
    assert.equal(d.getElementById('rec-status-loading').hidden, true);
    assert.equal(button.disabled, false);
    submit(); reject(new Error('Sin conexión')); await tick();
    assert.match(d.getElementById('rec-status-error').textContent, /Sin conexión/);
    submit(); resolve({ estado: '<img src=x onerror=alert(1)>' }); await tick();
    assert.equal(d.getElementById('rec-status-result').hidden, true);
    assert.equal(d.querySelector('#rec-status-result img'), null);
    assert.equal(w.localStorage.length, 0);
    assert.equal(w.sessionStorage.length, 0);
    assert.equal(w.location.search, '');
    assert.equal(d.querySelector('.rec-reference-hero .status-link').tagName, 'BUTTON');
  } finally { w.close(); }
});

test('Espera prolongada: aviso accesible sin otra petición y limpieza del temporizador al cerrar', async () => {
  const dom = new JSDOM(read('reclutamiento.html'), { url:'https://kja.example/reclutamiento.html', runScripts:'outside-only' });
  const w = dom.window, d = w.document;
  try {
    const dialog = d.getElementById('rec-status-dialog');
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new w.Event('close')); };
    let calls = 0, slow, settle, cleared = 0;
    w.setTimeout = (callback, ms) => { assert.equal(ms, 12000); slow = callback; return 42; };
    w.clearTimeout = id => { if (id === 42) cleared++; };
    w.KJARecruitmentAPI = { status: () => { calls++; return new Promise(resolve => { settle = resolve; }); }, message:e => e.message };
    w.eval(read('assets/js/reclutamiento-estado.js'));
    const trigger = d.querySelector('[data-rec-status-open]');
    trigger.click();
    const input = d.getElementById('rec-status-dni'), form = d.getElementById('rec-status-form');
    input.value = '12345678'; form.requestSubmit();
    const loading = d.getElementById('rec-status-loading');
    assert.equal(loading.hidden, false);
    assert.equal(loading.getAttribute('role'), 'status');
    slow();
    assert.match(d.getElementById('rec-status-wait-message').textContent, /tardando un poco más/);
    assert.equal(calls, 1);
    dialog.close();
    assert.equal(loading.hidden, true);
    assert.equal(cleared, 1);
    trigger.click();
    settle({estado:'Entrevista'}); await tick();
    assert.equal(loading.hidden, true);
    assert.equal(d.getElementById('rec-status-result').hidden, true);
  } finally { w.close(); }
});

test('Modal: apertura, cierre, foco, limpieza y respuesta tardía sin interferir con una consulta nueva', async () => {
  const dom = new JSDOM(read('reclutamiento.html'), { url:'https://kja.example/reclutamiento.html#estado-postulacion', runScripts:'outside-only' });
  const w = dom.window, d = w.document;
  try {
    const dialog = d.getElementById('rec-status-dialog');
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new w.Event('close')); };
    const pending = [];
    w.KJARecruitmentAPI = { status: () => new Promise(resolve => pending.push(resolve)), message:e => e.message };
    w.eval(read('assets/js/reclutamiento-estado.js'));
    const input = d.getElementById('rec-status-dni'), form = d.getElementById('rec-status-form');
    const trigger = d.querySelector('[data-rec-status-open]');
    assert.equal(dialog.open, true);
    assert.equal(d.activeElement, input);
    assert.equal(d.documentElement.classList.contains('rec-status-open'), true);
    input.value = '12345678'; form.requestSubmit();
    dialog.querySelector('.rec-status-close').click();
    assert.equal(dialog.open, false);
    assert.equal(input.value, '');
    assert.equal(d.activeElement, trigger);
    assert.equal(w.location.hash, '');
    assert.equal(d.documentElement.classList.contains('rec-status-open'), false);
    trigger.click(); input.value = '87654321'; form.requestSubmit();
    pending[0]({ estado:'Aprobado' }); await tick();
    assert.equal(d.getElementById('rec-status-result').hidden, true);
    assert.equal(form.querySelector('button').disabled, true);
    pending[1]({ estado:'Entrevista' }); await tick();
    assert.equal(d.getElementById('rec-status-label').textContent, 'Entrevista');
    dialog.click();
    assert.equal(dialog.open, false);
    assert.equal(d.getElementById('rec-status-label').textContent, '');
    assert.match(read('estado-postulacion.html'), /url=reclutamiento.html#estado-postulacion/);
  } finally { w.close(); }
});

test('Transporte público de consulta usa POST y conserva el DNI con cero inicial', async () => {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  try {
    const w = dom.window;
    w.fetch = async (url, opts) => {
      assert.match(url, /\/rpc\/rec_consultar_estado$/);
      assert.equal(opts.method, 'POST');
      assert.deepEqual(JSON.parse(opts.body), { p_dni: '01234567' });
      return { ok: true, json: async () => null };
    };
    w.eval(read('assets/js/reclutamiento-api.js'));
    assert.equal(await w.KJARecruitmentAPI.status('01234567'), null);
  } finally { dom.window.close(); }
});

test('SQL: consulta pública mínima, DNI exacto, última postulación y expediente privado', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      grant usage on schema public,auth to anon,authenticated;
      create table asis_perfiles(id uuid,activo boolean,acceso_panel boolean,rol text);
      create table perfiles(id uuid,rol text);`);
    await db.exec(read('supabase/reclutamiento_01_solicitudes.sql'));
    const migration = read('supabase/reclutamiento_03_consulta_estado.sql');
    await db.exec(migration); await db.exec(migration);
    await db.exec(`insert into rec_postulaciones(id,codigo,datos,estado,notas_revision,created_at) values
      ('10000000-0000-4000-8000-000000000001','PRIVADO1','{"dni":"01234567","nombres":"Privado","email":"privado@example.com"}','Pendiente','Nota privada','2026-10-20T15:00:00Z'),
      ('10000000-0000-4000-8000-000000000002','PRIVADO2','{"dni":"01234567"}','Entrevista','Nota privada','2026-10-21T15:00:00Z'),
      ('10000000-0000-4000-8000-000000000003','PRIVADO3','{"dni":"87654321"}','Aprobado','','2026-10-21T16:00:00Z');`);
    const query = async dni => (await db.query('select rec_consultar_estado($1) data', [dni])).rows[0].data;
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      const result = await query('01234567');
      assert.equal(result.estado, 'Entrevista');
      assert.deepEqual(Object.keys(result).sort(), ['created_at','estado','updated_at']);
      assert.equal(await query('00000000'), null);
      for (const dni of [null, '', '123', '01234567 ', "' OR true--", 'abcdefgh'])
        await assert.rejects(() => query(dni), /DNI de 8 dígitos/);
      await assert.rejects(() => db.query('select * from rec_postulaciones'), /permission denied/);
      await assert.rejects(() => db.query('select * from rec_curriculos'), /permission denied/);
      await assert.rejects(() => db.query('select rec_listar()'), /permission denied|reservado/);
      await assert.rejects(() => db.query("select rec_descargar_cv('10000000-0000-4000-8000-000000000001')"), /permission denied|reservado/);
      await db.exec('reset role');
    }
    // A saved administrative change becomes visible without touching the public client.
    await db.exec("update rec_postulaciones set estado='No seleccionado' where codigo='PRIVADO2'; set role anon;");
    assert.equal((await query('01234567')).estado, 'No seleccionado');
  } finally { await db.close(); }
});
