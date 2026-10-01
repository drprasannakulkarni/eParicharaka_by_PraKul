/* Floating scroll dock.
 *
 * Lives on the body, not inside a view, so it survives every tab switch and
 * every re-render without being rebuilt.
 *
 * Two behaviours keep it out of the way of reading:
 *
 *   It only appears once there is somewhere to go. Below one viewport of
 *   scroll there is no dock at all, so short pages are untouched.
 *
 *   Each arrow hides when it would do nothing. At the top there is no up
 *   arrow; at the bottom there is no down arrow. A control that does nothing
 *   is worse than no control.
 *
 * It also steps aside for the interview: answering questions is the one place
 * a floating element would sit over a tap target, so the dock dims and shrinks
 * while a question is on screen and returns to full strength afterwards.
 */

const SHOW_AFTER = 220;   // px of scroll before the dock is worth showing
const BOTTOM_EPS = 80;    // treat "this close to the end" as the bottom

let dock, upBtn, downBtn;
let raf = null, timer = null;

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToY(y) {
  window.scrollTo({ top: y, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function update() {
  const doc = document.documentElement;
  const y = window.scrollY || doc.scrollTop;
  const max = doc.scrollHeight - window.innerHeight;

  // Set before the early return below: a question page long enough to scroll
  // still needs the dock to stand back, and returning first skipped it.
  dock.classList.toggle('is-quiet', !!document.querySelector('.qtext'));

  // nothing to scroll: no dock
  if (max < SHOW_AFTER) { dock.classList.remove('is-on'); return; }

  dock.classList.toggle('is-on', y > SHOW_AFTER || max - y > BOTTOM_EPS);
  upBtn.hidden = y <= SHOW_AFTER;
  downBtn.hidden = max - y <= BOTTOM_EPS;
}

/* rAF is the right tool for coalescing scroll work, but it is not guaranteed to
 * fire: browsers throttle it in background tabs and under some fast-scroll
 * conditions, which would leave the dock frozen showing the wrong arrows. So a
 * timeout races it, and whichever arrives first cancels the other. */
function schedule() {
  if (raf !== null || timer !== null) return;
  const run = () => {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    if (timer !== null) { clearTimeout(timer); timer = null; }
    update();
  };
  raf = requestAnimationFrame(run);
  timer = setTimeout(run, 120);
}

export function mountScrollDock() {
  if (dock) return;

  // The icon gradient is referenced from CSS as stroke:url(#sdockGrad), which
  // only resolves against a gradient present in this document.
  const defs = document.createElement('div');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.setAttribute('aria-hidden', 'true');
  defs.innerHTML = `
    <svg><defs>
      <linearGradient id="sdockGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--dock-a)"/>
        <stop offset="100%" stop-color="var(--dock-b)"/>
      </linearGradient>
    </defs></svg>`;
  document.body.appendChild(defs);

  dock = document.createElement('div');
  dock.className = 'sdock';
  dock.innerHTML = `
    <button class="sdock-btn" data-dir="up" type="button" aria-label="Back to top" title="Back to top">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
    <button class="sdock-btn" data-dir="down" type="button" aria-label="Jump to bottom" title="Jump to bottom">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
    </button>`;
  document.body.appendChild(dock);

  upBtn = dock.querySelector('[data-dir="up"]');
  downBtn = dock.querySelector('[data-dir="down"]');

  dock.addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    if (btn.dataset.dir === 'up') {
      scrollToY(0);
      // Send focus somewhere sensible rather than leaving it on a button that
      // is about to hide itself.
      document.getElementById('main')?.focus?.({ preventScroll: true });
    } else {
      scrollToY(document.documentElement.scrollHeight);
    }
  });

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });

  // Views replace #view wholesale, which changes the page height without any
  // scroll event, so watch the container too.
  const view = document.getElementById('view');
  if (view && 'ResizeObserver' in window) {
    new ResizeObserver(schedule).observe(view);
  }
  if (view && 'MutationObserver' in window) {
    new MutationObserver(schedule).observe(view, { childList: true, subtree: false });
  }

  update();
}
