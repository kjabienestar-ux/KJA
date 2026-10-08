import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('dashboard.html contains desktop filter triggers and popovers for close section', () => {
  const html = fs.readFileSync('dashboard.html', 'utf8');
  assert.match(html, /id="admin-close-date-trigger"/);
  assert.match(html, /id="admin-close-date-display"/);
  assert.match(html, /id="admin-close-calendar-popover"/);
  assert.match(html, /id="admin-close-date"/);

  assert.match(html, /id="admin-close-area-trigger"/);
  assert.match(html, /id="admin-close-area-display"/);
  assert.match(html, /id="admin-close-area-popover"/);
  assert.match(html, /id="admin-close-area"/);
  assert.match(html, /id="admin-close-area-search-input"/);
});

test('dashboard-close-workspace.css styles triggers and popovers', () => {
  const css = fs.readFileSync('assets/css/paginas/dashboard-close-workspace.css', 'utf8');
  assert.match(css, /\.admin-close-trigger-btn/);
  assert.match(css, /\.admin-close-calendar-popover/);
  assert.match(css, /\.admin-close-area-popover/);
  assert.match(css, /\.admin-close-cal-day/);
  assert.match(css, /\.admin-close-area-opt-btn/);
});

test('dashboard-admin-cierre.js defines formatAdminCloseDisplayDate and custom controls', () => {
  const js = fs.readFileSync('assets/js/dashboard-admin-cierre.js', 'utf8');
  assert.match(js, /function formatAdminCloseDisplayDate/);
  assert.match(js, /function syncAdminCloseDatePicker/);
  assert.match(js, /function openAdminCloseCalendar/);
  assert.match(js, /function closeAdminCloseCalendar/);
  assert.match(js, /function syncAdminCloseAreaCustom/);
  assert.match(js, /function openAdminCloseAreaPopover/);
  assert.match(js, /function filterAdminCloseAreaOptions/);
});

test('formatAdminCloseDisplayDate formats ISO date to Peruvian DD/MM/YYYY format', () => {
  const js = fs.readFileSync('assets/js/dashboard-admin-cierre.js', 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(js.slice(js.indexOf('function formatAdminCloseDisplayDate('), js.indexOf('function syncAdminCloseDatePicker(')), ctx);
  assert.equal(ctx.formatAdminCloseDisplayDate('2026-10-07'), '07/10/2026');
  assert.equal(ctx.formatAdminCloseDisplayDate('2026-01-15'), '15/01/2026');
  assert.equal(ctx.formatAdminCloseDisplayDate(''), '--/--/----');
});
