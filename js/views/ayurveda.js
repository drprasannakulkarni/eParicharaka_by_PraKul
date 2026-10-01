/* Ayurveda A–Z: a browsable glossary of classical clinical terms, each with a
 * plain-English meaning. Independent of the biomedical differential -- this is
 * a dictionary, not a diagnostic tool. Where a term is one of the entities the
 * Check-symptoms result view can surface, it's cross-linked so a reader can see
 * which modern condition it currently corresponds to. No nidana/dosha-dushya/
 * samprapti content here, consistent with the rest of the app -- meaning only. */
import { loadAyurvedaGlossary, loadConditions, loadEvidence, loadClassicalVpk } from '../data.js';
import { esc, openModal, buildBioLinkIndex, linkifyBio, buildSymptomLinkIndex, linkifySymptom, createCompareState, compareBarHTML, wireCompareBar } from '../ui.js';
import { symptomLinkEntries } from './symptoms.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let BIO_INDEX = [];   // filled on first render: links a modern diagnosis mentioned
                       // in a term's own MEANING to that condition's detail panel
let SYM_INDEX = [];   // filled on first render: links a modern-medicine symptom name
                       // mentioned in a term's SYMPTOM LIST to that symptom's own
                       // write-up in Symptoms A-Z. Deliberately separate indices --
                       // a disease name and a symptom name belong to different
                       // fields (meaning vs. symptom-item), never mixed in one scan.

export async function render(root) {
  const [raw, conditions, evidence, classicalVpk] = await Promise.all([
    loadAyurvedaGlossary(), loadConditions(), loadEvidence(), loadClassicalVpk().catch(() => ({})),
  ]);
  BIO_INDEX = buildBioLinkIndex(conditions);
  SYM_INDEX = buildSymptomLinkIndex(symptomLinkEntries(conditions, evidence));
  const terms = raw.map((t, idx) => ({ ...t, idx }));
  const departments = [...new Set(terms.map(t => t.department))].sort();

  root.innerHTML = `
    <h2 class="section">Ayurveda A–Z</h2>
    <p class="lede">
      ${terms.length.toLocaleString()} terms, each with its meaning in plain English --
      classical disease entities with their Sanskrit source verse where available, plus core
      Ayurveda vocabulary (Dosha, Dhatu, Ama, and the rest). This is a glossary, not a
      diagnosis -- it exists so a term you meet elsewhere in this app, or in a classical text,
      has a plain-language definition one tap away.
    </p>
    <div class="toolbar">
      <input class="field" id="q" type="search" placeholder="Search a term or its meaning" autocomplete="off">
      <select class="field" id="dept">
        <option value="">All departments</option>
        ${departments.map(d => `<option>${esc(d)}</option>`).join('')}
      </select>
      <label class="field" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="linked-only" style="width:auto">
        <span class="small">Only terms used in Check symptoms</span>
      </label>
      <button type="button" class="btn btn-ghost" id="compare-toggle">⇄ Compare terms</button>
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

  // Same 2-4-item compare-and-select pattern as Conditions A-Z (see
  // js/ui.js's createCompareState) -- ids here are each term's own `idx`
  // (its position in `terms`), since glossary entries don't carry a stable
  // id of their own the way conditions do.
  let compareMode = false;
  const compare = createCompareState(4);

  const updateCompareBar = () => {
    if (!compareMode) { compareBar.hidden = true; return; }
    compareBar.hidden = false;
    compareBar.innerHTML = compareBarHTML(compare, idx => terms[Number(idx)]?.term || idx);
    compareBar.querySelector('#do-compare')?.addEventListener('click', () => {
      const picked = compare.selection.map(idx => terms[Number(idx)]).filter(Boolean);
      if (picked.length >= 2) openModal(compareAyurvedaHTML(picked, classicalVpk));
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
    const dept = root.querySelector('#dept').value;
    const linkedOnly = root.querySelector('#linked-only').checked;

    const shown = terms.filter(t =>
      (!dept || t.department === dept) &&
      (!linkedOnly || t.linkedConditionId) &&
      (!q || t.term.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q)));

    if (!shown.length) {
      nav.innerHTML = '';
      list.innerHTML = '<div class="empty">No terms match those filters.</div>';
      return;
    }

    const groups = new Map();
    for (const t of shown) {
      const L = t.term[0].toUpperCase();
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(t);
    }

    nav.innerHTML = LETTERS.map(L => groups.has(L)
      ? `<a href="#az-${L}">${L}</a>`
      : `<a aria-disabled="true" style="opacity:.3;pointer-events:none">${L}</a>`).join('');

    list.innerHTML = [...groups.entries()].map(([L, items]) => `
      <h3 class="az-letter" id="az-${L}">${L}</h3>
      ${items.map(t => `
        <button class="row${compareMode ? ' row-compare' : ''}" data-idx="${t.idx}">
          ${compareMode ? `<input type="checkbox" class="row-check" tabindex="-1" ${compare.selection.includes(String(t.idx)) ? 'checked' : ''}>` : ''}
          <span class="row-main">
            <strong>${esc(t.term)}</strong>
            <span>${esc(t.meaning)}</span>
          </span>
          ${t.linkedConditionId
            ? `<span class="pill pill-info">↔ ${esc(t.linkedConditionName)}</span>`
            : `<span class="pill">${esc(t.department)}</span>`}
        </button>`).join('')}
    `).join('');
  };

  draw();
  root.querySelector('#q').addEventListener('input', draw);
  root.querySelector('#dept').addEventListener('change', draw);
  root.querySelector('#linked-only').addEventListener('change', draw);

  list.addEventListener('click', e => {
    const row = e.target.closest('[data-idx]');
    if (!row) return;

    if (compareMode) {
      compare.toggle(row.dataset.idx);
      updateCompareBar();
      draw();
      return;
    }

    const t = terms[Number(row.dataset.idx)];
    if (t) openModal(detailHTML(t), t.term);
  });
}

/* Side-by-side comparison of 2-4 classical entities: meaning, VPK profile
 * (where eParicharak_VPK_Mapping's Cl_Decision_Tree read has one), and which
 * symptoms are shared across the group vs unique to just one of them --
 * there's no sens/frequency data at the classical-entity level the way
 * biomedical conditions have, so this is presence/absence across each
 * entity's own symptom list, not a percentage comparison. */
function compareAyurvedaHTML(picked, classicalVpk) {
  const vpkOf = t => classicalVpk[t.term.trim().toLowerCase()] || null;

  const symptomSets = picked.map(t =>
    new Set((t.symptoms || []).map(s => s.meaning || s.symptom).filter(Boolean)));
  const allSymptoms = [...new Set(symptomSets.flatMap(s => [...s]))]
    .map(sym => ({ sym, count: symptomSets.filter(s => s.has(sym)).length }))
    .sort((a, b) => b.count - a.count || a.sym.localeCompare(b.sym))
    .slice(0, 20);

  return `
    <h3>${picked.map(t => esc(t.term)).join(' vs ')}</h3>
    <div class="compare-summaries" style="--compare-n:${picked.length}">
      ${picked.map(t => {
        const vpk = vpkOf(t);
        return `
        <div>
          <strong>${esc(t.term)}</strong>
          <p class="small muted" style="margin:2px 0 8px">${esc(t.department)}</p>
          <p class="small muted">${linkifyBio(t.meaning, BIO_INDEX)}</p>
          ${vpk ? `
            <div class="vpk-badge vpk-badge-compact" style="margin-top:8px">
              <span class="vpk-chip is-vata">Vata ${vpk.v}%</span>
              <span class="vpk-chip is-pitta">Pitta ${vpk.p}%</span>
              <span class="vpk-chip is-kapha">Kapha ${vpk.k}%</span>
              <span class="vpk-source-tag is-classical">${esc(vpk.confidence)} confidence</span>
            </div>` : `<p class="small muted">No VPK reading available for this entity.</p>`}
        </div>`;
      }).join('')}
    </div>

    <h4>Symptom overlap</h4>
    ${allSymptoms.length ? `
      <p class="small muted" style="margin-bottom:8px">
        Shared across the most entities first -- a full circle means every one of them lists it.
      </p>
      <div class="tablewrap">
        <table>
          <thead>
            <tr><th>Symptom</th>${picked.map(t => `<th style="width:60px;text-align:center">${esc(t.term.split(' ')[0])}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${allSymptoms.map(({ sym }, i) => `
              <tr>
                <td>${esc(sym)}</td>
                ${symptomSets.map(s => `<td style="text-align:center">${s.has(sym) ? '●' : '—'}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `
      <p class="small muted">None of these have an overlapping symptom in this dataset.</p>`}
  `;
}

function detailHTML(t) {
  return `
    <h3>${esc(t.term)}</h3>
    <div class="chips" style="margin-bottom:14px">
      <span class="pill">${esc(t.department)}</span>
      ${t.nameCode ? `<span class="pill" title="Classification code in the ACD source workbook">${esc(t.nameCode)}</span>` : ''}
    </div>
    <p>${linkifyBio(t.meaning, BIO_INDEX)}</p>

    ${t.sloka ? `
      <h4>Classical source</h4>
      <blockquote style="margin:0 0 14px;padding:12px 16px;background:var(--surface-2);
                          border-left:3px solid var(--brand);border-radius:var(--r-sm);
                          font-family:var(--serif);white-space:pre-wrap">${esc(t.sloka)}</blockquote>
      ${t.reference ? `<p class="small muted" style="margin:0 0 14px">${esc(t.reference)}</p>` : ''}`
      : ''}

    ${t.whoDefinition ? `
      <h4>WHO definition</h4>
      <p style="margin:0 0 6px">${esc(t.whoDefinition)}</p>
      <p class="small muted" style="margin:0 0 14px">${esc(t.whoReference)}</p>`
      : ''}

    ${t.symptoms && t.symptoms.length ? `
      <h4>Symptoms</h4>
      <ul class="exam-list" style="margin-bottom:14px">
        ${t.symptoms.map(s => `
          <li>
            <span class="exam-step">${esc(s.symptom || s.meaning)}</span>
            ${s.symptom && s.meaning ? `<span class="exam-pos">${linkifySymptom(s.meaning, SYM_INDEX)}</span>` : ''}
          </li>`).join('')}
      </ul>` : ''}

    ${t.linkedConditionId ? `
      <h4>Correlates with</h4>
      <p>
        This term is currently identified as the nearest Ayurveda entity for
        <strong><a href="#" class="bio-link" data-cnd="${esc(t.linkedConditionId)}">${esc(t.linkedConditionName)}</a></strong>
        in the Check-symptoms result view.
      </p>` : ''}
  `;
}
