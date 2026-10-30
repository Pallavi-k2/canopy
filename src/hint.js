// hint.js
// -----------------------------------------------------------------------------
// The small, soft "how to play" line under the scene on a first visit.
//
// - Fades in shortly after the scene appears, and gently "breathes".
// - Fades away for good after the first successful circle.
// - Remembers (in this browser) that the visitor already knows, so it doesn't
//   show again next time. Turn that off with CONFIG.hint.rememberDismissed.
//
// It's plain HTML text (not drawn by PixiJS), so it stays crisp and screen
// readers can read it.
// -----------------------------------------------------------------------------

import { CONFIG } from './config.js';

const STORAGE_KEY = 'canopy-hint-dismissed';

// Browser storage can be blocked (private windows, some iframes), so every
// read/write is wrapped and simply does nothing if it fails.
function wasDismissed() {
  try {
    return CONFIG.hint.rememberDismissed && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberDismissed() {
  try {
    if (CONFIG.hint.rememberDismissed) localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

export function createHint({ app, scene }) {
  const H = CONFIG.hint;
  if (wasDismissed()) return { dismiss() {} };

  const el = document.createElement('p');
  el.className = 'hint';
  el.textContent = H.text;
  el.style.setProperty('--hint-fade', `${H.fadeTime}s`);
  document.getElementById('app').appendChild(el);

  // Sit just under the scene if there's room on the paper, otherwise just
  // inside the bottom edge of the scene.
  function place() {
    const box = scene.screenBounds();
    const roomBelow = app.screen.height - box.bottom;
    const top = roomBelow > H.minRoomBelow ? box.bottom + Math.min(roomBelow * 0.25, 16) : box.bottom - H.minRoomBelow;
    el.style.top = `${Math.round(top)}px`;
  }
  place();
  app.renderer.on('resize', place);

  // Appear a moment after the scene has faded in.
  const showTimer = setTimeout(() => el.classList.add('is-visible'), H.delay * 1000);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(showTimer);
    rememberDismissed();
    el.classList.remove('is-visible');
    el.classList.add('is-gone');
    setTimeout(() => {
      el.remove();
      app.renderer.off('resize', place);
    }, H.fadeTime * 1000 + 100);
  }

  return { dismiss };
}
