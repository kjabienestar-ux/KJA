import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/dashboard-guided-tour.js', import.meta.url), 'utf8');

function harness({ personal = true, loading = false, mobile = false, seen = false } = {}) {
  const storage = new Map(seen ? [['kja.dashboard.guided-tour.v3:user-one:web', 'done']] : []);
  const timers = [], frames = [], observers = [];
  const documentListeners = new Map();
  let pageScroll = { left: 5, top: 180 };
  let root = null;
  class Element {
    hidden = false; inert = false; isConnected = true; dataset = {}; attrs = {}; style = { setProperty() {} }; textContent = ''; disabled = false; listeners = {};
    classes = new Set();
    classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), contains: name => this.classes.has(name), toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
    constructor(name = '') { this.name = name; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    getBoundingClientRect() { return { left: 100, top: 100, right: 200, bottom: 150, width: 100, height: 50 }; }
    closest() { return this.hidden ? this : null; }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    remove() { this.isConnected = false; root = null; }
    click() { this.onclick?.(); this.listeners.click?.(); }
  }
  const portal = new Element('portal'); portal.dataset = { personal: String(personal), view: 'inicio' };
  const trigger = new Element('trigger'); trigger.hidden = true;
  const card = new Element('today-attendance-card'); if (loading) card.classes.add('daily-close-pending');
  const elements = new Map([['portal', portal], ['today-attendance-card', card], ['nav-guided-tour', trigger], ['sidebar', new Element()], ['side-scrim', new Element()]]);
  const controls = new Map();
  const groups = Array.from({ length: 5 }, (_, i) => { const el = new Element(); el.dataset.tourGroup = String(i); return el; });
  const home = new Element('nav-inicio'); home.onclick = () => { portal.dataset.view = 'inicio'; }; elements.set('nav-inicio', home);
  const targets = new Map([
    ['#sidebar', elements.get('sidebar')], ['.day-schedule', new Element()], ['.day-summary .progress-card', new Element()],
    ['#day-close-checklist .type-entrada', new Element()], ['#day-close-checklist .type-comparticiones', new Element()],
    ['#day-close-checklist .type-rpe', new Element()], ['#day-close-checklist .type-salida', new Element()], ['#portal-rail', new Element()],
    ['.mobile-quick-grid', new Element()], ['#mobile-today-summary', new Element()], ['#mobile-month-progress-slot .dashboard-month-progress', new Element()],
    ['#mobile-close-list .type-entrada', new Element()], ['#mobile-close-list .type-comparticiones', new Element()],
    ['#mobile-close-list .type-rpe', new Element()], ['#mobile-close-list .type-salida', new Element()], ['#mobile-profile-link', new Element()]
  ]);
  const document = {
    activeElement: trigger, documentElement: { clientWidth: 1920, clientHeight: 1080 },
    getElementById: id => elements.get(id) || null,
    querySelector: selector => targets.get(selector) || null,
    querySelectorAll: selector => selector === '[data-guided-tour-start]' ? [trigger] : [],
    createElement: () => {
      const el = new Element();
      el.querySelector = selector => { if (!controls.has(selector)) controls.set(selector, new Element(selector)); return controls.get(selector); };
      el.querySelectorAll = selector => selector === '[data-tour-group]' ? groups : ['.guided-tour-close', '.guided-tour-skip', '.guided-tour-back', '.guided-tour-next'].map(selector => el.querySelector(selector)).filter(el => !el.disabled);
      return el;
    },
    addEventListener(name, fn) { documentListeners.set(name, fn); },
    removeEventListener(name) { documentListeners.delete(name); },
    body: { append: el => { root = el; } }
  };
  const APP = { sessionUid: 'user-one' };
  const context = {
    document, APP, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    getComputedStyle: el => ({ display: el.hidden ? 'none' : 'block', visibility: 'visible', opacity: 1, borderRadius: '12px' }),
    matchMedia: query => ({ matches: query.includes('max-width') && mobile }),
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    get scrollX() { return pageScroll.left; }, get scrollY() { return pageScroll.top; },
    scrollBy({ top = 0, left = 0 } = {}) { pageScroll = { left: pageScroll.left + left, top: Math.max(0, pageScroll.top + top) }; },
    scrollTo({ left = 0, top = 0 } = {}) { pageScroll = { left, top }; },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, addEventListener() {},
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return {
    portal, trigger, card, document, APP, storage, targets, controls, elements,
    setMobile: value => { mobile = value; },
    root: () => root,
    title: () => controls.get('#guided-tour-title')?.textContent,
    mutate: () => observers[0]([]),
    flush: () => { while (frames.length) frames.shift()(); },
    auto: () => { while (timers.length) timers.shift()(); },
    click: selector => controls.get(selector).click(),
    dispatchDocumentEvent: (name, values = {}) => {
      let defaultPrevented = false;
      documentListeners.get(name)?.({ ...values, preventDefault() { defaultPrevented = true; } });
      return defaultPrevented;
    },
    setPageScroll: value => { pageScroll = value; },
    pageScroll: () => ({ ...pageScroll }),
    documentListeners,
    key: (key, shiftKey = false) => root.listeners.keydown({ key, shiftKey, preventDefault() {} })
  };
}

test('first visit waits for the loaded personal dashboard and starts automatically', () => {
  const h = harness({ loading: true }); h.auto(); assert.equal(h.root(), null);
  h.card.classes.delete('daily-close-pending'); h.mutate(); h.auto();
  assert.equal(h.title(), 'Todo empieza en el sidebar'); assert.equal(h.portal.inert, true);
});

test('seen and non-personal accounts do not start automatically', () => {
  const seen = harness({ seen: true }); seen.auto(); assert.equal(seen.root(), null); assert.equal(seen.trigger.hidden, false);
  const external = harness({ personal: false }); external.auto(); external.mutate(); assert.equal(external.root(), null); assert.equal(external.trigger.hidden, true);
});

test('chapters follow sidebar, jornada, hours, closing requirements and personal space', () => {
  const h = harness(); h.trigger.click(); const titles = [];
  while (h.root()) { titles.push(h.title()); h.click('.guided-tour-next'); }
  assert.deepEqual(titles, ['Todo empieza en el sidebar', 'Horario, modalidad y contador', 'Tus horas del mes', '1. Marca tu entrada', '2. Comparticiones de Facebook', '3. Sube tu RPE', '4. Registra tu salida', 'Mi espacio y listo']);
  assert.equal(h.portal.inert, false); assert.equal(h.storage.get('kja.dashboard.guided-tour.v3:user-one:web'), 'done');
});

test('replay returns home, closes the mobile menu, traps focus and restores it on Escape', () => {
  const h = harness({ seen: true }); h.portal.dataset.view = 'perfil';
  h.elements.get('sidebar').classes.add('open'); h.elements.get('side-scrim').classes.add('show'); h.trigger.click();
  assert.equal(h.elements.get('sidebar').classes.has('open'), false); assert.equal(h.elements.get('side-scrim').classes.has('show'), false);
  assert.equal(h.portal.dataset.view, 'inicio'); h.key('Tab', true);
  assert.equal(h.document.activeElement.name, '.guided-tour-next'); h.key('Escape');
  assert.equal(h.root(), null); assert.equal(h.document.activeElement, h.trigger); assert.equal(h.portal.getAttribute('aria-hidden'), null);
});

test('a replaced checklist target remains anchored and an interrupted view is not marked seen', () => {
  const h = harness(); h.trigger.click();
  while (h.title() !== '3. Sube tu RPE') h.click('.guided-tour-next');
  h.targets.get('#day-close-checklist .type-rpe').isConnected = false;
  h.targets.set('#day-close-checklist .type-rpe', { isConnected: true, closest: () => null, getBoundingClientRect: () => ({ left: 900, top: 200, right: 1200, bottom: 250, width: 300, height: 50 }) });
  h.mutate(); h.flush(); assert.equal(h.controls.get('.guided-tour-spotlight').hidden, false);
  h.portal.dataset.view = 'perfil'; h.mutate(); assert.equal(h.root(), null); assert.equal(h.storage.size, 0);
});

test('first-visit preference belongs to each signed-in user and replay bypasses it', () => {
  const h = harness({ seen: true }); h.trigger.click(); h.key('Escape');
  h.APP.sessionUid = 'user-two'; h.mutate(); h.auto();
  assert.equal(h.title(), 'Todo empieza en el sidebar'); h.key('Escape');
  assert.equal(h.storage.get('kja.dashboard.guided-tour.v3:user-two:web'), 'done');
});

test('mobile has its own brief route and never describes desktop-only controls', () => {
  const h = harness({ mobile: true }); h.trigger.click(); const titles = [];
  while (h.root()) { titles.push(h.title()); h.click('.guided-tour-next'); }
  assert.deepEqual(titles, ['Tus accesos rápidos', 'Tus horas registradas', 'Tu calendario del mes', '1. Marca tu entrada', '2. Facebook', '3. Sube tu RPE', '4. Registra tu salida', 'Tu perfil y mensajes']);
  assert.equal(h.storage.get('kja.dashboard.guided-tour.v3:user-one:mobile'), 'done');
  assert.equal(h.storage.has('kja.dashboard.guided-tour.v3:user-one:web'), false);
});

test('missing mobile requirements are omitted while the remaining closure order is preserved', () => {
  const h = harness({ mobile: true }); h.targets.delete('#mobile-close-list .type-rpe'); h.targets.delete('#mobile-today-summary');
  h.trigger.click(); const titles = [];
  while (h.root()) { titles.push(h.title()); h.click('.guided-tour-next'); }
  assert.equal(titles.length, 6);
  assert(!titles.includes('3. Sube tu RPE')); assert(!titles.includes('Tus horas registradas'));
  assert(titles.indexOf('1. Marca tu entrada') < titles.indexOf('2. Facebook'));
  assert(titles.indexOf('2. Facebook') < titles.indexOf('4. Registra tu salida'));
});

test('finishing the web guide does not suppress the first mobile visit', () => {
  const h = harness({ seen: true }); h.auto(); assert.equal(h.root(), null);
  h.setMobile(true); h.mutate(); h.auto(); assert.equal(h.title(), 'Tus accesos rápidos');
  h.key('Escape'); assert.equal(h.storage.get('kja.dashboard.guided-tour.v3:user-one:mobile'), 'done');
});

test('mobile pins its guide beneath the highlighted section and restores the page position', () => {
  const h = harness({ mobile: true });
  assert.equal(h.portal.dataset.guidedTour, undefined); h.trigger.click();
  assert.equal(h.portal.dataset.guidedTour, 'mobile');
  assert.equal(h.dispatchDocumentEvent('wheel'), true);
  assert.equal(h.dispatchDocumentEvent('touchmove'), true);
  assert.equal(h.dispatchDocumentEvent('keydown', { key: 'ArrowDown' }), true);
  h.click('.guided-tour-next'); assert.equal(h.title(), 'Tus horas registradas');
  h.setPageScroll({ left: 99, top: 999 }); h.key('Escape');
  assert.equal(h.portal.dataset.guidedTour, undefined);
  assert.deepEqual(h.pageScroll(), { left: 5, top: 180 });
  assert.equal(h.documentListeners.size, 0);
  assert.equal(h.dispatchDocumentEvent('wheel'), false);
});

test('the primary action becomes a finish action on the final step', () => {
  const h = harness({ mobile: true }); h.trigger.click();
  assert.equal(h.controls.get('.guided-tour-next-label').textContent, 'Continuar');
  while (h.title() !== 'Tu perfil y mensajes') h.click('.guided-tour-next');
  assert.equal(h.controls.get('.guided-tour-next-label').textContent, 'Listo');
  h.click('.guided-tour-next'); assert.equal(h.root(), null);
});
