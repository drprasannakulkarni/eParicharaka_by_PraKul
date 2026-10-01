import { startWarming, stopWarming, warmOnIntent } from './preload.js';
import { mountScrollDock } from './scrolldock.js';
import { openModal, esc } from './ui.js';

const VIEWS = {
  check:          () => import('./views/check.js'),
  ayurveda:       () => import('./views/ayurveda.js'),
  conditions:     () => import('./views/conditions.js'),
  symptoms:       () => import('./views/symptoms.js'),
  nutrition4u:    () => import('./views/nutrition4u.js'),
  yoga4u:         () => import('./views/yoga4u.js'),
  investigations: () => import('./views/investigations.js'),
  audit:          () => import('./views/audit.js'),
};

const subNavConfig = {
  ayurveda: [
    { label: 'Ayurveda A–Z', subview: 'ayurveda' },
    { label: 'Conditions A–Z', subview: 'conditions' },
    { label: 'Symptoms A–Z', subview: 'symptoms' },
  ],
  conditions: [
    { label: 'Ayurveda A–Z', subview: 'ayurveda' },
    { label: 'Conditions A–Z', subview: 'conditions' },
    { label: 'Symptoms A–Z', subview: 'symptoms' },
  ],
  symptoms: [
    { label: 'Ayurveda A–Z', subview: 'ayurveda' },
    { label: 'Conditions A–Z', subview: 'conditions' },
    { label: 'Symptoms A–Z', subview: 'symptoms' },
  ],
  nutrition4u: [
    { label: 'Nutrition4U', subview: 'nutrition4u' },
    { label: 'Yoga4U', subview: 'yoga4u' },
  ],
  yoga4u: [
    { label: 'Nutrition4U', subview: 'nutrition4u' },
    { label: 'Yoga4U', subview: 'yoga4u' },
  ],
};

let current = null;
const viewModules = new Map();

async function viewModule(name) {
  if (!viewModules.has(name)) viewModules.set(name, VIEWS[name]());
  return viewModules.get(name);
}

async function show(name) {
  if (!VIEWS[name]) name = 'check';
  if (current === name) return;
  
  const root = document.getElementById('view');
  
  document.querySelectorAll('.bnav-item').forEach(b => {
    const isThis = b.dataset.view === name || 
      (name === 'conditions' && b.dataset.view === 'ayurveda') ||
      (name === 'symptoms' && b.dataset.view === 'ayurveda') ||
      (name === 'yoga4u' && b.dataset.view === 'nutrition4u');
    b.classList.toggle('is-active', isThis);
    b.setAttribute('aria-selected', String(isThis));
  });

  const slow = setTimeout(() => {
    root.innerHTML = `<div class="loading"><span class="spinner" aria-hidden="true"></span> Loading clinical data...</div>`;
  }, 120);

  try {
    const mod = await viewModule(name);
    clearTimeout(slow);
    current = name;
    
    root.innerHTML = '';
    const container = document.createElement('div');
    container.className = `view-content view-${name}`;
    root.appendChild(container);

    await mod.render(container);

    const config = subNavConfig[name];
    if (config) {
      const subNavHTML = `
        <div class="hub-subnav" role="tablist" aria-label="Library Section">
          ${config.map(item => `
            <button type="button" class="subnav-btn ${item.subview === name ? 'is-active' : ''}" 
                    data-subview="${item.subview}" role="tab" aria-selected="${item.subview === name}">
              ${item.label}
            </button>
          `).join('')}
        </div>
      `;
      
      const subNavElem = document.createElement('div');
      subNavElem.innerHTML = subNavHTML;
      const subNavInner = subNavElem.firstElementChild;
      
      subNavInner.querySelectorAll('[data-subview]').forEach(btn => {
        btn.addEventListener('click', () => show(btn.dataset.subview));
      });

      container.insertBefore(subNavInner, container.firstElementChild);
    }
  } catch (err) {
    clearTimeout(slow);
    console.error(err);
    root.innerHTML = `
      <div class="card">
        <p class="eyebrow">Could not load</p>
        <p>${esc(err.message)}</p>
        <p class="small muted">
          If you are opening this file directly from disk, serve the folder over HTTP - for example <code>npx serve</code> - or use the deployed site.
        </p>
      </div>`;
  }

  const current_hash = location.hash.slice(1);
  if (current_hash !== name && !current_hash.startsWith('az-')) {
    history.replaceState(null, '', `#${name}`);
  }
}

document.querySelectorAll('.bnav-item, .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.action === 'about') {
      showAboutModal();
    } else if (tab.dataset.view) {
      show(tab.dataset.view);
    }
  });
});

window.addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (!name || name === current) return;
  if (!Object.prototype.hasOwnProperty.call(VIEWS, name)) return;
  show(name);
});

/* theme: system by default, explicit choice remembered */
const toggle = document.getElementById('theme-toggle');
const saved = localStorage.getItem('sc-theme');
if (saved) document.documentElement.setAttribute('data-theme', saved);

if (toggle) {
  toggle.addEventListener('click', () => {
    const now = document.documentElement.getAttribute('data-theme');
    const dark = now
      ? now === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sc-theme', next);
  });
}

/* Clinician mode */
const clinBtn = document.getElementById('clinician-toggle');
function applyClinician(on) {
  if (!clinBtn) return;
  document.body.setAttribute('data-clinician', on ? 'on' : 'off');
  clinBtn.setAttribute('aria-pressed', String(on));
  clinBtn.classList.toggle('is-on', on);
}
if (clinBtn) {
  applyClinician(localStorage.getItem('sc-clinician') === 'on');
  clinBtn.addEventListener('click', () => {
    const next = document.body.getAttribute('data-clinician') !== 'on';
    localStorage.setItem('sc-clinician', next ? 'on' : 'off');
    applyClinician(next);
  });
}

/* About & How to Use Guide Modal */
export function showAboutModal() {
  openModal(`
    <div class="about-modal-body" style="padding: 12px 4px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <span style="font-size:2.4rem; line-height:1;">🩺</span>
        <div>
          <h2 style="margin:0; font-size:1.45rem; color:var(--brand); font-weight:700;">eParicharaka by PraKul</h2>
          <p style="margin:2px 0 0 0; font-size:0.92rem; color:var(--ink-2);"><b>Integrative Nurse &amp; Clinical Doshic Guide</b></p>
        </div>
      </div>

      <div style="background:var(--surface-2); padding:10px 14px; border-radius:8px; border-left:4px solid var(--brand); margin-bottom:16px;">
        <p style="margin:0; font-size:0.88rem; color:var(--ink);">
          <b>Author &amp; Architect:</b> Dr. Prasanna Kulkarni<br>
          <b>Contact:</b> <a href="mailto:prasanna4ai@gmail.com" style="color:var(--brand); text-decoration:underline;">prasanna4ai@gmail.com</a>
        </p>
      </div>

      <div style="background:rgba(239, 68, 68, 0.08); padding:12px 14px; border-radius:8px; border:1px solid rgba(239, 68, 68, 0.25); margin-bottom:18px;">
        <h4 style="margin:0 0 4px 0; color:#dc2626; font-size:0.92rem;">⚠️ Medical Disclaimer</h4>
        <p style="margin:0; font-size:0.85rem; line-height:1.45; color:var(--ink);">
          This tool provides information about possible causes of symptoms. It is not a diagnosis and it cannot examine you. If you feel very unwell, or your symptoms are getting rapidly worse, seek medical help immediately regardless of what this tool says.
        </p>
      </div>

      <h3 style="font-size:1.1rem; color:var(--ink); border-bottom:1px solid var(--line-soft); padding-bottom:6px; margin-top:16px;">
        📘 Comprehensive Feature &amp; User Guide
      </h3>

      <div style="display:grid; gap:14px; margin-top:12px;">
        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">1. Guided Symptom Assessment &amp; Interactive Body Map</h4>
          <p style="margin:0; font-size:0.88rem; line-height:1.45;">
            Select symptoms by searching chief complaints or by tapping real 2D anatomical organ structures (Head, Lungs, Heart, Stomach, Liver, Intestines, Kidneys, Pelvis, Limbs) on the interactive Body Map. Answer adaptive clinical questions to calculate ranked differential diagnoses (Urgent, Moderate, Low risk).
          </p>
        </div>

        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">2. Real-Time VPK (Vata-Pitta-Kapha) Doshic Reading</h4>
          <p style="margin:0; font-size:0.88rem; line-height:1.45;">
            Every answered clinical question dynamically computes your live Vata, Pitta, and Kapha doshic affinity scores. View matched classical Ayurvedic disease profiles alongside evidence-based medical diagnostics.
          </p>
        </div>

        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">3. Medical &amp; Classical Ayurvedic Library</h4>
          <ul style="margin:4px 0 0 18px; padding:0; font-size:0.88rem; line-height:1.45;">
            <li><b>Ayurveda A–Z:</b> Classical disease entities, Nidana (etiology), Samprapti (pathogenesis), Doshic affinity, and original Sanskrit textual shlokas.</li>
            <li><b>Conditions A–Z:</b> Comprehensive clinical encyclopedia for differential diagnoses.</li>
            <li><b>Symptoms A–Z:</b> Complete symptom index with cross-linked clinical signs.</li>
          </ul>
        </div>

        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">4. Lifestyle &amp; Therapeutic Recommendations</h4>
          <ul style="margin:4px 0 0 18px; padding:0; font-size:0.88rem; line-height:1.45;">
            <li><b>Nutrition4U:</b> Evidence-based Pathya (recommended) &amp; Apathya (avoided) dietary guidance customized to diagnosis and dosha.</li>
            <li><b>Yoga4U:</b> Targeted therapeutic yoga routines, postural asanas, and pranayama breathwork.</li>
          </ul>
        </div>

        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">5. Diagnostics &amp; Decision Trees</h4>
          <p style="margin:0; font-size:0.88rem; line-height:1.45;">
            Inspect recommended laboratory investigations, physical examination signs, and underlying algorithmic decision logic trees.
          </p>
        </div>

        <div>
          <h4 style="margin:0 0 4px 0; font-size:0.98rem; color:var(--brand);">6. Clinician Mode</h4>
          <p style="margin:0; font-size:0.88rem; line-height:1.45;">
            Toggle <b>Clinician Mode</b> in the top navigation bar to display classical citations, Cochrane evidence links, and automated confidence tiers inline.
          </p>
        </div>
      </div>
    </div>
  `, 'About & User Guide');
}

// Bind About buttons across header, bottom nav, and footer
document.querySelectorAll('#about-btn, #bnav-about-btn, #foot-about-btn, [data-action="about"]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    showAboutModal();
  });
});

const initial = location.hash.slice(1);
show(Object.prototype.hasOwnProperty.call(VIEWS, initial) ? initial : 'check')
  .then(() => {
    mountScrollDock();
    startWarming();
    warmOnIntent(document.body);
    for (const name of Object.keys(VIEWS)) {
      if (name !== (current || 'check')) viewModule(name).catch(() => {});
    }
  });

window.addEventListener('pagehide', stopWarming);

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
