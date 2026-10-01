/* Conditions A–Z: every condition in the dataset, with the findings that
 * characterise it drawn straight from the evidence matrix. */
import { loadConditions, loadEvidence, loadImagery, loadSelfCareRemedies, loadNutrition } from '../data.js';
import { esc, pillClass, ACUITY_LABEL, openModal, figureHTML, selfCareSectionHTML, nutritionSectionHTML, createCompareState, compareBarHTML, wireCompareBar } from '../ui.js';
import { searchMatches } from '../search.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let CONDITION_ART = {};   // filled on first render, used by detailHTML
let SELF_CARE = {};       // filled by ensureSelfCareLoaded(), used by detailHTML
let NUTRITION = {};       // filled by ensureNutritionLoaded(), used by detailHTML

/* Self-care data is needed by detailHTML wherever it's opened from --
 * Conditions A-Z's own render() below, but also Symptoms A-Z, Investigations
 * and Ayurveda A-Z cross-links, none of which necessarily visit this view's
 * render() first. loadSelfCareRemedies() is already cache-once in data.js, so
 * calling this from every one of those call sites is cheap after the first. */
export async function ensureSelfCareLoaded() {
  if (!Object.keys(SELF_CARE).length) SELF_CARE = await loadSelfCareRemedies().catch(() => ({}));
  return SELF_CARE;
}

/* Same pattern as ensureSelfCareLoaded() above, for the nutrition database --
 * needed wherever detailHTML is opened from, not just this view's render(). */
export async function ensureNutritionLoaded() {
  if (!Object.keys(NUTRITION).length) NUTRITION = await loadNutrition().catch(() => ({}));
  return NUTRITION;
}

export async function render(root) {
  const [conditions, evidence, imgs] = await Promise.all([
    loadConditions(), loadEvidence(), loadImagery(), ensureSelfCareLoaded(), ensureNutritionLoaded(),
  ]);
  CONDITION_ART = imgs.conditions || {};
  const evMap = new Map(evidence.map(e => [e.id, e]));
  const specialties = [...new Set(conditions.map(c => c.specialty))].sort();

  root.innerHTML = `
    <h2 class="section">Conditions A–Z</h2>
    <p class="lede">
      All ${conditions.length} conditions the checker can reach, with the findings
      that characterise each one and how often they occur.
    </p>
    <div class="toolbar">
      <input class="field" id="q" type="search" placeholder="Search name, alias or ICD-10 code" autocomplete="off">
      <select class="field" id="spec">
        <option value="">All specialties</option>
        ${specialties.map(s => `<option>${esc(s)}</option>`).join('')}
      </select>
      <select class="field" id="acu">
        <option value="">All urgency levels</option>
        ${Object.entries(ACUITY_LABEL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
      </select>
      <button type="button" class="btn btn-ghost" id="compare-toggle">⇄ Compare conditions</button>
    </div>
    <div id="compare-bar" class="compare-bar" hidden></div>
    <nav class="az-nav" id="aznav"></nav>
    <div id="list"></div>
  `;

  const list = root.querySelector('#list');
  const nav = root.querySelector('#aznav');
  const compareBar = root.querySelector('#compare-bar');
  const compareToggle = root.querySelector('#compare-toggle');
  const searchInput = root.querySelector('#q');

  // Comparison mode: select 2-4 rows instead of opening the detail modal on
  // click. Local to this render() call -- resets whenever the tab is
  // revisited, same lifetime as the search/filter state above it.
  let compareMode = false;
  const compare = createCompareState(4);

  const updateCompareBar = () => {
    if (!compareMode) { compareBar.hidden = true; return; }
    compareBar.hidden = false;
    compareBar.innerHTML = compareBarHTML(compare, id => conditions.find(x => x.id === id)?.name || id);
    compareBar.querySelector('#do-compare')?.addEventListener('click', () => {
      const picked = compare.selection.map(id => conditions.find(x => x.id === id)).filter(Boolean);
      if (picked.length >= 2) openModal(compareHTML(picked, evMap));
    });
    wireCompareBar(compareBar, compare, () => { updateCompareBar(); draw(); }, searchInput);
  };

  compareToggle.addEventListener('click', () => {
    compareMode = !compareMode;
    compare.clear();
    compareToggle.classList.toggle('is-on', compareMode);
    updateCompareBar();
    draw();
  });

  const draw = () => {
    const q = root.querySelector('#q').value.trim().toLowerCase();
    const spec = root.querySelector('#spec').value;
    const acu = root.querySelector('#acu').value;

    const shown = conditions.filter(c =>
      (!spec || c.specialty === spec) &&
      (!acu || c.acuity === acu) &&
      searchMatches(q, c.name, c.icd10, ...c.aka));

    if (!shown.length) {
      nav.innerHTML = '';
      list.innerHTML = '<div class="empty">No conditions match those filters.</div>';
      return;
    }

    const groups = new Map();
    for (const c of [...shown].sort((a, b) => a.name.localeCompare(b.name))) {
      const L = c.name[0].toUpperCase();
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(c);
    }

    nav.innerHTML = LETTERS.map(L => groups.has(L)
      ? `<a href="#az-${L}">${L}</a>`
      : `<a aria-disabled="true" style="opacity:.3;pointer-events:none">${L}</a>`).join('');

    list.innerHTML = [...groups.entries()].map(([L, items]) => `
      <h3 class="az-letter" id="az-${L}">${L}</h3>
      ${items.map(c => `
        <button class="row${compareMode ? ' row-compare' : ''}" data-id="${esc(c.id)}">
          ${compareMode ? `<input type="checkbox" class="row-check" tabindex="-1" ${compare.selection.includes(c.id) ? 'checked' : ''}>` : ''}
          <span class="row-main">
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.specialty)} · ICD-10 ${esc(c.icd10)}${c.aka.length ? ' · ' + esc(c.aka.join(', ')) : ''}</span>
          </span>
          <span class="pill ${pillClass(c.acuity)}">${esc(ACUITY_LABEL[c.acuity])}</span>
        </button>`).join('')}
    `).join('');
  };

  draw();
  root.querySelector('#q').addEventListener('input', draw);
  root.querySelector('#spec').addEventListener('change', draw);
  root.querySelector('#acu').addEventListener('change', draw);

  list.addEventListener('click', e => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.dataset.id;

    if (compareMode) {
      compare.toggle(id);
      updateCompareBar();
      draw();
      return;
    }

    const c = conditions.find(x => x.id === id);
    if (c) openModal(detailHTML(c, evMap));
  });
}

/* Side-by-side comparison of 2-4 conditions -- what actually tells them
 * apart, not just their independent detail pages stacked together. Pulls
 * the union of evidence ids any of them has sens data for, ranks by how far
 * apart the WIDEST two of that finding's frequencies are (max minus min
 * across however many conditions were picked), and shows the biggest
 * spreads first: the findings most worth asking about to tell this specific
 * group apart. */
export function compareHTML(conds, evMap) {
  const allIds = new Set(conds.flatMap(c => Object.keys(c.sens || {})));
  const rows = [...allIds]
    .map(id => {
      const e = evMap.get(id);
      if (!e || e.kind === 'demographic') return null;
      const values = conds.map(c => c.sens?.[id] ?? 0);
      return { label: e.label, values, gap: Math.max(...values) - Math.min(...values) };
    })
    .filter(Boolean)
    .filter(r => r.gap >= 0.15) // only genuinely distinguishing findings, not noise
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 12);

  const colWidth = Math.round(100 / (conds.length + 1)) + '%';

  return `
    <h3>${conds.map(c => esc(c.name)).join(' vs ')}</h3>
    <div class="chips" style="margin-bottom:14px">
      ${conds.map(c => `<span class="pill ${pillClass(c.acuity)}">${esc(c.name)}: ${esc(c.triage.label)}</span>`).join('')}
    </div>
    <div class="compare-summaries" style="--compare-n:${conds.length}">
      ${conds.map(c => `<div><strong>${esc(c.name)}</strong><p class="small muted">${esc(c.summary)}</p></div>`).join('')}
    </div>

    <h4>What actually tells them apart</h4>
    ${rows.length ? `
      <p class="small muted" style="margin-bottom:8px">
        How often each finding occurs in each condition -- the widest spreads first.
      </p>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Finding</th>
              ${conds.map(c => `<th style="width:${colWidth}">${esc(c.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const top = Math.max(...r.values);
              return `
              <tr>
                <td>${esc(r.label)}</td>
                ${r.values.map(v => `<td${v === top ? ' style="font-weight:700"' : ''}>${Math.round(v * 100)}%</td>`).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <p class="small muted">These share very similar findings in this dataset -- nothing here
      strongly favours one over the others; the differential usually comes down to prior likelihood
      and context instead.</p>`}
  `;
}

export function detailHTML(c, evMap) {
  const findings = Object.entries(c.lr)
    .map(([id, lr]) => {
      const e = evMap.get(id);
      if (!e || e.kind === 'demographic') return null;
      return { label: e.label, layman: e.layman, kind: e.kind,
               sens: c.sens?.[id] ?? 0, lr: lr[0] };
    })
    .filter(Boolean)
    .sort((a, b) => b.sens - a.sens);

  const typical = findings.filter(f => f.sens >= 0.5).slice(0, 10);
  const discriminating = [...findings].sort((a, b) => b.lr - a.lr).slice(0, 6);

  return `
    <h3>${esc(c.name)}</h3>
    <div class="chips" style="margin-bottom:14px">
      <span class="pill ${pillClass(c.acuity)}">${esc(c.triage.label)} — ${esc(c.triage.window)}</span>
      <span class="pill">${esc(c.specialty)}</span>
      <span class="pill">ICD-10 ${esc(c.icd10)}</span>
    </div>
    <p>${esc(c.summary)}</p>
    ${(CONDITION_ART[c.id] || []).length ? `
      <div class="fig-row">
        ${CONDITION_ART[c.id].map(i => figureHTML(i, { size: 'md' })).join('')}
      </div>` : ''}
    ${c.aka.length ? `<p class="small muted">Also known as: ${esc(c.aka.join(', '))}</p>` : ''}

    <h4>Recommended action</h4>
    <p>${esc(c.triage.action)}</p>

    ${typical.length ? `
      <h4>Typically present</h4>
      <div class="tablewrap">
        <table>
          <thead><tr><th>Finding</th><th style="width:90px">Frequency</th></tr></thead>
          <tbody>
            ${typical.map(f => `<tr><td>${esc(f.label)}</td><td>${Math.round(f.sens * 100)}%</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

    ${discriminating.length ? `
    <h4>Most discriminating findings</h4>
    <p class="small muted" style="margin-bottom:8px">
      Findings that shift the odds toward this condition most when present.
    </p>
    <div class="chips">
      ${discriminating.map(f => `<span class="pill">${esc(f.label)} ×${f.lr.toFixed(1)}</span>`).join('')}
    </div>` : `
    <p class="small muted">
      This condition is usually found on examination or screening rather than through a specific
      symptom pattern, so it isn't part of the live symptom-check differential.
    </p>`}

    <h4>Clinical examination to confirm</h4>
    <ul class="exam-list">
      ${c.exam.map(e => `
        <li>
          <span class="exam-step">${esc(e.step)}</span>
          <span class="exam-pos">${esc(e.positive)}</span>
        </li>`).join('')}
    </ul>

    <h4>Definitive investigations</h4>
    <ul class="lab-list">
      ${c.labs.map(l => `
        <li>
          <span class="tier tier-${esc(l.tier)}">${l.tier === 'gp' ? 'GP' : esc(l.tier)}</span>
          <span class="lab-body">
            <span class="lab-test">${esc(l.test)}</span>
            <span class="lab-conf">${esc(l.confirms)}</span>
          </span>
        </li>`).join('')}
    </ul>

    <h4>Management summary</h4>
    <ol class="workup">
      ${c.workup.map((w, i) => `<li><span class="n">${i + 1}</span><span>${esc(w)}</span></li>`).join('')}
    </ol>

    ${SELF_CARE[c.id] ? `
      <h4 style="margin-top:22px">Self-care guide</h4>
      ${selfCareSectionHTML(SELF_CARE[c.id])}` : ''}

    ${NUTRITION[c.id] ? `
      <h4 style="margin-top:22px">Nutrition</h4>
      ${nutritionSectionHTML(NUTRITION[c.id])}` : ''}

    <div id="modal-videos" data-systems="${esc((c.systems || []).join(','))}"></div>
  `;
}
