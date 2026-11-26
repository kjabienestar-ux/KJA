function kjaAreaHeader({id, title, countLabel, expanded, detail}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kja-area-trigger';
  button.id = id + '-trigger';
  button.setAttribute('aria-controls', id);
  button.setAttribute('aria-expanded', String(expanded));
  for (const [part, value] of [['name', title], ['count', countLabel], ['detail', detail]]) {
    if (!value) continue;
    const label = document.createElement('span');
    label.className = 'kja-area-' + part;
    label.textContent = value;
    button.append(label);
  }
  button.insertAdjacentHTML('beforeend','<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>');
  return button;
}
