import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
const teamJs = fs.readFileSync(new URL('../assets/js/dashboard-admin-equipo.js', import.meta.url), 'utf8');
const exportJs = fs.readFileSync(new URL('../assets/js/dashboard-attendance-export.js', import.meta.url), 'utf8');

test('HTML markup contains institution filters in directory and attendance export', () => {
  assert.match(html, /<select id="admin-people-institution" aria-label="Filtrar colaboradores por institución">/);
  assert.match(html, /<select id="attendance-export-institution" class="attendance-export-institution-select" aria-label="Filtrar internos por institución">/);
  assert.match(html, /<button type="button" id="attendance-export-institution-all" hidden>/);
  assert.match(html, /placeholder="Buscar nombre, DNI, área o institución"/);
});

test('filteredAdminPeople filters directory by institution and sin institucion', () => {
  const start = teamJs.indexOf('function filteredAdminPeople(');
  const body = teamJs.slice(start, teamJs.indexOf('function renderAdminPeople(', start));
  const fields = {
    'admin-people-search': '',
    'admin-people-area': '',
    'admin-people-inactive': { checked: true },
    'admin-people-email': '',
    'admin-people-institution': ''
  };
  const personas = [
    { id: 1, nombre: 'Ana UTP', activo: true, institucion: 'UTP - LIMA CENTRO' },
    { id: 2, nombre: 'Beto Senati', activo: true, institucion: 'SENATI - INDEPENDENCIA' },
    { id: 3, nombre: 'Carlos Sin', activo: true, institucion: null },
    { id: 4, nombre: 'Diana UTP', activo: true, institucion: 'UTP - LIMA CENTRO' }
  ];
  const c = {
    APP: { adminTeam: { personas } },
    $: id => fields[id] && typeof fields[id] === 'object' ? fields[id] : { value: fields[id], checked: false }
  };
  vm.createContext(c);
  vm.runInContext(body, c);

  const names = () => vm.runInContext("filteredAdminPeople('people').map(p=>p.nombre).join(',')", c);
  assert.equal(names(), 'Ana UTP,Beto Senati,Carlos Sin,Diana UTP');

  fields['admin-people-institution'] = 'UTP - LIMA CENTRO';
  assert.equal(names(), 'Ana UTP,Diana UTP');

  fields['admin-people-institution'] = 'SENATI - INDEPENDENCIA';
  assert.equal(names(), 'Beto Senati');

  fields['admin-people-institution'] = '__sin__';
  assert.equal(names(), 'Carlos Sin');

  // Search by institution name text
  fields['admin-people-institution'] = '';
  fields['admin-people-search'] = 'senati';
  assert.equal(names(), 'Beto Senati');
});

test('attendance export filters by institution and allows selecting all users of that institution', () => {
  const nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, innerHTML: '', textContent: '', hidden: false });
    return nodes.get(id);
  };
  const personas = [
    { id: 10, nombre: 'Alviery UTP', dni: '73939131', area: 'Sistemas', institucion: 'UTP - LIMA CENTRO', activo: true },
    { id: 11, nombre: 'Ronny UTP', dni: '72020383', area: 'Sistemas', institucion: 'UTP - LIMA CENTRO', activo: true },
    { id: 12, nombre: 'Alejandra UTP', dni: '78021060', area: 'Diseño', institucion: 'UTP - LIMA CENTRO', activo: true },
    { id: 20, nombre: 'Erika Senati', dni: '71338491', area: 'Marketing', institucion: 'SENATI - INDEPENDENCIA', activo: true },
    { id: 30, nombre: 'Doris Sin', dni: '71089285', area: 'Psicología', institucion: null, activo: true }
  ];

  const c = {
    APP: { access: { acceso_panel: true }, adminTeam: { personas } },
    $: el,
    esc: s => String(s ?? ''),
    Intl,
    Date
  };
  vm.createContext(c);
  vm.runInContext(exportJs, c);

  // Initial render populates options and defaults
  c.renderAttendanceExport();
  assert.equal(el('attendance-export-institution').innerHTML.includes('UTP - LIMA CENTRO (3)'), true);
  assert.equal(el('attendance-export-institution').innerHTML.includes('SENATI - INDEPENDENCIA (1)'), true);
  assert.equal(el('attendance-export-institution').innerHTML.includes('Sin institución (1)'), true);

  // Filter by UTP
  el('attendance-export-institution').value = 'UTP - LIMA CENTRO';
  c.renderAttendanceExport();
  const visible = c.attendanceExportVisible();
  assert.equal(visible.length, 3);
  assert.deepEqual(visible.map(p => p.id), [10, 11, 12]);
  assert.equal(el('attendance-export-institution-all').hidden, false);
  assert.match(el('attendance-export-institution-all').textContent, /3/);

  // Click "Seleccionar toda la institución"
  el('attendance-export-institution-all').onclick();
  const selected = c.attendanceExportPeople();
  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map(p => p.id), [10, 11, 12]);
  assert.equal(el('admin-attendance-excel').disabled, false);
  assert.match(el('admin-attendance-export-status').textContent, /Seleccionados los 3 colaboradores de UTP - LIMA CENTRO/);

  // Switch to SENATI
  el('attendance-export-institution').value = 'SENATI - INDEPENDENCIA';
  c.renderAttendanceExport();
  assert.equal(c.attendanceExportVisible().length, 1);
  assert.equal(c.attendanceExportVisible()[0].id, 20);

  // Select all from SENATI replaces selection
  el('attendance-export-institution-all').onclick();
  assert.equal(c.attendanceExportPeople().length, 1);
  assert.equal(c.attendanceExportPeople()[0].id, 20);

  // Searching by institution in text search
  el('attendance-export-institution').value = '';
  el('attendance-export-search').value = 'utp';
  assert.equal(c.attendanceExportVisible().length, 3);
});
