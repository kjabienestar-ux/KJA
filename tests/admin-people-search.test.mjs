import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const base = process.cwd();
const teamJs = fs.readFileSync(path.join(base, 'assets/js/dashboard-admin-equipo.js'), 'utf8');
const workspaceCss = fs.readFileSync(path.join(base, 'assets/css/paginas/dashboard-people-workspace.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(base, 'assets/css/paginas/dashboard-mobile.css'), 'utf8');
const profileCss = fs.readFileSync(path.join(base, 'assets/css/paginas/dashboard-person-profile.css'), 'utf8');

function harness() {
  const nodes = new Map();
  const getNode = id => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        value: '',
        checked: false,
        innerHTML: '',
        hidden: false,
        addEventListener() {},
        querySelector() { return null; }
      });
    }
    return nodes.get(id);
  };

  const context = {
    $: getNode,
    document: {
      querySelector: selector => {
        if (selector.includes('.admin-attendance-export')) return getNode('admin-attendance-export-card');
        return null;
      },
      querySelectorAll: () => []
    },
    APP: {
      adminTeam: {
        puede_editar: false,
        areas: [{ id: 1, nombre: 'Ingeniería', activo: true }],
        personas: [
          { id: 1, nombre: 'Yeiser Jamber Avila Medina', dni: '72345678', activo: true, area_id: 1, area: 'Ingeniería' },
          { id: 2, nombre: 'Ana Gomez Lopez', dni: '71234567', activo: true, area_id: 1, area: 'Ingeniería' }
        ]
      },
      access: { rol: 'direccion', acceso_panel: true }
    },
    esc: s => String(s || ''),
    fmtTime: s => s || '',
    adminDate: d => d || '',
    profileAvatarMarkup: () => '',
    adminMode: () => 'virtual',
    adminHours: h => `${h}h`,
    ADMIN_DAYS: [['L', 1], ['M', 2], ['M', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 7]],
    ADMIN_MODES: { virtual: ['Virtual', 'V'] },
    ADMIN_LINKS: { practicas: 'Prácticas' }
  };
  vm.createContext(context);
  vm.runInContext(teamJs.slice(teamJs.indexOf('function filteredAdminPeople('), teamJs.indexOf('function scheduleRows(')), context);
  return context;
}

test('when searching collaborators, consolidated report card and KPIs are hidden', () => {
  const ctx = harness();

  // Initially without search
  ctx.$('admin-people-search').value = '';
  ctx.renderAdminPeople();
  assert.equal(ctx.$('admin-attendance-export-card').hidden, false);
  assert.equal(ctx.$('admin-people-kpis').hidden, false);
  assert.match(ctx.$('admin-people-list').innerHTML, /Yeiser Jamber Avila Medina/);
  assert.match(ctx.$('admin-people-list').innerHTML, /Ana Gomez Lopez/);

  // When searching "yei"
  ctx.$('admin-people-search').value = 'yei';
  ctx.renderAdminPeople();
  assert.equal(ctx.$('admin-attendance-export-card').hidden, true);
  assert.equal(ctx.$('admin-people-kpis').hidden, true);
  assert.match(ctx.$('admin-people-list').innerHTML, /Yeiser Jamber Avila Medina/);
  assert.doesNotMatch(ctx.$('admin-people-list').innerHTML, /Ana Gomez Lopez/);

  // When clearing search
  ctx.$('admin-people-search').value = '';
  ctx.renderAdminPeople();
  assert.equal(ctx.$('admin-attendance-export-card').hidden, false);
  assert.equal(ctx.$('admin-people-kpis').hidden, false);
  assert.match(ctx.$('admin-people-list').innerHTML, /Yeiser Jamber Avila Medina/);
  assert.match(ctx.$('admin-people-list').innerHTML, /Ana Gomez Lopez/);
});

test('mobile CSS enables smooth scrolling without overflow trap', () => {
  assert.match(mobileCss, /#portal #view-gestion>#admin-people-section[\s\S]*?overflow:visible!important/);
  assert.match(workspaceCss, /@media \(max-width: 900px\)[\s\S]*?overflow: visible !important/);
  assert.match(profileCss, /@media \(max-width: 900px\)[\s\S]*?overflow: visible !important/);
  // Guarantee mobile admin-section-nav is a responsive horizontal pill scroller
  assert.match(mobileCss, /#portal #view-gestion > \.admin-section-nav[\s\S]*?overflow-x: auto !important/);
  assert.match(mobileCss, /#portal #view-gestion > \.admin-section-nav[\s\S]*?-webkit-overflow-scrolling: touch !important/);
  assert.doesNotMatch(mobileCss, /#portal\.admin-wide #view-gestion > \.admin-section-nav\s*\{\s*display:\s*none\s*!important/);
});

test('when searching contracts, contract KPIs are hidden for streamlined mobile UX', () => {
  const ctx = harness();
  ctx.renderAdminContracts();
  assert.equal(ctx.$('admin-contract-kpis').hidden, false);

  // When searching "yei"
  ctx.$('admin-contract-search').value = 'yei';
  ctx.renderAdminContracts();
  assert.equal(ctx.$('admin-contract-kpis').hidden, true);

  // When clearing search
  ctx.$('admin-contract-search').value = '';
  ctx.renderAdminContracts();
  assert.equal(ctx.$('admin-contract-kpis').hidden, false);
});
