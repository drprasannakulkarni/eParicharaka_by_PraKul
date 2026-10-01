/* Nutrition4U: a nutrient-disease reference library, viewable from either
 * direction --
 *   by condition — what nutrients have an evidence-based role in managing this?
 *   by nutrient  — which conditions is this nutrient recommended for, and why?
 *
 * Same shape as Yoga4U (js/views/yoga4u.js): a reference, not a recommendation
 * engine, independent of the diagnostic flow. Covers the 49 of 136 app
 * conditions with a genuine, evidence-based nutrient management role -- see
 * Coverage_Note in Nutrition_Disease_Database.xlsx for why the other 87 don't
 * have one. Every row here is honestly evidence-tiered (Primary / Adjunctive /
 * Supportive / Limited evidence) and cites a named source. */
import { loadConditions, loadEvidence, loadNutrition } from '../data.js';
import { esc, pillClass, ACUITY_LABEL, openModal } from '../ui.js';
import { detailHTML, ensureSelfCareLoaded, ensureNutritionLoaded } from './conditions.js';

let mode = 'condition';

const ROLE_PILL = {
  'Primary': 'pill-low',
  'Adjunctive': 'pill-info',
  'Supportive': '',
  'Limited evidence': 'pill-mod',
};

export async function render(root) {
  const [conditions, evidence, nutritionMap] = await Promise.all([
    loadConditions(), loadEvidence(), loadNutrition(), ensureSelfCareLoaded(), ensureNutritionLoaded(),
  ]);
  const evMap = new Map(evidence.map(e => [e.id, e]));
  const condById = new Map(conditions.map(c => [c.id, c]));

  const entries = Object.values(nutritionMap)
    .filter(e => condById.has(e.conditionId))
    .sort((a, b) => a.condition.localeCompare(b.condition));

  // Inverted index: nutrient name -> { name, category, conditions: [...] }
  const nutrientMap = new Map();
  for (const e of entries) {
    for (const n of e.nutrients) {
      const key = n.nutrient.toLowerCase();
      if (!nutrientMap.has(key)) nutrientMap.set(key, { name: n.nutrient, category: n.category, rows: [] });
      nutrientMap.get(key).rows.push({ ...n, conditionId: e.conditionId, condition: e.condition,
        specialty: e.specialty, acuity: e.acuity });
    }
  }
  const nutrients = [...nutrientMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <h2 class="section">Nutrition4U</h2>
    <p class="lede">
      ${entries.length} conditions, ${nutrients.length} nutrients with a genuine, evidence-based
      management role — never a replacement for standard medical treatment. Look up a condition to
      see what to eat and why, or a nutrient to see which conditions it's recommended for.
    </p>
    <div class="toolbar">
      <input class="field" id="q" type="search" placeholder="Search a condition or a nutrient, e.g. zinc, iron, fibre" autocomplete="off">
      <select class="field" id="mode">
        <option value="condition">Browse by condition</option>
        <option value="nutrient">Browse by nutrient</option>
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
      const shown = entries.filter(e => !q || e.condition.toLowerCase().includes(q) ||
                                        e.nutrients.some(n => n.nutrient.toLowerCase().includes(q)));

      list.innerHTML = shown.length ? shown.map(e => `
        <details class="alt">
          <summary>
            <span class="pill ${pillClass(e.acuity)}">${esc(ACUITY_LABEL[e.acuity] || e.acuity)}</span>
            <span class="alt-name">${esc(e.condition)}</span>
            <span class="alt-share">${e.nutrients.length} nutrient${e.nutrients.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <p class="small muted" style="margin:0 0 10px">${esc(e.specialty)}</p>
            <div class="chips" style="margin-bottom:10px">
              ${e.nutrients.map(n => `<span class="pill ${ROLE_PILL[n.role] || ''}">${esc(n.nutrient)} · ${esc(n.role)}</span>`).join('')}
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost small" data-id="${esc(e.conditionId)}">Full condition detail</button>
            </div>
          </div>
        </details>`).join('')
        : '<div class="empty">Nothing matches that search.</div>';

    } else {
      const shown = nutrients.filter(n => !q || n.name.toLowerCase().includes(q) ||
                                          n.rows.some(r => r.condition.toLowerCase().includes(q)));

      list.innerHTML = shown.length ? shown.map(n => `
        <details class="alt">
          <summary>
            <span class="alt-name">${esc(n.name)}</span>
            <span class="alt-share">${n.rows.length} condition${n.rows.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <p class="small muted" style="margin:0 0 10px">${esc(n.category)} · commonly recommended for:</p>
            <div class="chips">
              ${n.rows.map(r => `
                <button class="pill ${ROLE_PILL[r.role] || ''}" data-id="${esc(r.conditionId)}"
                        style="cursor:pointer" title="${esc(r.role)}">${esc(r.condition)}</button>`).join('')}
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
    const c = condById.get(btn.dataset.id);
    if (c) openModal(detailHTML(c, evMap));
  });
}
