/* Background warming.
 *
 * First paint needs 6 KB. Everything after that is heavy: the Conditions tab
 * pulls 376 KB the first time it is opened, and choosing a complaint pulls up
 * to 195 KB. On a desktop that is invisible; on 4G it is a two-second stall at
 * exactly the moment the user expected something to happen.
 *
 * But the user is not idle during that time -- they are reading the complaint
 * list, or answering a question. This module spends that time fetching what
 * they are most likely to need next, so the click that follows hits a warm
 * cache and renders immediately.
 *
 * Three rules keep it polite:
 *
 *   Never compete.   Warming runs in idle callbacks, one request at a time, and
 *                    a user-initiated fetch always goes first.
 *   Never on a poor  Save-Data, 2g and slow-2g get nothing beyond the tiny
 *   connection.      files. Burning someone's data plan to save a second of
 *                    their time is not a trade we get to make for them.
 *   Never re-fetch.  Warming populates the same promise cache the app reads
 *                    from, so a warmed file is simply already there.
 */
import { warm } from './data.js';

const idle = (fn, timeout = 2000) =>
  ('requestIdleCallback' in window)
    ? requestIdleCallback(fn, { timeout })
    : setTimeout(fn, 200);

/* Complaints people actually pick first, so their bundles are worth having
 * ready before the click. Ordered by how often each is a presenting problem. */
const LIKELY_COMPLAINTS = [
  'EV_ABDO_PAIN', 'EV_CHEST_PAIN', 'EV_HEADACHE', 'EV_COUGH',
  'EV_FEVER', 'EV_SORE_THROAT', 'EV_FATIGUE', 'EV_DYSPNEA',
];

let queue = [];
let running = false;
let stopped = false;

function connectionAllowsBulk() {
  const c = navigator.connection;
  if (!c) return true;                       // unknown: assume it is fine
  if (c.saveData) return false;
  return !['slow-2g', '2g'].includes(c.effectiveType);
}

async function pump() {
  if (running || stopped || !queue.length) return;
  running = true;
  while (queue.length && !stopped) {
    const job = queue.shift();
    try { await job(); } catch { /* a warm miss is not an error */ }
    // yield between files so a real click is never stuck behind us
    await new Promise(r => idle(r));
  }
  running = false;
}

function enqueue(fn, front = false) {
  if (front) queue.unshift(fn); else queue.push(fn);
  idle(pump);
}

/* Called once the first screen is on the page. */
export function startWarming() {
  // Tiny and needed by the interview the moment a complaint is picked.
  enqueue(() => warm('imagery.json'));
  enqueue(() => warm('meta.json'));

  if (!connectionAllowsBulk()) return;

  // Needed by four of the five tabs. This is the 372 KB that makes the
  // Conditions tab feel slow, and nobody opens it in the first two seconds.
  enqueue(() => warm('conditions.json'));
  enqueue(() => warm('evidence.json'));
  enqueue(() => warm('exam_videos.json'));

  for (const cc of LIKELY_COMPLAINTS) enqueue(() => warm(`cc/${cc}.json`));
}

/* The strongest signal available: the pointer is on the control. Fetch now and
 * jump the queue -- by the time the click lands the file is usually there. */
export function warmOnIntent(rootEl) {
  if (!rootEl || rootEl.dataset.warmBound) return;
  rootEl.dataset.warmBound = '1';

  const seen = new Set();
  const grab = el => {
    const cc = el?.dataset?.cc;
    if (cc && !seen.has(cc)) { seen.add(cc); enqueue(() => warm(`cc/${cc}.json`), true); }
    const view = el?.dataset?.view;
    if (view && !seen.has(view)) {
      seen.add(view);
      if (['conditions', 'symptoms', 'investigations', 'audit', 'playground'].includes(view)) {
        enqueue(() => warm('conditions.json'), true);
        enqueue(() => warm('evidence.json'), true);
      }
    }
  };

  const handler = e => {
    grab(e.target.closest?.('[data-cc]'));
    grab(e.target.closest?.('[data-view]'));
  };
  rootEl.addEventListener('pointerover', handler, { passive: true });
  rootEl.addEventListener('focusin', handler, { passive: true });
  rootEl.addEventListener('touchstart', handler, { passive: true });
}

/* While a question is on screen the user is reading, not waiting. Use it to
 * pull the heavy shared files if they are not already in hand. */
export function warmDuringInterview() {
  if (!connectionAllowsBulk()) return;
  enqueue(() => warm('conditions.json'));
  enqueue(() => warm('evidence.json'));
}

export function stopWarming() { stopped = true; queue = []; }
