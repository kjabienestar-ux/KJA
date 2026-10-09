/* ── MoonRow Interactive Overview Modal for KJA Dashboard ── */
(function() {
  'use strict';

  let currentKey = 'general';
  let currentFilter = 'all';
  let currentSearch = '';
  let currentArea = '';

  const palette = {
    green: '#10b981',
    coral: '#f43f5e',
    amber: '#f59e0b',
    blue: '#3b82f6',
    slate: '#94a3b8',
    dark: '#0f172a'
  };

  function getModal() {
    return document.getElementById('admin-overview-modal');
  }

  function formatTime(isoStr) {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (_) {
      return null;
    }
  }

  function getOverviewData() {
    return window.KJA_OVERVIEW_DATA || { people: [], marks: [], closePeople: [] };
  }

  function openOverviewModal(key) {
    const modal = getModal();
    if (!modal) return;
    currentKey = ['general', 'asistencias', 'evidencias', 'tareas'].includes(key) ? key : 'general';
    currentFilter = 'all';
    currentSearch = '';
    currentArea = '';

    const searchInput = modal.querySelector('#moonrow-search-input');
    if (searchInput) searchInput.value = '';

    modal.hidden = false;
    document.documentElement.classList.add('moonrow-modal-open');
    document.body.classList.add('moonrow-modal-open');
    renderModalContent();

    const body = modal.querySelector('.moonrow-body');
    if (body) body.scrollTop = 0;

    // Focus close or sheet
    requestAnimationFrame(() => {
      const sheet = modal.querySelector('.moonrow-sheet');
      if (sheet) sheet.focus();
    });
  }

  function closeOverviewModal() {
    const modal = getModal();
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.classList.remove('moonrow-modal-open');
    document.body.classList.remove('moonrow-modal-open');
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    if (!name) return 'KJ';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'KJ';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function renderAvatar(person) {
    const url = person?.foto_url || '';
    const inits = getInitials(person?.nombre);
    if (url) {
      return `<span class="moonrow-avatar"><img src="${escapeHtml(url)}" alt="${escapeHtml(person?.nombre || '')}" loading="lazy" onerror="this.remove()"></span>`;
    }
    return `<span class="moonrow-avatar">${escapeHtml(inits)}</span>`;
  }

  function renderModalContent() {
    const modal = getModal();
    if (!modal || modal.hidden) return;

    const { people = [], marks = [], closePeople = [] } = getOverviewData();
    const ids = new Set(people.map(p => String(p.id)));
    const closes = closePeople.filter(p => ids.has(String(p.id)));
    const byClose = new Map(closes.map(p => [String(p.id), p.cierre || {}]));
    const byMark = new Map(marks.map(p => [String(p.colaborador_id), p]));

    // Sync navigation tabs active state
    modal.querySelectorAll('.moonrow-tab-btn').forEach(btn => {
      const isCurrent = btn.dataset.moonrowTab === currentKey;
      btn.classList.toggle('is-active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    // Populate Area filter select if needed
    const areaSelect = modal.querySelector('#moonrow-area-select');
    if (areaSelect && areaSelect.options.length <= 1) {
      const areaMap = new Map();
      people.forEach(p => {
        const areaName = p.asis_areas?.nombre || p.area || 'Sin área';
        const areaId = String(p.area_id || '');
        if (areaId && !areaMap.has(areaId)) areaMap.set(areaId, areaName);
      });
      const sortedAreas = [...areaMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
      areaSelect.innerHTML = '<option value="">Todas las áreas</option>' +
        sortedAreas.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
    }
    if (areaSelect) areaSelect.value = currentArea;

    // Header Titles
    const titleEl = modal.querySelector('#moonrow-modal-title');
    const subEl = modal.querySelector('#moonrow-modal-subtitle');
    const iconEl = modal.querySelector('#moonrow-brand-icon');

    const meta = {
      general: {
        title: 'Jornadas Generales de Hoy',
        sub: 'Monitoreo de estado de cierres (completas, incompletas y en curso)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M12 7v5l3 2"/></svg>'
      },
      asistencias: {
        title: 'Control de Asistencia de Hoy',
        sub: 'Entradas registradas, puntualidad, justificaciones y colaboradores sin registro',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>'
      },
      evidencias: {
        title: 'Requisitos y Evidencias Diarias',
        sub: 'Verificación de RPE, bitácoras y requisitos entregados por el equipo',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
      },
      tareas: {
        title: 'Tareas y Asignaciones del Día',
        sub: 'Entregables individuales asignados y estado de cumplimiento de los colaboradores',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
      }
    }[currentKey];

    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
    if (iconEl) iconEl.innerHTML = meta.icon;

    // Render Tab Views
    if (currentKey === 'general') {
      renderGeneralView(people, byClose, byMark);
    } else if (currentKey === 'asistencias') {
      renderAsistenciasView(people, byMark, byClose);
    } else if (currentKey === 'evidencias') {
      renderEvidenciasView(people, closes);
    } else if (currentKey === 'tareas') {
      renderTareasView(people, closes);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     1. VISTA GENERAL
  ───────────────────────────────────────────────────────────── */
  function renderGeneralView(people, byClose, byMark) {
    const modal = getModal();
    const complete = people.filter(p => ['completa', 'regularizada'].includes(byClose.get(String(p.id))?.estado)).length;
    const incomplete = people.filter(p => byClose.get(String(p.id))?.estado === 'incompleta').length;
    const total = people.length;
    const others = Math.max(0, total - complete - incomplete);
    const completePct = total ? Math.round((complete / total) * 100) : 0;
    const incompletePct = total ? Math.round((incomplete / total) * 100) : 0;
    const othersPct = total ? Math.max(0, 100 - completePct - incompletePct) : 0;

    // Hero KPI Card
    const heroEl = modal.querySelector('#moonrow-hero-kpi-card');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="moonrow-kpi-top">
          <span class="moonrow-kpi-label">Jornadas Concluidas</span>
          <span class="moonrow-chip is-positive">+${completePct}% efectividad</span>
        </div>
        <div class="moonrow-kpi-number-row">
          <strong class="moonrow-kpi-val">${complete}</strong>
          <span class="moonrow-kpi-total">/ ${total} personas</span>
        </div>
        <p class="moonrow-kpi-sub">${complete} jornadas completadas hoy sin observaciones pendientes.</p>
        <button type="button" class="moonrow-kpi-action" data-jump-section="lista">Pasar lista en vivo ↗</button>
      `;
    }

    // Hero Progress Card
    const progressEl = modal.querySelector('#moonrow-hero-progress-card');
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="moonrow-progress-head">
          <h4 class="moonrow-progress-title">Desglose de Jornadas</h4>
          <span class="moonrow-progress-summary-pill">${total} Colaboradores</span>
        </div>
        <div class="moonrow-segmented-top-bar" role="progressbar" aria-valuenow="${completePct}" aria-valuemin="0" aria-valuemax="100">
          <div class="moonrow-seg-segment" style="width: ${completePct}%; background: ${palette.green};" title="Completas: ${completePct}%"></div>
          <div class="moonrow-seg-segment" style="width: ${incompletePct}%; background: ${palette.coral};" title="Incompletas: ${incompletePct}%"></div>
          <div class="moonrow-seg-segment" style="width: ${othersPct}%; background: ${palette.amber};" title="Otros / En curso: ${othersPct}%"></div>
        </div>
        <div class="moonrow-breakdown-list">
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.green};"></span> Completas</span>
              <span class="moonrow-breakdown-meta">${completePct}% <small>(${complete})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${completePct}%; background: ${palette.green};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.coral};"></span> Incompletas</span>
              <span class="moonrow-breakdown-meta">${incompletePct}% <small>(${incomplete})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${incompletePct}%; background: ${palette.coral};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.amber};"></span> En curso / Otros</span>
              <span class="moonrow-breakdown-meta">${othersPct}% <small>(${others})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${othersPct}%; background: ${palette.amber};"></div></div>
          </div>
        </div>
      `;
    }

    // Hero Dark Card
    const darkEl = modal.querySelector('#moonrow-hero-dark-card');
    if (darkEl) {
      darkEl.innerHTML = `
        <div class="moonrow-dark-header">
          <span class="moonrow-dark-date">Jornada de Hoy</span>
          <span class="moonrow-dark-badge">Tiempo real</span>
        </div>
        <div class="moonrow-dark-kpi-row">
          <div class="moonrow-dark-number">${total}</div>
          <div class="moonrow-dark-label">Colaboradores programados</div>
        </div>
        <div class="moonrow-dark-bar">
          <div style="width: ${completePct}%; background: ${palette.green};"></div>
          <div style="width: ${incompletePct}%; background: ${palette.coral};"></div>
          <div style="width: ${othersPct}%; background: ${palette.amber};"></div>
        </div>
        <div class="moonrow-dark-legend">
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.green};"></span> ${completePct}% comp</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.coral};"></span> ${incompletePct}% incomp</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.amber};"></span> ${othersPct}% otros</span>
        </div>
      `;
    }

    // Filter Pills
    const pillsEl = modal.querySelector('#moonrow-filter-pills');
    if (pillsEl) {
      pillsEl.innerHTML = `
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" data-moonrow-filter="all">Todos <span class="moonrow-filter-count">${total}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'complete' ? 'is-active' : ''}" data-moonrow-filter="complete">Completas <span class="moonrow-filter-count">${complete}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'incomplete' ? 'is-active' : ''}" data-moonrow-filter="incomplete">Incompletas <span class="moonrow-filter-count">${incomplete}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'other' ? 'is-active' : ''}" data-moonrow-filter="other">En curso / Otros <span class="moonrow-filter-count">${others}</span></button>
      `;
    }

    // Prepare Records
    const rows = people.map(p => {
      const key = String(p.id);
      const close = byClose.get(key) || {};
      const mark = byMark.get(key);
      const rawState = close.estado || (mark ? 'en_curso' : 'sin_registro');
      let category = 'other';
      if (['completa', 'regularizada'].includes(rawState)) category = 'complete';
      else if (rawState === 'incompleta') category = 'incomplete';

      const reqs = close.requisitos || [];
      const reqDone = reqs.filter(r => r.completo === true).length;
      const reqTotal = reqs.length;

      const entrada = formatTime(close.entrada_at) || formatTime(mark?.marcado_at) || 'Sin entrada';
      const salida = formatTime(close.salida_at) || (mark ? 'En curso' : 'Sin salida');

      return {
        person: p,
        category,
        rawState,
        entrada,
        salida,
        reqSummary: reqTotal > 0 ? `${reqDone}/${reqTotal} requisitos` : 'Sin requisitos',
        area: p.asis_areas?.nombre || p.area || 'Sin área',
        areaId: String(p.area_id || '')
      };
    });

    renderTable(rows, [
      { key: 'colab', label: 'COLABORADOR' },
      { key: 'area', label: 'ÁREA' },
      { key: 'schedule', label: 'ENTRADA / SALIDA' },
      { key: 'requirements', label: 'REQUISITOS' },
      { key: 'status', label: 'ESTADO' },
      { key: 'action', label: 'ACCIÓN' }
    ], row => {
      let badgeHtml = '';
      if (row.category === 'complete') {
        badgeHtml = '<span class="moonrow-badge is-green"><span class="moonrow-badge-dot"></span> Completa</span>';
      } else if (row.category === 'incomplete') {
        badgeHtml = '<span class="moonrow-badge is-coral"><span class="moonrow-badge-dot"></span> Incompleta</span>';
      } else if (row.rawState === 'en_curso') {
        badgeHtml = '<span class="moonrow-badge is-amber"><span class="moonrow-badge-dot"></span> En curso</span>';
      } else {
        badgeHtml = '<span class="moonrow-badge is-slate"><span class="moonrow-badge-dot"></span> Sin registro</span>';
      }

      return `
        <td>
          <div class="moonrow-colab-cell">
            ${renderAvatar(row.person)}
            <div class="moonrow-colab-info">
              <strong class="moonrow-colab-name">${escapeHtml(row.person.nombre)}</strong>
              <span class="moonrow-area-tag">${escapeHtml(row.area)}</span>
            </div>
          </div>
        </td>
        <td><span class="moonrow-area-tag">${escapeHtml(row.area)}</span></td>
        <td>
          <div class="moonrow-detail-cell">
            <span class="moonrow-detail-main">${escapeHtml(row.entrada)}</span>
            <span class="moonrow-detail-sub">${escapeHtml(row.salida)}</span>
          </div>
        </td>
        <td><span class="moonrow-detail-sub">${escapeHtml(row.reqSummary)}</span></td>
        <td>${badgeHtml}</td>
        <td>
          <button type="button" class="moonrow-row-btn" data-person-profile-id="${row.person.id}">Ficha ↗</button>
        </td>
      `;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     2. VISTA ASISTENCIAS
  ───────────────────────────────────────────────────────────── */
  function renderAsistenciasView(people, byMark, byClose) {
    const modal = getModal();
    const total = people.length;
    const countPresent = people.filter(p => byMark.get(String(p.id))?.estado === 'P').length;
    const countLate = people.filter(p => byMark.get(String(p.id))?.estado === 'T').length;
    const countJustified = people.filter(p => byMark.get(String(p.id))?.estado === 'J').length;
    const countOther = people.filter(p => byMark.has(String(p.id)) && !['P', 'T', 'J'].includes(byMark.get(String(p.id)).estado)).length;
    const countNoEntry = people.filter(p => !byMark.has(String(p.id))).length;
    const marked = total - countNoEntry;

    const markedPct = total ? Math.round((marked / total) * 100) : 0;
    const presentPct = total ? Math.round((countPresent / total) * 100) : 0;
    const latePct = total ? Math.round((countLate / total) * 100) : 0;
    const noEntryPct = total ? Math.max(0, 100 - markedPct) : 0;

    // Hero KPI Card
    const heroEl = modal.querySelector('#moonrow-hero-kpi-card');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="moonrow-kpi-top">
          <span class="moonrow-kpi-label">Asistencia Registrada</span>
          <span class="moonrow-chip ${markedPct > 50 ? 'is-positive' : 'is-neutral'}">${markedPct}% del equipo</span>
        </div>
        <div class="moonrow-kpi-number-row">
          <strong class="moonrow-kpi-val">${marked}</strong>
          <span class="moonrow-kpi-total">/ ${total} colaboradores</span>
        </div>
        <p class="moonrow-kpi-sub">${countPresent} puntuales, ${countLate} tardanzas y ${countNoEntry} pendientes de marcar entrada.</p>
        <button type="button" class="moonrow-kpi-action" data-jump-section="lista">Ir a Pasar lista ↗</button>
      `;
    }

    // Hero Progress Card
    const progressEl = modal.querySelector('#moonrow-hero-progress-card');
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="moonrow-progress-head">
          <h4 class="moonrow-progress-title">Distribución de Marcas</h4>
          <span class="moonrow-progress-summary-pill">${marked} Marcados</span>
        </div>
        <div class="moonrow-segmented-top-bar" role="progressbar" aria-valuenow="${markedPct}">
          <div class="moonrow-seg-segment" style="width: ${presentPct}%; background: ${palette.green};" title="Presentes: ${presentPct}%"></div>
          <div class="moonrow-seg-segment" style="width: ${latePct}%; background: ${palette.coral};" title="Tardanzas: ${latePct}%"></div>
          <div class="moonrow-seg-segment" style="width: ${noEntryPct}%; background: ${palette.slate};" title="Sin registro: ${noEntryPct}%"></div>
        </div>
        <div class="moonrow-breakdown-list">
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.green};"></span> Presentes (P)</span>
              <span class="moonrow-breakdown-meta">${presentPct}% <small>(${countPresent})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${presentPct}%; background: ${palette.green};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.coral};"></span> Tardanzas (T)</span>
              <span class="moonrow-breakdown-meta">${latePct}% <small>(${countLate})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${latePct}%; background: ${palette.coral};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.slate};"></span> Sin registro</span>
              <span class="moonrow-breakdown-meta">${noEntryPct}% <small>(${countNoEntry})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${noEntryPct}%; background: ${palette.slate};"></div></div>
          </div>
        </div>
      `;
    }

    // Hero Dark Card
    const darkEl = modal.querySelector('#moonrow-hero-dark-card');
    if (darkEl) {
      darkEl.innerHTML = `
        <div class="moonrow-dark-header">
          <span class="moonrow-dark-date">Monitoreo Diario</span>
          <span class="moonrow-dark-badge">Asistencias</span>
        </div>
        <div class="moonrow-dark-kpi-row">
          <div class="moonrow-dark-number">${countNoEntry}</div>
          <div class="moonrow-dark-label">Colaboradores sin entrada aún</div>
        </div>
        <div class="moonrow-dark-bar">
          <div style="width: ${presentPct}%; background: ${palette.green};"></div>
          <div style="width: ${latePct}%; background: ${palette.coral};"></div>
          <div style="width: ${noEntryPct}%; background: ${palette.slate};"></div>
        </div>
        <div class="moonrow-dark-legend">
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.green};"></span> ${countPresent} Puntual</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.coral};"></span> ${countLate} Tarde</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.slate};"></span> ${countNoEntry} Sin marcar</span>
        </div>
      `;
    }

    // Filter Pills
    const pillsEl = modal.querySelector('#moonrow-filter-pills');
    if (pillsEl) {
      pillsEl.innerHTML = `
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" data-moonrow-filter="all">Todos <span class="moonrow-filter-count">${total}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'P' ? 'is-active' : ''}" data-moonrow-filter="P">Presentes <span class="moonrow-filter-count">${countPresent}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'T' ? 'is-active' : ''}" data-moonrow-filter="T">Tardanzas <span class="moonrow-filter-count">${countLate}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'J' ? 'is-active' : ''}" data-moonrow-filter="J">Justificados <span class="moonrow-filter-count">${countJustified}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'empty' ? 'is-active' : ''}" data-moonrow-filter="empty">Sin registro <span class="moonrow-filter-count">${countNoEntry}</span></button>
      `;
    }

    // Prepare Records
    const rows = people.map(p => {
      const mark = byMark.get(String(p.id));
      const code = mark ? mark.estado : 'empty';
      const hora = mark?.marcado_at ? formatTime(mark.marcado_at) : '— Aún no marca';
      const origen = mark?.origen ? `Origen: ${mark.origen}` : 'Sin conexión registrada';

      return {
        person: p,
        category: code,
        hora,
        origen,
        area: p.asis_areas?.nombre || p.area || 'Sin área',
        areaId: String(p.area_id || '')
      };
    });

    renderTable(rows, [
      { key: 'colab', label: 'COLABORADOR' },
      { key: 'area', label: 'ÁREA' },
      { key: 'time', label: 'HORA DE MARCADO' },
      { key: 'origin', label: 'MÉTODO / ORIGEN' },
      { key: 'status', label: 'ESTADO' },
      { key: 'action', label: 'ACCIÓN' }
    ], row => {
      let badgeHtml = '';
      if (row.category === 'P') {
        badgeHtml = '<span class="moonrow-badge is-green"><span class="moonrow-badge-dot"></span> Presente</span>';
      } else if (row.category === 'T') {
        badgeHtml = '<span class="moonrow-badge is-coral"><span class="moonrow-badge-dot"></span> Tardanza</span>';
      } else if (row.category === 'J') {
        badgeHtml = '<span class="moonrow-badge is-blue"><span class="moonrow-badge-dot"></span> Justificado</span>';
      } else if (row.category === 'empty') {
        badgeHtml = '<span class="moonrow-badge is-slate"><span class="moonrow-badge-dot"></span> Sin registro</span>';
      } else {
        badgeHtml = `<span class="moonrow-badge is-amber"><span class="moonrow-badge-dot"></span> ${escapeHtml(row.category)}</span>`;
      }

      return `
        <td>
          <div class="moonrow-colab-cell">
            ${renderAvatar(row.person)}
            <div class="moonrow-colab-info">
              <strong class="moonrow-colab-name">${escapeHtml(row.person.nombre)}</strong>
              <span class="moonrow-area-tag">${escapeHtml(row.area)}</span>
            </div>
          </div>
        </td>
        <td><span class="moonrow-area-tag">${escapeHtml(row.area)}</span></td>
        <td><strong class="moonrow-detail-main">${escapeHtml(row.hora)}</strong></td>
        <td><span class="moonrow-detail-sub">${escapeHtml(row.origen)}</span></td>
        <td>${badgeHtml}</td>
        <td>
          <button type="button" class="moonrow-row-btn" data-person-profile-id="${row.person.id}">Ficha ↗</button>
        </td>
      `;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     3. VISTA EVIDENCIAS
  ───────────────────────────────────────────────────────────── */
  function renderEvidenciasView(people, closes) {
    const modal = getModal();
    const requirements = closes.flatMap(p => (p.cierre?.requisitos || []).filter(r => r.tipo !== 'salida').map(r => ({
      ...r,
      person: p,
      area: p.asis_areas?.nombre || p.area || 'Sin área',
      areaId: String(p.area_id || '')
    })));

    const total = requirements.length;
    const completed = requirements.filter(r => r.completo === true).length;
    const pending = total - completed;
    const completePct = total ? Math.round((completed / total) * 100) : 0;
    const pendingPct = total ? Math.max(0, 100 - completePct) : 0;

    // Hero KPI Card
    const heroEl = modal.querySelector('#moonrow-hero-kpi-card');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="moonrow-kpi-top">
          <span class="moonrow-kpi-label">Requisitos Entregados</span>
          <span class="moonrow-chip is-positive">${completePct}% completado</span>
        </div>
        <div class="moonrow-kpi-number-row">
          <strong class="moonrow-kpi-val">${completed}</strong>
          <span class="moonrow-kpi-total">/ ${total} evidencias</span>
        </div>
        <p class="moonrow-kpi-sub">${completed} evidencias verificadas de ${total} exigidas en los cierres de hoy.</p>
        <button type="button" class="moonrow-kpi-action" data-jump-section="cierres">Ver panel de cierres ↗</button>
      `;
    }

    // Hero Progress Card
    const progressEl = modal.querySelector('#moonrow-hero-progress-card');
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="moonrow-progress-head">
          <h4 class="moonrow-progress-title">Cumplimiento de Requisitos</h4>
          <span class="moonrow-progress-summary-pill">${total} Requisitos</span>
        </div>
        <div class="moonrow-segmented-top-bar" role="progressbar" aria-valuenow="${completePct}">
          <div class="moonrow-seg-segment" style="width: ${completePct}%; background: ${palette.green};" title="Completados: ${completePct}%"></div>
          <div class="moonrow-seg-segment" style="width: ${pendingPct}%; background: ${palette.coral};" title="Pendientes: ${pendingPct}%"></div>
        </div>
        <div class="moonrow-breakdown-list">
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.green};"></span> Completados</span>
              <span class="moonrow-breakdown-meta">${completePct}% <small>(${completed})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${completePct}%; background: ${palette.green};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.coral};"></span> Pendientes</span>
              <span class="moonrow-breakdown-meta">${pendingPct}% <small>(${pending})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${pendingPct}%; background: ${palette.coral};"></div></div>
          </div>
        </div>
      `;
    }

    // Hero Dark Card
    const darkEl = modal.querySelector('#moonrow-hero-dark-card');
    if (darkEl) {
      darkEl.innerHTML = `
        <div class="moonrow-dark-header">
          <span class="moonrow-dark-date">Cierre Diario</span>
          <span class="moonrow-dark-badge">Evidencias</span>
        </div>
        <div class="moonrow-dark-kpi-row">
          <div class="moonrow-dark-number">${pending}</div>
          <div class="moonrow-dark-label">Evidencias por regularizar</div>
        </div>
        <div class="moonrow-dark-bar">
          <div style="width: ${completePct}%; background: ${palette.green};"></div>
          <div style="width: ${pendingPct}%; background: ${palette.coral};"></div>
        </div>
        <div class="moonrow-dark-legend">
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.green};"></span> ${completed} Listas</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.coral};"></span> ${pending} Pendientes</span>
        </div>
      `;
    }

    // Filter Pills
    const pillsEl = modal.querySelector('#moonrow-filter-pills');
    if (pillsEl) {
      pillsEl.innerHTML = `
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" data-moonrow-filter="all">Todos <span class="moonrow-filter-count">${total}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'complete' ? 'is-active' : ''}" data-moonrow-filter="complete">Completados <span class="moonrow-filter-count">${completed}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'pending' ? 'is-active' : ''}" data-moonrow-filter="pending">Pendientes <span class="moonrow-filter-count">${pending}</span></button>
      `;
    }

    const rows = requirements.map(r => ({
      person: r.person,
      category: r.completo ? 'complete' : 'pending',
      reqTitle: r.titulo || r.tipo?.toUpperCase() || 'Requisito',
      detail: r.observacion || (r.completo ? 'Entregado a tiempo' : 'Falta entrega del colaborador'),
      url: r.url || r.archivo_url || '',
      area: r.area,
      areaId: r.areaId
    }));

    renderTable(rows, [
      { key: 'colab', label: 'COLABORADOR' },
      { key: 'area', label: 'ÁREA' },
      { key: 'requirement', label: 'REQUISITO' },
      { key: 'detail', label: 'DETALLE / OBSERVACIÓN' },
      { key: 'status', label: 'ESTADO' },
      { key: 'action', label: 'ACCIÓN' }
    ], row => {
      const badgeHtml = row.category === 'complete'
        ? '<span class="moonrow-badge is-green"><span class="moonrow-badge-dot"></span> Completado</span>'
        : '<span class="moonrow-badge is-coral"><span class="moonrow-badge-dot"></span> Pendiente</span>';

      const fileBtn = row.url
        ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener" class="moonrow-row-btn">Ver archivo ↗</a>`
        : `<button type="button" class="moonrow-row-btn" data-person-profile-id="${row.person.id}">Ficha ↗</button>`;

      return `
        <td>
          <div class="moonrow-colab-cell">
            ${renderAvatar(row.person)}
            <div class="moonrow-colab-info">
              <strong class="moonrow-colab-name">${escapeHtml(row.person.nombre)}</strong>
              <span class="moonrow-area-tag">${escapeHtml(row.area)}</span>
            </div>
          </div>
        </td>
        <td><span class="moonrow-area-tag">${escapeHtml(row.area)}</span></td>
        <td><strong class="moonrow-detail-main">${escapeHtml(row.reqTitle)}</strong></td>
        <td><span class="moonrow-detail-sub">${escapeHtml(row.detail)}</span></td>
        <td>${badgeHtml}</td>
        <td>${fileBtn}</td>
      `;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     4. VISTA TAREAS
  ───────────────────────────────────────────────────────────── */
  function renderTareasView(people, closes) {
    const modal = getModal();
    const tasks = closes.flatMap(p => (p.cierre?.asignaciones || []).map(a => ({
      ...a,
      person: p,
      area: p.asis_areas?.nombre || p.area || 'Sin área',
      areaId: String(p.area_id || '')
    })));

    const total = tasks.length;
    const delivered = tasks.filter(t => t.completo === true).length;
    const pending = total - delivered;
    const deliveredPct = total ? Math.round((delivered / total) * 100) : 0;
    const pendingPct = total ? Math.max(0, 100 - deliveredPct) : 0;

    // Hero KPI Card
    const heroEl = modal.querySelector('#moonrow-hero-kpi-card');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="moonrow-kpi-top">
          <span class="moonrow-kpi-label">Entregas del Día</span>
          <span class="moonrow-chip ${total ? 'is-positive' : 'is-neutral'}">${total ? `${deliveredPct}% cumplido` : 'Sin tareas'}</span>
        </div>
        <div class="moonrow-kpi-number-row">
          <strong class="moonrow-kpi-val">${delivered}</strong>
          <span class="moonrow-kpi-total">/ ${total} tareas</span>
        </div>
        <p class="moonrow-kpi-sub">${total ? `${delivered} tareas concluidas y entregadas satisfactoriamente hoy.` : 'No hay asignaciones programadas para hoy.'}</p>
        <button type="button" class="moonrow-kpi-action" data-jump-section="asignaciones">Gestionar asignaciones ↗</button>
      `;
    }

    // Hero Progress Card
    const progressEl = modal.querySelector('#moonrow-hero-progress-card');
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="moonrow-progress-head">
          <h4 class="moonrow-progress-title">Avance de Asignaciones</h4>
          <span class="moonrow-progress-summary-pill">${total} Asignadas</span>
        </div>
        <div class="moonrow-segmented-top-bar" role="progressbar" aria-valuenow="${deliveredPct}">
          <div class="moonrow-seg-segment" style="width: ${deliveredPct}%; background: ${palette.green};"></div>
          <div class="moonrow-seg-segment" style="width: ${pendingPct}%; background: ${palette.amber};"></div>
        </div>
        <div class="moonrow-breakdown-list">
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.green};"></span> Entregadas</span>
              <span class="moonrow-breakdown-meta">${deliveredPct}% <small>(${delivered})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${deliveredPct}%; background: ${palette.green};"></div></div>
          </div>
          <div class="moonrow-breakdown-item">
            <div class="moonrow-breakdown-row">
              <span class="moonrow-breakdown-name"><span class="moonrow-breakdown-color-bar" style="background: ${palette.amber};"></span> Pendientes</span>
              <span class="moonrow-breakdown-meta">${pendingPct}% <small>(${pending})</small></span>
            </div>
            <div class="moonrow-breakdown-bar-track"><div class="moonrow-breakdown-bar-fill" style="width: ${pendingPct}%; background: ${palette.amber};"></div></div>
          </div>
        </div>
      `;
    }

    // Hero Dark Card
    const darkEl = modal.querySelector('#moonrow-hero-dark-card');
    if (darkEl) {
      darkEl.innerHTML = `
        <div class="moonrow-dark-header">
          <span class="moonrow-dark-date">Asignaciones</span>
          <span class="moonrow-dark-badge">Equipo</span>
        </div>
        <div class="moonrow-dark-kpi-row">
          <div class="moonrow-dark-number">${total}</div>
          <div class="moonrow-dark-label">Tareas registradas para la jornada</div>
        </div>
        <div class="moonrow-dark-bar">
          <div style="width: ${deliveredPct}%; background: ${palette.green};"></div>
          <div style="width: ${pendingPct}%; background: ${palette.amber};"></div>
        </div>
        <div class="moonrow-dark-legend">
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.green};"></span> ${delivered} Concluidas</span>
          <span class="moonrow-dark-legend-item"><span class="moonrow-dark-legend-dot" style="background: ${palette.amber};"></span> ${pending} En progreso</span>
        </div>
      `;
    }

    // Filter Pills
    const pillsEl = modal.querySelector('#moonrow-filter-pills');
    if (pillsEl) {
      pillsEl.innerHTML = `
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" data-moonrow-filter="all">Todos <span class="moonrow-filter-count">${total}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'complete' ? 'is-active' : ''}" data-moonrow-filter="complete">Entregadas <span class="moonrow-filter-count">${delivered}</span></button>
        <button type="button" class="moonrow-filter-btn ${currentFilter === 'pending' ? 'is-active' : ''}" data-moonrow-filter="pending">Pendientes <span class="moonrow-filter-count">${pending}</span></button>
      `;
    }

    const rows = tasks.map(t => ({
      person: t.person,
      category: t.completo ? 'complete' : 'pending',
      taskTitle: t.titulo || 'Tarea operativa',
      instructions: t.instrucciones || 'Sin instrucciones adicionales',
      area: t.area,
      areaId: t.areaId
    }));

    renderTable(rows, [
      { key: 'colab', label: 'COLABORADOR' },
      { key: 'area', label: 'ÁREA' },
      { key: 'task', label: 'TAREA ASIGNADA' },
      { key: 'instructions', label: 'INSTRUCCIONES / DETALLE' },
      { key: 'status', label: 'ESTADO' },
      { key: 'action', label: 'ACCIÓN' }
    ], row => {
      const badgeHtml = row.category === 'complete'
        ? '<span class="moonrow-badge is-green"><span class="moonrow-badge-dot"></span> Entregada</span>'
        : '<span class="moonrow-badge is-amber"><span class="moonrow-badge-dot"></span> Pendiente</span>';

      return `
        <td>
          <div class="moonrow-colab-cell">
            ${renderAvatar(row.person)}
            <div class="moonrow-colab-info">
              <strong class="moonrow-colab-name">${escapeHtml(row.person.nombre)}</strong>
              <span class="moonrow-area-tag">${escapeHtml(row.area)}</span>
            </div>
          </div>
        </td>
        <td><span class="moonrow-area-tag">${escapeHtml(row.area)}</span></td>
        <td><strong class="moonrow-detail-main">${escapeHtml(row.taskTitle)}</strong></td>
        <td><span class="moonrow-detail-sub">${escapeHtml(row.instructions)}</span></td>
        <td>${badgeHtml}</td>
        <td>
          <button type="button" class="moonrow-row-btn" data-person-profile-id="${row.person.id}">Ficha ↗</button>
        </td>
      `;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER TABLE HELPER
  ───────────────────────────────────────────────────────────── */
  function renderTable(allRows, columns, rowRenderer) {
    const modal = getModal();
    const tableEl = modal.querySelector('#moonrow-table-body');
    const theadEl = modal.querySelector('#moonrow-table-head');
    const countEl = modal.querySelector('#moonrow-footer-count');
    if (!tableEl) return;

    // Filter by category
    let filtered = allRows;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(r => r.category === currentFilter);
    }

    // Filter by area
    if (currentArea) {
      filtered = filtered.filter(r => r.areaId === currentArea);
    }

    // Filter by search query
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(r => {
        const name = (r.person?.nombre || '').toLowerCase();
        const area = (r.area || '').toLowerCase();
        const detail = ((r.reqTitle || r.taskTitle || r.detail || '') + '').toLowerCase();
        return name.includes(q) || area.includes(q) || detail.includes(q);
      });
    }

    // Render Table Header
    if (theadEl) {
      theadEl.innerHTML = `<tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>`;
    }

    // Render Table Body
    if (!filtered.length) {
      tableEl.innerHTML = `
        <tr>
          <td colspan="${columns.length}">
            <div class="moonrow-empty">
              <div class="moonrow-empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <h5 class="moonrow-empty-title">Sin resultados</h5>
              <p class="moonrow-empty-desc">No se encontraron registros que coincidan con los filtros aplicados.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      tableEl.innerHTML = filtered.map(row => `<tr>${rowRenderer(row)}</tr>`).join('');
    }

    if (countEl) {
      countEl.textContent = `Mostrando ${filtered.length} de ${allRows.length} registros`;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     EVENT DELEGATION & SETUP
  ───────────────────────────────────────────────────────────── */
  function initEvents() {
    const modal = getModal();
    if (!modal) return;

    // Tab buttons
    modal.addEventListener('click', e => {
      const tabBtn = e.target.closest('[data-moonrow-tab]');
      if (tabBtn) {
        currentKey = tabBtn.dataset.moonrowTab;
        currentFilter = 'all';
        renderModalContent();
        const body = modal.querySelector('.moonrow-body');
        if (body) body.scrollTop = 0;
        return;
      }

      // Filter pills
      const filterBtn = e.target.closest('[data-moonrow-filter]');
      if (filterBtn) {
        currentFilter = filterBtn.dataset.moonrowFilter;
        renderModalContent();
        return;
      }

      // Close button or backdrop
      if (e.target.matches('[data-moonrow-close]') || e.target.closest('[data-moonrow-close]')) {
        closeOverviewModal();
        return;
      }

      // Jump to section shortcut
      const jumpBtn = e.target.closest('[data-jump-section]');
      if (jumpBtn) {
        const targetSection = jumpBtn.dataset.jumpSection;
        closeOverviewModal();
        const navTab = document.querySelector(`[data-admin-section="${targetSection}"]`);
        if (navTab) navTab.click();
        return;
      }

      // Open profile modal
      const profileBtn = e.target.closest('[data-person-profile-id]');
      if (profileBtn) {
        const id = profileBtn.dataset.personProfileId;
        closeOverviewModal();
        if (typeof window.openPersonProfile === 'function') {
          window.openPersonProfile(id);
        } else if (typeof window.selectTeamPerson === 'function') {
          window.selectTeamPerson(id);
        }
        return;
      }
    });

    // Search input
    const searchInput = modal.querySelector('#moonrow-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        currentSearch = e.target.value.trim();
        renderModalContent();
      });
    }

    // Area select
    const areaSelect = modal.querySelector('#moonrow-area-select');
    if (areaSelect) {
      areaSelect.addEventListener('change', e => {
        currentArea = e.target.value;
        renderModalContent();
      });
    }

    // Keyboard ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) {
        closeOverviewModal();
      }
    });

    // Delegated click on dashboard overview charts
    document.addEventListener('click', e => {
      const chartCard = e.target.closest('[data-overview-chart]');
      if (chartCard) {
        const key = chartCard.dataset.overviewChart;
        openOverviewModal(key);
      }
    });

    // Keyboard Enter / Space on chart cards
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const chartCard = e.target.closest('[data-overview-chart]');
        if (chartCard && document.activeElement === chartCard) {
          e.preventDefault();
          const key = chartCard.dataset.overviewChart;
          openOverviewModal(key);
        }
      }
    });
  }

  // Expose global methods
  window.openOverviewModal = openOverviewModal;
  window.closeOverviewModal = closeOverviewModal;
  window.syncOverviewModalData = function() {
    const modal = getModal();
    if (modal && !modal.hidden) {
      renderModalContent();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEvents);
  } else {
    initEvents();
  }
})();
