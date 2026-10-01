/* Symptoms A–Z: the evidence matrix read the other way round.
 *
 * Conditions A–Z answers "what does this diagnosis look like". This answers the
 * question a physician asks at least as often: "who gets this symptom, and when
 * does it actually mean something".
 *
 * Two orderings, because they are different questions and people conflate them:
 *
 *   Most often seen in   ranked by sensitivity. Nausea is present in most of
 *                        these conditions, which is exactly why it is nearly
 *                        useless on its own.
 *   Most suggestive of   ranked by likelihood ratio. A finding can occur in a
 *                        fifth of cases and still be the one that decides the
 *                        diagnosis, and sorting by frequency buries it.
 *
 * Everything here is derived from data already loaded for other tabs, so it
 * costs no extra fetch.
 */
import { loadConditions, loadEvidence } from '../data.js';
import { esc, pillClass, ACUITY_LABEL, openModal } from '../ui.js';
import { searchMatches } from '../search.js';
import { detailHTML, ensureSelfCareLoaded, ensureNutritionLoaded } from './conditions.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const KIND_LABEL = {
  symptom: 'Symptom', sign: 'Examination finding', modifier: 'Character or timing',
  lab: 'Test result', risk: 'Risk factor', history: 'Past history',
  demographic: 'Patient profile',
};

const SYSTEM_LABEL = {
  cardio: 'Heart and circulation', resp: 'Chest and breathing',
  neuro: 'Brain and nerves', gi: 'Stomach and digestion',
  gu: 'Urinary and genital', msk: 'Bones, joints and muscles',
  derm: 'Skin', eye: 'Eyes', ent: 'Ear, nose and throat',
  psych: 'Mood and mental health', endo: 'Hormones', heme: 'Blood',
  general: 'General and whole-body', lab: 'Investigations',
  temporal: 'Timing', severity: 'Severity', history: 'History',
  demographic: 'Patient profile',
};

let INDEX = null;   // built once: evidence -> conditions that feature it

export async function render(root) {
  const [conditions, evidence] = await Promise.all([loadConditions(), loadEvidence(), ensureSelfCareLoaded(), ensureNutritionLoaded()]);
  if (!INDEX) INDEX = buildIndex(conditions, evidence);
  bindSymptomModal(conditions, new Map(evidence.map(e => [e.id, e])));

  const systems = [...new Set(INDEX.map(s => s.system))]
    .sort((a, b) => (SYSTEM_LABEL[a] || a).localeCompare(SYSTEM_LABEL[b] || b));
  const kinds = [...new Set(INDEX.map(s => s.kind))].sort();

  root.innerHTML = `
    <h2 class="section">Symptoms A–Z</h2>
    <p class="lede">
      Every finding the engine reasons about, and which conditions feature it.
      Sort by how often a symptom occurs, or by how much it actually shifts the
      diagnosis — they are rarely the same list.
    </p>

    <div class="toolbar">
      <input class="field" id="sq" type="search"
             placeholder="Search a symptom, e.g. vomiting, gait, indigestion" autocomplete="off">
      <select class="field" id="ssys">
        <option value="">All body systems</option>
        ${systems.map(s => `<option value="${esc(s)}">${esc(SYSTEM_LABEL[s] || s)}</option>`).join('')}
      </select>
      <select class="field" id="skind">
        <option value="">All kinds</option>
        ${kinds.map(k => `<option value="${esc(k)}">${esc(KIND_LABEL[k] || k)}</option>`).join('')}
      </select>
    </div>

    <p class="small muted" id="scount" style="margin:-6px 0 14px"></p>
    <nav class="az-nav" id="saznav"></nav>
    <div id="slist"></div>
  `;

  const list = root.querySelector('#slist');
  const nav = root.querySelector('#saznav');
  const count = root.querySelector('#scount');

  const draw = () => {
    const q = root.querySelector('#sq').value.trim().toLowerCase();
    const sys = root.querySelector('#ssys').value;
    const kind = root.querySelector('#skind').value;

    const shown = INDEX.filter(s =>
      (!sys || s.system === sys) &&
      (!kind || s.kind === kind) &&
      searchMatches(q, s.label, s.layman, ...s.synonyms));

    count.textContent = `${shown.length} of ${INDEX.length} findings`;

    if (!shown.length) {
      nav.innerHTML = '';
      list.innerHTML = `<div class="empty">
        <p>Nothing matches that.</p>
        <p class="small">If a symptom you expect is missing, it is not yet modelled —
        the coverage gaps are listed on the Model audit tab.</p></div>`;
      return;
    }

    const groups = new Map();
    for (const s of shown) {
      const L = s.label[0].toUpperCase();
      if (!groups.has(L)) groups.set(L, []);
      groups.get(L).push(s);
    }

    nav.innerHTML = LETTERS.map(L => groups.has(L)
      ? `<a href="#sym-${L}">${L}</a>`
      : `<a aria-disabled="true" style="opacity:.3;pointer-events:none">${L}</a>`).join('');

    list.innerHTML = [...groups.entries()].map(([L, items]) => `
      <h3 class="az-letter" id="sym-${L}">${L}</h3>
      ${items.map(s => `
        <button class="row" data-sym="${esc(s.id)}">
          <span class="row-main">
            <strong>${esc(s.label)}</strong>
            <span>${esc(KIND_LABEL[s.kind] || s.kind)} · ${esc(SYSTEM_LABEL[s.system] || s.system)}${
              s.entry ? ' · can start a check' : ''}</span>
          </span>
          <span class="pill">${s.conditions.length} condition${s.conditions.length === 1 ? '' : 's'}</span>
        </button>`).join('')}
    `).join('');
  };

  draw();
  root.querySelector('#sq').addEventListener('input', draw);
  root.querySelector('#ssys').addEventListener('change', draw);
  root.querySelector('#skind').addEventListener('change', draw);

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-sym]');
    if (!btn) return;
    const s = INDEX.find(x => x.id === btn.dataset.sym);
    if (s) openModal(symptomHTML(s, conditions));
  });
}

/* Looks up (or lazily builds) one symptom's own detail panel by evidence id --
 * used by ui.js's symptom in-text linking (a Sanskrit term's symptom meaning,
 * e.g. "fever", clicking straight through to the biomedical Symptoms A-Z entry
 * for Fever) so that feature never has to duplicate buildIndex/symptomHTML. */
export function findSymptomHTML(evId, conditions, evidence) {
  if (!INDEX) INDEX = buildIndex(conditions, evidence);
  const s = INDEX.find(x => x.id === evId);
  return s ? symptomHTML(s, conditions) : null;
}

/* The label list ui.js needs to build its text-scanning index -- only evidence
 * entries that actually resolve to something (buildIndex already drops
 * demographics and anything tied to zero conditions), so a rendered link is
 * never a dead end.
 *
 * Restricted to kind "symptom"/"sign" (genuine named findings, not "modifier"
 * character/timing qualifiers like sharp/dull/intermittent), and to each
 * entry's own LABEL only -- no synonyms. Both restrictions came from real
 * false positives caught in testing: EV_ABD_DIFFUSE's bare synonym
 * "generalised" matched inside "generalised bodyache" (an unrelated Amavata
 * symptom using the same everyday adjective), and EV_JOINT_LOCKING's bare
 * synonym "catching" matched inside "catching sensation" describing the jaw,
 * abdomen and pelvis -- nothing to do with a joint locking. Synonyms exist for
 * loose, forgiving *search* matching on the Symptoms A-Z tab itself; a label
 * is the finding's own specific name, which is what free-text scanning needs. */
export function symptomLinkEntries(conditions, evidence) {
  if (!INDEX) INDEX = buildIndex(conditions, evidence);
  return INDEX.filter(s => s.kind === 'symptom' || s.kind === 'sign')
    .map(s => ({ id: s.id, label: s.label, synonyms: [] }));
}

function buildIndex(conditions, evidence) {
  const byEv = new Map();
  for (const c of conditions) {
    for (const [id, sens] of Object.entries(c.sens || {})) {
      if (sens <= 0) continue;
      if (!byEv.has(id)) byEv.set(id, []);
      byEv.get(id).push({
        id: c.id, name: c.name, specialty: c.specialty, acuity: c.acuity,
        sens, lr: c.lr[id]?.[0] ?? 1,
      });
    }
  }
  return evidence
    // Age and sex are not symptoms anyone looks up.
    .filter(e => e.kind !== 'demographic')
    .map(e => ({
      id: e.id, label: e.label, layman: e.layman, kind: e.kind,
      system: e.system, synonyms: e.synonyms, background: e.background,
      entry: e.isChiefComplaint,
      conditions: (byEv.get(e.id) || []).sort((a, b) => b.sens - a.sens),
    }))
    .filter(s => s.conditions.length)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function symptomHTML(s, conditions) {
  const common = s.conditions.slice(0, 12);
  const telling = [...s.conditions].sort((a, b) => b.lr - a.lr).slice(0, 8);
  const emergencies = s.conditions.filter(c => c.acuity === 'emergency');

  const row = c => `
    <tr data-cond="${esc(c.id)}" style="cursor:pointer">
      <td>${esc(c.name)}<br><span class="small muted">${esc(c.specialty)}</span></td>
      <td><span class="pill ${pillClass(c.acuity)}">${esc(ACUITY_LABEL[c.acuity])}</span></td>
      <td>${Math.round(c.sens * 100)}%</td>
      <td>×${c.lr >= 10 ? Math.round(c.lr) : c.lr.toFixed(1)}</td>
    </tr>`;

  return `
    <h3>${esc(s.label)}</h3>
    <div class="chips" style="margin-bottom:12px">
      <span class="pill">${esc(KIND_LABEL[s.kind] || s.kind)}</span>
      <span class="pill">${esc(SYSTEM_LABEL[s.system] || s.system)}</span>
      ${s.entry ? '<span class="pill pill-low">Can start a symptom check</span>' : ''}
      ${emergencies.length ? `<span class="pill pill-crit">${emergencies.length} emergency cause${emergencies.length === 1 ? '' : 's'}</span>` : ''}
    </div>
    <p>${esc(s.layman)}</p>
    ${s.synonyms.length ? `<p class="small muted">Also called: ${esc(s.synonyms.join(', '))}</p>` : ''}
    <p class="small muted">
      Occurs in about ${Math.round(s.background * 100)}% of everyone presenting to care,
      which is the baseline every ratio below is measured against.
    </p>

    <h4>Most often seen in</h4>
    <p class="small muted" style="margin-bottom:8px">
      Ranked by how many people with that condition have this finding.
    </p>
    <div class="tablewrap">
      <table>
        <thead><tr><th>Condition</th><th style="width:96px">Urgency</th>
          <th style="width:70px">Frequency</th><th style="width:64px">LR+</th></tr></thead>
        <tbody>${common.map(row).join('')}</tbody>
      </table>
    </div>
    ${s.conditions.length > 12
      ? `<p class="small muted" style="margin-top:6px">…and ${s.conditions.length - 12} more.</p>` : ''}

    <h4>Most suggestive of</h4>
    <p class="small muted" style="margin-bottom:8px">
      Ranked by how far this finding shifts the odds. A symptom can be uncommon in
      a condition and still be the thing that points at it.
    </p>
    <div class="tablewrap">
      <table>
        <thead><tr><th>Condition</th><th style="width:96px">Urgency</th>
          <th style="width:70px">Frequency</th><th style="width:64px">LR+</th></tr></thead>
        <tbody>${telling.map(row).join('')}</tbody>
      </table>
    </div>

    ${emergencies.length ? `
      <h4>Emergency causes not to miss</h4>
      <div class="chips">
        ${emergencies.map(c => `<span class="pill pill-crit">${esc(c.name)}</span>`).join('')}
      </div>` : ''}
  `;
}

/* Clicking a condition row inside a symptom panel opens that condition. Bound
 * once on the shared modal rather than per render. */
let bound = false;
export function bindSymptomModal(conditions, evMap) {
  if (bound) return;
  bound = true;
  document.addEventListener('click', e => {
    const tr = e.target.closest('.modal [data-cond]');
    if (!tr) return;
    const c = conditions.find(x => x.id === tr.dataset.cond);
    if (c) openModal(detailHTML(c, evMap));
  });
}
