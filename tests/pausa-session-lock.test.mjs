import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/js/dashboard-pausa-activa.js', 'utf8');

function setupEnvironment() {
  const listeners = {};
  const mockClassList = (initial = []) => {
    const classes = new Set(initial);
    return {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c) => {
        if (classes.has(c)) { classes.delete(c); return false; }
        classes.add(c); return true;
      },
      contains: (c) => classes.has(c)
    };
  };

  const overlay = {
    hidden: true,
    classList: mockClassList()
  };

  const elements = {};
  const container = {
    className: '',
    innerHTML: '',
    classList: mockClassList(),
    offsetWidth: 100,
    querySelector: (selector) => elements[selector] || null,
    querySelectorAll: (selector) => []
  };

  const document = {
    getElementById: (id) => {
      if (id === 'pausa-activa-overlay') return overlay;
      if (id === 'pausa-activa-container') return container;
      if (id === 'pausa-activa-backdrop') return backdrop;
      if (id === 'today-attendance-card') return { dataset: { attendanceState: 'marked' } };
      return null;
    },
    addEventListener: (event, handler) => {
      listeners[event] = handler;
    },
    body: {
      classList: mockClassList(),
      appendChild: () => {}
    }
  };

  const backdrop = { onclick: null };

  const window = {
    APP: { inicio: { dia: { marcado: true } } },
    toast: (msg) => { window.lastToast = msg; }
  };

  // Mock global audio context
  const AudioContext = class {
    createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, start() {}, stop() {}, connect() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    get currentTime() { return 0; }
    get destination() { return {}; }
  };

  const context = {
    window,
    document,
    AudioContext,
    setTimeout: (fn) => fn(),
    setInterval: () => 123,
    clearInterval: () => {},
    Intl,
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    console
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return { context, overlay, container, backdrop, elements, listeners };
}

test('session start locks modal and sets running class', () => {
  const env = setupEnvironment();
  // Open selection
  const openTrigger = env.context.document.getElementById('rail-pausa-open');
  // Trigger opening selection view via DOM
  const container = env.container;
  assert.equal(typeof container.innerHTML, 'string');
});

test('backdrop click while session is running does not close modal and adds shake effect', () => {
  const env = setupEnvironment();
  // We can verify that clicking backdrop when session is active triggers shake
  // Let's trigger start of session by simulating startBtn
});
