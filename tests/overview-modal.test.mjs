import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('dashboard.html');
const css = read('assets/css/paginas/dashboard-overview-modal.css');
const js = read('assets/js/dashboard-overview-modal.js');
const dashboardJs = read('assets/js/dashboard.js');

test('dashboard.html contains MoonRow modal structure and assets', () => {
  assert.match(html, /id="admin-overview-modal"/);
  assert.match(html, /class="moonrow-modal"/);
  assert.match(html, /id="moonrow-modal-title"/);
  assert.match(html, /data-moonrow-tab="general"/);
  assert.match(html, /data-moonrow-tab="asistencias"/);
  assert.match(html, /data-moonrow-tab="evidencias"/);
  assert.match(html, /data-moonrow-tab="tareas"/);
  assert.match(html, /id="moonrow-hero-kpi-card"/);
  assert.match(html, /id="moonrow-hero-progress-card"/);
  assert.match(html, /id="moonrow-hero-dark-card"/);
  assert.match(html, /id="moonrow-filter-pills"/);
  assert.match(html, /id="moonrow-search-input"/);
  assert.match(html, /id="moonrow-table-body"/);
  assert.match(html, /assets\/css\/paginas\/dashboard-overview-modal\.css/);
  assert.match(html, /assets\/js\/dashboard-overview-modal\.js/);
});

test('dashboard-overview-modal.css defines MoonRow SaaS styling tokens and components', () => {
  assert.match(css, /\.moonrow-modal/);
  assert.match(css, /\.moonrow-sheet/);
  assert.match(css, /\.moonrow-nav-tabs/);
  assert.match(css, /\.moonrow-hero-grid/);
  assert.match(css, /\.moonrow-kpi-card/);
  assert.match(css, /\.moonrow-progress-card/);
  assert.match(css, /\.moonrow-dark-card/);
  assert.match(css, /\.moonrow-segmented-top-bar/);
  assert.match(css, /\.moonrow-filter-pills/);
  assert.match(css, /\.moonrow-table-card/);
  assert.match(css, /\.admin-chart:hover/);
});

test('dashboard.js renders overview charts with interactive dataset and caching', () => {
  assert.match(dashboardJs, /data-overview-chart="\${chart\.key}"/);
  assert.match(dashboardJs, /window\.KJA_OVERVIEW_DATA=/);
  assert.match(dashboardJs, /role="button"/);
});

test('dashboard-overview-modal.js defines openOverviewModal, tab switching and close handlers', () => {
  assert.match(js, /function openOverviewModal/);
  assert.match(js, /function closeOverviewModal/);
  assert.match(js, /renderGeneralView/);
  assert.match(js, /renderAsistenciasView/);
  assert.match(js, /renderEvidenciasView/);
  assert.match(js, /renderTareasView/);
  assert.match(js, /window\.openOverviewModal/);
});
