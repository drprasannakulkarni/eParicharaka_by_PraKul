/* Investigations, viewable from either direction:
 *   by condition  — what would confirm this?
 *   by test       — what does this test help settle? */
import { loadConditions, loadEvidence, investigationIndex } from '../data.js';
import { esc, pillClass, ACUITY_LABEL, openModal } from '../ui.js';
import { searchMatches } from '../search.js';
import { detailHTML, ensureSelfCareLoaded, ensureNutritionLoaded } from './conditions.js';

let mode = 'condition';

export async function render(root) {
  const [conditions, evidence, tests] = await Promise.all([
    loadConditions(), loadEvidence(), investigationIndex(), ensureSelfCareLoaded(), ensureNutritionLoaded(),
  ]);
  const evMap = new Map(evidence.map(e => [e.id, e]));

  root.innerHTML = `
    <h2 class="section">Investigations</h2>
    <p class="lede">
      ${tests.length} distinct investigations across ${conditions.length} conditions.
      Look up what confirms a given condition, or what a given test is used to settle.
    </p>
    <div class="toolbar">
      <input class="field" id="q" type="search" placeholder="Search a condition or a test" autocomplete="off">
      <select class="field" id="mode">
        <option value="condition">Browse by condition</option>
        <option value="test">Browse by investigation</option>
      </select>
    </div>
    <div id="list"></div>
  `;

  const list = root.querySelector('#list');
  const sel = root.querySelector('#mode');
  sel.value = mode;

  const draw = () => {
    const q = root.querySelector('#q').value.trim().toLowerCase();

    if (mode === 'condition') {
      const shown = conditions
        .filter(c => searchMatches(q, c.name, ...c.workup))
        .sort((a, b) => a.name.localeCompare(b.name));

      list.innerHTML = shown.length ? shown.map(c => `
        <details class="alt">
          <summary>
            <span class="pill ${pillClass(c.acuity)}">${esc(ACUITY_LABEL[c.acuity])}</span>
            <span class="alt-name">${esc(c.name)}</span>
            <span class="alt-share">${c.workup.length} test${c.workup.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <ol class="workup">
              ${c.workup.map((w, i) => `<li><span class="n">${i + 1}</span><span>${esc(w)}</span></li>`).join('')}
            </ol>
            <div class="btn-row" style="margin-top:12px">
              <button class="btn btn-ghost small" data-id="${esc(c.id)}">Full condition detail</button>
            </div>
          </div>
        </details>`).join('')
        : '<div class="empty">Nothing matches that search.</div>';

    } else {
      const shown = tests.filter(t => searchMatches(q, t.test, ...t.conditions.map(c => c.name)));

      list.innerHTML = shown.length ? shown.map(t => `
        <details class="alt">
          <summary>
            <span class="alt-name">${esc(t.test)}</span>
            <span class="alt-share">${t.count} condition${t.count === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <p class="small muted" style="margin:0 0 10px">Used in the workup of:</p>
            <div class="chips">
              ${t.conditions.map(c => `
                <button class="pill ${pillClass(c.acuity)}" data-id="${esc(c.id)}"
                        style="cursor:pointer">${esc(c.name)}</button>`).join('')}
            </div>
          </div>
        </details>`).join('')
        : '<div class="empty">Nothing matches that search.</div>';
    }
  };

  draw();
  root.querySelector('#q').addEventListener('input', draw);
  sel.addEventListener('change', e => { mode = e.target.value; draw(); });

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const c = conditions.find(x => x.id === btn.dataset.id);
    if (c) openModal(detailHTML(c, evMap));
  });
}
