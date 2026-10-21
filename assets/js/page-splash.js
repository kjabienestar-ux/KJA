/* Same splash and timing as the public pages, without loading unrelated widgets. */
(() => {
  'use strict';
  const splash = document.getElementById('kjaSplash');
  if (!splash) return;
  const started = performance.now();
  let closing = false;
  let safetyTimer;
  function hide() {
    if (closing) return;
    closing = true;
    clearTimeout(safetyTimer);
    setTimeout(() => {
      splash.classList.add('kja-splash--hidden');
      const remove = () => splash.remove();
      splash.addEventListener('transitionend', event => {
        if (event.target === splash) remove();
      });
      // Also clean up when motion settings or a restored tab skip the transition.
      setTimeout(remove, 650);
    }, Math.max(0, 550 - (performance.now() - started)));
  }
  safetyTimer = setTimeout(hide, 4500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hide, { once: true });
  } else {
    hide();
  }
  window.addEventListener('load', hide, { once: true });
  window.addEventListener('pageshow', event => {
    if (event.persisted) splash.remove();
  });
})();
