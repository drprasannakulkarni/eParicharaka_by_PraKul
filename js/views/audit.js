/* Model audit: where clinical review time is best spent.
 *
 * The evidence matrix is 2,509 rows. Reviewing it in alphabetical order spends
 * the same effort on a number that cannot change an answer as on one that
 * decides a diagnosis. This ranks conditions by how exposed they are to a wrong
 * estimate, using three things that are checkable rather than a single opaque
 * score:
 *
 *   Pinned ratios    findings whose likelihood ratio hit the clamp ceiling.
 *                    The clamp fires when a sensitivity is high and the finding
 *                    is rare, which is exactly where an over-confident estimate
 *                    hides — and those findings carry the most weight.
 *   Evidence breadth how many findings actually support the condition. A
 *                    diagnosis resting on seven is more fragile than one
 *                    resting on twenty-five.
 *   Nearest rival    the condition with the most similar finding profile. High
 *                    similarity is where the model will confuse two diagnoses,
 *                    and where a small error in either one flips the answer.
 *
 * Concentration is reported too, but it turned out uniformly low: no condition
 * here rests on a single finding. That is a result worth stating rather than a
 * dial worth watching.
 */
import { loadConditions, loadEvidence, loadMeta } from '../data.js';
import { esc, pillClass, ACUITY_LABEL, openModal } from '../ui.js';
import { detailHTML } from './conditions.js';

const CLAMP_HI = 49.9;      // build.py clamps LR+ at 50
const THIN = 10;            // fewer supportive findings than this reads as thin
const SIM_HIGH = 0.75;
const SIM_MED = 0.65;

const BANDS = [
  { min: 5, cls: 'pill-crit', label: 'Review first' },
  { min: 3, cls: 'pill-high', label: 'Review soon' },
  { min: 1, cls: 'pill-mod',  label: 'Worth a look' },
  { min: 0, cls: 'pill-low',  label: 'Low exposure' },
];
const band = n => BANDS.find(b => n >= b.min);

export async function render(root) {
  const [conditions, evidence, meta] = await Promise.all([
    loadConditions(), loadEvidence(), loadMeta(),
  ]);
  const evMap = new Map(evidence.map(e => [e.id, e]));
  const isDemo = id => evMap.get(id)?.kind === 'demographic';

  // finding profile per condition, demographics excluded: age and sex are
  // present in every record and would make everything look alike
  const profile = new Map(conditions.map(c => [
    c.id, Object.entries(c.sens || {}).filter(([k]) => !isDemo(k)),
  ]));
  const norm = new Map([...profile].map(([id, v]) => [
    id, Math.sqrt(v.reduce((s, [, x]) => s + x * x, 0)) || 1,
  ]));

  const cosine = (a, b) => {
    const va = new Map(profile.get(a.id));
    let dot = 0;
    for (const [k, x] of profile.get(b.id)) dot += (va.get(k) || 0) * x;
    return dot / (norm.get(a.id) * norm.get(b.id));
  };

  const rows = conditions.map(c => {
    // The chief complaint is excluded: every candidate has it by definition, so
    // its ratios say nothing about this condition in particular.
    const entries = Object.entries(c.lr)
      .filter(([k]) => !isDemo(k) && !c.chiefComplaints.includes(k));
    // Only the LR+ ceiling counts. A finding at the LR- floor is usually just a
    // near-universal symptom whose absence is unsurprising -- real, but not the
    // over-confidence risk this column is about.
    const pinned = entries.filter(([, lr]) => lr[0] >= CLAMP_HI);
    const supportive = entries.filter(([, lr]) => lr[0] > 1.2);

    const weights = supportive.map(([, lr]) => Math.abs(Math.log(lr[0]))).sort((x, y) => y - x);
    const totalW = weights.reduce((s, x) => s + x, 0) || 1;
    const concentration = weights.length ? weights[0] / totalW : 0;

    let rival = null, sim = 0;
    for (const other of conditions) {
      if (other.id === c.id) continue;
      if (!c.chiefComplaints.some(cc => other.chiefComplaints.includes(cc))) continue;
      const s = cosine(c, other);
      if (s > sim) { sim = s; rival = other; }
    }

    const score = pinned.length * 2
                + (sim >= SIM_HIGH ? 2 : sim >= SIM_MED ? 1 : 0)
                + (supportive.length < THIN ? 1 : 0);

    return {
      c, pinned, supportive: supportive.length, concentration,
      rival, sim, score,
      pinnedNames: pinned.map(([k]) => evMap.get(k)?.label || k),
    };
  }).sort((a, b) => b.score - a.score || b.sim - a.sim);

  const counts = BANDS.map(b => ({
    ...b, n: rows.filter(r => band(r.score).label === b.label).length,
  }));
  const totalPinned = rows.reduce((s, r) => s + r.pinned.length, 0);
  const maxConc = Math.max(...rows.map(r => r.concentration));

  root.innerHTML = `
    <h2 class="section">Model audit</h2>
    <p class="lede">
      Where a wrong number would actually change an answer, so clinical review
      starts with the ${counts[0].n + counts[1].n} conditions that matter rather
      than working through ${conditions.length} in alphabetical order.
    </p>

    <div class="card" style="margin-bottom:16px">
      <p class="eyebrow">Review priority</p>
      <div class="chips">
        ${counts.map(b => `<span class="pill ${b.cls}">${esc(b.label)}: ${b.n}</span>`).join('')}
      </div>
      <dl class="kv" style="margin-top:16px">
        <dt>Ratios at the clamp</dt>
        <dd>${totalPinned} findings across ${rows.filter(r => r.pinned.length).length} conditions</dd>
        <dt>Highest concentration</dt>
        <dd>${maxConc.toFixed(2)} — no condition rests on a single finding</dd>
        <dt>Most confusable pair</dt>
        <dd>${esc(rows.slice().sort((a, b) => b.sim - a.sim)[0].c.name)} and
            ${esc(rows.slice().sort((a, b) => b.sim - a.sim)[0].rival?.name || '—')}
            (${rows.slice().sort((a, b) => b.sim - a.sim)[0].sim.toFixed(2)})</dd>
      </dl>
      <p class="small muted" style="margin:14px 0 0">
        A pinned ratio means a finding hit the LR+ ceiling of 50 the build imposes:
        the sensitivity was high against a finding rare enough that the ratio ran
        away. Those are the estimates most
        likely to be over-stated and the ones carrying most weight, so they are
        worth checking first.
      </p>
    </div>

    <div class="toolbar">
      <input class="field" id="aq" type="search" placeholder="Search a condition" autocomplete="off">
      <select class="field" id="aband">
        <option value="">All priorities</option>
        ${BANDS.map(b => `<option>${esc(b.label)}</option>`).join('')}
      </select>
    </div>

    <details class="alt" style="margin-bottom:16px">
      <summary><span class="alt-name">How the ranking works, and what it cannot do</span></summary>
      <div class="alt-body">
        <h4 class="eyebrow" style="margin:0 0 8px">The model</h4>
        <p class="small">
          Each condition records how often a finding occurs in it. That becomes a
          likelihood ratio against how common the finding is <em>within the presenting
          complaint</em>: LR+ = sensitivity ÷ background, LR− = (1 − sensitivity) ÷
          (1 − background). Answers multiply into a running posterior and the shortlist
          is a softmax over the log-posteriors.
        </p>
        <p class="small">
          Because absence carries its own ratio, a <em>no</em> is informative: not having
          chest-wall tenderness raises the odds of cardiac pain rather than counting for
          nothing. Ratios are clamped to ${meta.model.lrClamp[0]}–${meta.model.lrClamp[1]},
          so no single self-reported answer can dominate. A finding a condition says
          nothing about contributes nothing — silence means “no information”, never “the
          patient does not have it”.
        </p>
        <p class="small">
          Red-flag rules sit outside the model and are deterministic. A fired rule always
          sets the urgency shown and can never be suppressed by a low ranking, because the
          cost of missing meningitis is not symmetric with the cost of a false alarm.
        </p>

        <h4 class="eyebrow" style="margin:18px 0 8px">Limitations</h4>
        <ul class="reasons" style="gap:10px">
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>The frequencies are authored estimates</b>, calibrated to typical
            primary-care presentation rather than extracted from one named cohort. They
            are pending formal clinical sign-off.
          </span></li>
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>Findings are treated as independent</b>, which is not strictly true —
            breathlessness and fast breathing travel together and get double-counted.
          </span></li>
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>The percentage is a share of the shortlist</b>, not a calibrated risk of
            disease.
          </span></li>
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>Backgrounds are derived, not measured</b> — computed from the model's own
            sensitivities, so they inherit any error in them.
          </span></li>
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>Coverage is adult general practice and urgent care.</b> Paediatrics appears
            only where it dominates a presentation.
          </span></li>
          <li><span class="tick" aria-hidden="true">•</span><span>
            <b>It cannot examine anyone.</b> No tool working from self-reported answers
            substitutes for being seen.
          </span></li>
        </ul>

        <h4 class="eyebrow" style="margin:18px 0 8px">Dataset</h4>
        <dl class="kv">
          <dt>Version</dt><dd>${esc(meta.version)}</dd>
          <dt>Built</dt><dd>${esc(meta.generated)}</dd>
          <dt>Conditions</dt><dd>${meta.counts.conditions}</dd>
          <dt>Clinical findings</dt><dd>${meta.counts.evidence}</dd>
          <dt>Evidence links</dt><dd>${meta.counts.evidenceLinks.toLocaleString()}</dd>
          <dt>Questions</dt><dd>${meta.counts.questions} (${meta.counts.answerOptions} options)</dd>
          <dt>Red-flag rules</dt><dd>${meta.counts.redFlags}</dd>
          <dt>Examination steps</dt><dd>${meta.counts.examSteps}</dd>
          <dt>Investigations</dt><dd>${meta.counts.investigations}</dd>
          <dt>Resource links</dt><dd>${meta.counts.resourceLinks} (verified to resolve)</dd>
          <dt>Integrity hash</dt>
          <dd style="word-break:break-all;font-size:.76rem">${esc(meta.sourceSha256)}</dd>
        </dl>
        <p class="small muted" style="margin-top:14px">${esc(meta.disclaimer)}</p>
      </div>
    </details>

    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Condition</th>
            <th style="width:110px">Priority</th>
            <th>Ratios at the clamp</th>
            <th>Most confusable with</th>
            <th style="width:88px">Support</th>
          </tr>
        </thead>
        <tbody id="abody"></tbody>
      </table>
    </div>
  `;

  const body = root.querySelector('#abody');
  const draw = () => {
    const q = root.querySelector('#aq').value.trim().toLowerCase();
    const sel = root.querySelector('#aband').value;
    const shown = rows.filter(r =>
      (!q || r.c.name.toLowerCase().includes(q)) &&
      (!sel || band(r.score).label === sel));

    body.innerHTML = shown.length ? shown.map(r => {
      const b = band(r.score);
      return `
        <tr data-id="${esc(r.c.id)}" style="cursor:pointer">
          <td>
            <strong>${esc(r.c.name)}</strong><br>
            <span class="small muted">${esc(r.c.specialty)}</span>
            <span class="pill ${pillClass(r.c.acuity)}" style="margin-left:6px">${esc(ACUITY_LABEL[r.c.acuity])}</span>
          </td>
          <td><span class="pill ${b.cls}">${esc(b.label)}</span></td>
          <td>
            ${r.pinned.length
              ? `<strong>${r.pinned.length}</strong><br><span class="small muted">${esc(r.pinnedNames.slice(0, 3).join('; '))}</span>`
              : '<span class="small muted">none</span>'}
          </td>
          <td>
            ${r.rival ? `${esc(r.rival.name)}<br><span class="small muted">similarity ${r.sim.toFixed(2)}</span>`
                      : '<span class="small muted">—</span>'}
          </td>
          <td>
            ${r.supportive}<br>
            <span class="small muted">${r.supportive < THIN ? 'thin' : 'broad'}</span>
          </td>
        </tr>`;
    }).join('') : '<tr><td colspan="5"><div class="empty">Nothing matches.</div></td></tr>';
  };

  draw();
  root.querySelector('#aq').addEventListener('input', draw);
  root.querySelector('#aband').addEventListener('change', draw);

  body.addEventListener('click', e => {
    const tr = e.target.closest('[data-id]');
    if (!tr) return;
    const c = conditions.find(x => x.id === tr.dataset.id);
    if (c) openModal(detailHTML(c, evMap));
  });
}
