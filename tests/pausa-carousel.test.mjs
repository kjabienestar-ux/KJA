import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup() {
  const nodes = new Map(), events = new Map(), intervals = new Map();
  let id = 0;
  function node(key) {
    if (!nodes.has(key)) {
      const classes = new Set();
      nodes.set(key, { hidden: true, style: {}, dataset: {},
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, on) { on ? classes.add(c) : classes.delete(c); } },
        querySelector: selector => node(selector), querySelectorAll: () => [], removeAttribute() {} });
    }
    return nodes.get(key);
  }
  const document = { readyState: 'loading', body: node('body'),
    getElementById: key => key === 'welcome-sub' ? null : node(key),
    querySelector: node, querySelectorAll: () => [], addEventListener: (key, cb) => events.set(key, cb) };
  const window = { APP: { inicio: { dia: { marcado: true } } }, addEventListener() {}, toast() {} };
  const context = { window, document, console,
    db: { rpc: async () => ({ data: { ok: true, pausas: ['movilidad'] } }) },
    setInterval(cb, ms) { const key = ++id; intervals.set(key, {cb, ms}); return key; },
    clearInterval: key => intervals.delete(key), setTimeout() {} };
  vm.runInNewContext(fs.readFileSync('assets/js/dashboard-pausa-activa.js', 'utf8'), context);
  events.get('DOMContentLoaded')();
  return { api: window.KJA_PAUSAS, node, events, intervals,
    tick: () => [...intervals.values()].find(timer => timer.ms === 10000).cb() };
}

test('carousel advances figure, title and instructions and loops back to first activity', async () => {
  const env = setup();
  await env.api.startSession(env.api.BREAKS[0]);
  const titles = env.api.BREAKS[0].activities.map(activity => activity.title);
  env.tick();
  assert.equal(env.node('pausa-act-title').textContent, titles[1]);
  const figure = env.node('pausa-act-figure').innerHTML;
  env.tick();
  assert.equal(env.node('pausa-act-title').textContent, titles[2]);
  assert.notEqual(env.node('pausa-act-figure').innerHTML, figure);
  env.tick(); env.tick();
  assert.equal(env.node('pausa-act-title').textContent, titles[0]);
  assert.equal(env.node('pausa-suggestion-display').textContent, env.api.BREAKS[0].activities[0].suggestions[1]);
});

test('outside clicks and Escape shake without confirmation; X pauses carousel and asks', async () => {
  const env = setup();
  await env.api.startSession(env.api.BREAKS[0]);
  const modal = env.node('pausa-activa-container');
  const overlay = env.node('pausa-activa-overlay'); overlay.hidden = false;
  const sessionHTML = modal.innerHTML;
  env.node('pausa-activa-backdrop').onclick();
  overlay.onclick({target: overlay});
  env.events.get('keydown')({key:'Escape'});
  assert.equal(modal.innerHTML, sessionHTML);
  assert.equal(overlay.hidden, false);
  assert.equal(modal.classList.contains('pausa-dialog-shake'), true);
  assert.ok([...env.intervals.values()].some(timer => timer.ms === 10000));
  env.node('#pausa-btn-confirm-exit').onclick();
  assert.match(modal.innerHTML, /¿Seguro que quieres salir/);
  assert.equal([...env.intervals.values()].some(timer => timer.ms === 10000), false);
  env.node('#pausa-btn-resume').onclick();
  assert.ok([...env.intervals.values()].some(timer => timer.ms === 10000));
});
