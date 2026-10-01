/* App shell: tab routing, theme, error surface. */
import { closeModal, esc } from './ui.js';
import { startWarming, warmOnIntent, stopWarming } from './prefetch.js';
import { mountScrollDock } from './scrolldock.js';

/* Views load on demand. Importing all five up front shipped 45 KB of JavaScript
 * for four tabs the user had not opened yet, and delayed the one they were
 * looking at. The loaders are prefetched during idle instead. */

/* Hub Mappings: 4 Core Hubs containing sub-views */
const HUBS = {
  check:        { name: 'check',        icon: '🩺', label: 'Check & Triage', sub: [{ id: 'check', label: '🩺 Symptom Checker' }, { id: 'redflags', label: '🚨 Red Flags' }] },
  redflags:     { name: 'check',        icon: '🩺', label: 'Check & Triage', sub: [{ id: 'check', label: '🩺 Symptom Checker' }, { id: 'redflags', label: '🚨 Red Flags' }] },
  ayurveda:     { name: 'library',      icon: '📚', label: 'Medical Library', sub: [{ id: 'ayurveda', label: '🌿 Ayurveda A–Z' }, { id: 'conditions', label: '📋 Conditions A–Z' }, { id: 'symptoms', label: '🔍 Symptoms A–Z' }] },
  conditions:   { name: 'library',      icon: '📚', label: 'Medical Library', sub: [{ id: 'ayurveda', label: '🌿 Ayurveda A–Z' }, { id: 'conditions', label: '📋 Conditions A–Z' }, { id: 'symptoms', label: '🔍 Symptoms A–Z' }] },
  symptoms:     { name: 'library',      icon: '📚', label: 'Medical Library', sub: [{ id: 'ayurveda', label: '🌿 Ayurveda A–Z' }, { id: 'conditions', label: '📋 Conditions A–Z' }, { id: 'symptoms', label: '🔍 Symptoms A–Z' }] },
  nutrition4u:  { name: 'lifestyle',    icon: '🌿', label: 'Lifestyle & Therapy', sub: [{ id: 'nutrition4u', label: '🥗 Nutrition4U' }, { id: 'yoga4u', label: '🧘 Yoga4U' }] },
  yoga4u:       { name: 'lifestyle',    icon: '🌿', label: 'Lifestyle & Therapy', sub: [{ id: 'nutrition4u', label: '🥗 Nutrition4U' }, { id: 'yoga4u', label: '🧘 Yoga4U' }] },
  investigations: { name: 'tools',      icon: '🔬', label: 'Diagnostics & Tools', sub: [{ id: 'investigations', label: '🔬 Lab & Exams' }, { id: 'playground', label: '⚡ Decision Tree' }] },
  playground:   { name: 'tools',        icon: '🔬', label: 'Diagnostics & Tools', sub: [{ id: 'investigations', label: '🔬 Lab & Exams' }, { id: 'playground', label: '⚡ Decision Tree' }] },
};

const VIEWS = {
  check:          () => import('./views/check.js'),
  redflags:       () => import('./views/redflags.js'),
  playground:     () => import('./views/playground.js'),
  symptoms:       () => import('./views/symptoms.js'),
  conditions:     () => import('./views/conditions.js'),
  ayurveda:       () => import('./views/ayurveda.js'),
  nutrition4u:    () => import('./views/nutrition4u.js'),
  yoga4u:         () => import('./views/yoga4u.js'),
  investigations: () => import('./views/investigations.js'),
  healthguide:    () => import('./views/healthguide.js'),
  audit:          () => import('./views/audit.js'),
};
const loaded = new Map();

async function viewModule(name) {
  if (!loaded.has(name)) loaded.set(name, VIEWS[name]());
  return loaded.get(name);
}
const root = document.getElementById('view');
let current = null;

async function show(name) {
  if (!VIEWS[name]) name = 'check';
  current = name;
  const hubInfo = HUBS[name] || HUBS['check'];

  // Activate parent hub tab on topbar
  document.querySelectorAll('.tab').forEach(t => {
    const hubTarget = t.dataset.view;
    const isHubActive = (hubTarget === 'check' && (name === 'check' || name === 'redflags')) ||
                        (hubTarget === 'ayurveda' && (name === 'ayurveda' || name === 'conditions' || name === 'symptoms')) ||
                        (hubTarget === 'nutrition4u' && (name === 'nutrition4u' || name === 'yoga4u')) ||
                        (hubTarget === 'investigations' && (name === 'investigations' || name === 'playground'));
    t.classList.toggle('is-active', isHubActive);
    t.setAttribute('aria-selected', String(isHubActive));
    if (isHubActive) {
      t.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  });

  closeModal();
  // Only show a spinner if the view is actually slow to arrive. Flashing one for
  // 40 ms reads as jank, not as progress.
  const slow = setTimeout(() => {
    root.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  }, 150);

  try {
    const mod = await viewModule(name);
    clearTimeout(slow);
    
    // Render view module
    await mod.render(root);

    // Prepend Hub Sub-segment navigation switcher if sub-views exist
    if (hubInfo && hubInfo.sub && hubInfo.sub.length > 1) {
      const subNavHTML = `
        <div class="hub-subnav" role="tablist" aria-label="${hubInfo.label}">
          ${hubInfo.sub.map(s => `
            <button class="hub-segment${s.id === name ? ' is-active' : ''}" data-subview="${s.id}" type="button" role="tab" aria-selected="${s.id === name}">
              ${s.label}
            </button>
          `).join('')}
        </div>`;
      
      const container = document.createElement('div');
      container.innerHTML = subNavHTML;
      const subNavElem = container.firstElementChild;
      
      subNavElem.querySelectorAll('[data-subview]').forEach(btn => {
        btn.addEventListener('click', () => show(btn.dataset.subview));
      });

      root.insertBefore(subNavElem, root.firstElementChild);
    }
  } catch (err) {
    clearTimeout(slow);
    console.error(err);
    root.innerHTML = `
      <div class="card">
        <p class="eyebrow">Could not load</p>
        <p>${esc(err.message)}</p>
        <p class="small muted">
          If you are opening this file directly from disk, the browser will block the
          data files. Serve the folder over HTTP instead — for example
          <code>npx serve</code> — or use the deployed site.
        </p>
      </div>`;
  }

  const current_hash = location.hash.slice(1);
  if (current_hash !== name && !current_hash.startsWith('az-')) {
    history.replaceState(null, '', `#${name}`);
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => show(tab.dataset.view));
});

/* Only hashes naming a real view are routing events. The Conditions A-Z letter
 * jumps are ordinary in-page anchors (#az-H), and treating those as navigation
 * threw the user onto the Check tab every time they clicked a letter. */
window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (!name || name === current) return;
  if (!Object.prototype.hasOwnProperty.call(VIEWS, name)) return;
  show(name);
});

/* Device layout: lets a physician on a laptop see the phone view without
 * picking up a handset. Purely a layout constraint -- same markup, same data,
 * so what they check is genuinely what a patient sees. */
const deviceBtn = document.getElementById('device-toggle');
const deviceIcon = document.getElementById('device-icon');
const deviceLabel = document.getElementById('device-label');

function applyDevice(mode) {
  const phone = mode === 'phone';
  document.body.setAttribute('data-device', phone ? 'phone' : 'laptop');
  deviceIcon.textContent = phone ? '📱' : '🖥️';
  deviceLabel.textContent = phone ? 'Phone' : 'Laptop';
  deviceBtn.setAttribute('aria-pressed', String(phone));
}

applyDevice(localStorage.getItem('sc-device') || 'laptop');
deviceBtn.addEventListener('click', () => {
  const next = document.body.getAttribute('data-device') === 'phone' ? 'laptop' : 'phone';
  localStorage.setItem('sc-device', next);
  applyDevice(next);
});

/* theme: system by default, explicit choice remembered */
const toggle = document.getElementById('theme-toggle');
const saved = localStorage.getItem('sc-theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);

toggle.addEventListener('click', () => {
  const now = document.documentElement.getAttribute('data-theme');
  const dark = now
    ? now === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sc-theme', next);
});

/* Clinician mode: shows the source/confidence detail behind an Ayurveda entity
 * inline (js/views/check.js reads this attribute) instead of only on hover.
 * Off by default -- a patient reading the same screen sees the plain version. */
const clinBtn = document.getElementById('clinician-toggle');
function applyClinician(on) {
  document.body.setAttribute('data-clinician', on ? 'on' : 'off');
  clinBtn.setAttribute('aria-pressed', String(on));
  clinBtn.classList.toggle('is-on', on);
}
applyClinician(localStorage.getItem('sc-clinician') === 'on');
clinBtn.addEventListener('click', () => {
  const next = document.body.getAttribute('data-clinician') !== 'on';
  localStorage.setItem('sc-clinician', next ? 'on' : 'off');
  applyClinician(next);
});

const initial = location.hash.slice(1);
show(Object.prototype.hasOwnProperty.call(VIEWS, initial) ? initial : 'check')
  .then(() => {
    // First screen is up; the user is now reading. Use that time.
    mountScrollDock();
    startWarming();
    warmOnIntent(document.body);
    // Pull the other view modules in the background so a tab click never waits
    // on a script fetch.
    for (const name of Object.keys(VIEWS)) {
      if (name !== (current || 'check')) viewModule(name).catch(() => {});
    }
  });

window.addEventListener('pagehide', stopWarming);

/* "Print or save as PDF" on the result page uses the browser's own print
 * dialog (no PDF library -- consistent with this app having no build step
 * or bundled dependencies). Its one real gap: the alternatives list is a
 * <details> per condition, collapsed by default, and collapsed <details>
 * content is absent from print output just as it is from the screen -- so
 * printing straight away would silently drop every alternative's reasoning
 * and VPK badge, keeping only the one-line summary. Force every <details> on
 * the page open right before printing and restore whatever state it was
 * actually in afterwards, so a user who'd deliberately expanded one to read
 * on-screen doesn't find them all sprung open again once the print dialog
 * closes. Registered once here (not per-render) since it must survive
 * across every view the router shows, not just the result page. */
window.addEventListener('beforeprint', () => {
  document.querySelectorAll('details').forEach(d => {
    d.dataset.vpkWasOpen = d.open ? '1' : '0';
    d.open = true;
  });
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('details').forEach(d => {
    if (d.dataset.vpkWasOpen !== undefined) {
      d.open = d.dataset.vpkWasOpen === '1';
      delete d.dataset.vpkWasOpen;
    }
  });
});
