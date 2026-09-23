import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/dashboard-pausa-activa.js', 'utf8');

function setupTestEnv() {
  const elements = {};
  const listeners = {};
  const storage = new Map();

  const mockClassList = (initial = []) => {
    const set = new Set(initial);
    return {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c) => {
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      },
      contains: (c) => set.has(c)
    };
  };

  const overlay = { hidden: true, classList: mockClassList() };
  const backdrop = { onclick: null };
  const container = {
    className: '',
    innerHTML: '',
    classList: mockClassList(),
    querySelector: (sel) => elements[sel] || null,
    querySelectorAll: (sel) => elements[sel] || []
  };

  const railCard = {
    disabled: false,
    title: '',
    style: {},
    removeAttribute: () => {},
    querySelector: (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          innerHTML: '',
          textContent: '',
          querySelectorAll: () => [
            { classList: mockClassList() },
            { classList: mockClassList() }
          ]
        };
      }
      return elements[sel];
    }
  };

  const document = {
    getElementById: (id) => {
      if (id === 'pausa-activa-overlay') return overlay;
      if (id === 'pausa-activa-container') return container;
      if (id === 'pausa-activa-backdrop') return backdrop;
      if (id === 'rail-pausa-open') return railCard;
      if (id === 'today-attendance-card') return { dataset: { attendanceState: 'marked' } };
      return elements[id] || null;
    },
    addEventListener: (event, handler) => { listeners[event] = handler; },
    body: { classList: mockClassList(), appendChild: () => {} },
    querySelectorAll: () => []
  };

  const window = {
    APP: {
      inicio: {
        colaborador: { id: 42, nombre: 'Ana Gómez' },
        dia: { marcado: true }
      }
    },
    toast: (msg) => { window.lastToast = msg; },
    addEventListener: () => {}
  };

  const context = {
    window,
    document,
    setTimeout: (fn) => fn(),
    setInterval: () => 101,
    clearInterval: () => {},
    Intl,
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    console
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return { context, window, document, elements, railCard, container, overlay, storage, api: window.KJA_PAUSAS };
}

test('Sidebar rail widget reflects count: 0, 1 usada, 2 completadas', () => {
  const env = setupTestEnv();
  const { railCard, api } = env;

  // Initially 0 completed
  api.refreshRail();
  const durationEl = railCard.querySelector('.rail-pausa-duration');
  assert.match(durationEl.innerHTML, /10 o 20 min/);

  // Simulate 1 break completed in storage
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  env.storage.set(`kja_pausas_42_${hoy}`, JSON.stringify({
    date: hoy,
    completed: ['movilidad']
  }));

  api.loadCompleted();
  api.refreshRail();
  assert.match(durationEl.innerHTML, /1 pausa usada · Te queda 1/);

  // Simulate both breaks completed
  env.storage.set(`kja_pausas_42_${hoy}`, JSON.stringify({
    date: hoy,
    completed: ['movilidad', 'visual']
  }));
  api.loadCompleted();
  api.refreshRail();
  assert.match(durationEl.innerHTML, /2 de 2 completadas/);
});

test('Exiting active session with "Salir y perder pausa" marks it as completed and disabled', () => {
  const env = setupTestEnv();
  const { api, container, elements } = env;

  const exitBtn = { onclick: null };
  elements['#pausa-btn-confirm-exit'] = { onclick: null };
  elements['#pausa-btn-exit-anyway'] = exitBtn;

  // Start a 20 min session (movilidad)
  const breakItem = api.BREAKS.find(b => b.id === 'movilidad');
  api.startSession(breakItem);

  // Verify session is active
  assert.equal(api.isSessionActive(), true);

  // Trigger confirm view
  api.renderConfirm();
  assert.match(container.innerHTML, /¿Seguro que quieres salir\?/);

  // Click exit anyway
  assert.equal(typeof exitBtn.onclick, 'function');
  exitBtn.onclick();

  // Verify break is now in completedBreaks set
  const completed = Array.from(api.getCompletedBreaks());
  assert.ok(completed.includes('movilidad'));
  assert.equal(api.isSessionActive(), false);
});

test('Admin reset clears user pause and updates rail button', () => {
  const env = setupTestEnv();
  const { api } = env;
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

  // Mark break 42 as done
  env.storage.set(`kja_pausas_42_${hoy}`, JSON.stringify({ date: hoy, completed: ['movilidad'] }));
  api.loadCompleted();
  api.refreshRail();
  assert.equal(api.getCompletedBreaks().has('movilidad'), true);

  // Admin resets collaborator 42
  api.resetColaborador(42, 'Ana Gómez');

  // Verify completed breaks is now empty for user 42
  assert.equal(api.getCompletedBreaks().size, 0);
  const stored = env.storage.get(`kja_pausas_42_${hoy}`);
  const parsed = stored ? JSON.parse(stored) : { completed: [] };
  assert.equal(parsed.completed.length, 0);
});
